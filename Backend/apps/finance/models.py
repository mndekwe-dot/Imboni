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
