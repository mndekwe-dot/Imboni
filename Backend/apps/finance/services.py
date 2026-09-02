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

    post_movement(account or default_account(), 'fee', amount,
                  description=f'{receipt} {fee.student.full_name}',
                  occurred_on=payment.paid_on, payment=payment,
                  recorded_by=received_by)
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

    # Take the money back out of wherever it was put, rather than deleting the
    # original movement: the account's history has to show that cash arrived
    # and then went back, which is what a parent asking about it will be told.
    original = payment.movements.filter(kind='fee').first()
    if original is not None:
        post_movement(original.account, 'adjustment', -money(original.amount),
                      description=f'Reversed {payment.receipt_no}',
                      payment=payment, recorded_by=reversed_by)
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

    account = account or default_account()
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
    qs = Fee.objects.filter(student=student).exclude(status='cleared')
    if before_term is not None:
        qs = qs.exclude(term=before_term).filter(term__isnull=False)
        # Only terms that started before this one. A charge for NEXT term is
        # not arrears, it is simply not due yet.
        qs = qs.filter(term__year__lte=before_term.year)
        qs = qs.exclude(term__year=before_term.year, term__order__gte=before_term.order)
    total = ZERO
    for fee in qs.prefetch_related('payments'):
        total += balance_of(fee)
    return total


@transaction.atomic
def carry_arrears_forward(into_term, *, category='arrears', due_date=None, students=None):
    """
    Raise one 'arrears' charge per family for what they owe from earlier terms.

    Idempotent per (student, term): re-running updates the existing arrears
    charge rather than adding a second one, because the natural response to
    "did that work?" is to press it again, and a family's bill must not double.

    A family whose arrears have since been settled has its arrears charge
    removed rather than left at zero -- a 0 RWF line on a bill is a question
    the office has to answer.
    """
    if into_term is None:
        raise FinanceError('Pick the term to carry the balances into.')

    roster = students if students is not None else Student.objects.all()
    raised = updated = cleared = 0

    for student in roster:
        owed = arrears_for(student, before_term=into_term)
        existing = Fee.objects.filter(student=student, term=into_term,
                                      category=category).first()
        if owed <= ZERO:
            # Never delete one that has money against it -- that would erase a
            # receipt's charge. Only an untouched, now-unnecessary line goes.
            if existing and not existing.payments.exists():
                existing.delete()
                cleared += 1
            continue

        if existing is None:
            Fee.objects.create(
                student=student, term=into_term, category=category, amount=owed,
                due_date=due_date or timezone.localdate(),
                notes='Brought forward from earlier terms.',
            )
            raised += 1
        elif money(existing.amount) != owed:
            existing.amount = owed
            existing.save(update_fields=['amount'])
            recalculate_fee(existing)
            updated += 1

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

PAYROLL_ROLES = ('teacher', 'dos', 'matron', 'discipline', 'librarian', 'bursar', 'admin')


def payslip_figures(salary):
    """
    Turn a standing salary into the amounts for one payslip.

    Percentages are applied to gross, not to gross plus allowances: allowances
    are usually non-pensionable and taxing them here would quietly overstate
    every deduction. A school that works differently edits one function.
    """
    gross = money(salary.gross)
    allowances = money(salary.allowances)
    pension = money(gross * money(salary.pension_percent) / Decimal('100'))
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

    salaries = (StaffSalary.objects.filter(is_active=True, staff__is_active=True)
                .select_related('staff'))
    if only_staff is not None:
        salaries = salaries.filter(staff__in=only_staff)

    run.payslips.all().delete()
    made = 0
    for salary in salaries:
        figures = payslip_figures(salary)
        if figures['net'] <= ZERO and figures['gross'] <= ZERO:
            continue        # nothing to pay; not a payslip
        staff = salary.staff
        Payslip.objects.create(
            run=run, staff=staff,
            staff_name=f'{staff.first_name} {staff.last_name}'.strip() or staff.username,
            role=staff.role or '', bank_account=salary.bank_account,
            **figures,
        )
        made += 1
    return made


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

    run.status = 'paid'
    run.paid_on = paid_on
    run.account = account
    run.expense = expense
    run.save(update_fields=['status', 'paid_on', 'account', 'expense'])
    return run
