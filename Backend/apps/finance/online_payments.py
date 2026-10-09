"""
A parent pays fees from their phone.

    initiate  check, record the attempt, send the prompt to the parent's phone
    refresh   ask the provider how it went; on success, settle
    settle    turn a successful payment into an ordinary receipt - once, however
              many times and from however many places it is asked

The books are only touched in ``settle``. Everything before it can fail, repeat
or be abandoned without a trace on a family's balance.
"""
import re
from datetime import timedelta
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.utils import timezone

from . import momo, services
from .models import OnlinePayment

# A prompt nobody answered stops being useful; MoMo's own prompts lapse in minutes.
PENDING_LIFETIME = timedelta(minutes=30)
MAX_ATTEMPTS_PER_HOUR = 5


class OnlinePaymentError(Exception):
    """A rule was broken; the message is shown to the parent as-is."""


def normalise_phone(value):
    """0788123456 / +250 788 123 456 / 788123456 -> 250788123456, or None."""
    digits = re.sub(r'\D', '', value or '')
    if len(digits) == 9:
        digits = '250' + digits
    elif len(digits) == 10 and digits.startswith('0'):
        digits = '250' + digits[1:]
    return digits if re.fullmatch(r'250\d{9}', digits) else None


def outstanding_for(student):
    from apps.results.models import AcademicTerm
    term = AcademicTerm.objects.filter(is_current=True).first()
    return services.student_balance(student, term)['outstanding'], term


def initiate(student, parent, amount, phone, client=None):
    if not momo.configured():
        raise OnlinePaymentError('Paying online is not set up for this school.')
    try:
        amount = Decimal(str(amount))
    except InvalidOperation:
        raise OnlinePaymentError('That amount is not a number.')
    amount = amount.quantize(Decimal('1'))
    if amount <= 0:
        raise OnlinePaymentError('Enter an amount to pay.')
    outstanding, _ = outstanding_for(student)
    if outstanding <= 0:
        raise OnlinePaymentError('There is nothing owing for this child this term.')
    if amount > outstanding:
        raise OnlinePaymentError(f'This is more than is owed ({outstanding:,.0f}).')
    number = normalise_phone(phone)
    if number is None:
        raise OnlinePaymentError('Enter the mobile money number as 07XX XXX XXX.')

    recent = OnlinePayment.objects.filter(paid_by=parent, created_at__gte=timezone.now() - timedelta(hours=1))
    if recent.count() >= MAX_ATTEMPTS_PER_HOUR:
        raise OnlinePaymentError('Too many attempts. Wait a little before trying again.')
    if OnlinePayment.objects.filter(student=student, status='pending',
                                    created_at__gte=timezone.now() - PENDING_LIFETIME).exists():
        raise OnlinePaymentError('A payment is already waiting for approval on the phone. Approve it, or wait a few minutes.')

    op = OnlinePayment.objects.create(student=student, paid_by=parent, amount=amount, phone=number)
    try:
        (client or momo.MomoClient()).request_to_pay(
            op.provider_ref, amount, number, f'School fees for {student.user.get_full_name()}')
    except momo.MomoError as exc:
        op.status, op.detail = 'failed', str(exc)[:255]
        op.save(update_fields=['status', 'detail', 'updated_at'])
        raise OnlinePaymentError(str(exc))
    return op


def settle(op_id):
    """Record a successful payment as a receipt. Safe to call any number of times."""
    from apps.audit.services import audit
    with transaction.atomic():
        op = OnlinePayment.objects.select_for_update(of=('self',)).select_related('student__user', 'paid_by').get(pk=op_id)
        if op.status in ('successful', 'needs_review'):
            return op
        _, term = outstanding_for(op.student)
        try:
            lines = services.record_split_payment(
                op.student, op.amount, None, method='momo', reference=op.transaction_id or str(op.provider_ref)[:36],
                received_by=None, payer_name=op.paid_by.get_full_name() if op.paid_by else '',
                notes='Paid online by a parent', term=term)
        except services.FinanceError as exc:
            # The money has arrived but there is nowhere to put it (the charges
            # were settled while the prompt was open). Never lose it silently:
            # the office is told, and decides whether to refund or credit it.
            op.status, op.detail = 'needs_review', str(exc)[:255]
            op.save(update_fields=['status', 'detail', 'updated_at'])
            audit(None, 'finance.online_payment_unplaced', op.student.student_id, {'amount': str(op.amount), 'why': op.detail})
            return op
        op.status, op.receipt_no = 'successful', lines[0].receipt_no
        op.save(update_fields=['status', 'receipt_no', 'updated_at'])
    from apps.notifications.services import notify_user
    if op.paid_by:
        notify_user(op.paid_by, 'Payment received',
                    f'We received {op.amount:,.0f} for {op.student.user.get_full_name()}. Receipt {op.receipt_no}.',
                    'announcement')
    return op


def refresh(op, client=None):
    """Ask the provider where a pending payment stands, and act on the answer."""
    if op.status != 'pending':
        return op
    try:
        answer = (client or momo.MomoClient()).status(op.provider_ref)
    except momo.MomoError:
        return op                      # no news is not a failure: ask again later
    if answer['status'] == 'SUCCESSFUL':
        op.transaction_id = answer['transaction_id'][:80]
        op.save(update_fields=['transaction_id', 'updated_at'])
        return settle(op.pk)
    if answer['status'] == 'FAILED':
        op.status, op.detail = 'failed', (answer['reason'] or 'The payment was declined.')[:255]
        op.save(update_fields=['status', 'detail', 'updated_at'])
    elif op.created_at < timezone.now() - PENDING_LIFETIME:
        op.status, op.detail = 'failed', 'Not approved in time.'
        op.save(update_fields=['status', 'detail', 'updated_at'])
    return op


def refresh_all_pending(client=None):
    """For the scheduler: settle what parents approved after closing the page."""
    cutoff = timezone.now() - timedelta(days=1)
    done = 0
    for op in OnlinePayment.objects.filter(status='pending', created_at__gte=cutoff):
        refresh(op, client)
        done += 1
    return done
