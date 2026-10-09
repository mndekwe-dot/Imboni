"""
The clearance card: fees, library, sick bay and medicine, in one place.

Run with:
    python -m pytest apps/discipline/test_clearance.py -q
"""
import datetime
import itertools
from decimal import Decimal

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from apps.authentication.factories import StudentFactory
from apps.discipline.clearance import clearance_for
from apps.finance.models import FeePayment
from apps.library.models import Book, BookCopy, Fine, Loan
from apps.matron.models import HealthRecord, MedicationSchedule
from apps.student.models import Fee

LIST = '/imboni/discipline/clearance/'
_n = itertools.count(1)


def owe(student, amount, paid=0):
    fee = Fee.objects.create(student=student, category='tuition', amount=Decimal(amount),
                             due_date=datetime.date(2025, 3, 1))
    if paid:
        FeePayment.objects.create(fee=fee, amount=Decimal(paid), receipt_no=f'R{next(_n)}')
    return fee


def borrow(student, returned=False):
    book = Book.objects.create(title=f'Book {next(_n)}')
    copy = BookCopy.objects.create(book=book, copy_code=f'C{next(_n)}')
    return Loan.objects.create(
        copy=copy, borrower=student.user, due_on=datetime.date(2025, 3, 1),
        returned_at=timezone.now() if returned else None)


def admit(student, discharged=False):
    return HealthRecord.objects.create(
        student=student, visit_type='sickbay_admission', condition_tag='fever',
        status='cleared' if discharged else 'in_sick_bay', visit_datetime=timezone.now(),
        complaint='fever', admitted=True,
        discharged_at=timezone.now() if discharged else None)


def medicate(student, ended=False):
    today = timezone.localdate()
    return MedicationSchedule.objects.create(
        student=student, medicine_name='Amoxicillin', dosage='500mg', times=['08:00'],
        start_date=today - datetime.timedelta(days=10),
        end_date=today - datetime.timedelta(days=1) if ended else None, is_active=True)


@pytest.mark.django_db
class TestVerdict:
    def test_a_student_who_owes_nothing_anywhere_is_cleared(self):
        s = StudentFactory()
        v = clearance_for([s])[s.id]
        assert v['cleared'] is True
        assert v['finance']['owed'] == 0 and v['library']['books_out'] == 0 and v['medical']['cleared']

    def test_unpaid_fees_block_and_say_how_much(self):
        s = StudentFactory()
        owe(s, '100000', paid='40000')
        v = clearance_for([s])[s.id]
        assert v['cleared'] is False
        assert v['finance'] == {'cleared': False, 'owed': Decimal('60000')}

    def test_fees_paid_in_full_clear(self):
        s = StudentFactory()
        owe(s, '100000', paid='100000')
        assert clearance_for([s])[s.id]['finance']['cleared'] is True

    def test_a_reversed_payment_does_not_count_as_paid(self):
        s = StudentFactory()
        fee = owe(s, '100000', paid='100000')
        FeePayment.objects.filter(fee=fee).update(reversed_at=timezone.now())
        assert clearance_for([s])[s.id]['finance']['owed'] == Decimal('100000')

    def test_overpayment_is_not_negative_debt(self):
        s = StudentFactory()
        owe(s, '100', paid='150')
        assert clearance_for([s])[s.id]['finance']['owed'] == 0

    def test_a_book_still_out_blocks(self):
        s = StudentFactory()
        borrow(s)
        v = clearance_for([s])[s.id]
        assert v['cleared'] is False and v['library']['books_out'] == 1

    def test_a_returned_book_does_not(self):
        s = StudentFactory()
        borrow(s, returned=True)
        assert clearance_for([s])[s.id]['library']['cleared'] is True

    def test_an_unpaid_fine_blocks_but_a_waived_one_does_not(self):
        s = StudentFactory()
        loan = borrow(s, returned=True)
        fine = Fine.objects.create(loan=loan, days_late=5, rate=Decimal('100'), amount=Decimal('500'))
        v = clearance_for([s])[s.id]
        assert v['library'] == {'cleared': False, 'books_out': 0, 'owed': Decimal('500')}
        Fine.objects.filter(pk=fine.pk).update(waived=True)
        assert clearance_for([s])[s.id]['library']['cleared'] is True

    def test_being_in_the_sick_bay_blocks(self):
        s = StudentFactory()
        admit(s)
        v = clearance_for([s])[s.id]
        assert v['cleared'] is False and v['medical']['in_sick_bay'] is True

    def test_a_discharged_student_is_not_blocked_by_an_old_admission(self):
        s = StudentFactory()
        admit(s, discharged=True)
        # discharged earlier today still counts as "in the bay today" by the sick-bay
        # rule; yesterday's does not. Backdate it.
        HealthRecord.objects.filter(student=s).update(
            visit_datetime=timezone.now() - datetime.timedelta(days=3),
            discharged_at=timezone.now() - datetime.timedelta(days=2))
        assert clearance_for([s])[s.id]['medical']['in_sick_bay'] is False

    def test_medicine_still_on_the_books_blocks_and_is_named(self):
        s = StudentFactory()
        medicate(s)
        v = clearance_for([s])[s.id]
        assert v['cleared'] is False and v['medical']['medication'] == ['Amoxicillin']

    def test_a_finished_course_does_not(self):
        s = StudentFactory()
        medicate(s, ended=True)
        assert clearance_for([s])[s.id]['medical']['cleared'] is True

    def test_students_are_judged_separately(self):
        owing, clear = StudentFactory(), StudentFactory()
        owe(owing, '500')
        out = clearance_for([owing, clear])
        assert out[owing.id]['cleared'] is False
        assert out[clear.id]['cleared'] is True

    def test_nobody_in_means_nothing_out(self):
        assert clearance_for([]) == {}

    def test_the_query_count_does_not_grow_with_the_class(self):
        few = [StudentFactory() for _ in range(3)]
        with CaptureQueriesContext(connection) as small:
            clearance_for(few)
        many = few + [StudentFactory() for _ in range(25)]
        for s in many:
            owe(s, '100'); borrow(s)
        with CaptureQueriesContext(connection) as large:
            clearance_for(many)
        assert len(large) == len(small), f'{len(small)} queries for 3, {len(large)} for 28'


@pytest.mark.django_db
class TestEndpoints:
    def test_the_list_gives_each_student_and_a_headline(self, make_authenticated_client):
        client, _ = make_authenticated_client('discipline')
        ok = StudentFactory(grade='S4', section='A')
        blocked = StudentFactory(grade='S4', section='A')
        owe(blocked, '1000')
        res = client.get(LIST + '?grade=S4&section=A')
        assert res.status_code == 200
        assert res.data['count'] == 2
        assert res.data['summary'] == {'cleared': 1, 'blocked': 1}
        rows = {r['student_code']: r for r in res.data['results']}
        assert rows[ok.student_id]['cleared'] is True
        assert rows[blocked.student_id]['finance'] == {'cleared': False, 'owed': 1000.0}

    def test_the_headline_covers_the_whole_filter_not_just_the_page(self, make_authenticated_client):
        client, _ = make_authenticated_client('discipline')
        for _i in range(5):
            owe(StudentFactory(grade='S4', section='A'), '10')
        res = client.get(LIST + '?grade=S4&page_size=2')
        assert len(res.data['results']) == 2
        assert res.data['summary'] == {'cleared': 0, 'blocked': 5}

    def test_it_filters_by_class_and_search(self, make_authenticated_client):
        client, _ = make_authenticated_client('discipline')
        StudentFactory(grade='S4', section='A')
        StudentFactory(grade='S4', section='B')
        assert client.get(LIST + '?grade=S4&section=b').data['count'] == 1

    def test_only_active_students_by_default(self, make_authenticated_client):
        client, _ = make_authenticated_client('discipline')
        StudentFactory(status='active')
        StudentFactory(status='transferred')
        assert client.get(LIST).data['count'] == 1
        assert client.get(LIST + '?status=transferred').data['count'] == 1

    def test_the_detail_names_the_books_to_bring_back(self, make_authenticated_client):
        client, _ = make_authenticated_client('discipline')
        s = StudentFactory()
        loan = borrow(s)
        res = client.get(f'{LIST}{s.id}/')
        assert res.status_code == 200
        assert res.data['cleared'] is False
        assert res.data['library']['books'][0]['title'] == loan.copy.book.title

    def test_an_unknown_student_is_a_404(self, make_authenticated_client):
        client, _ = make_authenticated_client('discipline')
        assert client.get(f'{LIST}00000000-0000-0000-0000-000000000000/').status_code == 404

    @pytest.mark.parametrize('role', ['discipline', 'dos', 'admin'])
    def test_discipline_dos_and_admin_may_see_it(self, make_authenticated_client, role):
        client, _ = make_authenticated_client(role)
        assert client.get(LIST).status_code == 200

    @pytest.mark.parametrize('role', ['student', 'parent', 'teacher'])
    def test_pupils_parents_and_teachers_may_not(self, make_authenticated_client, role):
        """A family's balance is not for every portal."""
        client, _ = make_authenticated_client(role)
        assert client.get(LIST).status_code == 403

    def test_signing_in_is_required(self, api_client):
        assert api_client.get(LIST).status_code in (401, 403)
