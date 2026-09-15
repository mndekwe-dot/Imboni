"""
The rules of the finance office, kept out of the views.

Recording a payment, reversing one, invoicing a year group and working out what
a family owes each touch several tables at once, so they live here and the
tests drive them directly. A view that did this inline would have to be driven
through HTTP to prove that a part-payment leaves a charge 'partial' rather than
'cleared'.
"""
from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import Count, Sum
from django.utils import timezone

from apps.results.models import AcademicTerm
from apps.student.models import Fee, Student

from .models import FeePayment, FinanceSettings, money


class FinanceError(Exception):
    """A rule was broken. The message is shown to the bursar as-is."""


ZERO = Decimal('0.00')

# Methods that settle part of a bill without money changing hands.
NON_CASH = ('waiver', 'carried')
# What the desk may record. 'carried' is written only by carry_arrears_forward.
DESK_METHODS = ('cash', 'momo', 'bank', 'cheque', 'waiver', 'other')


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


def cash_total(fee):
    """
    Money actually received against a charge: payments, less waivers.

    A waiver or bursary settles part of a bill without any money changing
    hands. It belongs in the balance, but counting it as "collected" made the
    collection rate and the cash position describe money the school never had.
    """
    total = (fee.payments.filter(reversed_at__isnull=True).exclude(method__in=NON_CASH)
             .aggregate(t=Sum('amount'))['t'])
    return money(total)


def carried_total(fee):
    """What of a charge was moved onto a later term's arrears charge."""
    total = (fee.payments.filter(reversed_at__isnull=True, method='carried')
             .aggregate(t=Sum('amount'))['t'])
    return money(total)


def overdue_cutoff(settings_row=None):
    """
    The due date on or before which an unpaid charge counts as overdue.

    Today, less the grace days the office gives families. The setting existed
    and was described as "what the overdue list is measured against", but
    nothing read it: a bill due yesterday was chased the same as one due in
    June.
    """
    settings_row = settings_row or FinanceSettings.load()
    return timezone.localdate() - timedelta(days=settings_row.grace_days or 0)


def is_overdue(fee, cutoff=None):
    return fee.due_date < (cutoff or overdue_cutoff()) and balance_of(fee) > ZERO


ACCOUNT_KIND_FOR_METHOD = {'cash': 'cash', 'momo': 'mobile', 'bank': 'bank', 'cheque': 'bank'}


def account_for_method(method):
    """
    Where money paid this way actually lands.

    Every receipt used to go to the default account, so a mobile-money payment
    was booked into the cash box and the box never counted up to its balance.
    Falls back to the default account when the school has none of that kind.
    """
    from .models import CashAccount
    kind = ACCOUNT_KIND_FOR_METHOD.get(method)
    if kind:
        match = (CashAccount.objects.filter(is_active=True, kind=kind)
                 .order_by('-is_default', 'name').first())
        if match is not None:
            return match
    return default_account()


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
    # The date of the last real payment: a balance carried forward was not
    # paid, and "cleared on 15 September" would tell the parent it was.
    last = (fee.payments.filter(reversed_at__isnull=True).exclude(method='carried')
            .order_by('-paid_on').values_list('paid_on', flat=True).first())

    if paid <= ZERO:
        # Back to unpaid. Overdue is a fact about the date, not a decision.
        fee.status = 'overdue' if fee.due_date < overdue_cutoff() else 'due'
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
    counter that drifts from reality issues a duplicate receipt. Receipts are
    counted, not rows: one receipt can cover several charges, and counting rows
    would skip numbers nobody could account for.
    """
    settings_row = settings_row or FinanceSettings.load()
    return f'{settings_row.receipt_prefix}-{_receipts_issued() + 1:05d}'


def _receipts_issued():
    # Carried balances are not receipts and take no number.
    return (FeePayment.objects.exclude(method='carried')
            .values('receipt_no').distinct().count())


def _issue_receipt(lines, *, method, reference, received_by, paid_on, payer_name,
                   notes, account):
    """
    Write one receipt: a FeePayment per (fee, amount) line, one number, one
    movement of the whole sum into one account.

    The movement is one row because the parent handed over one sum: the cash
    box count and the bank statement show 150,000, not three amounts that add
    up to it.
    """
    if method not in DESK_METHODS:
        raise FinanceError('That is not a way of paying.')
    settings_row = FinanceSettings.load()
    # Serialise receipt numbering on the settings row: two clerks taking money
    # at the same moment would otherwise both count the same receipts and
    # issue the same number to two families.
    settings_row = FinanceSettings.objects.select_for_update().get(pk=settings_row.pk)
    receipt = next_receipt_no(settings_row)
    step = 1
    while FeePayment.objects.filter(receipt_no=receipt).exists():
        step += 1
        receipt = f'{settings_row.receipt_prefix}-{_receipts_issued() + step:05d}'

    paid_on = paid_on or timezone.localdate()
    payments = []
    for fee, amount in lines:
        payments.append(FeePayment.objects.create(
            fee=fee, amount=amount, method=method, reference=reference,
            receipt_no=receipt, received_by=received_by, paid_on=paid_on,
            payer_name=payer_name, notes=notes,
        ))
        recalculate_fee(fee)

    # A waiver moves no money, so it goes into no account.
    if method != 'waiver':
        total = sum((amount for _, amount in lines), ZERO)
        post_movement(account or account_for_method(method), 'fee', total,
                      description=f'{receipt} {lines[0][0].student.full_name}',
                      occurred_on=paid_on, payment=payments[0],
                      recorded_by=received_by)
    return payments


@transaction.atomic
def record_payment(fee, amount, method='cash', reference='', received_by=None,
                   paid_on=None, payer_name='', notes='', account=None):
    """
    Take money against a charge, issue a receipt, and restate the balance.

    Also puts the money somewhere: a receipt says a parent paid, and the cash
    movement says where what they handed over now is. Without the second half
    the school can say how much it collected but not where any of it went.
    """
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

    return _issue_receipt([(fee, amount)], method=method, reference=reference,
                          received_by=received_by, paid_on=paid_on,
                          payer_name=payer_name, notes=notes, account=account)[0]


def open_charges(student, term=None):
    """
    A student's unsettled charges in the order money should settle them.

    Oldest due date first, so carried-forward arrears are cleared before this
    term's tuition -- the order a bursar applies a lump sum in, and the one a
    parent is told on the statement.

    Scoped to one term when given. Carried-forward arrears are raised as a
    charge IN the new term while the old term's charges stay open behind it,
    so spreading a sum over every term would pay the same debt twice.
    """
    fees = Fee.objects.filter(student=student)
    if term is not None:
        fees = fees.filter(term=term)
    fees = (fees
            .order_by('due_date', 'created_at').prefetch_related('payments'))
    return [fee for fee in fees if balance_of(fee) > ZERO]


def allocate(student, amount, allocations=None, term=None):
    """
    Split a sum across a student's charges: [(fee, amount), ...].

    With no `allocations` the sum settles the oldest charge first and flows on
    into the next. With them - [{'fee': id, 'amount': x}] - the bursar has said
    where it goes (a parent paying lunch only, because a sponsor pays tuition),
    and they must add up to the sum and fit what each charge still owes.
    """
    amount = money(amount)
    if amount <= ZERO:
        raise FinanceError('A payment has to be more than zero.')
    charges = open_charges(student, term)
    if not charges:
        raise FinanceError('This student owes nothing.')
    owed = {fee.id: balance_of(fee) for fee in charges}
    by_id = {str(fee.id): fee for fee in charges}

    if allocations:
        lines = []
        for item in allocations:
            fee = by_id.get(str(item.get('fee')))
            if fee is None:
                raise FinanceError('One of those charges is not an open charge of this student.')
            part = money(item.get('amount'))
            if part <= ZERO:
                continue
            if part > owed[fee.id]:
                raise FinanceError(
                    f'{category_label(fee.category)} has only {owed[fee.id]} outstanding.')
            lines.append((fee, part))
        if len({fee.id for fee, _ in lines}) != len(lines):
            raise FinanceError('Each charge can appear once on a receipt.')
        if sum((part for _, part in lines), ZERO) != amount:
            raise FinanceError('The amounts for each charge have to add up to the payment.')
        return lines

    total_owed = sum(owed.values(), ZERO)
    if amount > total_owed:
        # Refused, not held as credit: an overpayment is usually a typo, and
        # money kept against nothing is money nobody can account for.
        raise FinanceError(f'That is more than the {total_owed} this student owes in total.')
    lines, left = [], amount
    for fee in charges:
        if left <= ZERO:
            break
        part = min(left, owed[fee.id])
        lines.append((fee, part))
        left -= part
    return lines


@transaction.atomic
def record_split_payment(student, amount, allocations=None, *, method='cash', reference='',
                         received_by=None, paid_on=None, payer_name='', notes='',
                         account=None, term=None):
    """One sum, one receipt, settled across several of a student's charges."""
    lines = allocate(student, amount, allocations, term)
    return _issue_receipt(lines, method=method, reference=reference,
                          received_by=received_by, paid_on=paid_on,
                          payer_name=payer_name, notes=notes, account=account)


def receipt_lines(payment):
    """Every row issued under the same receipt number as `payment`."""
    return list(FeePayment.objects.filter(receipt_no=payment.receipt_no)
                .select_related('fee__student', 'fee__term').order_by('fee__due_date'))


@transaction.atomic
def reverse_payment(payment, reversed_by=None, reason=''):
    """
    Cancel a receipt without deleting it.

    The rows stay and the money stops counting. A school's books have to show
    that a receipt was issued and then cancelled; deleting it would leave a
    hole in the receipt numbers that nobody could explain.

    The whole receipt goes, every charge it covered: what gets reversed in real
    life is the slip - a cheque that bounced, a MoMo payment pulled back - and
    half a slip cannot bounce.
    """
    from .models import CashMovement

    if payment.method == 'carried':
        raise FinanceError('A balance carried forward is not a receipt. It is settled by '
                           'paying the arrears charge it moved to.')
    if payment.is_reversed:
        raise FinanceError('That receipt has already been reversed.')
    now = timezone.now()
    lines = [line for line in receipt_lines(payment) if not line.is_reversed]
    for line in lines:
        line.reversed_at = now
        line.reversed_by = reversed_by
        line.reversal_reason = reason[:255]
        line.save(update_fields=['reversed_at', 'reversed_by', 'reversal_reason'])
        recalculate_fee(line.fee)

    # Take the money back out of wherever it was put, rather than deleting the
    # original movement: the account's history has to show that cash arrived
    # and then went back, which is what a parent asking about it will be told.
    for original in CashMovement.objects.filter(kind='fee', payment__in=lines):
        post_movement(original.account, 'adjustment', -money(original.amount),
                      description=f'Reversed {payment.receipt_no}',
                      payment=original.payment, recorded_by=reversed_by)

    # A charge whose balance was already carried into a later term gets the
    # reopened amount carried after it: a cheque from last term that bounces
    # is owed on this term's arrears line, not on a term that has closed.
    for line in lines:
        moved = (line.fee.payments.filter(method='carried', reversed_at__isnull=True)
                 .select_related('carried_to').order_by('-created_at').first())
        if moved is not None and balance_of(line.fee) > ZERO:
            _carry(line.fee, moved.carried_to, balance_of(line.fee))
    payment.refresh_from_db()
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
    received = sum((cash_total(f) for f in fees), ZERO)
    carried = sum((carried_total(f) for f in fees), ZERO)
    cutoff = overdue_cutoff()
    overdue = sum((balance_of(f) for f in fees if is_overdue(f, cutoff)), ZERO)
    return {
        'charged': charged,
        'paid': paid,
        # Of `paid`: money received, waived, and moved onto a later term.
        'received': received,
        'waived': paid - received - carried,
        'carried': carried,
        'outstanding': charged - paid,
        'overdue': overdue,
        'fees': fees,
    }


# ── Invoicing ─────────────────────────────────────────────────────────────────

def category_labels():
    """{code: name} for every fee category, read once for a whole list."""
    from .models import FeeCategory
    labels = dict(Fee.CATEGORY_CHOICES)
    labels.update(FeeCategory.objects.values_list('code', 'name'))
    return labels


def category_label(code, labels=None):
    """The name people read for a FeeCategory code."""
    labels = labels if labels is not None else category_labels()
    return labels.get(code) or (code or '').replace('_', ' ').title()


def label_fees(fees):
    """Set `category_label` on each Fee, for templates. Returns the list."""
    fees = list(fees)
    labels = category_labels()
    for fee in fees:
        fee.category_label = category_label(fee.category, labels)
    return fees


def _year_start(term):
    """When the academic year this term belongs to began: its first term's start."""
    first = (AcademicTerm.objects.filter(year=term.year).order_by('order', 'start_date')
             .values_list('start_date', flat=True).first())
    return first or term.start_date


def _boarder_ids():
    from apps.discipline.models import BoardingStudent
    return set(BoardingStudent.objects.filter(is_active=True)
               .exclude(boarding_type='day_scholar').values_list('student_id', flat=True))


def students_for(structure):
    """
    The active students a fee line applies to, before frequency is checked.

    Classes, boarding and intake narrow together. A named student list narrows
    further; on an optional line it is the whole of who pays.
    """
    from django.db.models import Q

    qs = Student.objects.filter(status='active').select_related('user')
    if structure.classes:
        match = Q()
        for entry in structure.classes:
            grade = (entry.get('grade') or '').strip()
            stream = (entry.get('stream') or '').strip()
            if not grade:
                continue
            match |= Q(grade=grade, section=stream) if stream else Q(grade=grade)
        qs = qs.filter(match)

    if structure.boarding != 'all':
        boarders = _boarder_ids()
        qs = qs.filter(pk__in=boarders) if structure.boarding == 'boarders' else qs.exclude(pk__in=boarders)

    if structure.intake != 'all':
        start = _year_start(structure.term)
        qs = (qs.filter(enrollment_date__gte=start) if structure.intake == 'new'
              else qs.filter(enrollment_date__lt=start))

    chosen = list(structure.students.values_list('pk', flat=True)) if structure.pk else []
    if chosen:
        qs = qs.filter(pk__in=chosen)
    elif not structure.is_mandatory:
        return qs.none()
    return qs.order_by('grade', 'section', 'user__last_name', 'user__first_name')


def _already_charged(structure, student):
    """Whether this line's frequency says the student has already paid for this."""
    from .models import StructureCharge
    if structure.frequency == 'term':
        return StructureCharge.objects.filter(structure=structure, student=student).exists()
    same = StructureCharge.objects.filter(student=student, structure__category=structure.category,
                                          structure__name=structure.name)
    if structure.frequency == 'year':
        return same.filter(structure__term__year=structure.term.year).exists()
    return same.exists()


def child_number(student):
    """
    Which child of the family this is: 1 for the eldest at the school.

    Siblings are the students who share a parent account, ordered by when
    they enrolled, so a younger child joining later is the one discounted.
    """
    from apps.parents.models import ParentStudentRelationship

    parents = ParentStudentRelationship.objects.filter(student=student).values_list('parent_id', flat=True)
    siblings = list(Student.objects.filter(parents__parent_id__in=list(parents), status='active')
                    .distinct().order_by('enrollment_date', 'student_id').values_list('pk', flat=True))
    return siblings.index(student.pk) + 1 if student.pk in siblings else 1


def discounts_for(student, structure, boarders=None):
    """The active discounts that reduce this line for this student."""
    from django.db.models import Q
    from .models import FeeDiscount

    found = []
    rows = (FeeDiscount.objects.filter(is_active=True)
            .filter(Q(term__isnull=True) | Q(term=structure.term)).prefetch_related('students'))
    for discount in rows:
        if discount.categories and structure.category not in discount.categories:
            continue
        scope = discount.scope
        if scope == 'students' and not any(s.pk == student.pk for s in discount.students.all()):
            continue
        if scope == 'siblings' and child_number(student) < discount.from_child:
            continue
        if scope in ('boarders', 'day'):
            boarders = boarders if boarders is not None else _boarder_ids()
            if (student.pk in boarders) != (scope == 'boarders'):
                continue
        found.append(discount)
    return found


def price_for(student, structure, boarders=None):
    """
    What this student is charged for a line, and the reasons it differs.

    Bursary first (a percentage of the fee), then each discount in turn:
    percentages before fixed amounts, so "10% off and 5,000 off" means the
    same thing whichever was created first. Never below zero.
    """
    amount = money(structure.amount)
    reasons = []
    account = getattr(student, 'finance_account', None)
    if account and account.bursary_percent:
        amount = amount * (Decimal('100') - money(account.bursary_percent)) / Decimal('100')
        reasons.append(f'Bursary {money(account.bursary_percent).normalize():f}%')
    discounts = sorted(discounts_for(student, structure, boarders), key=lambda d: d.kind != 'percent')
    for discount in discounts:
        if discount.kind == 'percent':
            amount -= amount * money(discount.value) / Decimal('100')
            reasons.append(f'{discount.name} {money(discount.value).normalize():f}%')
        else:
            amount -= money(discount.value)
            reasons.append(f'{discount.name} -{money(discount.value):,.0f}')
    return max(amount.quantize(Decimal('0.01')), ZERO), reasons


def _parts(structure, amount):
    """[(instalment number, amount, due date)] for one student's charge."""
    from datetime import date

    plan = structure.instalments or []
    if not plan:
        return [(1, amount, structure.due_date)]
    parts, given = [], ZERO
    for index, step in enumerate(plan, start=1):
        due = step.get('due_date')
        due = date.fromisoformat(due) if isinstance(due, str) else (due or structure.due_date)
        if index == len(plan):
            part = amount - given                   # the last part takes the rounding
        else:
            part = (amount * money(step.get('percent')) / Decimal('100')).quantize(Decimal('1'))
        given += part
        parts.append((index, part, due))
    return parts


def validate_instalments(instalments):
    """Clean an instalment plan or raise FinanceError."""
    from datetime import date

    if not instalments:
        return []
    if not isinstance(instalments, list) or len(instalments) < 2:
        raise FinanceError('An instalment plan needs at least two parts.')
    cleaned, total = [], Decimal('0')
    for step in instalments:
        try:
            percent = Decimal(str(step.get('percent')))
            due = date.fromisoformat(str(step.get('due_date')))
        except (AttributeError, ArithmeticError, ValueError):
            raise FinanceError('Each instalment needs a percentage and a due date.')
        if percent <= 0:
            raise FinanceError('Each instalment has to be more than 0%.')
        total += percent
        cleaned.append({'percent': float(percent), 'due_date': due.isoformat()})
    if total != Decimal('100'):
        raise FinanceError(f'The instalments add up to {total:f}%, not 100%.')
    dates = [step['due_date'] for step in cleaned]
    if dates != sorted(dates):
        raise FinanceError('Instalments have to fall due in order.')
    return cleaned


def plan_structure(structure):
    """
    What invoicing this line would raise, without raising anything.

    [{'student', 'amount', 'reasons', 'parts'}] for the students it would
    charge now, plus how many it skips because they were already charged.
    """
    boarders = _boarder_ids()
    rows, skipped = [], 0
    for student in students_for(structure):
        if _already_charged(structure, student):
            skipped += 1
            continue
        amount, reasons = price_for(student, structure, boarders)
        if amount <= ZERO:
            skipped += 1
            continue
        rows.append({'student': student, 'amount': amount, 'reasons': reasons,
                     'parts': _parts(structure, amount)})
    return rows, skipped


@transaction.atomic
def invoice_from_structure(structure, term=None, *, dry_run=False):
    """
    Raise the charges a fee line describes. Returns the Fees raised.

    Safe to run twice: `StructureCharge` records what each line already raised,
    so a student is charged once per term, year or ever, as the line says. The
    natural response to "did that work?" is to click it again, and a family's
    bill must not double.
    """
    from .models import StructureCharge

    if not structure.is_active:
        raise FinanceError('That fee line is switched off.')
    rows, _ = plan_structure(structure)
    if dry_run:
        return rows

    label = structure.name or category_label(structure.category)
    cutoff = overdue_cutoff()
    created = []
    for row in rows:
        count = len(row['parts'])
        for number, part, due in row['parts']:
            notes = [label]
            if count > 1:
                notes.append(f'Instalment {number} of {count}')
            notes.extend(row['reasons'])
            if structure.notes:
                notes.append(structure.notes)
            fee = Fee.objects.create(
                student=row['student'], term=structure.term, category=structure.category,
                amount=part, due_date=due,
                status='overdue' if due < cutoff else 'due',
                notes=' · '.join(notes),
            )
            StructureCharge.objects.create(structure=structure, student=row['student'],
                                           fee=fee, instalment=number)
            created.append(fee)
    return created


def invoice_term(term, *, dry_run=False):
    """
    Every active line of a term at once: what each raises, and the total.

    With dry_run nothing is written - the bursar sees "S4 tuition: 120
    students, 10,200,000" for every line before a single bill goes out.
    """
    from .models import FeeStructure

    lines = []
    with transaction.atomic():
        for structure in FeeStructure.objects.filter(term=term, is_active=True):
            if dry_run:
                rows, skipped = plan_structure(structure)
                charged = len(rows)
                total = sum((row['amount'] for row in rows), ZERO)
            else:
                fees = invoice_from_structure(structure)
                charged = len({fee.student_id for fee in fees})
                total = sum((money(fee.amount) for fee in fees), ZERO)
                skipped = None
            lines.append({'id': str(structure.id), 'name': structure.name or category_label(structure.category),
                          'class_label': structure.class_label, 'students': charged,
                          'skipped': skipped, 'total': total})
    return {'lines': lines, 'students': sum(line['students'] for line in lines),
            'total': sum((line['total'] for line in lines), ZERO), 'dry_run': dry_run}


@transaction.atomic
def copy_structures(from_term, to_term):
    """
    Start a term's fee lines from another term's, due dates moved along.

    Most schools charge the same things term after term; setting every line up
    again by hand is where last term's price ends up on this term's bill.
    Lines that already exist in the target (same category, name and classes)
    are left alone, so copying twice adds nothing.
    """
    from .models import FeeStructure

    if from_term == to_term:
        raise FinanceError('Pick a different term to copy from.')
    shift = to_term.start_date - from_term.start_date
    existing = {(s.category, s.name, str(s.classes)) for s in FeeStructure.objects.filter(term=to_term)}
    copied = 0
    for line in FeeStructure.objects.filter(term=from_term).prefetch_related('students'):
        if (line.category, line.name, str(line.classes)) in existing:
            continue
        students = list(line.students.all())
        instalments = [
            {**step, 'due_date': (date_of(step['due_date']) + shift).isoformat()}
            for step in (line.instalments or [])
        ]
        clone = FeeStructure.objects.create(
            term=to_term, name=line.name, category=line.category, amount=line.amount,
            due_date=line.due_date + shift, classes=line.classes, boarding=line.boarding,
            intake=line.intake, frequency=line.frequency, is_mandatory=line.is_mandatory,
            instalments=instalments, notes=line.notes, is_active=line.is_active,
        )
        clone.students.set(students)
        copied += 1
    return copied


def date_of(value):
    from datetime import date
    return date.fromisoformat(value) if isinstance(value, str) else value


def collection_summary(term=None):
    """Charged, collected and outstanding across the school for a term."""
    term = term or AcademicTerm.objects.filter(is_current=True).first()
    fees = Fee.objects.all()
    if term is not None:
        fees = fees.filter(term=term)
    fees = list(fees.prefetch_related('payments'))

    charged = sum((money(f.amount) for f in fees), ZERO)
    settled = sum((paid_total(f) for f in fees), ZERO)
    collected = sum((cash_total(f) for f in fees), ZERO)
    # Carried forward is still owed - on a later term's bill - so it is
    # neither collected nor forgiven, and still counts against the rate.
    carried = sum((carried_total(f) for f in fees), ZERO)
    waived = settled - collected - carried
    outstanding = charged - settled
    # What the school can still hope to collect is the bill less what it chose
    # to forgive; measuring against the full bill made every bursary look like
    # a family that had not paid.
    collectable = charged - waived
    return {
        'term': term.name if term else None,
        'term_id': str(term.id) if term else None,
        'charged': charged,
        'collected': collected,
        'waived': waived,
        'carried': carried,
        'outstanding': outstanding,
        # Guarded: a term with nothing billed is 0% collected, not a crash.
        'collection_rate': (round(float(collected / collectable) * 100, 1)
                            if collectable > ZERO else 0.0),
        'students_owing': len({
            f.student_id for f in fees if balance_of(f) > ZERO
        }),
    }


def income_statement(term=None):
    """
    Everything the school took in and paid out for a term, by source.

    Money in is fees actually received (by fee category - waivers and carried
    balances are not money) plus every other income, refunds netted off. Money
    out is expenses PAID, payroll and remittances included since they are
    expenses too; approved-but-unpaid is shown apart as committed, because
    counting it as spent made the surplus look smaller than the cash held.
    """
    from .models import Expense, OtherIncome

    term = term or current_term()
    labels = category_labels()

    payments = FeePayment.objects.filter(reversed_at__isnull=True).exclude(method__in=NON_CASH)
    other = OtherIncome.objects.select_related('category')
    expenses = Expense.objects.select_related('category')
    if term is not None:
        payments = payments.filter(fee__term=term)
        other = other.filter(term=term)
        expenses = expenses.filter(term=term)

    fee_lines = [
        {'source': 'fees', 'key': row['fee__category'],
         'label': category_label(row['fee__category'], labels), 'amount': money(row['total'])}
        for row in payments.values('fee__category').annotate(total=Sum('amount')).order_by('-total')
    ]
    other_lines = [
        {'source': 'other', 'key': str(row['category_id']), 'label': row['category__name'],
         'amount': money(row['total'])}
        for row in other.values('category_id', 'category__name').annotate(total=Sum('amount'))
        .order_by('-total')
    ]

    def by_category(rows):
        return [{'key': str(row['category_id']), 'label': row['category__name'],
                 'amount': money(row['total'])}
                for row in rows.values('category_id', 'category__name')
                .annotate(total=Sum('amount')).order_by('-total')]

    spent_lines = by_category(expenses.filter(status='paid'))
    committed_lines = by_category(expenses.filter(status='approved'))
    fees_in = sum((line['amount'] for line in fee_lines), ZERO)
    other_in = sum((line['amount'] for line in other_lines), ZERO)
    spent = sum((line['amount'] for line in spent_lines), ZERO)
    committed = sum((line['amount'] for line in committed_lines), ZERO)
    summary = collection_summary(term)
    return {
        'term': term,
        'income': fee_lines + other_lines,
        'fees_in': fees_in,
        'other_in': other_in,
        'income_total': fees_in + other_in,
        'expenditure': spent_lines,
        'spent': spent,
        'committed_lines': committed_lines,
        'committed': committed,
        'net': fees_in + other_in - spent,
        'by_method': [
            {'method': row['method'], 'total': money(row['total'])}
            for row in payments.values('method').annotate(total=Sum('amount')).order_by('-total')
        ],
        'summary': summary,
    }


# ── Where the money sits ──────────────────────────────────────────────────────

def default_account():
    """The account money lands in when nobody says otherwise, or None."""
    from .models import CashAccount
    return (CashAccount.objects.filter(is_default=True, is_active=True).first()
            or CashAccount.objects.filter(is_active=True).first())


def account_balance(account, upto=None):
    """
    Opening balance plus every movement, which IS the balance.

    Not a stored running total on purpose. A cached balance and a list of
    movements are two answers to one question, and they drift the first time a
    movement is corrected -- at which point nobody can tell which is right.
    """
    from .models import CashMovement
    qs = CashMovement.objects.filter(account=account)
    if upto is not None:
        qs = qs.filter(occurred_on__lte=upto)
    moved = qs.aggregate(total=Sum('amount'))['total'] or ZERO
    return money(account.opening_balance) + money(moved)


def post_movement(account, kind, amount, *, description='', occurred_on=None,
                  payment=None, expense=None, income=None, recorded_by=None,
                  transfer_group=None):
    """
    Record one movement. `amount` is signed: in positive, out negative.

    Returns None when `account` is None rather than raising -- a school that has
    not set up its accounts yet must still be able to take a payment. Cash
    tracking is a layer on top of the receipt book, never a gate in front of it.
    """
    from .models import CashMovement
    if account is None:
        return None
    return CashMovement.objects.create(
        account=account, kind=kind, amount=money(amount),
        description=description[:255],
        occurred_on=occurred_on or timezone.localdate(),
        payment=payment, expense=expense, income=income,
        recorded_by=recorded_by, transfer_group=transfer_group,
    )


@transaction.atomic
def transfer(from_account, to_account, amount, *, description='', occurred_on=None,
             recorded_by=None):
    """
    Move money between two accounts as one event with two halves.

    Both rows share a `transfer_group`, so banking the week's cash reads as one
    action in both places rather than an unexplained withdrawal here and an
    unexplained deposit there.
    """
    import uuid as _uuid

    amount = money(amount)
    if amount <= ZERO:
        raise FinanceError('A transfer has to be more than zero.')
    if from_account.pk == to_account.pk:
        raise FinanceError('Pick two different accounts.')
    available = account_balance(from_account)
    if amount > available:
        raise FinanceError(f'{from_account.name} only holds {available}.')

    group = _uuid.uuid4()
    label = description or f'Transfer to {to_account.name}'
    occurred_on = occurred_on or timezone.localdate()
    out = post_movement(from_account, 'transfer', -amount, description=label,
                        occurred_on=occurred_on, recorded_by=recorded_by,
                        transfer_group=group)
    into = post_movement(to_account, 'transfer', amount,
                         description=description or f'Transfer from {from_account.name}',
                         occurred_on=occurred_on, recorded_by=recorded_by,
                         transfer_group=group)
    return out, into


@transaction.atomic
def reconcile(account, counted_balance, *, counted_by=None, counted_on=None, note=''):
    """
    Record what was actually counted against what the books say.

    A difference is NOT auto-corrected. Writing a balancing movement here would
    make every count agree by construction and the record would prove nothing;
    the difference is the finding, and correcting it is a separate, deliberate
    decision with its own note.
    """
    from .models import Reconciliation
    counted_on = counted_on or timezone.localdate()
    book = account_balance(account, upto=counted_on)
    counted = money(counted_balance)
    return Reconciliation.objects.create(
        account=account, counted_on=counted_on, book_balance=book,
        counted_balance=counted, difference=counted - book,
        counted_by=counted_by, note=note,
    )


def cash_position(upto=None):
    """Every active account and what it holds, plus the total."""
    from .models import CashAccount
    rows = []
    total = ZERO
    for account in CashAccount.objects.filter(is_active=True):
        balance = account_balance(account, upto=upto)
        total += balance
        rows.append({'account': account, 'balance': balance})
    return {'accounts': rows, 'total': total}


# ── Money in that is not school fees ──────────────────────────────────────────

@transaction.atomic
def record_income(category, amount, *, description='', method='cash', reference='',
                  received_on=None, account=None, term=None, received_by=None):
    """Take money that belongs to no family, and put it somewhere."""
    from .models import OtherIncome
    amount = money(amount)
    if amount <= ZERO:
        raise FinanceError('An amount has to be more than zero.')

    account = account or account_for_method(method)
    entry = OtherIncome.objects.create(
        category=category, description=description[:255], amount=amount,
        method=method, reference=reference,
        received_on=received_on or timezone.localdate(),
        account=account, term=term or current_term(), received_by=received_by,
    )
    post_movement(account, 'income', amount,
                  description=f'{category.name}: {entry.description}',
                  occurred_on=entry.received_on, income=entry,
                  recorded_by=received_by)
    return entry


@transaction.atomic
def refund_income(entry, amount, *, reason, refunded_by=None, refunded_on=None):
    """
    Give back part or all of an income entry, from the account it went into.

    Written as a negative entry in the same category, pointing at the original,
    so the income report nets it off and the account shows the money leaving.
    Booking it as an expense instead would make 'Spent' grow by money the
    school only ever held for someone else.
    """
    from .models import OtherIncome

    amount = money(amount)
    if amount <= ZERO:
        raise FinanceError('A refund has to be more than zero.')
    if not (reason or '').strip():
        raise FinanceError('Say why the money is being given back.')
    already = -money(entry.refunds.aggregate(t=Sum('amount'))['t'])
    if amount > money(entry.amount) - already:
        raise FinanceError(
            f'Only {money(entry.amount) - already} of that entry is left to refund.')

    account = entry.account or default_account()
    if account is not None:
        available = account_balance(account)
        if amount > available:
            raise FinanceError(f'{account.name} holds {available}; the refund needs {amount}.')

    refund = OtherIncome.objects.create(
        category=entry.category, description=f'Refund: {reason.strip()}'[:255],
        amount=-amount, method=entry.method, reference=entry.reference,
        received_on=refunded_on or timezone.localdate(), account=account,
        term=current_term(), received_by=refunded_by, refund_of=entry,
    )
    if account is not None:
        post_movement(account, 'income', -amount,
                      description=f'{entry.category.name}: {refund.description}',
                      occurred_on=refund.received_on, income=refund,
                      recorded_by=refunded_by)
    return refund


# ── Money out ─────────────────────────────────────────────────────────────────

@transaction.atomic
def pay_expense(expense, *, account=None, paid_by=None, paid_on=None, note=''):
    """
    Pay out an approved expense: the money leaves an account.

    Marking an expense paid used to change its status and nothing else, so the
    cash position never went down for anything but payroll - the safe could
    read 2 million while holding a few thousand.
    """
    if expense.status != 'approved':
        raise FinanceError('Only an approved expense can be paid.')

    amount = money(expense.amount)
    account = account or account_for_method(expense.method)
    if account is not None:
        available = account_balance(account)
        if amount > available:
            raise FinanceError(f'{account.name} holds {available}; this expense needs {amount}.')

    expense.status = 'paid'
    if note:
        expense.decision_note = note[:255]
    expense.save(update_fields=['status', 'decision_note'])
    post_movement(account, 'expense', -amount,
                  description=f'{expense.category.name}: {expense.description}',
                  occurred_on=paid_on or timezone.localdate(), expense=expense,
                  recorded_by=paid_by)
    return expense


# ── Arrears ───────────────────────────────────────────────────────────────────

def current_term():
    return AcademicTerm.objects.filter(is_current=True).first()


def arrears_for(student, before_term=None):
    """
    What this family still owes from terms already finished.

    Unpaid balances used to simply stop being counted when a term ended: the
    dashboard measures the current term, so last term's 40,000 disappeared from
    every screen while still being owed. This is that money.
    """
    return sum((balance_of(fee) for fee in _earlier_open_charges(student, before_term)), ZERO)


def _earlier_open_charges(student, before_term=None):
    """Unsettled charges from terms that started before `before_term`, oldest first."""
    qs = Fee.objects.filter(student=student).exclude(status='cleared')
    if before_term is not None:
        qs = qs.exclude(term=before_term).filter(term__isnull=False)
        # Only terms that started before this one. A charge for NEXT term is
        # not arrears, it is simply not due yet.
        qs = qs.filter(term__year__lte=before_term.year)
        qs = qs.exclude(term__year=before_term.year, term__order__gte=before_term.order)
    fees = qs.order_by('due_date', 'created_at').prefetch_related('payments')
    return [fee for fee in fees if balance_of(fee) > ZERO]


def _carry(fee, into, amount):
    """
    Move `amount` of an old charge's balance onto the arrears charge `into`.

    The old charge is closed by a 'carried' line and the arrears charge grows
    by the same amount, in one step, so at no moment is the debt owed twice.
    """
    import uuid

    amount = money(amount)
    FeePayment.objects.create(
        fee=fee, amount=amount, method='carried', carried_to=into,
        # Not a receipt: a reference the statement can show, outside the
        # receipt sequence.
        receipt_no=f'BF-{uuid.uuid4().hex[:10].upper()}',
        notes=f'Carried forward to {into.term.name if into.term else "a later term"}.',
    )
    recalculate_fee(fee)
    Fee.objects.filter(pk=into.pk).update(amount=money(into.amount) + amount)
    into.refresh_from_db()
    recalculate_fee(into)


@transaction.atomic
def carry_arrears_forward(into_term, *, category='arrears', due_date=None, students=None):
    """
    Move what each family owes from earlier terms onto one arrears charge.

    Moved, not copied. This used to raise an arrears charge while last term's
    charges stayed open behind it, so the same 80,000 was owed twice: on the
    old tuition line and on the new arrears line, and a family paying one still
    showed as owing the other. Each old balance is now closed with a 'carried'
    line and added to the arrears charge, so the debt lives in one place.

    Idempotent per (student, term): only balances not yet carried move, and
    they go onto the existing arrears charge rather than a second one, because
    the natural response to "did that work?" is to press it again.
    """
    if into_term is None:
        raise FinanceError('Pick the term to carry the balances into.')

    roster = students if students is not None else Student.objects.all()
    raised = updated = cleared = 0

    for student in roster:
        old = _earlier_open_charges(student, before_term=into_term)
        existing = Fee.objects.filter(student=student, term=into_term,
                                      category=category).first()
        if not old:
            # An arrears line with nothing carried onto it and no money against
            # it is left over from before balances were moved; a 0 RWF line on
            # a bill is a question the office has to answer.
            if (existing and not existing.payments.exists()
                    and not existing.carried_in.exists()):
                existing.delete()
                cleared += 1
            continue

        if existing is None:
            existing = Fee.objects.create(
                student=student, term=into_term, category=category, amount=ZERO,
                due_date=due_date or timezone.localdate(),
                notes='Brought forward from earlier terms.',
            )
            raised += 1
        else:
            if not existing.carried_in.exists():
                # Raised before balances were moved: its amount is a copy of
                # the very balances about to move onto it.
                Fee.objects.filter(pk=existing.pk).update(amount=ZERO)
                existing.refresh_from_db()
            updated += 1

        for fee in old:
            _carry(fee, existing, balance_of(fee))

    return {'raised': raised, 'updated': updated, 'cleared': cleared}


# ── Budget ────────────────────────────────────────────────────────────────────

def budget_report(budget):
    """
    Planned against actual, per category, for one budget's term.

    Actuals count expenses that are approved or paid. A pending expense is a
    request, not a commitment, and counting it would make a budget look spent
    on the strength of something the head has not agreed to.
    """
    from .models import Expense

    spent_by_category = dict(
        Expense.objects
        .filter(term=budget.term, status__in=['approved', 'paid'])
        .values_list('category')
        .annotate(total=Sum('amount'))
    )

    lines, planned_total, actual_total = [], ZERO, ZERO
    for line in budget.lines.select_related('category'):
        actual = money(spent_by_category.pop(line.category_id, 0))
        planned = money(line.planned)
        planned_total += planned
        actual_total += actual
        lines.append({
            'category': line.category,
            'planned': planned,
            'actual': actual,
            'variance': planned - actual,
            # Guard the division: an unbudgeted category with spend against it
            # is exactly the row somebody needs to see, not a crash.
            'used_percent': float(actual / planned * 100) if planned > ZERO else None,
            'over': actual > planned,
        })

    # Anything spent against a category nobody budgeted for. Dropping these
    # would let real spending hide by simply not being in the plan.
    from .models import ExpenseCategory
    for category_id, total in spent_by_category.items():
        category = ExpenseCategory.objects.filter(pk=category_id).first()
        actual = money(total)
        actual_total += actual
        lines.append({
            'category': category, 'planned': ZERO, 'actual': actual,
            'variance': -actual, 'used_percent': None, 'over': True,
            'unbudgeted': True,
        })

    return {
        'budget': budget,
        'lines': lines,
        'planned_total': planned_total,
        'actual_total': actual_total,
        'variance_total': planned_total - actual_total,
    }


# ── Payroll ───────────────────────────────────────────────────────────────────



def validate_paye_bands(bands):
    """
    Check a band table before it is saved; returns it cleaned.

    Ascending limits, rates 0-100, and an open-ended top band - a table that
    stops at 200,000 would leave a head teacher's salary above it untaxed.
    """
    if not isinstance(bands, list) or not bands:
        raise FinanceError('PAYE needs at least one band.')
    cleaned, previous = [], Decimal('0')
    for index, band in enumerate(bands):
        last = index == len(bands) - 1
        try:
            rate = Decimal(str(band.get('rate')))
            upto = band.get('upto')
            upto = None if upto in (None, '') else Decimal(str(upto))
        except (AttributeError, ArithmeticError, ValueError):
            raise FinanceError('Each PAYE band needs a limit and a rate.')
        if not Decimal('0') <= rate <= Decimal('100'):
            raise FinanceError('A PAYE rate has to be between 0 and 100.')
        if last and upto is not None:
            raise FinanceError('The top PAYE band has no upper limit.')
        if not last and (upto is None or upto <= previous):
            raise FinanceError('PAYE band limits have to go up, band by band.')
        cleaned.append({'upto': None if upto is None else int(upto), 'rate': float(rate)})
        previous = upto if upto is not None else previous
    return cleaned


def paye_tax(taxable, bands=None):
    """
    Progressive PAYE on one month's taxable pay.

    Each band's rate applies only to the slice of pay inside it. On 250,000
    under Rwanda's bands: 0 on the first 60,000, 10% of the next 40,000, 20%
    of the next 100,000 and 30% of the last 50,000 = 39,000. A flat 30% would
    have taken 75,000.
    """
    bands = bands if bands is not None else FinanceSettings.load().paye_bands
    taxable = money(taxable)
    tax, floor = ZERO, ZERO
    for band in bands:
        upto = band.get('upto')
        ceiling = taxable if upto in (None, '') else min(taxable, money(upto))
        if ceiling > floor:
            tax += (ceiling - floor) * money(band.get('rate')) / Decimal('100')
        if upto in (None, '') or taxable <= money(upto):
            break
        floor = money(upto)
    return tax.quantize(Decimal('1.00'))


def payslip_figures(salary, bands=None):
    """
    Turn a standing salary into the amounts for one payslip.

    Pension is a percentage of gross, not of gross plus allowances: allowances
    are usually non-pensionable. PAYE is different - the law taxes all
    employment income, allowances included - so the band method taxes both.
    The flat method keeps the old rule, tax_percent of gross, for a second
    employer or a consultant withheld at a fixed rate.
    """
    gross = money(salary.gross)
    allowances = money(salary.allowances)
    pension = money(gross * money(salary.pension_percent) / Decimal('100'))
    if getattr(salary, 'tax_method', 'flat') == 'paye':
        tax = paye_tax(gross + allowances, bands)
    else:
        tax = money(gross * money(salary.tax_percent) / Decimal('100'))
    other = money(salary.other_deduction)
    return {
        'gross': gross,
        'allowances': allowances,
        'pension': pension,
        'tax': tax,
        'other_deduction': other,
        'net': gross + allowances - pension - tax - other,
    }


@transaction.atomic
def build_payroll(run, *, only_staff=None):
    """
    Fill a draft run with one payslip per active salaried member of staff.

    Rebuilding a DRAFT replaces its payslips, which is what you want while the
    figures are still being corrected. An approved or paid run refuses -- its
    payslips are a statement already made, and rebuilding would rewrite it.
    """
    from .models import Payslip, StaffSalary

    if run.status not in ('draft',):
        raise FinanceError('Only a draft run can be rebuilt.')

    # Everyone on the register who is still employed and has a live salary,
    # whether or not they sign in to Imboni.
    salaries = (StaffSalary.objects.filter(is_active=True, staff__is_active=True)
                .select_related('staff__department', 'staff__user'))
    if only_staff is not None:
        salaries = salaries.filter(staff__in=only_staff)

    run.payslips.all().delete()
    made = 0
    bands = FinanceSettings.load().paye_bands
    for salary in salaries:
        figures = payslip_figures(salary, bands)
        if figures['net'] <= ZERO and figures['gross'] <= ZERO:
            continue        # nothing to pay; not a payslip
        staff = salary.staff
        Payslip.objects.create(
            run=run, staff=staff, staff_name=staff.full_name,
            role=staff.user.role if staff.user_id else '',
            job_title=staff.job_title,
            department=staff.department.name if staff.department_id else '',
            bank_account=salary.bank_account,
            **figures,
        )
        made += 1
    return made


def payroll_by_department(run):
    """What the month costs each department, largest first."""
    rows = (run.payslips.values('department')
            .annotate(staff=Count('id'), gross=Sum('gross'), net=Sum('net'))
            .order_by('-gross'))
    return [{'department': r['department'], 'staff': r['staff'],
             'gross': money(r['gross'] or 0), 'net': money(r['net'] or 0)} for r in rows]


def payroll_totals(run):
    """Gross, deductions and net for a whole run."""
    aggregate = run.payslips.aggregate(
        gross=Sum('gross'), allowances=Sum('allowances'), pension=Sum('pension'),
        tax=Sum('tax'), other=Sum('other_deduction'), net=Sum('net'),
    )
    return {key: money(value or 0) for key, value in aggregate.items()}


@transaction.atomic
def approve_payroll(run, approved_by=None):
    if run.status != 'draft':
        raise FinanceError('Only a draft run can be approved.')
    if not run.payslips.exists():
        raise FinanceError('There is nothing to approve: this run has no payslips.')
    if approved_by is not None and run.prepared_by_id == approved_by.pk:
        # The same separation the expenses page already enforces. A control one
        # person can complete alone is not a control.
        raise FinanceError('Payroll has to be approved by someone other than '
                           'whoever prepared it.')
    run.status = 'approved'
    run.approved_by = approved_by
    run.approved_at = timezone.now()
    run.save(update_fields=['status', 'approved_by', 'approved_at'])
    return run


@transaction.atomic
def pay_payroll(run, *, account=None, paid_on=None, paid_by=None):
    """
    Settle an approved run: one expense, one movement out of an account.

    Payroll is the school's largest outgoing, so it must appear in the expense
    report and the cash position like everything else. Writing it here, rather
    than asking the bursar to remember to add an expense afterwards, is what
    keeps 'Spent' honest.
    """
    from .models import Expense, ExpenseCategory

    if run.status != 'approved':
        raise FinanceError('Only an approved run can be paid.')

    totals = payroll_totals(run)
    net = totals['net']
    if net <= ZERO:
        raise FinanceError('This run pays nothing.')

    account = account or run.account or default_account()
    if account is not None:
        available = account_balance(account)
        if net > available:
            raise FinanceError(
                f'{account.name} holds {available}; this run needs {net}.')

    category, _ = ExpenseCategory.objects.get_or_create(
        name='Salaries', defaults={'description': 'Staff pay'})
    paid_on = paid_on or timezone.localdate()

    expense = Expense.objects.create(
        category=category,
        description=f'Payroll: {run.period_label}',
        amount=net, status='paid', term=current_term(),
        recorded_by=run.prepared_by, approved_by=run.approved_by,
        decided_at=run.approved_at, spent_on=paid_on,
    )
    post_movement(account, 'expense', -net,
                  description=f'Payroll {run.period_label}',
                  occurred_on=paid_on, expense=expense, recorded_by=paid_by)

    # What was withheld is not the school's to keep: PAYE goes to the revenue
    # authority and pension to the social security fund, usually by the 15th of
    # the next month. Only the net used to be booked, so payroll understated
    # the cost of staff by every franc of tax and pension, and nothing reminded
    # the office that the money was owed on. Each is raised as an approved
    # expense, paid out (and out of an account) when it is actually remitted.
    for label, key in (('PAYE withheld', 'tax'), ('Pension withheld', 'pension'),
                       ('Other payroll deductions', 'other')):
        if totals[key] > ZERO:
            Expense.objects.create(
                category=category, description=f'{label}: {run.period_label}',
                amount=totals[key], status='approved', term=current_term(),
                recorded_by=run.prepared_by, approved_by=run.approved_by,
                decided_at=run.approved_at, spent_on=paid_on,
                payee='Revenue authority' if key == 'tax' else '',
            )

    run.status = 'paid'
    run.paid_on = paid_on
    run.account = account
    run.expense = expense
    run.save(update_fields=['status', 'paid_on', 'account', 'expense'])
    return run
