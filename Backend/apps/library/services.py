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


# ── Counting the shelves ──────────────────────────────────────────────────────

def stocktake_scope(stocktake):
    """
    Every copy this count is responsible for.

    Withdrawn copies are excluded: they have already left the collection on
    purpose, and listing them as missing every time would bury the copies that
    are genuinely unaccounted for.
    """
    from .models import BookCopy

    qs = BookCopy.objects.select_related('book').exclude(status='withdrawn')
    if stocktake.scope_shelf:
        qs = qs.filter(book__shelf=stocktake.scope_shelf)
    if stocktake.scope_category:
        qs = qs.filter(book__category=stocktake.scope_category)
    return qs


def record_scan(stocktake, copy, *, found_as='shelf', note='', scanned_by=None):
    """
    Tick one copy off. Scanning the same barcode twice is harmless.

    The person counting is holding a scanner and a stack of books, not watching
    the screen, so a duplicate must update rather than raise.
    """
    from .models import StocktakeScan

    if stocktake.status != 'open':
        raise LibraryError('This count is closed.')
    scan, created = StocktakeScan.objects.update_or_create(
        stocktake=stocktake, copy=copy,
        defaults={'found_as': found_as, 'note': note, 'scanned_by': scanned_by},
    )
    return scan, created


def stocktake_progress(stocktake):
    """
    Seen, still to find, and what that means, at any point during a count.

    A copy that is out on loan is NOT missing -- somebody has it and the system
    knows who -- so it is counted separately. Lumping the two together is how a
    stocktake produces a frightening number that turns out to be the S4 set
    texts, all properly issued.
    """
    from .models import Loan

    scope = stocktake_scope(stocktake)
    total = scope.count()
    seen_ids = set(stocktake.scans.values_list('copy_id', flat=True))

    on_loan_ids = set(Loan.objects.filter(returned_at__isnull=True,
                                          copy__in=scope).values_list('copy_id', flat=True))
    unseen = [c for c in scope if c.id not in seen_ids]
    unseen_on_loan = [c for c in unseen if c.id in on_loan_ids]
    unaccounted = [c for c in unseen if c.id not in on_loan_ids]

    return {
        'total': total,
        'seen': len(seen_ids),
        'on_loan': len(unseen_on_loan),
        'unaccounted': len(unaccounted),
        'unaccounted_copies': unaccounted,
        'on_loan_copies': unseen_on_loan,
        'percent_seen': round(len(seen_ids) / total * 100, 1) if total else 0.0,
    }


@transaction.atomic
def close_stocktake(stocktake, *, closed_by=None, mark_missing=False):
    """
    Finish the count. Optionally mark what was never found as lost.

    `mark_missing` defaults to FALSE. Closing a count and writing off books are
    two different decisions, and a librarian who closes a count at the end of a
    long afternoon must not discover afterwards that four hundred copies were
    marked lost because a shelf had not been reached yet.
    """
    from .models import CopyEvent

    if stocktake.status != 'open':
        raise LibraryError('This count is already closed.')

    progress = stocktake_progress(stocktake)
    marked = 0
    if mark_missing:
        for copy in progress['unaccounted_copies']:
            CopyEvent.objects.create(
                copy=copy, kind='lost', stocktake=stocktake, recorded_by=closed_by,
                reason=f'Not found during {stocktake.name}.')
            copy.status = 'lost'
            copy.save(update_fields=['status'])
            marked += 1

    stocktake.status = 'closed'
    stocktake.closed_at = timezone.now()
    stocktake.closed_by = closed_by
    stocktake.save(update_fields=['status', 'closed_at', 'closed_by'])
    return {**{k: v for k, v in progress.items() if not k.endswith('_copies')},
            'marked_lost': marked}


# ── A copy's fate ─────────────────────────────────────────────────────────────

# What each event does to the copy's status. `None` means "leave it alone".
_EVENT_STATUS = {
    'lost': 'lost',
    'found': 'available',
    'damaged': None,            # condition changes, not status: it is still here
    'repaired': None,
    'written_off': 'withdrawn',
    'withdrawn': 'withdrawn',
    'restored': 'available',
}


@transaction.atomic
def record_copy_event(copy, kind, *, reason='', borrower=None, charged=None,
                      recorded_by=None, stocktake=None):
    """
    Note what happened to one physical book, and move its status to match.

    Returning a lost copy to the shelf while an open loan still points at it
    would leave the borrower owing a book that is back on the shelf, so the
    loan is closed here rather than left for somebody to notice.
    """
    from .models import CopyEvent, Loan

    if kind not in dict(CopyEvent.KIND_CHOICES):
        raise LibraryError('That is not something that happens to a book.')

    event = CopyEvent.objects.create(
        copy=copy, kind=kind, reason=reason[:255], borrower=borrower,
        charged=charged, recorded_by=recorded_by, stocktake=stocktake)

    if kind == 'damaged':
        copy.condition = 'damaged'
        copy.save(update_fields=['condition'])
    elif kind == 'repaired':
        copy.condition = 'fair'
        copy.save(update_fields=['condition'])

    new_status = _EVENT_STATUS.get(kind)
    if new_status:
        copy.status = new_status
        copy.save(update_fields=['status'])

    if kind in ('lost', 'written_off', 'found', 'restored'):
        open_loan = Loan.objects.filter(copy=copy, returned_at__isnull=True).first()
        if open_loan is not None:
            open_loan.returned_at = timezone.now()
            open_loan.returned_to = recorded_by
            open_loan.save(update_fields=['returned_at', 'returned_to'])

    return event


# ── Chasing what is late ──────────────────────────────────────────────────────

def overdue_loans(*, grade='', stream='', as_of=None):
    """
    Every loan past its due date, newest debt last.

    Filterable by class because that is how a school chases: the notices go to
    a form teacher for one register, not to two hundred pupils individually.
    """
    from .models import Loan

    as_of = as_of or _today()
    qs = (Loan.objects.filter(returned_at__isnull=True, due_on__lt=as_of)
          .select_related('copy__book', 'borrower'))
    if grade:
        qs = qs.filter(borrower__student_profile__grade=grade)
    if stream:
        qs = qs.filter(borrower__student_profile__section=stream)
    return qs.order_by('due_on')


def borrower_history(user, *, limit=None):
    """
    Everything one person has borrowed, and where they stand today.

    The page a librarian opens when a pupil is at the desk asking why they
    cannot take another book out.
    """
    from .models import Fine, Loan

    loans = (Loan.objects.filter(borrower=user)
             .select_related('copy__book').order_by('-issued_at'))
    open_loans = [loan for loan in loans if loan.returned_at is None]
    today = _today()

    fines = Fine.objects.filter(loan__borrower=user).select_related('loan__copy__book')
    owed = sum((f.amount for f in fines if not f.is_paid and not f.waived_at), Decimal('0'))

    return {
        'borrower': user,
        'loans': list(loans[:limit] if limit else loans),
        'open_loans': open_loans,
        'overdue': [loan for loan in open_loans if loan.due_on < today],
        'total_borrowed': loans.count(),
        'fines': list(fines),
        'owed': owed,
        'block': borrowing_block(user),
    }


# ── What the collection is actually doing ─────────────────────────────────────

def usage_report(*, since=None, until=None, limit=20):
    """
    What gets borrowed, what never moves, and who reads.

    Dead stock is the half nobody asks for and the half that decides next
    year's acquisition budget: a title that has not left the shelf in a year is
    money already spent, and knowing which titles those are is what stops the
    school buying six more of them.
    """
    from django.db.models import Count

    from .models import Book, Loan

    loans = Loan.objects.all()
    if since:
        loans = loans.filter(issued_at__date__gte=since)
    if until:
        loans = loans.filter(issued_at__date__lte=until)

    popular = (loans.values('copy__book__id', 'copy__book__title', 'copy__book__author')
               .annotate(times=Count('id')).order_by('-times')[:limit])

    borrowed_book_ids = set(loans.values_list('copy__book_id', flat=True))
    dead_stock = (Book.objects.exclude(id__in=borrowed_book_ids)
                  .order_by('title')[:limit])

    by_class = (loans.exclude(borrower__student_profile__isnull=True)
                .values('borrower__student_profile__grade',
                        'borrower__student_profile__section')
                .annotate(times=Count('id')).order_by('-times'))

    by_category = (loans.values('copy__book__category')
                   .annotate(times=Count('id')).order_by('-times'))

    return {
        'total_loans': loans.count(),
        'popular': list(popular),
        'dead_stock': list(dead_stock),
        'by_class': list(by_class),
        'by_category': list(by_category),
    }


# ── Loading a catalogue somebody already has ──────────────────────────────────

IMPORT_COLUMNS = ('title', 'author', 'isbn', 'category', 'shelf', 'published_year',
                  'publisher', 'copies', 'copy_prefix')


@transaction.atomic
def import_books(rows, *, created_by=None):
    """
    Load a catalogue from a spreadsheet, one book per row.

    Matches on ISBN first and title+author second, so re-importing a corrected
    file updates the same books rather than creating a second copy of the
    library. A school with three thousand books will not type them in, and an
    import that duplicates on the second run is one nobody dares use twice.

    Returns per-row outcomes rather than raising on the first bad line: a
    3,000-row file with two broken rows should import 2,998 books and tell you
    about the two.
    """
    from .models import Book, BookCopy

    created = updated = copies_made = 0
    problems = []

    for index, row in enumerate(rows, start=2):        # row 1 is the header
        title = (row.get('title') or '').strip()
        if not title:
            problems.append({'row': index, 'error': 'No title.'})
            continue

        isbn = (row.get('isbn') or '').strip()
        author = (row.get('author') or '').strip()

        book = None
        if isbn:
            book = Book.objects.filter(isbn=isbn).first()
        if book is None:
            book = Book.objects.filter(title__iexact=title, author__iexact=author).first()

        fields = {
            'title': title,
            'author': author,
            'isbn': isbn,
            'category': (row.get('category') or '').strip(),
            'shelf': (row.get('shelf') or '').strip(),
            'publisher': (row.get('publisher') or '').strip(),
        }
        year = (row.get('published_year') or '').strip()
        if year.isdigit():
            fields['published_year'] = int(year)

        if book is None:
            book = Book.objects.create(**fields)
            created += 1
        else:
            for key, value in fields.items():
                if value:                    # never blank an existing value
                    setattr(book, key, value)
            book.save()
            updated += 1

        wanted = (row.get('copies') or '').strip()
        if wanted.isdigit() and int(wanted) > 0:
            prefix = (row.get('copy_prefix') or '').strip() or _copy_prefix(book)
            existing = book.copies.count()
            for n in range(int(wanted)):
                code = f'{prefix}-{existing + n + 1:04d}'
                if BookCopy.objects.filter(copy_code=code).exists():
                    continue
                BookCopy.objects.create(book=book, copy_code=code)
                copies_made += 1

    return {'created': created, 'updated': updated, 'copies': copies_made,
            'problems': problems}


def _copy_prefix(book):
    """A readable barcode stem from the title: 'Things Fall Apart' -> 'THI'."""
    letters = ''.join(c for c in book.title.upper() if c.isalnum())
    return (letters[:3] or 'BOK')
