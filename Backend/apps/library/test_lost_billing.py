"""A lost book billed to the student's fee account instead of the library drawer."""
from decimal import Decimal

import pytest
from django.utils import timezone

from apps.authentication.factories import StudentFactory
from apps.finance import services as finance
from apps.library import services
from apps.library.models import Book, BookCopy, Fine, LibrarySettings
from apps.student.models import Fee

pytestmark = pytest.mark.django_db


@pytest.fixture
def term():
    from datetime import timedelta
    from apps.results.models import AcademicTerm
    return AcademicTerm.objects.create(name='Term 2 2026', term='2', year=2026, order=2, is_current=True,
                                       start_date=timezone.localdate() - timedelta(days=30),
                                       end_date=timezone.localdate() + timedelta(days=30))


@pytest.fixture
def lost(term):
    """A student has a 5,000 book out and loses it. Returns (student, copy, loan)."""
    student = StudentFactory()
    book = Book.objects.create(title='Physics S5', author='REB', category='textbook')
    copy = BookCopy.objects.create(book=book, copy_code='P1', price=Decimal('5000'))
    loan = services.issue(copy, student.user)
    return student, copy, loan


def report_lost(copy):
    return services.record_copy_event(copy, 'lost', reason='Lost on the bus')


def settings_on(on=True):
    row = LibrarySettings.load()
    row.bill_lost_to_finance = on
    row.save()


class TestBilling:
    def test_off_by_default_so_the_library_works_alone(self, lost):
        student, copy, _ = lost
        report_lost(copy)
        assert Fine.objects.get().billed_fee_id is None and not Fee.objects.filter(student=student).exists()

    def test_on_the_cost_lands_on_the_students_fee_account(self, lost):
        student, copy, _ = lost
        settings_on()
        report_lost(copy)

        fine = Fine.objects.get()
        fee = Fee.objects.get(student=student)
        assert fine.billed_fee_id == fee.id and fee.amount == Decimal('5000.00')
        assert 'Physics S5' in fee.notes and fee.category == 'other'
        assert finance.student_balance(student)['outstanding'] == Decimal('5000.00')

    def test_it_cannot_also_be_taken_at_the_library_desk(self, lost):
        _, copy, _ = lost
        settings_on()
        report_lost(copy)
        with pytest.raises(services.LibraryError, match='fee account'):
            services.pay_fine(Fine.objects.get())

    def test_paying_it_in_finance_clears_the_library_fine(self, lost):
        student, copy, _ = lost
        settings_on()
        report_lost(copy)
        fee = Fee.objects.get(student=student)

        payment = finance.record_payment(fee, '5000', method='cash')
        fine = Fine.objects.get()
        assert fine.paid and fine.paid_at is not None and not fine.outstanding

        finance.reverse_payment(payment, reason='bounced')
        fine.refresh_from_db()
        assert not fine.paid           # a reversed receipt reopens it

    def test_a_part_payment_does_not_clear_it(self, lost):
        student, copy, _ = lost
        settings_on()
        report_lost(copy)
        finance.record_payment(Fee.objects.get(student=student), '2000', method='cash')
        assert not Fine.objects.get().paid

    def test_waiving_it_clears_the_charge_on_the_fee_account_too(self, lost):
        student, copy, _ = lost
        settings_on()
        report_lost(copy)
        services.waive_fine(Fine.objects.get(), reason='Family hardship')
        assert finance.student_balance(student)['outstanding'] == 0

    def test_the_book_turning_up_cancels_the_unpaid_charge_there_as_well(self, lost):
        student, copy, _ = lost
        settings_on()
        report_lost(copy)

        services._settle_found_copy(copy)

        assert not Fine.objects.exists()
        assert finance.student_balance(student)['outstanding'] == 0

    def test_staff_borrowers_are_never_billed_to_a_student_account(self, term):
        from apps.authentication.factories import UserFactory
        teacher = UserFactory(role='teacher')
        book = Book.objects.create(title='Atlas', author='X', category='reference')
        copy = BookCopy.objects.create(book=book, copy_code='A1', price=Decimal('3000'))
        services.issue(copy, teacher)
        settings_on()
        report_lost(copy)
        assert Fine.objects.get().billed_fee_id is None


def test_the_setting_is_exposed_and_changeable(make_authenticated_client):
    client, _ = make_authenticated_client('librarian')
    assert client.get('/imboni/library/settings/').data['bill_lost_to_finance'] is False
    client.put('/imboni/library/settings/', {**client.get('/imboni/library/settings/').data, 'bill_lost_to_finance': True}, format='json')
    assert LibrarySettings.load().bill_lost_to_finance is True


def test_the_fine_list_says_which_ones_are_on_the_fee_account(make_authenticated_client, term):
    client, _ = make_authenticated_client('librarian')
    student = StudentFactory()
    book = Book.objects.create(title='B', author='A', category='textbook')
    copy = BookCopy.objects.create(book=book, copy_code='B1', price=Decimal('100'))
    services.issue(copy, student.user)
    settings_on()
    report_lost(copy)
    rows = client.get('/imboni/library/fines/').data
    rows = rows['results'] if isinstance(rows, dict) else rows
    assert rows[0]['billed_to_finance'] is True and timezone.now()
