"""
The finance office against how a school's money actually behaves.

Each test is one thing that used to be true in the books and false in the
safe: a bursary counted as cash, mobile money booked into the cash box, an
expense "paid" that never left any account, tax withheld from salaries that
vanished from the cost of staff.
"""
from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from apps.authentication.factories import UserFactory
from apps.finance import services
from apps.finance.models import (
    CashAccount, CashMovement, Expense, ExpenseCategory, FinanceSettings, PayrollRun, StaffSalary,
)
from apps.finance.test_operations import account, student, term  # noqa: F401 - fixtures
from apps.student.models import Fee

pytestmark = pytest.mark.django_db


def charge(student, term, amount='100000', due_in_days=10, category='tuition'):
    return Fee.objects.create(student=student, term=term, category=category,
                              amount=Decimal(amount),
                              due_date=timezone.localdate() + timedelta(days=due_in_days))


class TestWaivers:
    def test_a_waiver_settles_the_bill_but_puts_no_money_anywhere(self, account, student, term):
        fee = charge(student, term)

        services.record_payment(fee, '40000', method='waiver')

        assert services.balance_of(fee) == Decimal('60000.00')
        assert not CashMovement.objects.exists()
        assert services.account_balance(account) == Decimal('100000.00')

    def test_a_waiver_is_not_collected_and_does_not_count_against_the_rate(
            self, account, student, term):
        fee = charge(student, term)
        services.record_payment(fee, '50000', method='waiver')
        services.record_payment(fee, '25000', method='cash')

        summary = services.collection_summary(term)

        assert summary['collected'] == Decimal('25000.00')
        assert summary['waived'] == Decimal('50000.00')
        assert summary['outstanding'] == Decimal('25000.00')
        # 25,000 of the 50,000 the school can still hope to collect.
        assert summary['collection_rate'] == 50.0


class TestWhereMoneyLands:
    def test_mobile_money_goes_to_the_mobile_account_not_the_safe(self, account, student, term):
        momo = CashAccount.objects.create(name='MoMo till', kind='mobile')
        fee = charge(student, term)

        services.record_payment(fee, '30000', method='momo')

        assert services.account_balance(momo) == Decimal('30000.00')
        assert services.account_balance(account) == Decimal('100000.00')

    def test_a_method_with_no_matching_account_falls_back_to_the_default(
            self, account, student, term):
        fee = charge(student, term)

        services.record_payment(fee, '30000', method='bank')

        assert services.account_balance(account) == Decimal('130000.00')


class TestPayingExpenses:
    def _approved(self, amount='60000', method='cash'):
        category = ExpenseCategory.objects.create(name='Maintenance')
        return Expense.objects.create(category=category, description='Roof repair',
                                      amount=Decimal(amount), status='approved',
                                      method=method)

    def test_paying_an_expense_takes_the_money_out_of_an_account(self, account):
        expense = self._approved('60000')

        services.pay_expense(expense)

        expense.refresh_from_db()
        assert expense.status == 'paid'
        assert services.account_balance(account) == Decimal('40000.00')

    def test_an_expense_the_account_cannot_cover_is_refused(self, account):
        expense = self._approved('250000')

        with pytest.raises(services.FinanceError, match='holds'):
            services.pay_expense(expense)
        expense.refresh_from_db()
        assert expense.status == 'approved'

    def test_the_bursar_pays_it_over_http(self, api_client, account):
        expense = self._approved('10000')
        api_client.force_authenticate(UserFactory(role='bursar'))

        response = api_client.post(f'/imboni/finance/expenses/{expense.id}/decision/',
                                   {'decision': 'paid'})

        assert response.status_code == 200
        assert services.account_balance(account) == Decimal('90000.00')

    def test_the_dashboard_counts_only_what_was_paid_as_spent(self, api_client, account, term):
        category = ExpenseCategory.objects.get_or_create(name='Utilities')[0]
        Expense.objects.create(category=category, description='Water', amount=Decimal('5000'),
                               status='paid', term=term)
        Expense.objects.create(category=category, description='Power', amount=Decimal('7000'),
                               status='approved', term=term)
        api_client.force_authenticate(UserFactory(role='bursar'))

        data = api_client.get('/imboni/finance/dashboard/').data

        assert Decimal(data['expenses']) == Decimal('5000')
        assert Decimal(data['committed']) == Decimal('7000')


class TestGraceDays:
    def test_a_charge_inside_the_grace_period_is_not_overdue(self, student, term):
        settings_row = FinanceSettings.load()
        settings_row.grace_days = 7
        settings_row.save()
        charge(student, term, due_in_days=-3)

        assert services.student_balance(student, term)['overdue'] == Decimal('0.00')

    def test_past_the_grace_period_it_is(self, student, term):
        settings_row = FinanceSettings.load()
        settings_row.grace_days = 7
        settings_row.save()
        charge(student, term, due_in_days=-10)

        assert services.student_balance(student, term)['overdue'] == Decimal('100000.00')


class TestPayrollRemittances:
    def test_tax_and_pension_withheld_are_owed_on_not_forgotten(self, account, term):
        staff = UserFactory(role='teacher')
        StaffSalary.objects.create(staff=staff.staff_record, gross=Decimal('200000'), tax_method='flat',
                                   tax_percent=Decimal('20'), pension_percent=Decimal('6'))
        CashAccount.objects.filter(pk=account.pk).update(opening_balance=Decimal('500000'))
        account.refresh_from_db()
        run = PayrollRun.objects.create(period_month=9, period_year=2026,
                                        prepared_by=UserFactory(role='bursar'))
        services.build_payroll(run)
        services.approve_payroll(run, approved_by=UserFactory(role='admin'))

        services.pay_payroll(run, account=account)

        run.refresh_from_db()
        assert run.expense.amount == Decimal('148000.00')          # net, paid now
        owed = Expense.objects.filter(status='approved', category__name='Salaries')
        assert {e.description.split(':')[0]: e.amount for e in owed} == {
            'PAYE withheld': Decimal('40000.00'),
            'Pension withheld': Decimal('12000.00'),
        }
        # Only the net has left the account; the rest goes when it is remitted.
        assert services.account_balance(account) == Decimal('352000.00')


class TestOneSumAcrossCharges:
    """A parent hands over one sum; it settles several charges on one receipt."""

    def _charges(self, student, term):
        arrears = charge(student, term, '30000', due_in_days=-40, category='arrears')
        tuition = charge(student, term, '100000', due_in_days=-5)
        lunch = charge(student, term, '40000', due_in_days=10, category='lunch')
        return arrears, tuition, lunch

    def test_the_oldest_charge_is_settled_first_and_the_rest_flows_on(
            self, account, student, term):
        arrears, tuition, lunch = self._charges(student, term)

        lines = services.record_split_payment(student, '150000', method='cash')

        assert [(line.fee_id, line.amount) for line in lines] == [
            (arrears.id, Decimal('30000.00')),
            (tuition.id, Decimal('100000.00')),
            (lunch.id, Decimal('20000.00')),
        ]
        assert len({line.receipt_no for line in lines}) == 1
        lunch.refresh_from_db()
        assert lunch.status == 'partial'
        # One sum handed over, one movement into the safe.
        assert CashMovement.objects.filter(kind='fee').count() == 1
        assert services.account_balance(account) == Decimal('250000.00')

    def test_the_bursar_can_say_where_it_goes(self, account, student, term):
        arrears, tuition, lunch = self._charges(student, term)

        lines = services.record_split_payment(student, '50000', [
            {'fee': str(lunch.id), 'amount': '40000'},
            {'fee': str(tuition.id), 'amount': '10000'},
        ])

        assert {line.fee_id: line.amount for line in lines} == {
            lunch.id: Decimal('40000.00'), tuition.id: Decimal('10000.00')}
        assert services.balance_of(arrears) == Decimal('30000.00')

    def test_allocations_have_to_add_up(self, student, term):
        _, tuition, _ = self._charges(student, term)

        with pytest.raises(services.FinanceError, match='add up'):
            services.record_split_payment(student, '50000', [
                {'fee': str(tuition.id), 'amount': '20000'}])

    def test_more_than_the_family_owes_is_refused(self, student, term):
        self._charges(student, term)

        with pytest.raises(services.FinanceError, match='owes in total'):
            services.record_split_payment(student, '500000')

    def test_the_next_receipt_counts_receipts_not_rows(self, account, student, term):
        self._charges(student, term)
        first = services.record_split_payment(student, '150000')
        second = services.record_split_payment(student, '1000')

        assert first[0].receipt_no == 'RCT-00001'
        assert second[0].receipt_no == 'RCT-00002'

    def test_reversing_the_receipt_reverses_every_charge_on_it(self, account, student, term):
        arrears, tuition, _ = self._charges(student, term)
        lines = services.record_split_payment(student, '130000')

        services.reverse_payment(lines[1], reason='Cheque bounced')

        assert services.balance_of(arrears) == Decimal('30000.00')
        assert services.balance_of(tuition) == Decimal('100000.00')
        assert services.account_balance(account) == Decimal('100000.00')

    def test_over_http_with_a_printable_receipt(self, api_client, account, student, term):
        self._charges(student, term)
        api_client.force_authenticate(UserFactory(role='bursar'))

        response = api_client.post('/imboni/finance/payments/record/', {
            'student': str(student.id), 'amount': '60000', 'method': 'cash',
        }, format='json')

        assert response.status_code == 201
        assert response.data['total'] == '60000.00'
        assert len(response.data['payments']) == 2
        pdf = api_client.get(f"/imboni/finance/payments/{response.data['payment']['id']}/receipt/")
        assert pdf.status_code == 200


class TestPayeBands:
    def test_each_band_taxes_only_its_own_slice(self):
        # 0 on 60k, 10% of 40k, 20% of 100k, 30% of 50k.
        assert services.paye_tax('250000') == Decimal('39000.00')

    def test_pay_under_the_threshold_is_not_taxed(self):
        assert services.paye_tax('60000') == Decimal('0.00')
        assert services.paye_tax('80000') == Decimal('2000.00')

    def test_allowances_are_taxed_under_paye_but_not_pensioned(self):
        staff = UserFactory(role='teacher')
        salary = StaffSalary.objects.create(staff=staff.staff_record, gross=Decimal('200000'),
                                            allowances=Decimal('50000'),
                                            pension_percent=Decimal('6'))

        figures = services.payslip_figures(salary)

        assert salary.tax_method == 'paye'
        assert figures['tax'] == Decimal('39000.00')
        assert figures['pension'] == Decimal('12000.00')
        assert figures['net'] == Decimal('199000.00')

    def test_the_school_can_change_the_bands(self):
        settings_row = FinanceSettings.load()
        settings_row.paye_bands = [{'upto': 100000, 'rate': 0}, {'upto': None, 'rate': 25}]
        settings_row.save()

        assert services.paye_tax('200000') == Decimal('25000.00')

    def test_a_band_table_without_an_open_top_is_refused(self, api_client):
        api_client.force_authenticate(UserFactory(role='bursar'))

        response = api_client.put('/imboni/finance/settings/', {
            'paye_bands': [{'upto': 60000, 'rate': 0}, {'upto': 100000, 'rate': 10}],
        }, format='json')

        assert response.status_code == 400


class TestIncomeAndExpenditure:
    def test_every_source_of_money_is_on_the_statement(self, api_client, account, student, term):
        from apps.finance.models import IncomeCategory

        fee = charge(student, term, '100000')
        services.record_payment(fee, '60000', method='cash')
        services.record_payment(fee, '10000', method='waiver')
        grant = IncomeCategory.objects.get(name='Capitation grant')
        services.record_income(grant, '250000', description='Term 2 grant', term=term)
        category = ExpenseCategory.objects.get_or_create(name='Utilities')[0]
        Expense.objects.create(category=category, description='Water', amount=Decimal('40000'),
                               status='paid', term=term)
        Expense.objects.create(category=category, description='Power', amount=Decimal('9000'),
                               status='approved', term=term)
        api_client.force_authenticate(UserFactory(role='bursar'))

        data = api_client.get('/imboni/finance/report/').data

        assert data['fees_in'] == '60000.00'          # the waiver is not money
        assert data['other_in'] == '250000.00'
        assert data['income_total'] == '310000.00'
        assert data['expenses'] == '40000.00'         # approved is not spent
        assert data['committed'] == '9000.00'
        assert data['net'] == '270000.00'
        labels = {line['label'] for line in data['income']}
        assert {'Tuition', 'Capitation grant'} <= labels

    def test_the_statement_prints_and_exports(self, api_client, term):
        api_client.force_authenticate(UserFactory(role='bursar'))

        assert api_client.get('/imboni/finance/report/?format=pdf')['Content-Type'] == 'application/pdf'
        csv = api_client.get('/imboni/finance/report/?format=csv')
        assert 'Surplus / deficit' in csv.content.decode()


class TestExportsAnswer:
    """Every Print and Export button 404'd: DRF claimed `?format=` for itself."""

    @pytest.mark.parametrize('path', [
        'fees/', 'payments/', 'debtors/', 'expenses/', 'cash/', 'income/', 'arrears/', 'salaries/',
    ])
    def test_csv(self, api_client, term, path):
        api_client.force_authenticate(UserFactory(role='bursar'))
        response = api_client.get(f'/imboni/finance/{path}?format=csv')
        assert response.status_code == 200
        assert response['Content-Type'].startswith('text/csv')

    @pytest.mark.parametrize('path', ['fees/', 'payments/', 'debtors/', 'expenses/', 'cash/'])
    def test_pdf(self, api_client, term, path):
        api_client.force_authenticate(UserFactory(role='bursar'))
        response = api_client.get(f'/imboni/finance/{path}?format=pdf')
        assert response.status_code == 200
        assert response['Content-Type'] == 'application/pdf'


class TestASectionFiltersItsYears:
    """Choosing "A-Level" in the class picker sends every A-Level year."""

    def test_charges_for_several_years(self, api_client, term):
        from apps.authentication.factories import StudentFactory
        for grade in ('S1', 'S4', 'S5'):
            Fee.objects.create(student=StudentFactory(grade=grade, section='A'), term=term,
                               category='tuition', amount=Decimal('1000'),
                               due_date=timezone.localdate())
        api_client.force_authenticate(UserFactory(role='bursar'))

        rows = api_client.get('/imboni/finance/fees/?grade=S4,S5').data
        rows = rows.get('results', rows) if isinstance(rows, dict) else rows

        assert sorted(r['student']['class_label'] for r in rows) == ['S4A', 'S5A']
