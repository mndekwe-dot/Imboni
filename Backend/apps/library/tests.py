"""
Library tests.

The circulation rules are exercised through `services` directly as well as
through HTTP: returning a book has to hand it to the next person in the queue,
and driving that through the API would prove only that the endpoint answered.
"""
from datetime import timedelta
from decimal import Decimal

import pytest
from django.db import connection
from django.utils import timezone
from django_tenants.utils import get_tenant_model, get_public_schema_name, schema_context
from rest_framework import status

from apps.authentication.factories import UserFactory
from apps.library import services
from apps.library.models import (
    AcquisitionRequest, Book, BookCopy, Fine, LibrarySettings, Loan, Reservation,
)


def make_book(title='Things Fall Apart', copies=1, **kwargs):
    book = Book.objects.create(title=title, author='Chinua Achebe', **kwargs)
    for i in range(copies):
        BookCopy.objects.create(book=book, copy_code=f'{title[:3].upper()}-{i:03d}')
    return book


@pytest.fixture
def settings_row():
    return LibrarySettings.load()


# ── Plan gating ───────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestPlanGate:
    def _set_plan(self, plan):
        TenantModel = get_tenant_model()
        schema = connection.schema_name
        with schema_context(get_public_schema_name()):
            TenantModel.objects.filter(schema_name=schema).update(plan=plan)
        connection.tenant.plan = plan

    def test_library_is_closed_on_a_plan_without_it(self, make_authenticated_client):
        client, _ = make_authenticated_client('librarian')
        self._set_plan('basic')
        try:
            response = client.get('/imboni/library/books/')
            # 402, not 403: the request is not forbidden, it is unpaid for.
            assert response.status_code == status.HTTP_402_PAYMENT_REQUIRED
        finally:
            self._set_plan('premium')

    def test_availability_answers_even_when_the_plan_lacks_it(self, make_authenticated_client):
        """
        The endpoint the frontend uses to decide whether to show the portal must
        not itself 402, or it cannot tell "not on your plan" from "server down".
        """
        client, _ = make_authenticated_client('librarian')
        self._set_plan('basic')
        try:
            response = client.get('/imboni/library/availability/')
            assert response.status_code == status.HTTP_200_OK
            assert response.data['enabled'] is False
        finally:
            self._set_plan('premium')

    def test_library_is_open_on_premium(self, make_authenticated_client):
        client, _ = make_authenticated_client('librarian')
        response = client.get('/imboni/library/availability/')
        assert response.data['enabled'] is True


# ── Roles ─────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestRoles:
    def test_requires_authentication(self, api_client):
        assert api_client.get('/imboni/library/books/').status_code == \
            status.HTTP_401_UNAUTHORIZED

    def test_a_teacher_is_not_a_librarian(self, make_authenticated_client):
        client, _ = make_authenticated_client('teacher')
        assert client.get('/imboni/library/books/').status_code == status.HTTP_403_FORBIDDEN

    def test_a_student_reads_the_catalogue_but_not_the_desk(self, make_authenticated_client):
        client, _ = make_authenticated_client('student')
        make_book()
        assert client.get('/imboni/library/catalogue/').status_code == status.HTTP_200_OK
        assert client.get('/imboni/library/loans/').status_code == status.HTTP_403_FORBIDDEN


# ── Issuing and returning ─────────────────────────────────────────────────────

@pytest.mark.django_db
class TestCirculation:
    def test_issuing_marks_the_copy_out_and_dates_it(self, settings_row):
        book = make_book()
        copy = book.copies.first()
        student = UserFactory(role='student')

        loan = services.issue(copy, student)

        copy.refresh_from_db()
        assert copy.status == 'on_loan'
        assert loan.due_on == timezone.localdate() + timedelta(
            days=settings_row.loan_period_days)
        assert loan.status == 'on_loan'

    def test_a_copy_cannot_go_out_twice(self):
        book = make_book()
        copy = book.copies.first()
        services.issue(copy, UserFactory(role='student'))

        with pytest.raises(services.LibraryError, match='already on loan'):
            services.issue(copy, UserFactory(role='student'))

    def test_the_borrowing_limit_is_enforced_and_says_why(self, settings_row):
        settings_row.max_books_student = 1
        settings_row.save()
        student = UserFactory(role='student')
        services.issue(make_book('One').copies.first(), student)

        with pytest.raises(services.LibraryError, match='already has 1 of 1'):
            services.issue(make_book('Two').copies.first(), student)

    def test_an_overdue_book_blocks_further_borrowing(self):
        student = UserFactory(role='student')
        loan = services.issue(make_book('Late').copies.first(), student)
        loan.due_on = timezone.localdate() - timedelta(days=2)
        loan.save(update_fields=['due_on'])

        with pytest.raises(services.LibraryError, match='overdue'):
            services.issue(make_book('Next').copies.first(), student)

    def test_returning_on_time_charges_nothing_and_reshelves(self):
        book = make_book()
        copy = book.copies.first()
        loan = services.issue(copy, UserFactory(role='student'))

        loan, fine, reservation = services.return_loan(loan)

        copy.refresh_from_db()
        assert copy.status == 'available'
        assert fine is None and reservation is None
        assert loan.status == 'returned'

    def test_returning_late_charges_the_daily_rate(self, settings_row):
        settings_row.fine_per_day = Decimal('50.00')
        settings_row.save()
        loan = services.issue(make_book().copies.first(), UserFactory(role='student'))
        loan.due_on = timezone.localdate() - timedelta(days=3)
        loan.save(update_fields=['due_on'])

        _loan, fine, _res = services.return_loan(loan)

        assert fine is not None
        assert fine.days_late == 3
        assert fine.amount == Decimal('150.00')

    def test_a_fine_stops_growing_once_the_book_is_back(self, settings_row):
        """days_late counts to the RETURN date, not to today."""
        settings_row.fine_per_day = Decimal('10.00')
        settings_row.save()
        loan = services.issue(make_book().copies.first(), UserFactory(role='student'))
        loan.due_on = timezone.localdate() - timedelta(days=5)
        loan.save(update_fields=['due_on'])
        services.return_loan(loan)

        loan.refresh_from_db()
        assert loan.days_late == 5
        # ...and it stays 5 however long the returned loan sits in the table.
        assert loan.status == 'returned'


# ── Renewal ───────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestRenewal:
    def test_renewing_pushes_the_due_date_out(self, settings_row):
        loan = services.issue(make_book().copies.first(), UserFactory(role='student'))
        original = loan.due_on

        services.renew(loan)

        assert loan.due_on == original + timedelta(days=settings_row.loan_period_days)
        assert loan.renewed_count == 1

    def test_the_allowance_is_finite(self, settings_row):
        settings_row.renewals_allowed = 1
        settings_row.save()
        loan = services.issue(make_book().copies.first(), UserFactory(role='student'))
        services.renew(loan)

        with pytest.raises(services.LibraryError, match='already been renewed'):
            services.renew(loan)

    def test_a_queue_beats_a_renewal(self):
        book = make_book()
        loan = services.issue(book.copies.first(), UserFactory(role='student'))
        Reservation.objects.create(book=book, member=UserFactory(role='student'))

        with pytest.raises(services.LibraryError, match='waiting'):
            services.renew(loan)


# ── Reservations ──────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestReservations:
    def test_you_cannot_queue_for_a_book_on_the_shelf(self):
        book = make_book()
        with pytest.raises(services.LibraryError, match='on the shelf'):
            services.reserve(book, UserFactory(role='student'))

    def test_returning_hands_the_copy_to_the_next_in_the_queue(self, settings_row):
        book = make_book()
        copy = book.copies.first()
        loan = services.issue(copy, UserFactory(role='student'))
        waiting = UserFactory(role='student')
        services.reserve(book, waiting)

        _loan, _fine, reservation = services.return_loan(loan)

        copy.refresh_from_db()
        assert copy.status == 'reserved'          # on the hold shelf, not back in stock
        assert reservation.member_id == waiting.id
        assert reservation.status == 'ready'
        assert reservation.expires_on == timezone.localdate() + timedelta(
            days=settings_row.reservation_hold_days)

    def test_a_held_copy_goes_only_to_the_person_it_is_held_for(self):
        book = make_book()
        copy = book.copies.first()
        loan = services.issue(copy, UserFactory(role='student'))
        waiting = UserFactory(role='student')
        services.reserve(book, waiting)
        services.return_loan(loan)

        with pytest.raises(services.LibraryError, match='on hold for'):
            services.issue(copy, UserFactory(role='student'))

    def test_collecting_a_hold_closes_the_reservation(self):
        book = make_book()
        copy = book.copies.first()
        loan = services.issue(copy, UserFactory(role='student'))
        waiting = UserFactory(role='student')
        res = services.reserve(book, waiting)
        services.return_loan(loan)

        services.issue(copy, waiting)

        res.refresh_from_db()
        assert res.status == 'collected'

    def test_queue_position_is_counted_not_stored(self):
        """Cancelling ahead of you moves you up without anybody rewriting a number."""
        book = make_book()
        services.issue(book.copies.first(), UserFactory(role='student'))
        first, second = UserFactory(role='student'), UserFactory(role='student')
        res_one = services.reserve(book, first)
        res_two = services.reserve(book, second)

        from apps.library.serializers import ReservationSerializer
        assert ReservationSerializer(res_two).data['position'] == 2

        services.cancel_reservation(res_one)
        assert ReservationSerializer(res_two).data['position'] == 1

    def test_a_lapsed_hold_is_released_to_the_next_person(self, settings_row):
        book = make_book()
        copy = book.copies.first()
        loan = services.issue(copy, UserFactory(role='student'))
        first, second = UserFactory(role='student'), UserFactory(role='student')
        services.reserve(book, first)
        services.reserve(book, second)
        _l, _f, held = services.return_loan(loan)

        held.expires_on = timezone.localdate() - timedelta(days=1)
        held.save(update_fields=['expires_on'])
        released = services.expire_stale_holds()

        held.refresh_from_db()
        assert released == 1
        assert held.status == 'expired'
        next_up = Reservation.objects.get(member=second)
        assert next_up.status == 'ready'


# ── Acquisitions ──────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestAcquisitions:
    def test_the_librarian_asks_and_the_office_decides(self, api_client):
        librarian = UserFactory(role='librarian')
        api_client.force_authenticate(librarian)
        response = api_client.post('/imboni/library/acquisitions/', {
            'title': 'A Grain of Wheat', 'quantity': 3, 'unit_price': '9000.00',
        })
        assert response.status_code == status.HTTP_201_CREATED
        request_id = response.data['id']

        # The person who asked cannot approve their own request.
        decision_url = f'/imboni/library/acquisitions/{request_id}/decision/'
        assert api_client.post(decision_url, {'decision': 'approved'}).status_code == \
            status.HTTP_403_FORBIDDEN

        api_client.force_authenticate(UserFactory(role='admin'))
        assert api_client.post(decision_url, {'decision': 'approved'}).status_code == \
            status.HTTP_200_OK

    def test_receiving_catalogues_the_title_and_adds_the_copies(self, api_client):
        librarian = UserFactory(role='librarian')
        req = AcquisitionRequest.objects.create(
            title='Weep Not, Child', quantity=2, status='approved',
            requested_by=librarian, unit_price=Decimal('8000'),
        )
        api_client.force_authenticate(librarian)

        response = api_client.post(f'/imboni/library/acquisitions/{req.id}/receive/', {})

        assert response.status_code == status.HTTP_201_CREATED
        assert len(response.data['copies']) == 2
        book = Book.objects.get(title='Weep Not, Child')
        assert book.available_copies == 2
        req.refresh_from_db()
        assert req.status == 'received' and req.book_id == book.id

    def test_only_an_approved_request_can_be_received(self, api_client):
        librarian = UserFactory(role='librarian')
        req = AcquisitionRequest.objects.create(title='Pending', requested_by=librarian)
        api_client.force_authenticate(librarian)

        response = api_client.post(f'/imboni/library/acquisitions/{req.id}/receive/', {})
        assert response.status_code == status.HTTP_400_BAD_REQUEST


# ── The desk, over HTTP ───────────────────────────────────────────────────────

@pytest.mark.django_db
class TestDeskEndpoints:
    def test_issue_by_scanning_the_copy_code(self, make_authenticated_client):
        client, _ = make_authenticated_client('librarian')
        make_book(title='Purple Hibiscus')
        student = UserFactory(role='student')

        response = client.post('/imboni/library/loans/issue/', {
            'copy_code': 'PUR-000', 'borrower': str(student.id),
        })

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['book_title'] == 'Purple Hibiscus'

    def test_an_unknown_code_says_so(self, make_authenticated_client):
        client, _ = make_authenticated_client('librarian')
        student = UserFactory(role='student')
        response = client.post('/imboni/library/loans/issue/', {
            'copy_code': 'NOPE-1', 'borrower': str(student.id),
        })
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_returning_reports_who_the_copy_is_now_held_for(self, make_authenticated_client):
        client, _ = make_authenticated_client('librarian')
        book = make_book()
        loan = services.issue(book.copies.first(), UserFactory(role='student'))
        waiting = UserFactory(role='student', first_name='Aline', last_name='K')
        services.reserve(book, waiting)

        response = client.post(f'/imboni/library/loans/{loan.id}/return/', {})

        assert response.status_code == status.HTTP_200_OK
        assert response.data['held_for']['name'] == 'Aline K'

    def test_a_fine_can_be_paid_or_waived(self, make_authenticated_client):
        client, _ = make_authenticated_client('librarian')
        loan = services.issue(make_book().copies.first(), UserFactory(role='student'))
        fine = Fine.objects.create(loan=loan, days_late=2, rate=Decimal('50'),
                                   amount=Decimal('100'))

        response = client.post(f'/imboni/library/fines/{fine.id}/', {'action': 'pay'})

        assert response.status_code == status.HTTP_200_OK
        assert response.data['paid'] is True
        assert response.data['outstanding'] is False

    def test_the_dashboard_counts_what_is_out_and_late(self, make_authenticated_client):
        client, _ = make_authenticated_client('librarian')
        loan = services.issue(make_book('Overdue One').copies.first(),
                              UserFactory(role='student'))
        loan.due_on = timezone.localdate() - timedelta(days=1)
        loan.save(update_fields=['due_on'])
        services.issue(make_book('On Time').copies.first(), UserFactory(role='student'))

        response = client.get('/imboni/library/dashboard/')

        assert response.data['on_loan'] == 2
        assert response.data['overdue'] == 1
        assert response.data['titles'] == 2

    def test_a_title_with_a_copy_out_is_not_deleted(self, make_authenticated_client):
        client, _ = make_authenticated_client('librarian')
        book = make_book()
        services.issue(book.copies.first(), UserFactory(role='student'))

        response = client.delete(f'/imboni/library/books/{book.id}/')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert Book.objects.filter(pk=book.id).exists()


# ── The student's side ────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestStudentLibrary:
    def test_a_student_sees_their_own_loans_only(self, api_client):
        mine = UserFactory(role='student')
        theirs = UserFactory(role='student')
        services.issue(make_book('Mine').copies.first(), mine)
        services.issue(make_book('Theirs').copies.first(), theirs)
        api_client.force_authenticate(mine)

        response = api_client.get('/imboni/library/me/')

        titles = [row['book_title'] for row in response.data['loans']]
        assert titles == ['Mine']

    def test_a_student_can_join_and_leave_a_queue(self, api_client):
        book = make_book()
        services.issue(book.copies.first(), UserFactory(role='student'))
        student = UserFactory(role='student')
        api_client.force_authenticate(student)

        created = api_client.post('/imboni/library/me/reserve/', {'book': str(book.id)})
        assert created.status_code == status.HTTP_201_CREATED
        assert created.data['position'] == 1

        cancelled = api_client.post(
            f"/imboni/library/reservations/{created.data['id']}/cancel/", {})
        assert cancelled.status_code == status.HTTP_200_OK
        assert cancelled.data['status'] == 'cancelled'

    def test_a_student_cannot_cancel_somebody_else_s_reservation(self, api_client):
        book = make_book()
        services.issue(book.copies.first(), UserFactory(role='student'))
        res = services.reserve(book, UserFactory(role='student'))
        api_client.force_authenticate(UserFactory(role='student'))

        response = api_client.post(f'/imboni/library/reservations/{res.id}/cancel/', {})

        assert response.status_code == status.HTTP_403_FORBIDDEN
