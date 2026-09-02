"""
Finance tests.

The money rules run through `services` directly as well as over HTTP: a
part-payment has to leave a charge 'partial' and a reversal has to put it back,
and driving that through the API would prove only that the endpoint answered.
"""
from datetime import timedelta
from decimal import Decimal

import pytest
from django.db import connection
from django.utils import timezone
from django_tenants.utils import get_public_schema_name, get_tenant_model, schema_context
from rest_framework import status

from apps.authentication.factories import StudentFactory, UserFactory
from apps.finance import services
from apps.finance.models import (
    Expense, ExpenseCategory, FeePayment, FeeStructure, FinanceSettings, StudentAccount,
)
from apps.results.models import AcademicTerm
from apps.student.models import Fee


def make_fee(student=None, amount='50000.00', due_in_days=7, category='tuition', term=None):
    return Fee.objects.create(
        student=student or StudentFactory(),
        category=category,
        amount=Decimal(amount),
        due_date=timezone.localdate() + timedelta(days=due_in_days),
        term=term,
        status='due',
    )


@pytest.fixture
def term():
    return AcademicTerm.objects.create(
        name='Term 2 2026', term='term2', year=2026, order=2,
        start_date=timezone.localdate() - timedelta(days=30),
        end_date=timezone.localdate() + timedelta(days=60), is_current=True,
    )


# ── Plan gating ───────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestPlanGate:
    def _set_plan(self, plan):
        TenantModel = get_tenant_model()
        schema = connection.schema_name
        with schema_context(get_public_schema_name()):
            TenantModel.objects.filter(schema_name=schema).update(plan=plan)
        connection.tenant.plan = plan

    def test_finance_is_closed_on_a_plan_without_it(self, make_authenticated_client):
        client, _ = make_authenticated_client('bursar')
        self._set_plan('basic')
        try:
            response = client.get('/imboni/finance/fees/')
            # 402, not 403: not forbidden, unpaid for.
            assert response.status_code == status.HTTP_402_PAYMENT_REQUIRED
        finally:
            self._set_plan('premium')

    def test_availability_answers_even_off_the_plan(self, make_authenticated_client):
        client, _ = make_authenticated_client('bursar')
        self._set_plan('basic')
        try:
            response = client.get('/imboni/finance/availability/')
            assert response.status_code == status.HTTP_200_OK
            assert response.data['enabled'] is False
        finally:
            self._set_plan('premium')


# ── Roles ─────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestRoles:
    def test_requires_authentication(self, api_client):
        assert api_client.get('/imboni/finance/fees/').status_code == \
            status.HTTP_401_UNAUTHORIZED

    def test_a_teacher_has_no_business_here(self, make_authenticated_client):
        client, _ = make_authenticated_client('teacher')
        assert client.get('/imboni/finance/fees/').status_code == status.HTTP_403_FORBIDDEN

    def test_an_admin_may_read_but_not_take_money(self, make_authenticated_client):
        client, _ = make_authenticated_client('admin')
        fee = make_fee()

        assert client.get('/imboni/finance/fees/').status_code == status.HTTP_200_OK

        response = client.post('/imboni/finance/payments/record/',
                               {'fee': str(fee.id), 'amount': '1000'})
        assert response.status_code == status.HTTP_403_FORBIDDEN


# ── Payments ──────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestPayments:
    def test_a_part_payment_leaves_the_charge_partial(self):
        fee = make_fee(amount='50000.00')

        services.record_payment(fee, '20000.00')

        fee.refresh_from_db()
        assert fee.status == 'partial'
        assert services.paid_total(fee) == Decimal('20000.00')
        assert services.balance_of(fee) == Decimal('30000.00')
        # Not settled, so no settlement date.
        assert fee.paid_date is None

    def test_paying_the_balance_clears_it(self):
        fee = make_fee(amount='50000.00')
        services.record_payment(fee, '20000.00')

        services.record_payment(fee, '30000.00')

        fee.refresh_from_db()
        assert fee.status == 'cleared'
        assert fee.paid_date == timezone.localdate()

    def test_overpaying_is_refused_rather_than_capped(self):
        """Overpaying nearly always means the wrong charge was picked."""
        fee = make_fee(amount='10000.00')

        with pytest.raises(services.FinanceError, match='more than'):
            services.record_payment(fee, '15000.00')

    def test_a_settled_charge_takes_no_more_money(self):
        fee = make_fee(amount='10000.00')
        services.record_payment(fee, '10000.00')

        with pytest.raises(services.FinanceError, match='already settled'):
            services.record_payment(fee, '500.00')

    def test_zero_and_negative_are_not_payments(self):
        fee = make_fee()
        for bad in ('0', '-100'):
            with pytest.raises(services.FinanceError, match='more than zero'):
                services.record_payment(fee, bad)

    def test_receipts_are_numbered_in_sequence(self):
        fee = make_fee(amount='9000.00')
        first = services.record_payment(fee, '3000.00')
        second = services.record_payment(fee, '3000.00')

        assert first.receipt_no == 'RCT-00001'
        assert second.receipt_no == 'RCT-00002'

    def test_the_receipt_prefix_follows_the_settings(self):
        settings_row = FinanceSettings.load()
        settings_row.receipt_prefix = 'IMB'
        settings_row.save()

        payment = services.record_payment(make_fee(), '1000.00')

        assert payment.receipt_no.startswith('IMB-')


# ── Reversals ─────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestReversals:
    def test_reversing_puts_the_balance_back_without_deleting_the_receipt(self):
        fee = make_fee(amount='40000.00')
        payment = services.record_payment(fee, '40000.00')
        fee.refresh_from_db()
        assert fee.status == 'cleared'

        services.reverse_payment(payment, reason='Cheque bounced')

        fee.refresh_from_db()
        assert fee.status == 'due'
        assert services.paid_total(fee) == Decimal('0.00')
        # The row survives: the books have to show it was issued and cancelled.
        assert FeePayment.objects.filter(pk=payment.pk).exists()
        assert FeePayment.objects.get(pk=payment.pk).is_reversed is True

    def test_a_reversal_cannot_be_reversed_twice(self):
        payment = services.record_payment(make_fee(), '1000.00')
        services.reverse_payment(payment)

        with pytest.raises(services.FinanceError, match='already been reversed'):
            services.reverse_payment(payment)

    def test_a_reversed_charge_past_its_due_date_reads_overdue(self):
        fee = make_fee(amount='5000.00', due_in_days=-3)
        payment = services.record_payment(fee, '5000.00')

        services.reverse_payment(payment)

        fee.refresh_from_db()
        assert fee.status == 'overdue'


# ── Invoicing ─────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestInvoicing:
    def test_a_structure_raises_one_charge_per_student_in_the_year(self, term):
        for _ in range(3):
            StudentFactory(grade='S4', section='A', status='active')
        StudentFactory(grade='S5', section='A', status='active')
        structure = FeeStructure.objects.create(
            term=term, grade='S4', section='A', category='tuition',
            amount=Decimal('85000.00'), due_date=timezone.localdate() + timedelta(days=14),
        )

        created = services.invoice_from_structure(structure)

        assert len(created) == 3
        assert Fee.objects.filter(term=term, category='tuition').count() == 3

    def test_invoicing_twice_does_not_double_a_family_s_bill(self, term):
        """The natural response to "did that work?" is to click it again."""
        StudentFactory(grade='S4', section='A', status='active')
        structure = FeeStructure.objects.create(
            term=term, grade='S4', section='A', category='tuition',
            amount=Decimal('85000.00'), due_date=timezone.localdate(),
        )
        services.invoice_from_structure(structure)

        second = services.invoice_from_structure(structure)

        assert second == []
        assert Fee.objects.filter(term=term).count() == 1

    def test_a_bursary_discounts_the_charge_rather_than_paying_it(self, term):
        """
        The school never received that money, so the books must not say it did.
        """
        student = StudentFactory(grade='S4', section='A', status='active')
        StudentAccount.objects.create(student=student, bursary_percent=Decimal('25.00'))
        structure = FeeStructure.objects.create(
            term=term, grade='S4', section='A', category='tuition',
            amount=Decimal('80000.00'), due_date=timezone.localdate(),
        )

        created = services.invoice_from_structure(structure)

        assert created[0].amount == Decimal('60000.00')
        assert services.paid_total(created[0]) == Decimal('0.00')

    def test_an_overdue_due_date_is_billed_as_overdue(self, term):
        StudentFactory(grade='S4', status='active')
        structure = FeeStructure.objects.create(
            term=term, grade='S4', category='lunch', amount=Decimal('10000'),
            due_date=timezone.localdate() - timedelta(days=1),
        )

        created = services.invoice_from_structure(structure)

        assert created[0].status == 'overdue'


# ── What a family owes ────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestBalances:
    def test_a_student_balance_adds_up_across_charges(self, term):
        student = StudentFactory()
        make_fee(student, '50000.00', term=term)
        second = make_fee(student, '20000.00', category='lunch', term=term)
        services.record_payment(second, '20000.00')

        balance = services.student_balance(student, term)

        assert balance['charged'] == Decimal('70000.00')
        assert balance['paid'] == Decimal('20000.00')
        assert balance['outstanding'] == Decimal('50000.00')

    def test_overdue_counts_only_what_is_late_and_unpaid(self, term):
        student = StudentFactory()
        make_fee(student, '30000.00', due_in_days=-5, term=term)   # late
        make_fee(student, '10000.00', due_in_days=10, term=term)   # not yet

        balance = services.student_balance(student, term)

        assert balance['overdue'] == Decimal('30000.00')

    def test_the_collection_rate_of_a_term_with_nothing_billed_is_zero(self, term):
        summary = services.collection_summary(term)
        assert summary['collection_rate'] == 0.0
        assert summary['charged'] == Decimal('0')


# ── Expenses ──────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestExpenses:
    def test_the_office_records_and_the_head_approves(self, api_client):
        category = ExpenseCategory.objects.create(name='Utilities')
        bursar = UserFactory(role='bursar')
        api_client.force_authenticate(bursar)

        created = api_client.post('/imboni/finance/expenses/', {
            'category': str(category.id), 'description': 'Electricity, June',
            'amount': '240000.00',
        })
        assert created.status_code == status.HTTP_201_CREATED
        assert created.data['status'] == 'pending'
        expense_id = created.data['id']

        # The person who recorded it cannot sign it off.
        url = f'/imboni/finance/expenses/{expense_id}/decision/'
        assert api_client.post(url, {'decision': 'approved'}).status_code == \
            status.HTTP_403_FORBIDDEN

        api_client.force_authenticate(UserFactory(role='admin'))
        approved = api_client.post(url, {'decision': 'approved'})
        assert approved.status_code == status.HTTP_200_OK
        assert approved.data['status'] == 'approved'

    def test_only_an_approved_expense_can_be_marked_paid(self, api_client):
        category = ExpenseCategory.objects.create(name='Maintenance')
        bursar = UserFactory(role='bursar')
        expense = Expense.objects.create(
            category=category, description='Roof repair', amount=Decimal('100000'),
            recorded_by=bursar,
        )
        api_client.force_authenticate(bursar)

        response = api_client.post(
            f'/imboni/finance/expenses/{expense.id}/decision/', {'decision': 'paid'})

        assert response.status_code == status.HTTP_400_BAD_REQUEST


# ── Over HTTP ─────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestEndpoints:
    def test_recording_a_payment_returns_the_receipt_and_the_new_balance(
            self, make_authenticated_client):
        client, _ = make_authenticated_client('bursar')
        fee = make_fee(amount='50000.00')

        response = client.post('/imboni/finance/payments/record/', {
            'fee': str(fee.id), 'amount': '20000.00', 'method': 'momo',
            'reference': 'MOMO-771', 'payer_name': 'Chantal Uwase',
        })

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['payment']['receipt_no'].startswith('RCT-')
        assert response.data['fee']['balance'] == '30000.00'
        assert response.data['fee']['status'] == 'partial'

    def test_the_desk_is_told_which_rule_refused_a_payment(self, make_authenticated_client):
        client, _ = make_authenticated_client('bursar')
        fee = make_fee(amount='10000.00')

        response = client.post('/imboni/finance/payments/record/',
                               {'fee': str(fee.id), 'amount': '99999.00'})

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'more than' in response.data['detail']

    def test_the_debtor_list_is_worst_first(self, make_authenticated_client, term):
        client, _ = make_authenticated_client('bursar')
        small = StudentFactory(user__first_name='Small', user__last_name='Debt')
        large = StudentFactory(user__first_name='Large', user__last_name='Debt')
        make_fee(small, '10000.00', term=term)
        make_fee(large, '90000.00', term=term)

        response = client.get('/imboni/finance/debtors/')

        assert response.status_code == status.HTTP_200_OK
        assert response.data[0]['student']['name'] == 'Large Debt'
        assert response.data[0]['outstanding'] == '90000.00'

    def test_a_settled_student_is_not_a_debtor(self, make_authenticated_client, term):
        client, _ = make_authenticated_client('bursar')
        student = StudentFactory()
        fee = make_fee(student, '10000.00', term=term)
        services.record_payment(fee, '10000.00')

        response = client.get('/imboni/finance/debtors/')

        assert response.data == []

    def test_the_dashboard_reports_collection_against_charges(
            self, make_authenticated_client, term):
        client, _ = make_authenticated_client('bursar')
        fee = make_fee(amount='100000.00', term=term)
        services.record_payment(fee, '25000.00')

        response = client.get('/imboni/finance/dashboard/')

        assert response.data['charged'] == '100000.00'
        assert response.data['collected'] == '25000.00'
        assert response.data['collection_rate'] == 25.0

    def test_a_bursar_invoices_a_year_group_in_one_go(
            self, make_authenticated_client, term):
        client, bursar = make_authenticated_client('bursar')
        for _ in range(2):
            StudentFactory(grade='S3', section='B', status='active')
        structure = FeeStructure.objects.create(
            term=term, grade='S3', section='B', category='tuition',
            amount=Decimal('70000'), due_date=timezone.localdate(),
        )

        response = client.post(f'/imboni/finance/structures/{structure.id}/invoice/', {})

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['created'] == 2
