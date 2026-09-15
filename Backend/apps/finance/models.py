"""
The finance office: what a school charges, what it has actually received, and
what it spends.

Deliberately NOT here: another Fee model. `apps.student.models.Fee` already
holds the CHARGE -- a category, an amount, a due date and a term, per student --
and the parent portal, the analytics overview and the reminder task all read
it. A second fee table would mean two answers to "what does this family owe".

What was missing is the other half: money RECEIVED. `Fee.status` had a
'partial' state that nothing could substantiate, and `paid_date` recorded when
something was settled but never how much, by what means, or who took it. That
is what FeePayment is, and Fee.status is recomputed from the payments against
it rather than typed in by hand.
"""
import uuid
from decimal import Decimal

from django.db import models
from django.utils import timezone

from apps.authentication.models import User
from apps.student.models import Fee, Student


def rwanda_paye_bands():
    """
    Rwanda's monthly PAYE bands on employment income, in force since July 2023
    (Law 027/2022): nothing on the first 60,000, then 10%, 20% and 30%.
    """
    return [
        {'upto': 60000, 'rate': 0},
        {'upto': 100000, 'rate': 10},
        {'upto': 200000, 'rate': 20},
        {'upto': None, 'rate': 30},
    ]


class FinanceSettings(models.Model):
    """
    The office's own rules. One row per school.

    A singleton by convention rather than by constraint, like the library's:
    `load()` returns the row or creates it with the defaults, so a fresh school
    has working settings before anyone has visited the page.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    currency          = models.CharField(max_length=8, default='RWF')
    # Printed on every receipt, so a parent can query a payment with the office.
    receipt_prefix    = models.CharField(max_length=12, default='RCT')
    # Nothing charges this automatically -- it is what the office tells families,
    # and what the overdue list is measured against.
    late_fee_percent  = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    grace_days        = models.PositiveSmallIntegerField(default=0)
    bank_details      = models.TextField(blank=True)
    # Monthly PAYE bands, lowest first: [{"upto": 60000, "rate": 0}, ...], the
    # last with "upto": null. Stored rather than hard-coded because the revenue
    # authority changes them by law, and a school should not wait for a release
    # to pay its staff correctly. See `services.paye_tax`.
    paye_bands        = models.JSONField(default=rwanda_paye_bands, blank=True)
    updated_at        = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'finance_settings'
        verbose_name_plural = 'finance settings'

    def __str__(self):
        return f'Finance settings ({self.currency})'

    @classmethod
    def load(cls):
        return cls.objects.first() or cls.objects.create()


class FeeCategory(models.Model):
    """
    A kind of charge the school raises: tuition, boarding, PTA contribution.

    The school's own list. `Fee.category` used to be one of six hard-coded
    values, so a school that charges an exam fee, a development levy or
    medical insurance filed each of them under "Other" and could not tell
    them apart on any report. `code` is what a Fee stores; `name` is what
    people read.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code        = models.SlugField(max_length=20, unique=True)
    name        = models.CharField(max_length=80)
    description = models.CharField(max_length=255, blank=True)
    is_active   = models.BooleanField(default=True)
    sort_order  = models.PositiveSmallIntegerField(default=100)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'finance_fee_categories'
        ordering = ['sort_order', 'name']
        verbose_name_plural = 'fee categories'

    def __str__(self):
        return self.name


# The categories a school starts with. Codes match what Fee rows already hold.
DEFAULT_FEE_CATEGORIES = [
    ('tuition', 'Tuition'),
    ('boarding', 'Boarding'),
    ('lunch', 'Lunch'),
    ('transport', 'Transport'),
    ('uniform', 'Uniform'),
    ('activity', 'Activities'),
    ('exam', 'Examination fee'),
    ('pta', 'PTA contribution'),
    ('development', 'Development levy'),
    ('medical', 'Medical insurance'),
    ('admission', 'Admission fee'),
    ('arrears', 'Brought forward'),
    ('other', 'Other'),
]


class FeeStructure(models.Model):
    """
    One line of what the school charges for a term, and who pays it.

    Invoicing turns each line into charges (`services.invoice_from_structure`).
    A line used to name one year group and one of six categories, which could
    not describe how a school really bills: boarding only for boarders, an
    admission fee once for new pupils, transport only for the families who
    take the bus, the A-Level combination that pays for lab materials, tuition
    in two instalments. Each of those is a field below.
    """
    FREQUENCY_CHOICES = [
        ('term', 'Every term'),
        ('year', 'Once a year'),
        ('once', 'Once per student'),
    ]
    BOARDING_CHOICES = [
        ('all', 'Boarders and day students'),
        ('boarders', 'Boarders only'),
        ('day', 'Day students only'),
    ]
    INTAKE_CHOICES = [
        ('all', 'New and returning students'),
        ('new', 'New students only'),
        ('returning', 'Returning students only'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    term      = models.ForeignKey('results.AcademicTerm', on_delete=models.CASCADE,
                                  related_name='fee_structures')
    # What families see on the bill; defaults to the category's name.
    name      = models.CharField(max_length=120, blank=True)
    # A FeeCategory code.
    category  = models.CharField(max_length=20)
    amount    = models.DecimalField(max_digits=10, decimal_places=2)
    due_date  = models.DateField()
    # Which classes: [{"grade": "S4", "stream": ""}, {"grade": "S5", "stream": "MPC"}].
    # Empty means the whole school; a blank stream means every stream of that year.
    classes   = models.JSONField(default=list, blank=True)
    boarding  = models.CharField(max_length=10, choices=BOARDING_CHOICES, default='all')
    intake    = models.CharField(max_length=10, choices=INTAKE_CHOICES, default='all')
    frequency = models.CharField(max_length=10, choices=FREQUENCY_CHOICES, default='term')
    # Not mandatory = opt-in: only the students listed below are charged
    # (transport, extra lessons). A mandatory line with students listed is
    # narrowed to exactly them (a resit fee).
    is_mandatory = models.BooleanField(default=True)
    students  = models.ManyToManyField(Student, blank=True, related_name='fee_lines')
    # Paying in parts: [{"percent": 50, "due_date": "2026-09-15"}, ...]. The
    # percents add up to 100. Empty means one charge on `due_date`.
    instalments = models.JSONField(default=list, blank=True)
    notes     = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'finance_fee_structures'
        ordering = ['category', 'name', 'created_at']

    def __str__(self):
        return f'{self.label}: {self.amount}'

    @property
    def label(self):
        return self.name or self.category

    @property
    def class_label(self):
        if not self.classes:
            return 'All classes'
        return ', '.join(f"{c.get('grade', '')}{c.get('stream', '')}" for c in self.classes)


class StructureCharge(models.Model):
    """
    Which charge a fee line raised for which student.

    This is what makes invoicing safe to repeat. It used to skip a student who
    already had a charge of the same CATEGORY that term, so a second line in a
    category - an exam fee beside another "other" charge, or the second
    instalment of tuition - was silently never billed.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    structure  = models.ForeignKey(FeeStructure, on_delete=models.CASCADE, related_name='charges')
    student    = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='structure_charges')
    fee        = models.OneToOneField(Fee, on_delete=models.CASCADE, related_name='source')
    instalment = models.PositiveSmallIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'finance_structure_charges'
        unique_together = ['structure', 'student', 'instalment']


class FeeDiscount(models.Model):
    """
    A standing reduction applied when charges are raised.

    Applied to the charge, never recorded as a payment: the school did not
    receive that money. The reason is written onto the charge so a parent
    can see why their bill is smaller than the fee structure says.
    """
    KIND_CHOICES = [('percent', 'Percentage'), ('fixed', 'Fixed amount')]
    SCOPE_CHOICES = [
        ('students', 'Chosen students'),
        # Every child after the first of the same parent, oldest enrolled first.
        ('siblings', 'Siblings'),
        ('boarders', 'Boarders'),
        ('day', 'Day students'),
        ('all', 'Everyone'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name       = models.CharField(max_length=120)
    kind       = models.CharField(max_length=8, choices=KIND_CHOICES, default='percent')
    value      = models.DecimalField(max_digits=10, decimal_places=2)
    scope      = models.CharField(max_length=10, choices=SCOPE_CHOICES, default='students')
    students   = models.ManyToManyField(Student, blank=True, related_name='fee_discounts')
    # For siblings: the discount starts at this child (2 = the second child).
    from_child = models.PositiveSmallIntegerField(default=2)
    # FeeCategory codes it reduces; empty means every category.
    categories = models.JSONField(default=list, blank=True)
    # Null means every term.
    term       = models.ForeignKey('results.AcademicTerm', on_delete=models.CASCADE,
                                   null=True, blank=True, related_name='fee_discounts')
    is_active  = models.BooleanField(default=True)
    notes      = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'finance_fee_discounts'
        ordering = ['name']

    def __str__(self):
        return self.name


class FeePayment(models.Model):
    """
    Money received against one charge.

    Several payments may sit against one Fee -- part-payment is the norm, not
    the exception, which is what the 'partial' status was always trying to say
    without any way to prove it. The Fee's status is recomputed from the sum of
    these; see `services.recalculate_fee`.

    One receipt may also cover several charges: a parent hands over 150,000
    and it settles arrears, then tuition, then part of lunch. Each charge gets
    its own row, and the rows share the receipt number the parent was given.
    """
    # How money is paid - also what an expense or other income can use.
    PAYMENT_METHODS = [
        ('cash',     'Cash'),
        ('momo',     'Mobile money'),
        ('bank',     'Bank transfer'),
        ('cheque',   'Cheque'),
        ('waiver',   'Waiver / bursary'),
        ('other',    'Other'),
    ]
    METHOD_CHOICES = PAYMENT_METHODS + [
        # Not money: an unpaid balance moved onto an arrears charge in a later
        # term. It closes the old charge so the debt is owed in one place only.
        # Never taken at the desk; see `services.carry_arrears_forward`.
        ('carried',  'Carried to a later term'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    fee        = models.ForeignKey(Fee, on_delete=models.CASCADE, related_name='payments')
    amount     = models.DecimalField(max_digits=10, decimal_places=2)
    method     = models.CharField(max_length=10, choices=METHOD_CHOICES, default='cash')
    # The MoMo transaction id, the bank slip number, the cheque number. Not
    # unique: two schools' worth of slips may collide and a cash payment has none.
    reference  = models.CharField(max_length=80, blank=True)
    # Sequential per school, and what a parent quotes when they query a payment.
    receipt_no = models.CharField(max_length=40, db_index=True)
    paid_on    = models.DateField(default=timezone.localdate)
    received_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                    related_name='finance_receipts')
    payer_name = models.CharField(max_length=200, blank=True)
    notes      = models.TextField(blank=True)
    # A reversal is a new fact, not a deletion: the receipt was issued and the
    # school's books have to show that it was issued and then cancelled.
    reversed_at     = models.DateTimeField(null=True, blank=True)
    reversed_by     = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                        related_name='finance_reversals')
    reversal_reason = models.CharField(max_length=255, blank=True)
    # On a 'carried' line: the arrears charge the balance moved to. RESTRICT
    # so the arrears charge cannot be deleted while a balance sits on it, yet
    # deleting the whole student still cascades.
    carried_to = models.ForeignKey(Fee, on_delete=models.RESTRICT, null=True, blank=True,
                                   related_name='carried_in')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'finance_payments'
        ordering = ['-paid_on', '-created_at']
        indexes = [models.Index(fields=['fee', 'reversed_at'])]
        constraints = [
            # A receipt names each charge at most once.
            models.UniqueConstraint(fields=['receipt_no', 'fee'],
                                    name='finance_payment_receipt_fee_unique'),
        ]

    def __str__(self):
        return f'{self.receipt_no}: {self.amount}'

    @property
    def is_reversed(self):
        return self.reversed_at is not None


class ExpenseCategory(models.Model):
    """What the school spends money on: salaries, utilities, maintenance."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name       = models.CharField(max_length=100, unique=True)
    description = models.CharField(max_length=255, blank=True)
    is_active  = models.BooleanField(default=True)

    class Meta:
        db_table = 'finance_expense_categories'
        ordering = ['name']
        verbose_name_plural = 'expense categories'

    def __str__(self):
        return self.name


class Expense(models.Model):
    """
    Money out, recorded and then approved.

    Approval is a separate step and a separate person: the office records what
    it spent, the head teacher signs it off. Recording and approving in one
    action would make the control meaningless.
    """
    STATUS_CHOICES = [
        ('pending',  'Awaiting approval'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('paid',     'Paid'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    category    = models.ForeignKey(ExpenseCategory, on_delete=models.PROTECT,
                                    related_name='expenses')
    description = models.CharField(max_length=255)
    amount      = models.DecimalField(max_digits=12, decimal_places=2)
    spent_on    = models.DateField(default=timezone.localdate)
    payee       = models.CharField(max_length=200, blank=True)
    method      = models.CharField(max_length=10, choices=FeePayment.PAYMENT_METHODS,
                                   default='cash')
    reference   = models.CharField(max_length=80, blank=True)
    status      = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    term        = models.ForeignKey('results.AcademicTerm', on_delete=models.SET_NULL,
                                    null=True, blank=True, related_name='expenses')

    recorded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True,
                                    related_name='finance_expenses')
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                    related_name='finance_approvals')
    decided_at  = models.DateTimeField(null=True, blank=True)
    decision_note = models.CharField(max_length=255, blank=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'finance_expenses'
        ordering = ['-spent_on', '-created_at']
        indexes = [models.Index(fields=['status', 'spent_on'])]

    def __str__(self):
        return f'{self.description}: {self.amount}'


class StudentAccount(models.Model):
    """
    A note the office keeps against one family, and nothing else.

    Not a balance -- a balance derived from two places would eventually
    disagree with itself, so what a student owes is always computed from their
    Fees and the payments against them (`services.student_balance`). This holds
    only what cannot be derived: an arrangement to pay in instalments, a
    bursary, a note about who actually pays.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student    = models.OneToOneField(Student, on_delete=models.CASCADE,
                                      related_name='finance_account')
    payer_name = models.CharField(max_length=200, blank=True)
    payer_phone = models.CharField(max_length=30, blank=True)
    bursary_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    arrangement = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'finance_student_accounts'

    def __str__(self):
        return f'Account for {self.student.full_name}'


def money(value):
    """Decimal, never float: 0.1 + 0.2 must be 0.3 in a school's books."""
    return Decimal(str(value or 0))


# ── Where the money sits ──────────────────────────────────────────────────────

class CashAccount(models.Model):
    """
    A place money actually is: the safe, a bank account, a mobile-money float.

    The dashboard could say 767,500 collected and nobody could answer "so where
    is it?". A receipt records that a parent paid; it does not record that the
    cash reached the bank. That gap is where school money goes missing, and it
    is not caught by counting receipts -- only by counting receipts AGAINST a
    balance somebody is responsible for.
    """
    KIND_CHOICES = [
        ('cash',   'Cash box'),
        ('bank',   'Bank account'),
        ('mobile', 'Mobile money'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name            = models.CharField(max_length=120)
    kind            = models.CharField(max_length=10, choices=KIND_CHOICES, default='cash')
    # Free text: an account number, a till number, a safe location.
    reference       = models.CharField(max_length=80, blank=True)
    opening_balance = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    # The account a payment lands in when the cashier does not say otherwise.
    is_default      = models.BooleanField(default=False)
    is_active       = models.BooleanField(default=True)
    notes           = models.TextField(blank=True)
    created_at      = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'finance_cash_accounts'
        ordering = ['-is_default', 'name']

    def __str__(self):
        return f'{self.name} ({self.get_kind_display()})'

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if self.is_default:
            # Exactly one default, enforced on write rather than hoped for. Two
            # defaults means the cashier's money lands in whichever row the
            # query happened to return first.
            CashAccount.objects.filter(is_default=True).exclude(pk=self.pk).update(is_default=False)


class CashMovement(models.Model):
    """
    One movement in or out of an account, and why.

    Every row carries its own reason: a fee receipt, an expense paid, a deposit
    at the bank, a transfer between accounts, or a counted correction.
    `payment`, `expense` and `income` are the links back, so a balance can
    always be taken apart into the documents that made it.
    """
    KIND_CHOICES = [
        ('fee',        'Fee received'),
        ('income',     'Other income'),
        ('expense',    'Expense paid'),
        ('deposit',    'Banked'),
        ('withdrawal', 'Withdrawn'),
        ('transfer',   'Transfer'),
        ('adjustment', 'Correction'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    account   = models.ForeignKey(CashAccount, on_delete=models.PROTECT, related_name='movements')
    kind      = models.CharField(max_length=12, choices=KIND_CHOICES)
    # Signed: money in is positive, money out is negative. One column and one
    # sign rule beats a `direction` field that half the queries forget to read.
    amount    = models.DecimalField(max_digits=14, decimal_places=2)
    occurred_on = models.DateField(default=timezone.localdate)
    description = models.CharField(max_length=255, blank=True)

    payment   = models.ForeignKey('FeePayment', on_delete=models.SET_NULL, null=True, blank=True,
                                  related_name='movements')
    expense   = models.ForeignKey('Expense', on_delete=models.SET_NULL, null=True, blank=True,
                                  related_name='movements')
    income    = models.ForeignKey('OtherIncome', on_delete=models.SET_NULL, null=True, blank=True,
                                  related_name='movements')
    # Set on both halves of a transfer so the pair can be found together.
    transfer_group = models.UUIDField(null=True, blank=True)

    recorded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                    related_name='cash_movements')
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'finance_cash_movements'
        ordering = ['-occurred_on', '-created_at']
        indexes = [
            models.Index(fields=['account', '-occurred_on']),
            models.Index(fields=['kind', '-occurred_on']),
        ]

    def __str__(self):
        return f'{self.get_kind_display()} {self.amount} ({self.account_id})'


class Reconciliation(models.Model):
    """
    A count of what is really there, against what the books say.

    The difference is the whole point of the record, so it is stored rather
    than recomputed: a reconciliation is evidence of what somebody found on a
    particular day, and a later correction must not rewrite history.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    account         = models.ForeignKey(CashAccount, on_delete=models.CASCADE,
                                        related_name='reconciliations')
    counted_on      = models.DateField(default=timezone.localdate)
    book_balance    = models.DecimalField(max_digits=14, decimal_places=2)
    counted_balance = models.DecimalField(max_digits=14, decimal_places=2)
    difference      = models.DecimalField(max_digits=14, decimal_places=2)
    note            = models.TextField(blank=True)
    counted_by      = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                        related_name='reconciliations')
    created_at      = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'finance_reconciliations'
        ordering = ['-counted_on', '-created_at']

    def __str__(self):
        return f'{self.account_id} on {self.counted_on}: {self.difference:+}'


# ── Money in that is not school fees ──────────────────────────────────────────

class IncomeCategory(models.Model):
    """Canteen, uniforms, hall hire, a donation. Not a fee, still income."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name        = models.CharField(max_length=120, unique=True)
    description = models.CharField(max_length=255, blank=True)
    is_active   = models.BooleanField(default=True)

    class Meta:
        db_table = 'finance_income_categories'
        ordering = ['name']
        verbose_name_plural = 'income categories'

    def __str__(self):
        return self.name


class OtherIncome(models.Model):
    """
    Money received that is not against a student's charge.

    Kept apart from FeePayment on purpose. A payment settles a Fee and moves a
    family's balance; this settles nothing and belongs to no family. Folding
    the two together would make "collected" and "what families owe" stop
    agreeing, which is the one relationship the collection rate depends on.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    category    = models.ForeignKey(IncomeCategory, on_delete=models.PROTECT,
                                    related_name='entries')
    description = models.CharField(max_length=255)
    amount      = models.DecimalField(max_digits=14, decimal_places=2)
    method      = models.CharField(max_length=20, choices=FeePayment.PAYMENT_METHODS,
                                   default='cash')
    reference   = models.CharField(max_length=80, blank=True)
    received_on = models.DateField(default=timezone.localdate)
    account     = models.ForeignKey(CashAccount, on_delete=models.SET_NULL, null=True, blank=True,
                                    related_name='income')
    term        = models.ForeignKey('results.AcademicTerm', on_delete=models.SET_NULL,
                                    null=True, blank=True, related_name='other_income')
    received_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                    related_name='other_income_taken')
    # Set on a refund: a negative entry that gives back part of an earlier one,
    # like a lost-book charge returned when the book turns up. Negative rather
    # than an expense, because refunded money was never income to spend.
    refund_of   = models.ForeignKey('self', on_delete=models.PROTECT, null=True, blank=True,
                                    related_name='refunds')
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'finance_other_income'
        ordering = ['-received_on', '-created_at']

    def __str__(self):
        return f'{self.description} ({self.amount})'


# ── What may be spent, before it is ───────────────────────────────────────────

class Budget(models.Model):
    """
    What the school planned to spend this term.

    Expenses recorded what happened. A budget is the other half: a decision
    made in advance that this is what may happen -- which is what turns the
    expenses page from a diary into a control.
    """
    STATUS_CHOICES = [
        ('draft',     'Draft'),
        ('approved',  'Approved'),
        ('closed',    'Closed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name        = models.CharField(max_length=120)
    term        = models.ForeignKey('results.AcademicTerm', on_delete=models.CASCADE,
                                    related_name='budgets')
    status      = models.CharField(max_length=10, choices=STATUS_CHOICES, default='draft')
    note        = models.TextField(blank=True)
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                    related_name='budgets_approved')
    approved_at = models.DateTimeField(null=True, blank=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'finance_budgets'
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(fields=['term', 'name'], name='finance_budget_unique_name'),
        ]

    def __str__(self):
        return f'{self.name} ({self.term_id})'


class BudgetLine(models.Model):
    """One category, one planned figure. Actuals are computed, never stored."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    budget   = models.ForeignKey(Budget, on_delete=models.CASCADE, related_name='lines')
    category = models.ForeignKey(ExpenseCategory, on_delete=models.CASCADE,
                                 related_name='budget_lines')
    planned  = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    note     = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = 'finance_budget_lines'
        ordering = ['category__name']
        constraints = [
            models.UniqueConstraint(fields=['budget', 'category'],
                                    name='finance_budget_line_unique_category'),
        ]

    def __str__(self):
        return f'{self.category_id}: {self.planned}'


# ── Payroll ───────────────────────────────────────────────────────────────────

class StaffSalary(models.Model):
    """
    What one member of staff is paid, standing.

    Separate from the run: a salary is a fact about a person that persists,
    while a run is what happened in one month. Keeping them apart means last
    month's payslip does not change when somebody gets a raise -- the run
    copies the figures it used, and this row is only ever the starting point.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # A worker on the staff register, not a login: the cook and the night guard
    # are paid too, and neither has an account.
    staff      = models.OneToOneField('staff.StaffMember', on_delete=models.CASCADE,
                                      related_name='salary')
    gross      = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    # Allowances the school adds on top: housing, transport, responsibility.
    allowances = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    # Deduction RATES live here; the resulting AMOUNTS are frozen onto each
    # payslip, so changing a rate never rewrites a payslip already issued.
    pension_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    tax_percent     = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    other_deduction = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    TAX_METHOD_CHOICES = [
        # The progressive bands in FinanceSettings, on gross plus allowances.
        ('paye', 'PAYE bands'),
        # tax_percent of gross: a second employer, or a consultant withheld at
        # a flat rate.
        ('flat', 'Flat rate'),
    ]
    tax_method      = models.CharField(max_length=4, choices=TAX_METHOD_CHOICES, default='paye')
    bank_account    = models.CharField(max_length=80, blank=True)
    is_active       = models.BooleanField(default=True)
    note            = models.CharField(max_length=255, blank=True)
    updated_at      = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'finance_staff_salaries'
        ordering = ['staff__last_name', 'staff__first_name']
        verbose_name_plural = 'staff salaries'

    def __str__(self):
        return f'{self.staff_id}: {self.gross}'

    @property
    def net_estimate(self):
        # The same arithmetic the payslip uses, so the salary list and the
        # month's run never disagree about what someone takes home.
        from .services import payslip_figures
        return payslip_figures(self)['net']


class PayrollRun(models.Model):
    """
    One month's pay, as a document that moves through approval.

    draft -> approved -> paid, and paid is the step that touches money: it
    writes one Expense against Salaries and one movement out of a cash account,
    so payroll lands in the same reports as every other outgoing instead of
    living in a spreadsheet nobody reconciles.
    """
    STATUS_CHOICES = [
        ('draft',     'Draft'),
        ('approved',  'Approved'),
        ('paid',      'Paid'),
        ('cancelled', 'Cancelled'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    period_month = models.PositiveSmallIntegerField()
    period_year  = models.PositiveSmallIntegerField()
    status       = models.CharField(max_length=10, choices=STATUS_CHOICES, default='draft')
    note         = models.TextField(blank=True)

    prepared_by  = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                     related_name='payrolls_prepared')
    approved_by  = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                     related_name='payrolls_approved')
    approved_at  = models.DateTimeField(null=True, blank=True)
    paid_on      = models.DateField(null=True, blank=True)
    account      = models.ForeignKey(CashAccount, on_delete=models.SET_NULL, null=True, blank=True,
                                     related_name='payrolls')
    expense      = models.ForeignKey('Expense', on_delete=models.SET_NULL, null=True, blank=True,
                                     related_name='payrolls')
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'finance_payroll_runs'
        ordering = ['-period_year', '-period_month']
        constraints = [
            # A month is paid once. Without this a second draft for the same
            # month can be approved and paid alongside the first.
            models.UniqueConstraint(fields=['period_year', 'period_month'],
                                    condition=models.Q(status__in=['draft', 'approved', 'paid']),
                                    name='finance_payroll_one_live_run_per_month'),
        ]

    def __str__(self):
        return f'Payroll {self.period_year}-{self.period_month:02d} ({self.status})'

    @property
    def period_label(self):
        from calendar import month_name
        return f'{month_name[self.period_month]} {self.period_year}'


class Payslip(models.Model):
    """
    One person's pay for one run, with the figures frozen as they were.

    Every amount is copied rather than referenced. A payslip is a statement the
    school made to a person on a date; if it recomputed itself from the current
    salary row, last year's payslips would quietly change every time somebody
    got a raise, and the school could not answer a query about one.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    run        = models.ForeignKey(PayrollRun, on_delete=models.CASCADE, related_name='payslips')
    staff      = models.ForeignKey('staff.StaffMember', on_delete=models.PROTECT,
                                   related_name='payslips')
    # Snapshots: a payslip says who, what job and which department AS PAID, so
    # a transfer or a rename next year does not rewrite this one.
    staff_name = models.CharField(max_length=200)
    role       = models.CharField(max_length=20, blank=True)
    job_title  = models.CharField(max_length=100, blank=True)
    department = models.CharField(max_length=80, blank=True)

    gross      = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    allowances = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    pension    = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tax        = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    other_deduction = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    net        = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    bank_account = models.CharField(max_length=80, blank=True)
    note       = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = 'finance_payslips'
        ordering = ['staff_name']
        constraints = [
            models.UniqueConstraint(fields=['run', 'staff'], name='finance_payslip_once_per_run'),
        ]

    def __str__(self):
        return f'{self.staff_name} {self.run_id}: {self.net}'

    @property
    def total_deductions(self):
        return self.pension + self.tax + self.other_deduction
