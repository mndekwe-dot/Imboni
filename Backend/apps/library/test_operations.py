"""
Running a library when nobody is at the circulation desk: counting it, chasing
it, loading it, and knowing what it does.

The rules that matter here are mostly about what must NOT happen: a count must
not write books off by accident, an import must not duplicate a catalogue on
its second run, and a copy out on loan must never be reported as missing.
"""
from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from apps.authentication.factories import StudentFactory, UserFactory
from apps.library import services
from apps.library.models import (
    Book, BookCopy, CopyEvent, LibrarySettings, Loan, Stocktake,
)

pytestmark = pytest.mark.django_db


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def librarian():
    return UserFactory(role='librarian')


@pytest.fixture
def reader():
    return StudentFactory(grade='S4', section='A',
                          user__first_name='Amina', user__last_name='Uwase').user


def a_book(title='Things Fall Apart', shelf='F-ACH', **kwargs):
    return Book.objects.create(title=title, author=kwargs.pop('author', 'Chinua Achebe'),
                               shelf=shelf, **kwargs)


def a_copy(book, code, **kwargs):
    return BookCopy.objects.create(book=book, copy_code=code, **kwargs)


# ── Counting the shelves ──────────────────────────────────────────────────────

class TestStocktake:
    def test_a_count_can_be_narrowed_to_one_shelf(self):
        here = a_book(shelf='F-ACH')
        elsewhere = a_book('Purple Hibiscus', shelf='F-ADI')
        a_copy(here, 'TFA-0001')
        a_copy(elsewhere, 'PH-0001')

        count = Stocktake.objects.create(name='Fiction', scope_shelf='F-ACH')
        assert services.stocktake_scope(count).count() == 1

    def test_withdrawn_copies_are_not_expected_on_the_shelf(self):
        book = a_book()
        a_copy(book, 'TFA-0001')
        a_copy(book, 'TFA-0002', status='withdrawn')

        count = Stocktake.objects.create(name='All')
        assert services.stocktake_scope(count).count() == 1

    def test_scanning_the_same_barcode_twice_is_harmless(self, librarian):
        book = a_book()
        copy = a_copy(book, 'TFA-0001')
        count = Stocktake.objects.create(name='All')

        _, first = services.record_scan(count, copy, scanned_by=librarian)
        _, second = services.record_scan(count, copy, scanned_by=librarian)

        assert first is True
        assert second is False       # updated, not a second row
        assert count.scans.count() == 1

    def test_a_book_out_on_loan_is_not_missing(self, reader, librarian):
        """
        The difference that stops a stocktake producing a frightening number
        that turns out to be the S4 set texts, all properly issued.
        """
        LibrarySettings.load()
        book = a_book()
        on_shelf = a_copy(book, 'TFA-0001')
        borrowed = a_copy(book, 'TFA-0002')
        services.issue(borrowed, reader, issued_by=librarian)

        count = Stocktake.objects.create(name='All')
        services.record_scan(count, on_shelf, scanned_by=librarian)
        progress = services.stocktake_progress(count)

        assert progress['seen'] == 1
        assert progress['on_loan'] == 1
        assert progress['unaccounted'] == 0

    def test_a_copy_nobody_has_is_unaccounted_for(self, librarian):
        book = a_book()
        a_copy(book, 'TFA-0001')
        count = Stocktake.objects.create(name='All')

        progress = services.stocktake_progress(count)
        assert progress['unaccounted'] == 1
        assert progress['percent_seen'] == 0.0

    def test_closing_does_not_write_books_off_unless_asked(self, librarian):
        """
        The default that stops a librarian closing a count at the end of a long
        afternoon and discovering four hundred copies marked lost.
        """
        book = a_book()
        copy = a_copy(book, 'TFA-0001')
        count = Stocktake.objects.create(name='All')

        result = services.close_stocktake(count, closed_by=librarian)

        copy.refresh_from_db()
        assert result['marked_lost'] == 0
        assert copy.status == 'available'

    def test_closing_can_mark_the_missing_ones_lost_when_asked(self, librarian):
        book = a_book()
        copy = a_copy(book, 'TFA-0001')
        count = Stocktake.objects.create(name='All')

        result = services.close_stocktake(count, closed_by=librarian, mark_missing=True)

        copy.refresh_from_db()
        assert result['marked_lost'] == 1
        assert copy.status == 'lost'
        # And it says why, with a date and a name against it.
        assert CopyEvent.objects.get(copy=copy).kind == 'lost'

    def test_a_closed_count_cannot_be_scanned_into(self, librarian):
        book = a_book()
        copy = a_copy(book, 'TFA-0001')
        count = Stocktake.objects.create(name='All')
        services.close_stocktake(count, closed_by=librarian)

        with pytest.raises(services.LibraryError, match='closed'):
            services.record_scan(count, copy, scanned_by=librarian)

    def test_a_count_cannot_be_closed_twice(self, librarian):
        count = Stocktake.objects.create(name='All')
        services.close_stocktake(count, closed_by=librarian)
        with pytest.raises(services.LibraryError, match='already closed'):
            services.close_stocktake(count, closed_by=librarian)


# ── What happens to a copy ────────────────────────────────────────────────────

class TestCopyEvents:
    def test_marking_lost_moves_the_status_and_records_why(self, librarian, reader):
        copy = a_copy(a_book(), 'TFA-0001')

        event = services.record_copy_event(
            copy, 'lost', reason='Never came back', borrower=reader,
            charged=Decimal('8000'), recorded_by=librarian)

        copy.refresh_from_db()
        assert copy.status == 'lost'
        assert event.borrower == reader
        assert event.charged == Decimal('8000')

    def test_finding_a_lost_book_closes_the_loan_that_was_still_open(
            self, librarian, reader):
        """
        Otherwise the borrower owes a book that is back on the shelf.
        """
        LibrarySettings.load()
        copy = a_copy(a_book(), 'TFA-0001')
        loan = services.issue(copy, reader, issued_by=librarian)
        services.record_copy_event(copy, 'lost', recorded_by=librarian)

        services.record_copy_event(copy, 'found', recorded_by=librarian)

        loan.refresh_from_db()
        copy.refresh_from_db()
        assert copy.status == 'available'
        assert loan.returned_at is not None

    def test_damage_changes_the_condition_not_the_whereabouts(self, librarian):
        """A damaged book is still on the shelf; it has not gone anywhere."""
        copy = a_copy(a_book(), 'TFA-0001')
        services.record_copy_event(copy, 'damaged', recorded_by=librarian)

        copy.refresh_from_db()
        assert copy.condition == 'damaged'
        assert copy.status == 'available'

    def test_an_unknown_event_is_refused(self, librarian):
        copy = a_copy(a_book(), 'TFA-0001')
        with pytest.raises(services.LibraryError):
            services.record_copy_event(copy, 'eaten', recorded_by=librarian)


# ── Chasing what is late ──────────────────────────────────────────────────────

class TestOverdue:
    def test_only_loans_past_their_due_date_are_listed(self, reader, librarian):
        LibrarySettings.load()
        book = a_book()
        late = services.issue(a_copy(book, 'TFA-0001'), reader, issued_by=librarian)
        services.issue(a_copy(book, 'TFA-0002'), reader, issued_by=librarian)

        Loan.objects.filter(pk=late.pk).update(
            due_on=timezone.localdate() - timedelta(days=3))

        overdue = list(services.overdue_loans())
        assert [loan.pk for loan in overdue] == [late.pk]

    def test_a_returned_book_is_never_overdue(self, reader, librarian):
        LibrarySettings.load()
        loan = services.issue(a_copy(a_book(), 'TFA-0001'), reader, issued_by=librarian)
        Loan.objects.filter(pk=loan.pk).update(
            due_on=timezone.localdate() - timedelta(days=10))
        services.return_loan(Loan.objects.get(pk=loan.pk), received_by=librarian)

        assert services.overdue_loans().count() == 0

    def test_the_chase_list_can_be_narrowed_to_one_class(self, librarian):
        LibrarySettings.load()
        s4 = StudentFactory(grade='S4', section='A').user
        s1 = StudentFactory(grade='S1', section='B').user
        book = a_book()
        for borrower, code in ((s4, 'TFA-0001'), (s1, 'TFA-0002')):
            loan = services.issue(a_copy(book, code), borrower, issued_by=librarian)
            Loan.objects.filter(pk=loan.pk).update(
                due_on=timezone.localdate() - timedelta(days=2))

        assert services.overdue_loans(grade='S4').count() == 1
        assert services.overdue_loans(grade='S4', stream='B').count() == 0


class TestBorrowerHistory:
    def test_it_answers_what_they_have_and_what_they_owe(self, reader, librarian):
        LibrarySettings.load()
        book = a_book()
        services.issue(a_copy(book, 'TFA-0001'), reader, issued_by=librarian)
        returned = services.issue(a_copy(book, 'TFA-0002'), reader, issued_by=librarian)
        services.return_loan(returned, received_by=librarian)

        history = services.borrower_history(reader)

        assert history['total_borrowed'] == 2
        assert len(history['open_loans']) == 1
        assert history['owed'] == Decimal('0')


# ── What the collection does ──────────────────────────────────────────────────

class TestUsageReport:
    def test_it_ranks_what_moves_and_names_what_does_not(self, reader, librarian):
        LibrarySettings.load()
        popular = a_book('Popular')
        ignored = a_book('Never Read', author='Nobody')
        copy = a_copy(popular, 'POP-0001')
        a_copy(ignored, 'NR-0001')

        loan = services.issue(copy, reader, issued_by=librarian)
        services.return_loan(loan, received_by=librarian)
        services.issue(BookCopy.objects.get(pk=copy.pk), reader, issued_by=librarian)

        report = services.usage_report()

        assert report['total_loans'] == 2
        assert report['popular'][0]['copy__book__title'] == 'Popular'
        assert [b.title for b in report['dead_stock']] == ['Never Read']


# ── Loading a catalogue ───────────────────────────────────────────────────────

class TestImport:
    def test_a_row_becomes_a_book_and_its_copies(self):
        result = services.import_books([{
            'title': 'Things Fall Apart', 'author': 'Chinua Achebe',
            'isbn': '9780385474542', 'category': 'Fiction', 'shelf': 'F-ACH',
            'published_year': '1958', 'copies': '3', 'copy_prefix': 'TFA',
        }])

        assert result['created'] == 1
        assert result['copies'] == 3
        book = Book.objects.get(isbn='9780385474542')
        assert book.published_year == 1958
        assert sorted(book.copies.values_list('copy_code', flat=True)) == [
            'TFA-0001', 'TFA-0002', 'TFA-0003']

    def test_importing_the_same_file_twice_does_not_duplicate_the_library(self):
        """An import that duplicates on the second run is one nobody dares use."""
        row = {'title': 'Things Fall Apart', 'author': 'Chinua Achebe',
               'isbn': '9780385474542', 'copies': '2', 'copy_prefix': 'TFA'}
        services.import_books([row])
        second = services.import_books([row])

        assert second['created'] == 0
        assert second['updated'] == 1
        assert Book.objects.count() == 1
        # Copies are added, not re-created, and the codes do not collide.
        assert BookCopy.objects.count() == 4

    def test_a_book_with_no_isbn_matches_on_title_and_author(self):
        row = {'title': 'Local History', 'author': 'A Teacher'}
        services.import_books([row])
        services.import_books([row])
        assert Book.objects.filter(title='Local History').count() == 1

    def test_an_existing_value_is_never_blanked_by_an_empty_column(self):
        services.import_books([{'title': 'Book', 'author': 'Somebody',
                                'shelf': 'A-1'}])
        services.import_books([{'title': 'Book', 'author': 'Somebody', 'shelf': ''}])
        assert Book.objects.get(title='Book').shelf == 'A-1'

    def test_a_bad_row_is_reported_and_the_rest_still_import(self):
        """3,000 rows with two broken ones should import 2,998 and say so."""
        result = services.import_books([
            {'title': 'Good One', 'author': 'A'},
            {'title': '', 'author': 'B'},
            {'title': 'Another Good One', 'author': 'C'},
        ])

        assert result['created'] == 2
        assert len(result['problems']) == 1
        assert result['problems'][0]['row'] == 3      # header is row 1
