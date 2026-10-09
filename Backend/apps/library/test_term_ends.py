"""Class sets at the start of term, and clearing leavers at the end of it."""
from decimal import Decimal

import pytest

from apps.authentication.factories import StudentFactory, UserFactory
from apps.library import services
from apps.library.models import Book, BookCopy, Fine, Loan

pytestmark = pytest.mark.django_db


@pytest.fixture
def librarian(api_client):
    user = UserFactory(role='librarian')
    api_client.force_authenticate(user)
    return api_client


def a_book(copies):
    book = Book.objects.create(title='Mathematics S3', author='REB', category='textbook')
    for i in range(copies):
        BookCopy.objects.create(book=book, copy_code=f'M{i:03d}')
    return book


def a_class(n, grade='S3', section='A'):
    return [StudentFactory(grade=grade, section=section) for _ in range(n)]


class TestClassSet:
    def test_every_pupil_in_the_class_gets_a_copy(self, librarian):
        book = a_book(3)
        pupils = a_class(3)
        StudentFactory(grade='S3', section='B')      # another class: untouched

        out = librarian.post('/imboni/library/loans/issue-class/',
                             {'book': str(book.id), 'grade': 'S3', 'stream': 'A'}, format='json')

        assert out.status_code == 201
        assert out.data['issued'] == 3 and out.data['short'] == [] and out.data['skipped'] == []
        assert Loan.objects.filter(borrower__in=[p.user for p in pupils]).count() == 3
        assert Loan.objects.count() == 3

    def test_when_the_copies_run_out_the_rest_are_listed_not_failed(self, librarian):
        book = a_book(2)
        a_class(3)

        out = librarian.post('/imboni/library/loans/issue-class/',
                             {'book': str(book.id), 'grade': 'S3', 'stream': 'A'}, format='json').data

        assert out['issued'] == 2 and len(out['short']) == 1

    def test_a_pupil_with_an_unpaid_fine_is_skipped_for_the_same_reason_as_at_the_desk(self, librarian):
        book = a_book(3)
        good, owing = a_class(2)
        old = Loan.objects.create(copy=BookCopy.objects.create(book=Book.objects.create(title='Old'),
                                                                copy_code='X1'),
                                  borrower=owing.user, due_on='2020-01-01')
        Fine.objects.create(loan=old, days_late=5, rate=Decimal('100'), amount=Decimal('500'))

        out = librarian.post('/imboni/library/loans/issue-class/',
                             {'book': str(book.id), 'grade': 'S3', 'stream': 'A'}, format='json').data

        assert out['issued'] == 1
        assert [s['student'] for s in out['skipped']] == [owing.full_name]
        assert 'fine' in out['skipped'][0]['reason'].lower() or 'overdue' in out['skipped'][0]['reason'].lower()

    def test_running_it_twice_does_not_give_anyone_a_second_copy(self, librarian):
        book = a_book(6)
        a_class(3)
        body = {'book': str(book.id), 'grade': 'S3', 'stream': 'A'}

        librarian.post('/imboni/library/loans/issue-class/', body, format='json')
        again = librarian.post('/imboni/library/loans/issue-class/', body, format='json').data

        assert again['issued'] == 0 and len(again['skipped']) == 3
        assert Loan.objects.count() == 3

    def test_a_class_must_be_chosen(self, librarian):
        book = a_book(1)
        assert librarian.post('/imboni/library/loans/issue-class/', {'book': str(book.id)},
                              format='json').status_code == 400

    def test_a_teacher_cannot_do_it(self, api_client):
        api_client.force_authenticate(UserFactory(role='teacher'))
        assert api_client.post('/imboni/library/loans/issue-class/', {}, format='json').status_code == 403


class TestClearance:
    def test_a_pupil_with_nothing_out_and_nothing_owed_is_cleared(self, librarian):
        pupil = StudentFactory()
        out = librarian.get('/imboni/library/clearance/', {'student': str(pupil.id)}).data
        assert out['cleared'] is True and out['books_out'] == [] and out['owed'] == '0'

    def test_a_book_still_out_or_a_fine_unpaid_stops_clearance_and_says_which(self, librarian):
        pupil = StudentFactory()
        book = a_book(1)
        loan = services.issue(book.copies.first(), pupil.user)
        services.return_loan(loan)
        late = Loan.objects.create(copy=BookCopy.objects.create(book=book, copy_code='L1'),
                                   borrower=pupil.user, due_on='2020-01-01')
        Fine.objects.create(loan=Loan.objects.create(copy=BookCopy.objects.create(book=book, copy_code='L2'),
                                                     borrower=pupil.user, due_on='2020-01-01', returned_at=late.issued_at),
                            days_late=3, rate=Decimal('100'), amount=Decimal('300'))

        out = librarian.get('/imboni/library/clearance/', {'student': str(pupil.id)}).data

        assert out['cleared'] is False
        assert [b['copy_code'] for b in out['books_out']] == ['L1']
        assert out['owed'] == '300.00'

    def test_a_fine_that_was_paid_or_waived_does_not_count(self, librarian):
        pupil = StudentFactory()
        book = a_book(1)
        loan = Loan.objects.create(copy=book.copies.first(), borrower=pupil.user, due_on='2020-01-01',
                                   returned_at='2020-02-01T00:00:00Z')
        Fine.objects.create(loan=loan, days_late=3, rate=Decimal('100'), amount=Decimal('300'), paid=True)
        assert librarian.get('/imboni/library/clearance/', {'student': str(pupil.id)}).data['cleared'] is True

    def test_a_class_lists_only_those_who_are_not_cleared(self, librarian):
        clear, holding = a_class(2, grade='S6')
        book = a_book(1)
        services.issue(book.copies.first(), holding.user)

        out = librarian.get('/imboni/library/clearance/', {'grade': 'S6', 'stream': 'A'}).data

        assert out['class_size'] == 2
        assert [r['student'] for r in out['not_cleared']] == [holding.full_name]
