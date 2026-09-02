"""
Scanning: reading a code, and the difference between a title and a copy.

The distinction these tests defend is the one that makes or breaks a library
system. The barcode printed on a book identifies the EDITION; five copies of a
textbook carry the same one. A loan is of a COPY. So an ISBN can catalogue but
must never circulate, and every test below that looks pedantic is guarding a
way for the system to mark the wrong physical book returned.
"""
import pytest
from django.urls import reverse

from apps.authentication.factories import StudentFactory
from apps.library import codes
from apps.library.models import Book, BookCopy, Loan
from apps.library.services import add_copies, issue

pytestmark = pytest.mark.django_db


# ── Reading a code ────────────────────────────────────────────────────────────

class TestNormalise:
    def test_strips_the_whitespace_a_scanner_adds(self):
        # A USB scanner types the characters and presses Enter, so a trailing
        # carriage return is the normal case rather than the odd one.
        assert codes.normalise('  THI-0001 \n') == 'THI-0001'

    def test_upper_cases_so_a_lower_case_scanner_still_matches(self):
        assert codes.normalise('thi-0001') == 'THI-0001'

    def test_keeps_the_hyphen_a_copy_code_is_built_with(self):
        """
        The bug this guards: stripping hyphens globally looks right, because an
        ISBN is printed with them — and it makes every one of the school's own
        labels stop matching its own database. 'THI-0001' on the sticker,
        'THI0001' in the lookup, nothing found, at every desk at once.
        """
        assert '-' in codes.normalise('THI-0001')

    def test_a_hyphenated_isbn_still_validates(self):
        # Hyphens come out where the question is "is this an ISBN", not before.
        assert codes.is_isbn('978-0-14-118776-1')
        assert codes.to_isbn13('978-0-14-118776-1') == '9780141187761'


class TestIsbn:
    def test_accepts_a_real_isbn13(self):
        assert codes.is_isbn('9780141187761')

    def test_accepts_a_real_isbn10(self):
        assert codes.is_isbn('014118776X')

    def test_rejects_a_thirteen_digit_string_whose_check_digit_disagrees(self):
        # The whole point of validating rather than pattern-matching: this is a
        # misread, and accepting it would catalogue a book that does not exist.
        assert not codes.is_isbn('9780141187762')

    def test_rejects_a_copy_code(self):
        assert not codes.is_isbn('THI-0001')

    def test_isbn10_converts_to_the_same_record_as_isbn13(self):
        assert codes.to_isbn13('014118776X') == '9780141187761'


class TestBarcodeImage:
    def test_code128_is_a_png_data_uri(self):
        # Embedded rather than linked: xhtml2pdf cannot fetch a URL while
        # rendering, so a linked barcode prints as a blank label.
        uri = codes.barcode_data_uri('THI-0001')
        assert uri.startswith('data:image/png;base64,')
        assert len(uri) > 200

    def test_qr_is_offered_for_phones(self):
        assert codes.barcode_data_uri('THI-0001', kind='qr').startswith('data:image/png;base64,')

    def test_an_empty_code_draws_nothing_rather_than_a_broken_image(self):
        assert codes.barcode_data_uri('') == ''


# ── Resolving ─────────────────────────────────────────────────────────────────

@pytest.fixture
def book():
    return Book.objects.create(title='Things Fall Apart', author='Achebe',
                               isbn='9780141187761')


@pytest.fixture
def librarian_client(make_authenticated_client):
    client, _ = make_authenticated_client('librarian')
    return client


@pytest.fixture
def student():
    return StudentFactory(grade='S4', section='A',
                          user__first_name='Amina', user__last_name='Uwase').user


class TestResolve:
    def test_a_copy_label_identifies_one_physical_book(self, book):
        copy = BookCopy.objects.create(book=book, copy_code='THI-0001')
        found = codes.resolve('THI-0001')
        assert found['kind'] == 'copy'
        assert found['copy'] == copy

    def test_an_isbn_we_hold_resolves_to_the_title_and_all_its_copies(self, book):
        add_copies(book, 3)
        found = codes.resolve('9780141187761')
        assert found['kind'] == 'title'
        assert len(found['copies']) == 3

    def test_the_ten_digit_form_finds_the_same_title(self, book):
        assert codes.resolve('014118776X')['kind'] == 'title'

    def test_a_valid_isbn_we_lack_is_not_an_error(self):
        # Distinct from 'unknown' on purpose: the librarian is holding a real
        # book, and "not found" would be a lie that stops them trusting it.
        assert codes.resolve('9780141187761')['kind'] == 'isbn'

    def test_a_misread_is_unknown_rather_than_a_new_isbn(self):
        assert codes.resolve('9780141187762')['kind'] == 'unknown'

    def test_a_copy_code_wins_over_an_isbn_of_the_same_string(self, book):
        # A school whose copy codes happen to be numeric must not have one
        # shadowed by some book's barcode.
        BookCopy.objects.create(book=book, copy_code='9780141187761')
        assert codes.resolve('9780141187761')['kind'] == 'copy'


# ── Adding copies ─────────────────────────────────────────────────────────────

class TestAddCopies:
    def test_creates_the_number_asked_for(self, book):
        assert len(add_copies(book, 5)) == 5
        assert book.copies.count() == 5

    def test_codes_are_readable_and_sequential(self, book):
        made = add_copies(book, 2)
        assert [c.copy_code for c in made] == ['THI-0001', 'THI-0002']

    def test_walks_past_a_gap_rather_than_creating_fewer_books(self, book):
        """
        The bug this replaces: counting copies and adding one collides after a
        withdrawal, and the old code skipped the collision — so the librarian
        had forty books on the trolley and thirty-eight in the system.
        """
        add_copies(book, 3)
        book.copies.filter(copy_code='THI-0002').delete()
        made = add_copies(book, 2)
        assert len(made) == 2
        assert book.copies.count() == 4

    def test_never_moves_a_title_that_already_has_a_shelf(self, book):
        book.shelf = 'A3'
        book.save()
        add_copies(book, 1, shelf='B7')
        book.refresh_from_db()
        assert book.shelf == 'A3'


# ── The endpoints ─────────────────────────────────────────────────────────────

class TestScanEndpoints:
    def test_scanning_a_copy_says_who_has_it(self, librarian_client, book, student):
        copy = add_copies(book, 1)[0]
        issue(copy, student)
        response = librarian_client.post(reverse('library-scan'),
                                         {'code': copy.copy_code}, format='json')
        assert response.status_code == 200
        assert response.data['kind'] == 'copy'
        assert response.data['loan'] is not None

    def test_returning_by_scanning_the_copy_closes_the_loan(
            self, librarian_client, book, student):
        copy = add_copies(book, 1)[0]
        issue(copy, student)
        response = librarian_client.post(reverse('library-scan-return'),
                                         {'code': copy.copy_code}, format='json')
        assert response.status_code == 200
        assert Loan.objects.get(copy=copy).returned_at is not None

    def test_returning_by_isbn_is_refused(self, librarian_client, book, student):
        """
        The single most important refusal here. Five copies share the ISBN, one
        of them came back, and guessing would put a book on the shelf in the
        system that is still in somebody's bag.
        """
        copies = add_copies(book, 3)
        issue(copies[0], student)
        response = librarian_client.post(reverse('library-scan-return'),
                                         {'code': book.isbn}, format='json')
        assert response.status_code == 409
        assert Loan.objects.get(copy=copies[0]).returned_at is None

    def test_returning_something_not_on_loan_says_so(self, librarian_client, book):
        copy = add_copies(book, 1)[0]
        response = librarian_client.post(reverse('library-scan-return'),
                                         {'code': copy.copy_code}, format='json')
        assert response.status_code == 409

    def test_cataloguing_a_known_isbn_adds_copies_rather_than_a_second_title(
            self, librarian_client, book):
        add_copies(book, 2)
        response = librarian_client.post(
            reverse('library-scan-catalogue'),
            {'isbn': book.isbn, 'copies': 3}, format='json')
        assert response.status_code == 201
        assert response.data['created'] is False
        assert Book.objects.filter(isbn=book.isbn).count() == 1
        assert book.copies.count() == 5

    def test_cataloguing_an_unknown_isbn_asks_for_a_title_once(self, librarian_client):
        response = librarian_client.post(
            reverse('library-scan-catalogue'),
            {'isbn': '9780141187761', 'copies': 1}, format='json')
        # Not a failure: nothing on a barcode carries the title.
        assert response.status_code == 422
        assert response.data['needs_title'] is True

    def test_cataloguing_a_misread_is_refused(self, librarian_client):
        response = librarian_client.post(
            reverse('library-scan-catalogue'),
            {'isbn': '9780141187762', 'title': 'Whatever'}, format='json')
        assert response.status_code == 400
        assert Book.objects.count() == 0

    def test_a_ten_digit_scan_lands_on_the_thirteen_digit_record(self, librarian_client):
        librarian_client.post(reverse('library-scan-catalogue'),
                              {'isbn': '014118776X', 'title': 'Things Fall Apart'},
                              format='json')
        librarian_client.post(reverse('library-scan-catalogue'),
                              {'isbn': '9780141187761', 'copies': 2}, format='json')
        assert Book.objects.count() == 1
        assert Book.objects.get().copies.count() == 3


class TestLabels:
    def test_a_label_sheet_carries_a_scannable_barcode(self, librarian_client, book):
        """
        Without this the labels are stickers with a number typed on them, and
        every issue, return and stocktake is still done by hand.
        """
        copy = add_copies(book, 1)[0]
        response = librarian_client.get(reverse('library-labels'),
                                        {'copies': str(copy.id)})
        assert response.status_code == 200
        assert response['Content-Type'] == 'application/pdf'
        assert len(response.content) > 1000
