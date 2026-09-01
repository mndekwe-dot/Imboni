"""
The school library: what it owns, who has it, and what is owed.

Deliberately NOT here: a LibraryMember table. A borrower is a `User` — every
student and every member of staff already has one, with a name, a class and a
photo the library would otherwise duplicate and then have to keep in step. A
second roster is a second thing to go stale: a student who leaves would still be
a library member. Borrowing limits come from LibrarySettings by role instead,
which is how the school actually thinks about them ("students three, staff
five"), and a borrower who must be stopped is stopped by the account they
already have.
"""
import uuid
from datetime import timedelta

from django.db import models
from django.utils import timezone

from apps.authentication.models import User


def _today():
    return timezone.localdate()


class LibrarySettings(models.Model):
    """
    The library's own rules. One row per school.

    A singleton by convention rather than by constraint: `load()` returns the
    row or creates it with the defaults, so a fresh school has working rules
    before the librarian has visited Settings once.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    loan_period_days   = models.PositiveSmallIntegerField(default=14)
    max_books_student  = models.PositiveSmallIntegerField(default=3)
    max_books_staff    = models.PositiveSmallIntegerField(default=5)
    renewals_allowed   = models.PositiveSmallIntegerField(default=1)

    # Money is Decimal, never float: a fine of 0.1/day accumulated in binary
    # floating point stops being a round number by the third week.
    fine_per_day       = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    currency           = models.CharField(max_length=8, default='RWF')

    # How long a reserved book waits on the hold shelf before the next person
    # in the queue gets it.
    reservation_hold_days = models.PositiveSmallIntegerField(default=3)

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'library_settings'
        verbose_name_plural = 'library settings'

    def __str__(self):
        return f'Library settings (loan {self.loan_period_days}d)'

    @classmethod
    def load(cls):
        return cls.objects.first() or cls.objects.create()

    def max_books_for(self, user):
        return self.max_books_student if getattr(user, 'role', None) == 'student' \
            else self.max_books_staff


class Supplier(models.Model):
    """Where books are bought. Only ever referenced by acquisitions and copies."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name         = models.CharField(max_length=200)
    contact_name = models.CharField(max_length=200, blank=True)
    email        = models.EmailField(blank=True)
    phone        = models.CharField(max_length=30, blank=True)
    notes        = models.TextField(blank=True)
    is_active    = models.BooleanField(default=True)
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'library_suppliers'
        ordering = ['name']

    def __str__(self):
        return self.name


class Book(models.Model):
    """
    A TITLE, not a physical object.

    The distinction is the whole model: a school owns four copies of one book,
    and a loan is of a copy while a reservation is of a title (any copy will
    do). Collapsing the two is what makes a library system unable to answer
    "how many are on the shelf".
    """
    CATEGORY_CHOICES = [
        ('textbook',   'Textbook'),
        ('fiction',    'Fiction'),
        ('nonfiction', 'Non-fiction'),
        ('reference',  'Reference'),
        ('periodical', 'Periodical'),
        ('other',      'Other'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title       = models.CharField(max_length=300)
    author      = models.CharField(max_length=200, blank=True)
    # Not unique: a school legitimately catalogues two editions, and a blank
    # ISBN (old or locally produced stock) must not collide with another blank.
    isbn        = models.CharField(max_length=20, blank=True, db_index=True)
    publisher   = models.CharField(max_length=200, blank=True)
    published_year = models.PositiveSmallIntegerField(null=True, blank=True)
    category    = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='other')
    language    = models.CharField(max_length=40, blank=True)
    subject     = models.CharField(max_length=100, blank=True)
    description = models.TextField(blank=True)
    shelf       = models.CharField(max_length=50, blank=True)
    cover_url   = models.URLField(blank=True)

    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'library_books'
        ordering = ['title']
        indexes = [models.Index(fields=['title']), models.Index(fields=['author'])]

    def __str__(self):
        return self.title

    @property
    def total_copies(self):
        return self.copies.exclude(status='withdrawn').count()

    @property
    def available_copies(self):
        return self.copies.filter(status='available').count()


class BookCopy(models.Model):
    """One physical object on one shelf, with its own barcode and its own fate."""
    CONDITION_CHOICES = [
        ('new',      'New'),
        ('good',     'Good'),
        ('fair',     'Fair'),
        ('poor',     'Poor'),
        ('damaged',  'Damaged'),
    ]
    STATUS_CHOICES = [
        ('available', 'Available'),
        ('on_loan',   'On loan'),
        ('reserved',  'On hold shelf'),
        ('lost',      'Lost'),
        ('withdrawn', 'Withdrawn'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    book        = models.ForeignKey(Book, on_delete=models.CASCADE, related_name='copies')
    copy_code   = models.CharField(max_length=40, unique=True)
    condition   = models.CharField(max_length=10, choices=CONDITION_CHOICES, default='good')
    status      = models.CharField(max_length=10, choices=STATUS_CHOICES, default='available')
    acquired_on = models.DateField(null=True, blank=True)
    price       = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    supplier    = models.ForeignKey(Supplier, on_delete=models.SET_NULL, null=True, blank=True,
                                    related_name='copies')
    notes       = models.TextField(blank=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'library_book_copies'
        ordering = ['copy_code']

    def __str__(self):
        return f'{self.copy_code} ({self.book.title})'


class Loan(models.Model):
    """
    One copy, out with one person, due back on one date.

    `returned_at` being null is what "still out" means — there is no status
    column to disagree with it. Overdue is likewise derived from the date, so a
    loan cannot be marked on-time while being three weeks late.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    copy       = models.ForeignKey(BookCopy, on_delete=models.PROTECT, related_name='loans')
    borrower   = models.ForeignKey(User, on_delete=models.PROTECT, related_name='library_loans')
    issued_by  = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                   related_name='library_loans_issued')
    issued_at  = models.DateTimeField(default=timezone.now)
    due_on     = models.DateField()
    returned_at = models.DateTimeField(null=True, blank=True)
    returned_to = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                    related_name='library_loans_received')
    renewed_count = models.PositiveSmallIntegerField(default=0)
    notes      = models.TextField(blank=True)

    class Meta:
        db_table = 'library_loans'
        ordering = ['-issued_at']
        indexes = [
            models.Index(fields=['borrower', 'returned_at']),
            models.Index(fields=['due_on']),
        ]

    def __str__(self):
        return f'{self.copy.copy_code} -> {self.borrower.get_full_name()}'

    @property
    def is_returned(self):
        return self.returned_at is not None

    @property
    def days_late(self):
        """
        How many days past due, counted to the RETURN date once returned.

        Counting an already-returned loan to today would keep growing a fine
        that stopped accruing the moment the book came back.
        """
        # localtime() first: `returned_at` is stored in UTC and `due_on` is a
        # LOCAL date, so .date() on the raw timestamp compares a UTC day with a
        # local one. In a +02:00 school that silently forgave a day's fine on
        # every book brought back before 02:00.
        end = timezone.localtime(self.returned_at).date() if self.returned_at else _today()
        return max((end - self.due_on).days, 0)

    @property
    def is_overdue(self):
        return not self.is_returned and self.days_late > 0

    @property
    def status(self):
        if self.is_returned:
            return 'returned'
        return 'overdue' if self.days_late > 0 else 'on_loan'

    @classmethod
    def due_date_from(cls, settings_row, start=None):
        return (start or _today()) + timedelta(days=settings_row.loan_period_days)


class Fine(models.Model):
    """
    What a late return cost, frozen at the moment it was worked out.

    The amount is STORED rather than recomputed on read: the daily rate can be
    changed in Settings, and a fine already handed to a student must not change
    because the school later decided lateness costs more.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    loan      = models.OneToOneField(Loan, on_delete=models.CASCADE, related_name='fine')
    days_late = models.PositiveSmallIntegerField()
    rate      = models.DecimalField(max_digits=8, decimal_places=2)
    amount    = models.DecimalField(max_digits=10, decimal_places=2)
    paid      = models.BooleanField(default=False)
    paid_at   = models.DateTimeField(null=True, blank=True)
    waived    = models.BooleanField(default=False)
    waived_reason = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'library_fines'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.amount} on {self.loan_id}'

    @property
    def outstanding(self):
        return not self.paid and not self.waived


class Reservation(models.Model):
    """
    A place in the queue for a TITLE.

    Ordered by `created_at`, so position is derived rather than stored: a
    stored position has to be rewritten for everyone behind whoever cancels,
    and one missed rewrite leaves two people at number three.
    """
    STATUS_CHOICES = [
        ('waiting',   'Waiting'),
        ('ready',     'Ready for collection'),
        ('collected', 'Collected'),
        ('cancelled', 'Cancelled'),
        ('expired',   'Expired'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    book      = models.ForeignKey(Book, on_delete=models.CASCADE, related_name='reservations')
    member    = models.ForeignKey(User, on_delete=models.CASCADE, related_name='library_reservations')
    status    = models.CharField(max_length=10, choices=STATUS_CHOICES, default='waiting')
    created_at = models.DateTimeField(auto_now_add=True)
    # Set when a copy is put aside; the hold lapses after settings.reservation_hold_days.
    ready_at   = models.DateTimeField(null=True, blank=True)
    expires_on = models.DateField(null=True, blank=True)
    copy       = models.ForeignKey(BookCopy, on_delete=models.SET_NULL, null=True, blank=True,
                                   related_name='reservations')
    closed_at  = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'library_reservations'
        ordering = ['created_at']
        indexes = [models.Index(fields=['book', 'status'])]

    def __str__(self):
        return f'{self.member.get_full_name()} waiting for {self.book.title}'

    @property
    def is_open(self):
        return self.status in ('waiting', 'ready')

    @property
    def has_lapsed(self):
        return (self.status == 'ready' and self.expires_on is not None
                and self.expires_on < _today())


class AcquisitionRequest(models.Model):
    """
    A title the library wants to buy: asked for, decided on, then received.

    Receiving is a separate step from approval because money and stock are
    separate events -- a request approved in March and delivered in June is the
    ordinary case, and until it arrives there is nothing to lend.
    """
    STATUS_CHOICES = [
        ('pending',  'Awaiting decision'),
        ('approved', 'Approved'),
        ('declined', 'Declined'),
        ('received', 'Received'),
        ('cancelled', 'Cancelled'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title       = models.CharField(max_length=300)
    author      = models.CharField(max_length=200, blank=True)
    isbn        = models.CharField(max_length=20, blank=True)
    quantity    = models.PositiveSmallIntegerField(default=1)
    unit_price  = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    supplier    = models.ForeignKey(Supplier, on_delete=models.SET_NULL, null=True, blank=True,
                                    related_name='requests')
    reason      = models.TextField(blank=True)
    status      = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')

    requested_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True,
                                     related_name='library_requests')
    decided_by   = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                     related_name='library_decisions')
    decision_note = models.CharField(max_length=255, blank=True)
    decided_at   = models.DateTimeField(null=True, blank=True)
    received_at  = models.DateTimeField(null=True, blank=True)
    # The title the received stock was catalogued as, so a request can be traced
    # to the books it put on the shelf.
    book        = models.ForeignKey(Book, on_delete=models.SET_NULL, null=True, blank=True,
                                    related_name='acquisitions')
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'library_acquisitions'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.title} x{self.quantity} ({self.status})'

    @property
    def estimated_cost(self):
        return (self.unit_price or 0) * self.quantity


# ── Counting what is actually on the shelves ──────────────────────────────────

class Stocktake(models.Model):
    """
    A count of the shelves against the catalogue.

    Every library does this at least once a year, and until it does, the
    catalogue is a record of what the school BOUGHT rather than what it has.
    The gap between the two is the whole point: a stocktake that finds nothing
    missing is still worth the afternoon, because now somebody knows.

    Open one, scan or tick copies as they are found, then close it. Closing is
    what turns "not scanned yet" into "missing", so it is a deliberate act --
    an unfinished count must never quietly write books off.
    """
    STATUS_CHOICES = [
        ('open',      'In progress'),
        ('closed',    'Closed'),
        ('abandoned', 'Abandoned'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name        = models.CharField(max_length=140)
    # Narrow a count to one part of the collection: a shelf, a subject, a year
    # group's set texts. Blank means the whole library.
    scope_shelf = models.CharField(max_length=60, blank=True)
    scope_category = models.CharField(max_length=60, blank=True)
    status      = models.CharField(max_length=10, choices=STATUS_CHOICES, default='open')
    started_at  = models.DateTimeField(default=timezone.now)
    closed_at   = models.DateTimeField(null=True, blank=True)
    started_by  = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                    related_name='stocktakes_started')
    closed_by   = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                    related_name='stocktakes_closed')
    note        = models.TextField(blank=True)

    class Meta:
        db_table = 'library_stocktakes'
        ordering = ['-started_at']

    def __str__(self):
        return f'{self.name} ({self.status})'


class StocktakeScan(models.Model):
    """
    One copy, seen with somebody's own eyes during a count.

    Unique per (stocktake, copy) so scanning the same barcode twice is harmless
    -- which matters, because the person counting is holding a scanner and a
    pile of books, not watching the screen.
    """
    FOUND_CHOICES = [
        ('shelf',   'On the shelf'),
        ('on_loan', 'Out on loan'),
        ('damaged', 'Found damaged'),
        ('misplaced', 'Found out of place'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    stocktake = models.ForeignKey(Stocktake, on_delete=models.CASCADE, related_name='scans')
    copy      = models.ForeignKey(BookCopy, on_delete=models.CASCADE, related_name='scans')
    found_as  = models.CharField(max_length=10, choices=FOUND_CHOICES, default='shelf')
    note      = models.CharField(max_length=255, blank=True)
    scanned_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                   related_name='stocktake_scans')
    scanned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'library_stocktake_scans'
        ordering = ['-scanned_at']
        constraints = [
            models.UniqueConstraint(fields=['stocktake', 'copy'],
                                    name='library_stocktake_scan_once'),
        ]

    def __str__(self):
        return f'{self.copy_id} in {self.stocktake_id}'


class CopyEvent(models.Model):
    """
    Something that happened to one physical book, and who decided it.

    A copy's `status` says where it is now; this says how it got there. Without
    it, "lost" is a value in a column with no date, no reason and nobody's name
    against it -- which is exactly the record you need when a parent is being
    asked to pay for a book.
    """
    KIND_CHOICES = [
        ('lost',       'Marked lost'),
        ('found',      'Found again'),
        ('damaged',    'Marked damaged'),
        ('repaired',   'Repaired'),
        ('written_off', 'Written off'),
        ('withdrawn',  'Withdrawn'),
        ('restored',   'Returned to stock'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    copy    = models.ForeignKey(BookCopy, on_delete=models.CASCADE, related_name='events')
    kind    = models.CharField(max_length=12, choices=KIND_CHOICES)
    reason  = models.CharField(max_length=255, blank=True)
    # Who had it when it went missing, when that is known. A write-off with a
    # borrower attached is a conversation; one without is a shelf problem.
    borrower = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                 related_name='copy_events_as_borrower')
    charged  = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    recorded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                    related_name='copy_events')
    stocktake = models.ForeignKey(Stocktake, on_delete=models.SET_NULL, null=True, blank=True,
                                  related_name='events')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'library_copy_events'
        ordering = ['-created_at']
        indexes = [models.Index(fields=['copy', '-created_at'])]

    def __str__(self):
        return f'{self.get_kind_display()}: {self.copy_id}'
