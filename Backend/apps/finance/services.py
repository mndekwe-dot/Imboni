"""
The rules of the finance office, kept out of the views.

Recording a payment, reversing one, invoicing a year group and working out what
a family owes each touch several tables at once, so they live here and the
tests drive them directly. A view that did this inline would have to be driven
through HTTP to prove that a part-payment leaves a charge 'partial' rather than
'cleared'.
"""
from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from apps.results.models import AcademicTerm
from apps.student.models import Fee, Student

from .models import FeePayment, FinanceSettings, money


class FinanceError(Exception):
    """A rule was broken. The message is shown to the bursar as-is."""


ZERO = Decimal('0.00')


# ── What has actually been paid ───────────────────────────────────────────────

def paid_total(fee):
    """
    Money received against one charge, reversals excluded.

    A reversed receipt is still a row -- the books have to show that it was
    issued and then cancelled -- so it must not be counted here.
    """
    total = fee.payments.filter(reversed_at__isnull=True).aggregate(t=Sum('amount'))['t']
    return money(total)


def balance_of(fee):
    return money(fee.amount) - paid_total(fee)


@transaction.atomic
def recalculate_fee(fee):
    """
    Set a charge's status from the payments against it.

    `status` and `paid_date` used to be typed in by hand, which is how a fee
    could read 'cleared' with nothing recorded against it. They are derived
    now, and this is the only place that writes them.
    """
    paid = paid_total(fee)
    amount = money(fee.amount)
    last = (fee.payments.filter(reversed_at__isnull=True)
            .order_by('-paid_on').values_list('paid_on', flat=True).first())

    if paid <= ZERO:
        # Back to unpaid. Overdue is a fact about the date, not a decision.
        fee.status = 'overdue' if fee.due_date < timezone.localdate() else 'due'
        fee.paid_date = None
    elif paid >= amount:
        fee.status = 'cleared'
        fee.paid_date = last
    else:
        fee.status = 'partial'
        fee.paid_date = None

    fee.save(update_fields=['status', 'paid_date', 'updated_at'])
    return fee


def next_receipt_no(settings_row=None):
    """
    The next receipt number, as PREFIX-00001.

    Counted from the table rather than stored in a counter row, because a
    counter that drifts from reality issues a duplicate receipt, and
    `receipt_no` is unique -- the write would fail at the worst moment, with a
    parent at the desk. Retried by `record_payment` on collision.
    """
    settings_row = settings_row or FinanceSettings.load()
    return f'{settings_row.receipt_prefix}-{FeePayment.objects.count() + 1:05d}'


@transaction.atomic
def record_payment(fee, amount, method='cash', reference='', received_by=None,
                   paid_on=None, payer_name='', notes=''):
    """Take money against a charge, issue a receipt, and restate the balance."""
    amount = money(amount)
    if amount <= ZERO:
        raise FinanceError('A payment has to be more than zero.')

    outstanding = balance_of(fee)
    if outstanding <= ZERO:
        raise FinanceError('That charge is already settled.')
    if amount > outstanding:
        # Refused rather than quietly capped: overpaying usually means the wrong
        # charge was picked, and silently keeping the difference hides it.
        raise FinanceError(
            f'That is more than the {outstanding} outstanding on this charge.')

    settings_row = FinanceSettings.load()
    receipt = next_receipt_no(settings_row)
    # One retry: two clerks taking money at the same moment would otherwise
    # both compute the same number and the second write would fail.
    if FeePayment.objects.filter(receipt_no=receipt).exists():
        receipt = f'{settings_row.receipt_prefix}-{FeePayment.objects.count() + 2:05d}'

    payment = FeePayment.objects.create(
        fee=fee, amount=amount, method=method, reference=reference,
        receipt_no=receipt, received_by=received_by,
        paid_on=paid_on or timezone.localdate(),
        payer_name=payer_name, notes=notes,
    )
    recalculate_fee(fee)
    return payment


@transaction.atomic
def reverse_payment(payment, reversed_by=None, reason=''):
    """
    Cancel a receipt without deleting it.

    The row stays and the money stops counting. A school's books have to show
    that a receipt was issued and then cancelled; deleting it would leave a
    hole in the receipt numbers that nobody could explain.
    """
    if payment.is_reversed:
        raise FinanceError('That receipt has already been reversed.')
    payment.reversed_at = timezone.now()
    payment.reversed_by = reversed_by
    payment.reversal_reason = reason[:255]
    payment.save(update_fields=['reversed_at', 'reversed_by', 'reversal_reason'])
    recalculate_fee(payment.fee)
    return payment


# ── What a family owes ────────────────────────────────────────────────────────

def student_balance(student, term=None):
    """
    Charged, paid and outstanding for one student.

    Always computed, never stored: a balance kept in a column and a balance
    computed from the rows eventually disagree, and the column is the one
    people trust.
    """
    fees = Fee.objects.filter(student=student)
    if term is not None:
        fees = fees.filter(term=term)
    fees = list(fees.prefetch_related('payments'))

    charged = sum((money(f.amount) for f in fees), ZERO)
    paid = sum((paid_total(f) for f in fees), ZERO)
    overdue = sum(
        (balance_of(f) for f in fees
         if balance_of(f) > ZERO and f.due_date < timezone.localdate()),
        ZERO,
    )
    return {
        'charged': charged,
        'paid': paid,
        'outstanding': charged - paid,
        'overdue': overdue,
        'fees': fees,
    }


# ── Invoicing ─────────────────────────────────────────────────────────────────

@transaction.atomic
def invoice_from_structure(structure, term=None):
    """
    Raise one charge per student in the year group the structure covers.

    Idempotent: a student who already has this charge for this term is skipped,
    so running it twice does not double a family's bill. That matters -- the
    natural response to "did that work?" is to click it again.
    """
    term = term or structure.term
    students = Student.objects.filter(grade=structure.grade, status='active')
    if structure.section:
        students = students.filter(section=structure.section)

    created = []
    for student in students:
        exists = Fee.objects.filter(
            student=student, term=term, category=structure.category,
        ).exists()
        if exists:
            continue
        amount = money(structure.amount)
        # A bursary is a discount on the charge, not a payment against it: the
        # school never received that money and the books must not say it did.
        account = getattr(student, 'finance_account', None)
        if account and account.bursary_percent:
            amount = (amount * (Decimal('100') - money(account.bursary_percent))
                      / Decimal('100')).quantize(Decimal('0.01'))
        if amount <= ZERO:
            continue
        created.append(Fee.objects.create(
            student=student, term=term, category=structure.category,
            amount=amount, due_date=structure.due_date,
            status='overdue' if structure.due_date < timezone.localdate() else 'due',
            notes=structure.notes,
        ))
    return created


def collection_summary(term=None):
    """Charged, collected and outstanding across the school for a term."""
    term = term or AcademicTerm.objects.filter(is_current=True).first()
    fees = Fee.objects.all()
    if term is not None:
        fees = fees.filter(term=term)
    fees = list(fees.prefetch_related('payments'))

    charged = sum((money(f.amount) for f in fees), ZERO)
    collected = sum((paid_total(f) for f in fees), ZERO)
    outstanding = charged - collected
    return {
        'term': term.name if term else None,
        'term_id': str(term.id) if term else None,
        'charged': charged,
        'collected': collected,
        'outstanding': outstanding,
        # Guarded: a term with nothing billed is 0% collected, not a crash.
        'collection_rate': (round(float(collected / charged) * 100, 1)
                            if charged > ZERO else 0.0),
        'students_owing': len({
            f.student_id for f in fees if balance_of(f) > ZERO
        }),
    }
