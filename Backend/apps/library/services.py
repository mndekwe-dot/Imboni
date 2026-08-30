"""
The rules of the library, kept out of the views.

Issuing, returning, renewing and the hold queue are the only places in this app
where several tables have to move together, so they live in one module that the
views call and the tests exercise directly. A view that did this inline would
have to be driven through HTTP to prove that returning a book hands it to the
next person waiting.
"""
from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from .models import Fine, LibrarySettings, Loan, Reservation


class LibraryError(Exception):
    """A rule was broken. The message is shown to the librarian as-is."""


def _today():
    return timezone.localdate()


def open_loans_for(user):
    return Loan.objects.filter(borrower=user, returned_at__isnull=True)


def outstanding_fines_for(user):
    return Fine.objects.filter(loan__borrower=user, paid=False, waived=False)


def borrowing_block(user, settings_row=None):
    """
    Why this person may not borrow right now, or None if they may.

    Returns a reason rather than a boolean so the librarian is told which rule
    stopped them -- "at their limit" and "has an overdue book" need different
    answers at the desk, and a bare False sends them to guess.
    """
    settings_row = settings_row or LibrarySettings.load()
    overdue = [loan for loan in open_loans_for(user) if loan.is_overdue]
    if overdue:
        titles = ', '.join(loan.copy.book.title for loan in overdue[:3])
        return f'{user.get_full_name()} has an overdue book ({titles}).'
    limit = settings_row.max_books_for(user)
    current = open_loans_for(user).count()
    if current >= limit:
        return f'{user.get_full_name()} already has {current} of {limit} books out.'
    return None


@transaction.atomic
def issue(copy, borrower, issued_by=None, settings_row=None):
    """Put a copy in someone's hands, and close the hold that was waiting for it."""
    settings_row = settings_row or LibrarySettings.load()

    if copy.status == 'on_loan':
        raise LibraryError(f'{copy.copy_code} is already on loan.')
    if copy.status in ('lost', 'withdrawn'):
        raise LibraryError(f'{copy.copy_code} is marked {copy.get_status_display().lower()}.')

    # A copy on the hold shelf may only go to the person it is being held for.
    held = copy.reservations.filter(status='ready').first()
    if copy.status == 'reserved' and held and held.member_id != borrower.id:
        raise LibraryError(
            f'{copy.copy_code} is on hold for {held.member.get_full_name()}.')

    blocked = borrowing_block(borrower, settings_row)
    if blocked:
        raise LibraryError(blocked)

    loan = Loan.objects.create(
        copy=copy,
        borrower=borrower,
        issued_by=issued_by,
        due_on=Loan.due_date_from(settings_row),
    )
    copy.status = 'on_loan'
    copy.save(update_fields=['status'])

    if held and held.member_id == borrower.id:
        held.status = 'collected'
        held.closed_at = timezone.now()
        held.save(update_fields=['status', 'closed_at'])

    return loan


@transaction.atomic
def return_loan(loan, received_by=None, settings_row=None):
    """
    Take a book back: close the loan, charge for lateness, then re-shelve it --
    on the hold shelf if someone is waiting, otherwise back into stock.

    Returns ``(loan, fine, reservation)``; the last two are None when there was
    nothing to charge and nobody waiting.
    """
    if loan.returned_at is not None:
        raise LibraryError('That loan is already closed.')
    settings_row = settings_row or LibrarySettings.load()

    loan.returned_at = timezone.now()
    loan.returned_to = received_by
    loan.save(update_fields=['returned_at', 'returned_to'])

    fine = None
    days = loan.days_late
    rate = Decimal(settings_row.fine_per_day or 0)
    if days > 0 and rate > 0:
        # Stored, not recomputed: changing the rate in Settings tomorrow must
        # not change a fine already handed to a student today.
        fine = Fine.objects.create(
            loan=loan, days_late=days, rate=rate, amount=rate * days,
        )

    reservation = _next_in_queue(loan.copy, settings_row)
    return loan, fine, reservation


def _next_in_queue(copy, settings_row):
    """Hand a returned copy to the next person waiting, if there is one."""
    waiting = (Reservation.objects
               .filter(book=copy.book, status='waiting')
               .order_by('created_at')
               .first())
    if waiting is None:
        copy.status = 'available'
        copy.save(update_fields=['status'])
        return None

    waiting.status = 'ready'
    waiting.copy = copy
    waiting.ready_at = timezone.now()
    waiting.expires_on = _today() + timedelta(days=settings_row.reservation_hold_days)
    waiting.save(update_fields=['status', 'copy', 'ready_at', 'expires_on'])

    copy.status = 'reserved'
    copy.save(update_fields=['status'])
    return waiting


@transaction.atomic
def renew(loan, settings_row=None):
    """
    Push the due date out by another loan period.

    Refused for an overdue book, for a loan already renewed its allowance, and
    for a title someone else is queueing for -- renewing past a queue is how a
    hold list stops meaning anything.
    """
    settings_row = settings_row or LibrarySettings.load()

    if loan.returned_at is not None:
        raise LibraryError('That loan is already closed.')
    if loan.is_overdue:
        raise LibraryError('An overdue book has to be brought back before it can be renewed.')
    if loan.renewed_count >= settings_row.renewals_allowed:
        raise LibraryError(
            f'This loan has already been renewed {loan.renewed_count} time(s).')
    if Reservation.objects.filter(book=loan.copy.book, status='waiting').exists():
        raise LibraryError('Someone is waiting for this title.')

    loan.due_on = loan.due_on + timedelta(days=settings_row.loan_period_days)
    loan.renewed_count += 1
    loan.save(update_fields=['due_on', 'renewed_count'])
    return loan


@transaction.atomic
def reserve(book, member):
    """Join the queue for a title. One open reservation per person per title."""
    if Reservation.objects.filter(book=book, member=member,
                                  status__in=['waiting', 'ready']).exists():
        raise LibraryError('You are already in the queue for this title.')
    if book.copies.filter(status='available').exists():
        raise LibraryError('A copy is on the shelf -- it can be borrowed now.')
    if open_loans_for(member).filter(copy__book=book).exists():
        raise LibraryError('You already have a copy of this title.')
    return Reservation.objects.create(book=book, member=member)


@transaction.atomic
def cancel_reservation(reservation, settings_row=None):
    """Leave the queue, and pass a held copy on to whoever is next."""
    if not reservation.is_open:
        raise LibraryError('That reservation is already closed.')
    settings_row = settings_row or LibrarySettings.load()

    copy = reservation.copy
    reservation.status = 'cancelled'
    reservation.closed_at = timezone.now()
    reservation.copy = None
    reservation.save(update_fields=['status', 'closed_at', 'copy'])

    if copy is not None:
        _next_in_queue(copy, settings_row)
    return reservation


@transaction.atomic
def expire_stale_holds(settings_row=None):
    """
    Release hold-shelf copies nobody came for, oldest first.

    Called when the circulation desk is opened rather than on a timer: this app
    has no scheduler, and a hold that lapsed overnight must not still be held
    when the queue is looked at in the morning.
    """
    settings_row = settings_row or LibrarySettings.load()
    released = 0
    for res in Reservation.objects.filter(status='ready', expires_on__lt=_today()):
        copy = res.copy
        res.status = 'expired'
        res.closed_at = timezone.now()
        res.copy = None
        res.save(update_fields=['status', 'closed_at', 'copy'])
        if copy is not None:
            _next_in_queue(copy, settings_row)
        released += 1
    return released
