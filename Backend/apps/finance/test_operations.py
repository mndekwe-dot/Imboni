"""
The finance office beyond the fee cycle: cash, income, arrears, budget, payroll.

Each section is one thing a school actually does with money, and the tests are
about the rules rather than the plumbing -- what refuses, what is idempotent,
and what must never quietly happen.
"""
from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from apps.authentication.factories import StudentFactory, UserFactory
from apps.finance import services
from apps.finance.models import (
    Budget, BudgetLine, CashAccount, CashMovement, Expense, ExpenseCategory,
    IncomeCategory, PayrollRun, StaffSalary,
)
from apps.results.models import AcademicTerm
from apps.student.models import Fee

pytestmark = pytest.mark.django_db

ZERO = Decimal('0.00')


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def term():
    return AcademicTerm.objects.create(name='Term 2 2026', term='2', year=2026,
                                       order=2, is_current=True,
                                       start_date=timezone.localdate() - timedelta(days=30),
                                       end_date=timezone.localdate() + timedelta(days=30))


@pytest.fixture
def older_term():
    return AcademicTerm.objects.create(name='Term 1 2026', term='1', year=2026,
                                       order=1, is_current=False,
                                       start_date=timezone.localdate() - timedelta(days=200),
                                       end_date=timezone.localdate() - timedelta(days=120))


@pytest.fixture
def account():
    return CashAccount.objects.create(name='Safe', kind='cash', is_default=True,
                                      opening_balance=Decimal('100000'))


@pytest.fixture
def bank():
    return CashAccount.objects.create(name='Bank of Kigali', kind='bank')


@pytest.fixture
def student():
    return StudentFactory(grade='S4', section='A',
                          user__first_name='Amina', user__last_name='Uwase')


def a_fee(student, term, amount='100000', **kwargs):
    return Fee.objects.create(student=student, term=term, category='tuition',
                              amount=Decimal(amount),
                              due_date=kwargs.pop('due_date', timezone.localdate()),
                              **kwargs)


# ── Where the money sits ──────────────────────────────────────────────────────

class TestCashAccounts:
    def test_a_balance_is_the_opening_plus_every_movement(self, account):
        services.post_movement(account, 'deposit', Decimal('50000'))
        services.post_movement(account, 'expense', Decimal('-20000'))
        assert services.account_balance(account) == Decimal('130000.00')

    def test_only_one_account_can_be_the_default(self, account, bank):
        bank.is_default = True
        bank.save()
        account.refresh_from_db()
        assert account.is_default is False
        assert services.default_account() == bank

    def test_taking_a_payment_puts_the_money_somewhere(self, student, term, account):
        fee = a_fee(student, term)
        payment = services.record_payment(fee, Decimal('40000'))

        movement = CashMovement.objects.get(payment=payment)
        assert movement.account == account
        assert movement.amount == Decimal('40000.00')
        assert services.account_balance(account) == Decimal('140000.00')

    def test_reversing_takes_it_back_out_without_deleting_the_history(
            self, student, term, account):
        fee = a_fee(student, term)
        payment = services.record_payment(fee, Decimal('40000'))
        services.reverse_payment(payment, reason='wrong charge')

        # Both rows survive: the account has to show money in and then out.
        assert CashMovement.objects.filter(payment=payment).count() == 2
        assert services.account_balance(account) == Decimal('100000.00')

    def test_a_payment_still_works_before_any_account_exists(self, student, term):
        """Cash tracking sits on top of the receipt book, never in front of it."""
        fee = a_fee(student, term)
        payment = services.record_payment(fee, Decimal('10000'))
        assert payment.receipt_no
        assert CashMovement.objects.count() == 0

    def test_a_transfer_writes_both_halves_with_one_group(self, account, bank):
        out, into = services.transfer(account, bank, Decimal('60000'))
        assert out.transfer_group == into.transfer_group
        assert services.account_balance(account) == Decimal('40000.00')
        assert services.account_balance(bank) == Decimal('60000.00')

    def test_a_transfer_refuses_more_than_the_account_holds(self, account, bank):
        with pytest.raises(services.FinanceError, match='only holds'):
            services.transfer(account, bank, Decimal('999999'))

    def test_a_transfer_refuses_to_go_nowhere(self, account):
        with pytest.raises(services.FinanceError, match='two different'):
            services.transfer(account, account, Decimal('10'))

    def test_a_count_records_the_difference_and_does_not_correct_it(self, account):
        row = services.reconcile(account, Decimal('95000'), note='2,000 short')

        assert row.book_balance == Decimal('100000.00')
        assert row.difference == Decimal('-5000.00')
        # The books are untouched: counting is one decision, correcting is
        # another, and doing both at once would make every count agree.
        assert services.account_balance(account) == Decimal('100000.00')


# ── Income that is not school fees ────────────────────────────────────────────

class TestOtherIncome:
    def test_income_lands_in_an_account_without_touching_any_family(
            self, account, student, term):
        category = IncomeCategory.objects.create(name='Canteen')
        entry = services.record_income(category, Decimal('35000'),
                                       description='Week 3 canteen')

        assert services.account_balance(account) == Decimal('135000.00')
        # Crucially, it did not become a payment against anybody's charge.
        assert entry.category == category
        assert services.student_balance(student, term)['paid'] == ZERO

    def test_zero_is_refused(self):
        category = IncomeCategory.objects.create(name='Donation')
        with pytest.raises(services.FinanceError, match='more than zero'):
            services.record_income(category, ZERO)


# ── Arrears ───────────────────────────────────────────────────────────────────

class TestArrears:
    def test_last_terms_debt_is_found(self, student, term, older_term):
        a_fee(student, older_term, '80000')
        assert services.arrears_for(student, before_term=term) == Decimal('80000.00')

    def test_this_terms_debt_is_not_arrears(self, student, term):
        a_fee(student, term, '80000')
        assert services.arrears_for(student, before_term=term) == ZERO

    def test_carrying_forward_raises_one_charge(self, student, term, older_term):
        a_fee(student, older_term, '80000')
        result = services.carry_arrears_forward(term)

        assert result['raised'] == 1
        charge = Fee.objects.get(student=student, term=term, category='arrears')
        assert charge.amount == Decimal('80000.00')

    def test_running_it_twice_does_not_double_the_bill(self, student, term, older_term):
        """The natural response to "did that work?" is to press it again."""
        a_fee(student, older_term, '80000')
        services.carry_arrears_forward(term)
        second = services.carry_arrears_forward(term)

        assert second['raised'] == 0
        assert Fee.objects.filter(student=student, term=term,
                                  category='arrears').count() == 1

    def test_a_settled_family_loses_its_arrears_line(self, student, term, older_term):
        old = a_fee(student, older_term, '80000')
        services.carry_arrears_forward(term)

        services.record_payment(old, Decimal('80000'))
        result = services.carry_arrears_forward(term)

        assert result['cleared'] == 1
        assert not Fee.objects.filter(student=student, term=term,
                                      category='arrears').exists()

    def test_an_arrears_charge_with_money_against_it_is_never_deleted(
            self, student, term, older_term):
        old = a_fee(student, older_term, '80000')
        services.carry_arrears_forward(term)
        arrears = Fee.objects.get(student=student, term=term, category='arrears')
        services.record_payment(arrears, Decimal('20000'))
        services.record_payment(old, Decimal('80000'))

        services.carry_arrears_forward(term)

        # Deleting it would erase the charge a receipt was issued against.
        assert Fee.objects.filter(pk=arrears.pk).exists()


# ── Budget ────────────────────────────────────────────────────────────────────

class TestBudget:
    def test_planned_against_actual(self, term):
        category = ExpenseCategory.objects.create(name='Utilities')
        budget = Budget.objects.create(name='Term 2', term=term)
        BudgetLine.objects.create(budget=budget, category=category,
                                  planned=Decimal('500000'))
        Expense.objects.create(category=category, description='Power',
                               amount=Decimal('320000'), status='paid', term=term)

        report = services.budget_report(budget)
        line = report['lines'][0]

        assert line['planned'] == Decimal('500000.00')
        assert line['actual'] == Decimal('320000.00')
        assert line['variance'] == Decimal('180000.00')
        assert line['over'] is False

    def test_a_pending_expense_is_a_request_not_a_commitment(self, term):
        category = ExpenseCategory.objects.create(name='Repairs')
        budget = Budget.objects.create(name='Term 2', term=term)
        BudgetLine.objects.create(budget=budget, category=category,
                                  planned=Decimal('100000'))
        Expense.objects.create(category=category, description='Roof',
                               amount=Decimal('90000'), status='pending', term=term)

        assert services.budget_report(budget)['lines'][0]['actual'] == ZERO

    def test_spending_on_a_category_nobody_budgeted_still_shows(self, term):
        """Otherwise real spending hides simply by not being in the plan."""
        budget = Budget.objects.create(name='Term 2', term=term)
        rogue = ExpenseCategory.objects.create(name='Transport')
        Expense.objects.create(category=rogue, description='Fuel',
                               amount=Decimal('75000'), status='paid', term=term)

        report = services.budget_report(budget)
        line = next(l for l in report['lines'] if l['category'] == rogue)

        assert line['unbudgeted'] is True
        assert line['actual'] == Decimal('75000.00')
        assert report['actual_total'] == Decimal('75000.00')

    def test_a_zero_planned_line_does_not_divide_by_zero(self, term):
        category = ExpenseCategory.objects.create(name='Sundries')
        budget = Budget.objects.create(name='Term 2', term=term)
        BudgetLine.objects.create(budget=budget, category=category, planned=ZERO)

        assert services.budget_report(budget)['lines'][0]['used_percent'] is None


# ── Payroll ───────────────────────────────────────────────────────────────────

def a_salary(gross='400000', **kwargs):
    staff = UserFactory(role='teacher', **{k: kwargs.pop(k) for k in
                                          list(kwargs) if k in
                                          ('first_name', 'last_name', 'username')})
    return StaffSalary.objects.create(staff=staff, gross=Decimal(gross), **kwargs)


class TestPayroll:
    def test_deductions_come_off_gross_not_off_allowances(self):
        salary = a_salary('400000', allowances=Decimal('50000'),
                          pension_percent=Decimal('5'), tax_percent=Decimal('10'))
        figures = services.payslip_figures(salary)

        assert figures['pension'] == Decimal('20000.00')      # 5% of 400,000
        assert figures['tax'] == Decimal('40000.00')          # 10% of 400,000
        assert figures['net'] == Decimal('390000.00')         # 450,000 - 60,000

    def test_a_run_is_filled_from_the_salary_list(self):
        a_salary('300000')
        a_salary('500000')
        run = PayrollRun.objects.create(period_month=9, period_year=2026)

        assert services.build_payroll(run) == 2
        assert services.payroll_totals(run)['gross'] == Decimal('800000.00')

    def test_the_payslip_freezes_the_figures_it_used(self):
        """Last month's payslip must not change when somebody gets a raise."""
        salary = a_salary('300000')
        run = PayrollRun.objects.create(period_month=9, period_year=2026)
        services.build_payroll(run)

        salary.gross = Decimal('900000')
        salary.save()

        assert run.payslips.first().gross == Decimal('300000.00')

    def test_an_approved_run_cannot_be_rebuilt(self):
        a_salary()
        preparer = UserFactory(role='bursar')
        run = PayrollRun.objects.create(period_month=9, period_year=2026,
                                        prepared_by=preparer)
        services.build_payroll(run)
        services.approve_payroll(run, approved_by=UserFactory(role='admin'))

        with pytest.raises(services.FinanceError, match='draft'):
            services.build_payroll(run)

    def test_whoever_prepared_it_cannot_approve_it(self):
        """A control one person can complete alone is not a control."""
        a_salary()
        preparer = UserFactory(role='bursar')
        run = PayrollRun.objects.create(period_month=9, period_year=2026,
                                        prepared_by=preparer)
        services.build_payroll(run)

        with pytest.raises(services.FinanceError, match='someone other than'):
            services.approve_payroll(run, approved_by=preparer)

    def test_an_empty_run_cannot_be_approved(self):
        run = PayrollRun.objects.create(period_month=9, period_year=2026)
        with pytest.raises(services.FinanceError, match='nothing to approve'):
            services.approve_payroll(run, approved_by=UserFactory(role='admin'))

    def test_paying_writes_one_expense_and_moves_the_cash(self, account, term):
        a_salary('300000')
        run = PayrollRun.objects.create(period_month=9, period_year=2026,
                                        prepared_by=UserFactory(role='bursar'))
        services.build_payroll(run)
        services.approve_payroll(run, approved_by=UserFactory(role='admin'))

        CashAccount.objects.filter(pk=account.pk).update(
            opening_balance=Decimal('500000'))
        account.refresh_from_db()
        services.pay_payroll(run, account=account)

        run.refresh_from_db()
        assert run.status == 'paid'
        # It shows up as an expense like every other outgoing, which is what
        # keeps the "Spent" figure honest.
        assert run.expense.category.name == 'Salaries'
        assert run.expense.amount == Decimal('300000.00')
        assert services.account_balance(account) == Decimal('200000.00')

    def test_paying_refuses_when_the_account_cannot_cover_it(self, account):
        a_salary('900000')
        run = PayrollRun.objects.create(period_month=9, period_year=2026,
                                        prepared_by=UserFactory(role='bursar'))
        services.build_payroll(run)
        services.approve_payroll(run, approved_by=UserFactory(role='admin'))

        with pytest.raises(services.FinanceError, match='holds'):
            services.pay_payroll(run, account=account)

    def test_an_unapproved_run_cannot_be_paid(self, account):
        a_salary('100000')
        run = PayrollRun.objects.create(period_month=9, period_year=2026)
        services.build_payroll(run)

        with pytest.raises(services.FinanceError, match='approved'):
            services.pay_payroll(run, account=account)
