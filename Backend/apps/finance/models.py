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
    updated_at        = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'finance_settings'
        verbose_name_plural = 'finance settings'

    def __str__(self):
        return f'Finance settings ({self.currency})'

    @classmethod
    def load(cls):
        return cls.objects.first() or cls.objects.create()


class FeeStructure(models.Model):
    """
    What a year group is charged for a term, before anybody is invoiced.

    The point of it is bulk: a bursar sets "S4 pays 85,000 tuition and 15,000
    lunch this term" once, and invoicing raises one Fee per student from it.
    Doing that per student by hand across six year groups is where the errors
    come from -- one child charged last term's amount, and nobody notices until
    the parent does.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    term      = models.ForeignKey('results.AcademicTerm', on_delete=models.CASCADE,
                                  related_name='fee_structures')
    # The school's own year label ('S4', 'P6'), validated where data enters
    # rather than enumerated here -- see the note on Student.grade.
    grade     = models.CharField(max_length=10)
    # Blank means "every stream in that year".
    section   = models.CharField(max_length=10, blank=True)
    category  = models.CharField(max_length=20, choices=Fee.CATEGORY_CHOICES)
    amount    = models.DecimalField(max_digits=10, decimal_places=2)
    due_date  = models.DateField()
    is_mandatory = models.BooleanField(default=True)
    notes     = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'finance_fee_structures'
        ordering = ['grade', 'category']
        # One amount per year/stream/category/term. Two rows would mean two
        # answers to what a child is charged.
        unique_together = ['term', 'grade', 'section', 'category']

    def __str__(self):
        return f'{self.grade}{self.section} {self.category}: {self.amount}'

    @property
    def class_label(self):
        return f'{self.grade}{self.section}' if self.section else self.grade


class FeePayment(models.Model):
    """
    Money received against one charge.

    Several payments may sit against one Fee -- part-payment is the norm, not
    the exception, which is what the 'partial' status was always trying to say
    without any way to prove it. The Fee's status is recomputed from the sum of
    these; see `services.recalculate_fee`.
    """
    METHOD_CHOICES = [
        ('cash',     'Cash'),
        ('momo',     'Mobile money'),
        ('bank',     'Bank transfer'),
        ('cheque',   'Cheque'),
        ('waiver',   'Waiver / bursary'),
        ('other',    'Other'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    fee        = models.ForeignKey(Fee, on_delete=models.CASCADE, related_name='payments')
    amount     = models.DecimalField(max_digits=10, decimal_places=2)
    method     = models.CharField(max_length=10, choices=METHOD_CHOICES, default='cash')
    # The MoMo transaction id, the bank slip number, the cheque number. Not
    # unique: two schools' worth of slips may collide and a cash payment has none.
    reference  = models.CharField(max_length=80, blank=True)
    # Sequential per school, and what a parent quotes when they query a payment.
    receipt_no = models.CharField(max_length=40, unique=True)
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
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'finance_payments'
        ordering = ['-paid_on', '-created_at']
        indexes = [models.Index(fields=['fee', 'reversed_at'])]

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
    method      = models.CharField(max_length=10, choices=FeePayment.METHOD_CHOICES,
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
    method      = models.CharField(max_length=20, choices=FeePayment.METHOD_CHOICES,
                                   default='cash')
    reference   = models.CharField(max_length=80, blank=True)
    received_on = models.DateField(default=timezone.localdate)
    account     = models.ForeignKey(CashAccount, on_delete=models.SET_NULL, null=True, blank=True,
                                    related_name='income')
    term        = models.ForeignKey('results.AcademicTerm', on_delete=models.SET_NULL,
                                    null=True, blank=True, related_name='other_income')
    received_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                    related_name='other_income_taken')
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
    staff      = models.OneToOneField(User, on_delete=models.CASCADE, related_name='salary')
    gross      = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    # Allowances the school adds on top: housing, transport, responsibility.
    allowances = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    # Deduction RATES live here; the resulting AMOUNTS are frozen onto each
    # payslip, so changing a rate never rewrites a payslip already issued.
    pension_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    tax_percent     = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    other_deduction = models.DecimalField(max_digits=12, decimal_places=2, default=0)
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
        base = self.gross + self.allowances
        pension = self.gross * self.pension_percent / Decimal('100')
        tax = self.gross * self.tax_percent / Decimal('100')
        return base - pension - tax - self.other_deduction


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
    staff      = models.ForeignKey(User, on_delete=models.PROTECT, related_name='payslips')
    staff_name = models.CharField(max_length=200)        # snapshot; survives a rename
    role       = models.CharField(max_length=20, blank=True)

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
