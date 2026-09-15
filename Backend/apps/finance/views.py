"""
The finance API.

Gated twice, like the library: by ROLE (who is asking) and by PLAN (whether the
school bought this at all). The plan check raises 402 -- not forbidden, unpaid
for -- and the availability endpoint below is deliberately outside it, because
the frontend needs to be able to hear "no".
"""
from decimal import Decimal, InvalidOperation

from django.db.models import Q, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.permissions import IsBursar, IsBursarOrAdmin
from apps.results.models import AcademicTerm
from apps.student.models import Fee, Student
from apps.tenants.limits import enforce_feature, tenant_has_feature

from apps.common import documents

from . import documents as finance_documents
from . import services
from .models import (
    Expense, ExpenseCategory, FeePayment, FeeStructure, FinanceSettings,
    StudentAccount, money,
)
from .serializers import (
    ExpenseCategorySerializer, ExpenseSerializer, FeePaymentSerializer,
    FeeSerializer, FeeStructureSerializer, FinanceSettingsSerializer,
    StudentAccountSerializer, student_brief,
)

FINANCE = 'finance'
FINANCE_LABEL = 'The finance office'


class FinanceView(APIView):
    """Authenticated, on a plan that includes finance. Subclasses add the role."""
    permission_classes = [IsBursarOrAdmin]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        enforce_feature(FINANCE, FINANCE_LABEL)


class BursarView(FinanceView):
    """Writes belong to the office; an admin may read but not take money."""
    permission_classes = [IsBursar]


class FinanceAvailabilityView(APIView):
    """
    Is finance part of this school's plan?

    Not gated by the feature it reports on: the frontend asks this to decide
    whether to show the portal, and an endpoint that 402s cannot tell "not on
    your plan" from "the server is down".
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({'enabled': tenant_has_feature(FINANCE)})


def student_filters(qs, request, prefix='student'):
    """
    Narrow a queryset to the students a page is asking about.

    One definition, used by charges, payments and debtors alike, so the class
    picker means the same thing on every screen. `prefix` is the path from the
    row to the student: 'student' on a Fee, 'fee__student' on a payment.

    Three filters, all optional and combinable:
        grade   the year level  (S1..S6)
        stream  the class within it (A, B, MPG)
        q       a name or student id

    NOTE `stream` maps to `Student.section`. The class picker calls its top
    level "section" (O-Level / A-Level) while the model calls the STREAM
    letter `section`, so a page passing its picker's `section` straight through
    would filter S1 pupils by the string 'O-Level' and return nothing.
    """
    def field(name):
        return f'{prefix}__{name}' if prefix else name

    # One year, or a comma-separated list: the class picker sends every year
    # of a section when only the section is chosen ("S4,S5,S6" for A-Level).
    grades = grades_of(request)
    if grades:
        qs = qs.filter(**{field('grade') + '__in': grades})

    stream = (request.query_params.get('stream') or '').strip()
    if stream:
        qs = qs.filter(**{field('section'): stream})

    search = (request.query_params.get('q') or '').strip()
    if search:
        # `full_name` is a PROPERTY on Student (it comes from the user), not a
        # column -- filtering on it would raise FieldError.
        qs = qs.filter(
            Q(**{field('user__first_name') + '__icontains': search})
            | Q(**{field('user__last_name') + '__icontains': search})
            | Q(**{field('student_id') + '__icontains': search}))
    return qs


def grades_of(request):
    """The years asked for: '?grade=S4' or '?grade=S4,S5,S6'."""
    raw = request.query_params.get('grade') or ''
    return [g.strip() for g in raw.split(',') if g.strip()]


def class_label_of(request):
    """How the current filter reads on a printed document, e.g. 'S4 A'."""
    grade = ', '.join(grades_of(request))
    stream = (request.query_params.get('stream') or '').strip()
    if grade and stream:
        return f'{grade}{stream}'
    return grade or (f'Stream {stream}' if stream else 'All classes')


def _current_term(request):
    term_id = request.query_params.get('term') or request.data.get('term')
    if term_id:
        return AcademicTerm.objects.filter(pk=term_id).first()
    return AcademicTerm.objects.filter(is_current=True).first()


# ── Dashboard ─────────────────────────────────────────────────────────────────

class FinanceDashboardView(FinanceView):
    def get(self, request):
        term = _current_term(request)
        summary = services.collection_summary(term)

        expenses = Expense.objects.all()
        if term is not None:
            expenses = expenses.filter(term=term)
        # Spent is what has gone out. An approved expense not yet paid is a
        # commitment: counting it as spent made "net" look worse than the cash
        # the school actually held.
        spent = money(expenses.filter(status='paid').aggregate(t=Sum('amount'))['t'])
        committed = money(expenses.filter(status='approved').aggregate(t=Sum('amount'))['t'])

        recent = (FeePayment.objects.filter(reversed_at__isnull=True)
                  .exclude(method='carried').select_related('fee__student')[:8])

        # The classes furthest behind, which is where the office spends its day.
        by_class = {}
        fee_rows = Fee.objects.select_related('student').prefetch_related('payments')
        if term is not None:
            fee_rows = fee_rows.filter(term=term)
        for fee in fee_rows:
            if fee.student is None:
                continue
            label = f'{fee.student.grade}{fee.student.section}'
            row = by_class.setdefault(label, {'class_label': label,
                                              'charged': Decimal('0'),
                                              'collected': Decimal('0')})
            row['charged'] += money(fee.amount)
            row['collected'] += services.paid_total(fee)

        classes = sorted(
            ({'class_label': r['class_label'],
              'charged': str(r['charged']),
              'collected': str(r['collected']),
              'outstanding': str(r['charged'] - r['collected'])}
             for r in by_class.values()),
            key=lambda r: Decimal(r['outstanding']), reverse=True,
        )[:6]

        return Response({
            'term': summary['term'],
            'charged': str(summary['charged']),
            'collected': str(summary['collected']),
            'outstanding': str(summary['outstanding']),
            'collection_rate': summary['collection_rate'],
            'students_owing': summary['students_owing'],
            'expenses': str(spent),
            'committed': str(committed),
            'waived': str(summary['waived']),
            'net': str(summary['collected'] - spent),
            'pending_expenses': Expense.objects.filter(status='pending').count(),
            'overdue_charges': Fee.objects.filter(
                due_date__lt=services.overdue_cutoff()).exclude(status='cleared').count(),
            'recent_payments': FeePaymentSerializer(recent, many=True).data,
            'by_class': classes,
        })


# ── Charges ───────────────────────────────────────────────────────────────────

class FeeListView(FinanceView):
    def get(self, request):
        qs = (Fee.objects.select_related('student')
              .prefetch_related('payments'))
        term = _current_term(request)
        if term is not None:
            qs = qs.filter(term=term)

        status_filter = request.query_params.get('status', 'all')
        if status_filter == 'outstanding':
            qs = qs.exclude(status='cleared')
        elif status_filter == 'overdue':
            qs = qs.filter(due_date__lt=timezone.localdate()).exclude(status='cleared')
        elif status_filter != 'all':
            qs = qs.filter(status=status_filter)

        qs = student_filters(qs, request)

        if documents.wants(request, 'csv'):
            labels = services.category_labels()
            return documents.csv_response(
                f'charges-{class_label_of(request)}',
                ['Student', 'Class', 'Student ID', 'Category', 'Charged',
                 'Paid', 'Outstanding', 'Due', 'Status'],
                ([f.student.full_name if f.student else '',
                  f'{f.student.grade}{f.student.section}' if f.student else '',
                  f.student.student_id if f.student else '',
                  services.category_label(f.category, labels), f.amount,
                  services.paid_total(f), services.balance_of(f),
                  f.due_date, f.get_status_display()]
                 for f in qs))
        if documents.wants(request, 'pdf'):
            return finance_documents.charges_pdf(request, qs, term)

        # The cap is for the SCREEN only. An export must not silently stop at
        # 400 rows -- a truncated list a bursar believes is complete is worse
        # than no list at all -- so it is applied after the export branches.
        return Response(FeeSerializer(qs[:400], many=True).data)

    def post(self, request):
        """One-off charge for one student — a replacement book, a trip."""
        if request.user.role != 'bursar':
            return Response({'detail': 'Only the finance office raises a charge.'},
                            status=403)
        student = get_object_or_404(Student, pk=request.data.get('student'))
        serializer = FeeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        fee = Fee.objects.create(
            student=student,
            category=request.data.get('category', 'other'),
            amount=money(request.data.get('amount')),
            due_date=request.data.get('due_date'),
            term=_current_term(request),
            notes=request.data.get('notes', ''),
        )
        services.recalculate_fee(fee)
        return Response(FeeSerializer(fee).data, status=201)


# ── Payments ──────────────────────────────────────────────────────────────────

class PaymentListView(FinanceView):
    def get(self, request):
        # The receipt book: money taken. A balance carried forward is not a
        # receipt, and listing it would inflate every cash-up.
        qs = (FeePayment.objects.select_related('fee__student__user', 'received_by')
              .exclude(method='carried'))
        if request.query_params.get('include_reversed') != 'true':
            qs = qs.filter(reversed_at__isnull=True)
        student = request.query_params.get('student')
        if student:
            qs = qs.filter(fee__student_id=student)
        qs = student_filters(qs, request, prefix='fee__student')

        # A cashing-up run is bounded by dates, not by class: "what did we take
        # today", "what did we take this week".
        date_from = (request.query_params.get('from') or '').strip()
        date_to = (request.query_params.get('to') or '').strip()
        if date_from:
            qs = qs.filter(paid_on__gte=date_from)
        if date_to:
            qs = qs.filter(paid_on__lte=date_to)
        method = (request.query_params.get('method') or '').strip()
        if method:
            qs = qs.filter(method=method)

        if documents.wants(request, 'csv'):
            labels = services.category_labels()
            return documents.csv_response(
                'receipts',
                ['Receipt', 'Date', 'Student', 'Class', 'Category', 'Amount',
                 'Method', 'Reference', 'Taken by', 'Reversed'],
                ([p.receipt_no, p.paid_on,
                  p.fee.student.full_name if p.fee and p.fee.student else '',
                  (f'{p.fee.student.grade}{p.fee.student.section}'
                   if p.fee and p.fee.student else ''),
                  services.category_label(p.fee.category, labels) if p.fee else '',
                  p.amount, p.get_method_display(), p.reference,
                  getattr(p.received_by, 'username', ''),
                  'yes' if p.is_reversed else '']
                 for p in qs))
        if documents.wants(request, 'pdf'):
            return finance_documents.payments_pdf(request, qs)

        return Response(FeePaymentSerializer(qs[:300], many=True).data)


class RecordPaymentView(BursarView):
    """
    Take money: against one charge (`fee`), or as one sum across a student's
    charges (`student`, with optional `allocations` [{fee, amount}]; without
    them the oldest charge is settled first).
    """

    def post(self, request):
        try:
            amount = Decimal(str(request.data.get('amount')))
        except (InvalidOperation, TypeError):
            return Response({'detail': 'That amount is not a number.'}, status=400)
        details = dict(
            method=request.data.get('method', 'cash'),
            reference=request.data.get('reference', ''),
            received_by=request.user,
            paid_on=request.data.get('paid_on') or None,
            payer_name=request.data.get('payer_name', ''),
            notes=request.data.get('notes', ''),
        )
        try:
            if request.data.get('fee'):
                fee = get_object_or_404(Fee, pk=request.data.get('fee'))
                lines = [services.record_payment(fee, amount, **details)]
            else:
                student = get_object_or_404(Student, pk=request.data.get('student'))
                allocations = request.data.get('allocations') or None
                if allocations is not None and not isinstance(allocations, list):
                    return Response({'detail': 'Allocations have to be a list.'}, status=400)
                # The term the desk is showing: see services.open_charges.
                lines = services.record_split_payment(student, amount, allocations,
                                                      term=_current_term(request), **details)
        except services.FinanceError as exc:
            return Response({'detail': str(exc)}, status=400)
        for line in lines:
            line.fee.refresh_from_db()
        return Response({
            'payment': FeePaymentSerializer(lines[0]).data,
            'payments': FeePaymentSerializer(lines, many=True).data,
            'total': str(sum((line.amount for line in lines), Decimal('0'))),
            'fee': FeeSerializer(lines[0].fee).data,
        }, status=201)


class ReversePaymentView(BursarView):
    def post(self, request, pk):
        payment = get_object_or_404(FeePayment, pk=pk)
        try:
            payment = services.reverse_payment(
                payment, reversed_by=request.user,
                reason=request.data.get('reason', ''))
        except services.FinanceError as exc:
            return Response({'detail': str(exc)}, status=400)
        return Response(FeePaymentSerializer(payment).data)


# ── Students ──────────────────────────────────────────────────────────────────

class DebtorListView(FinanceView):
    """Who owes what, worst first — the list the office works from."""
    def get(self, request):
        term = _current_term(request)
        fees = Fee.objects.select_related('student').prefetch_related('payments')
        if term is not None:
            fees = fees.filter(term=term)
        # Same picker, same meaning, on this page too.
        fees = student_filters(fees, request)

        rows = {}
        cutoff = services.overdue_cutoff()
        for fee in fees:
            if fee.student is None:
                continue
            balance = services.balance_of(fee)
            if balance <= Decimal('0'):
                continue
            row = rows.setdefault(str(fee.student.id), {
                'student': student_brief(fee.student),
                'outstanding': Decimal('0'),
                'overdue': Decimal('0'),
                'charges': 0,
            })
            row['outstanding'] += balance
            row['charges'] += 1
            if fee.due_date < cutoff:
                row['overdue'] += balance

        out = sorted(rows.values(), key=lambda r: r['outstanding'], reverse=True)

        if documents.wants(request, 'csv'):
            return documents.csv_response(
                f'who-owes-{class_label_of(request)}',
                ['Student', 'Class', 'Student ID', 'Charges', 'Outstanding', 'Overdue'],
                ([r['student']['name'], r['student']['class_label'],
                  r['student']['student_id'], r['charges'],
                  r['outstanding'], r['overdue']] for r in out))
        if documents.wants(request, 'pdf'):
            return finance_documents.debtors_pdf(request, out, term)

        return Response([
            {**r, 'outstanding': str(r['outstanding']), 'overdue': str(r['overdue'])}
            for r in out[:300]
        ])


class StudentFinanceView(FinanceView):
    def get(self, request, pk):
        student = get_object_or_404(Student, pk=pk)
        term = _current_term(request)
        balance = services.student_balance(student, term)
        account = getattr(student, 'finance_account', None)
        return Response({
            'student': student_brief(student),
            'charged': str(balance['charged']),
            'paid': str(balance['paid']),
            'outstanding': str(balance['outstanding']),
            'overdue': str(balance['overdue']),
            'fees': FeeSerializer(balance['fees'], many=True).data,
            'account': StudentAccountSerializer(account).data if account else None,
        })

    def put(self, request, pk):
        """The office's note on a family: who pays, any bursary or arrangement."""
        if request.user.role != 'bursar':
            return Response({'detail': 'Only the finance office edits an account.'},
                            status=403)
        student = get_object_or_404(Student, pk=pk)
        account, _ = StudentAccount.objects.get_or_create(student=student)
        serializer = StudentAccountSerializer(account, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(StudentAccountSerializer(account).data)


# ── Expenses ──────────────────────────────────────────────────────────────────

class ExpenseListView(FinanceView):
    def get(self, request):
        qs = Expense.objects.select_related('category', 'recorded_by', 'approved_by')
        status_filter = request.query_params.get('status')
        if status_filter and status_filter != 'all':
            qs = qs.filter(status=status_filter)

        term = _current_term(request)
        if term is not None and request.query_params.get('term') != 'all':
            qs = qs.filter(term=term)
        category = request.query_params.get('category')
        if category:
            qs = qs.filter(category_id=category)
        date_from = (request.query_params.get('from') or '').strip()
        date_to = (request.query_params.get('to') or '').strip()
        if date_from:
            qs = qs.filter(spent_on__gte=date_from)
        if date_to:
            qs = qs.filter(spent_on__lte=date_to)
        search = (request.query_params.get('q') or '').strip()
        if search:
            qs = qs.filter(Q(description__icontains=search)
                           | Q(payee__icontains=search)
                           | Q(reference__icontains=search))

        if documents.wants(request, 'csv'):
            return documents.csv_response(
                'expenses',
                ['Date', 'Category', 'Description', 'Payee', 'Method',
                 'Reference', 'Status', 'Amount'],
                ([e.spent_on, e.category.name if e.category else '', e.description,
                  e.payee, e.get_method_display(), e.reference,
                  e.get_status_display(), e.amount] for e in qs))
        if documents.wants(request, 'pdf'):
            committed = sum((e.amount for e in qs
                             if e.status in ('approved', 'paid')), Decimal('0'))
            pending = sum((e.amount for e in qs if e.status == 'pending'),
                          Decimal('0'))
            return finance_documents.expenses_pdf(
                list(qs), term, {'committed': committed, 'pending': pending})

        return Response(ExpenseSerializer(qs[:300], many=True).data)

    def post(self, request):
        if request.user.role != 'bursar':
            return Response({'detail': 'Only the finance office records an expense.'},
                            status=403)
        serializer = ExpenseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        expense = serializer.save(recorded_by=request.user, status='pending',
                                  term=_current_term(request))
        return Response(ExpenseSerializer(expense).data, status=201)


class ExpenseDecisionView(FinanceView):
    """
    Approve or reject. The office records what it spent; the head signs it off.

    Recording and approving in one action would make the control meaningless,
    so the person who recorded it cannot be the person who approves it.
    """
    def post(self, request, pk):
        expense = get_object_or_404(Expense, pk=pk)
        decision = request.data.get('decision')
        if decision not in ('approved', 'rejected', 'paid'):
            return Response(
                {'detail': 'decision must be "approved", "rejected" or "paid".'},
                status=400)
        if decision in ('approved', 'rejected'):
            if request.user.role != 'admin':
                return Response(
                    {'detail': 'Only a school administrator approves an expense.'},
                    status=403)
            if expense.status != 'pending':
                return Response({'detail': f'That expense is already {expense.status}.'},
                                status=400)
        else:  # marking an approved expense as actually paid out
            if request.user.role != 'bursar':
                return Response({'detail': 'Only the finance office pays an expense.'},
                                status=403)
            if expense.status != 'approved':
                return Response({'detail': 'Only an approved expense can be paid.'},
                                status=400)

        if decision == 'paid':
            from .models import CashAccount
            account = None
            if request.data.get('account'):
                account = get_object_or_404(CashAccount, pk=request.data['account'], is_active=True)
            try:
                services.pay_expense(expense, account=account, paid_by=request.user,
                                     note=request.data.get('note') or '')
            except services.FinanceError as exc:
                return Response({'detail': str(exc)}, status=400)
            return Response(ExpenseSerializer(expense).data)

        expense.status = decision
        expense.decision_note = (request.data.get('note') or '')[:255]
        expense.approved_by = request.user
        expense.decided_at = timezone.now()
        expense.save(update_fields=['status', 'decision_note', 'approved_by', 'decided_at'])
        return Response(ExpenseSerializer(expense).data)


class ExpenseCategoryListView(FinanceView):
    def get(self, request):
        return Response(ExpenseCategorySerializer(
            ExpenseCategory.objects.filter(is_active=True), many=True).data)

    def post(self, request):
        if request.user.role != 'bursar':
            return Response({'detail': 'Only the finance office adds a category.'},
                            status=403)
        serializer = ExpenseCategorySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(ExpenseCategorySerializer(serializer.save()).data, status=201)


# ── Reports and settings ──────────────────────────────────────────────────────

class FinanceReportView(FinanceView):
    """
    The income and expenditure statement for a term: every source of money in,
    every category of money out, and the surplus. Also `?format=csv|pdf`.

    It used to count fees only, and approved-but-unpaid expenses as spent: the
    canteen, the capitation grant and library fines never reached the report,
    and the "net" was fees minus money that had not left the school.
    """
    def get(self, request):
        term = _current_term(request)
        report = services.income_statement(term)
        summary = report['summary']

        if documents.wants(request, 'csv'):
            rows = ([['Money in', line['label'], line['amount']] for line in report['income']]
                    + [['Money in', 'Total', report['income_total']]]
                    + [['Money out', line['label'], line['amount']] for line in report['expenditure']]
                    + [['Money out', 'Total', report['spent']]]
                    + [['Committed (approved, not paid)', line['label'], line['amount']]
                       for line in report['committed_lines']]
                    + [['Surplus / deficit', '', report['net']],
                       ['Fees charged', '', summary['charged']],
                       ['Fees outstanding', '', summary['outstanding']],
                       ['Collection rate %', '', summary['collection_rate']]])
            return documents.csv_response('income-and-expenditure', ['Section', 'Line', 'Amount'], rows)
        if documents.wants(request, 'pdf'):
            return finance_documents.income_statement_pdf(report)

        def lines(items):
            return [{**item, 'amount': str(item['amount'])} for item in items]

        return Response({
            'term': summary['term'],
            'charged': str(summary['charged']),
            'collected': str(summary['collected']),
            'outstanding': str(summary['outstanding']),
            'waived': str(summary['waived']),
            'collection_rate': summary['collection_rate'],
            'income': lines(report['income']),
            'fees_in': str(report['fees_in']),
            'other_in': str(report['other_in']),
            'income_total': str(report['income_total']),
            'expenditure': lines(report['expenditure']),
            'expenses': str(report['spent']),
            'committed': str(report['committed']),
            'committed_lines': lines(report['committed_lines']),
            'net': str(report['net']),
            'by_method': [{**row, 'total': str(row['total'])} for row in report['by_method']],
        })


class FinanceSettingsView(FinanceView):
    def get(self, request):
        return Response(FinanceSettingsSerializer(FinanceSettings.load()).data)

    def put(self, request):
        if request.user.role != 'bursar':
            return Response({'detail': 'Only the finance office changes these.'},
                            status=403)
        row = FinanceSettings.load()
        serializer = FinanceSettingsSerializer(row, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(FinanceSettingsSerializer(row).data)


# ── What the office prints ────────────────────────────────────────────────────

class ReceiptDocumentView(FinanceView):
    """One receipt, for the parent standing at the desk."""

    def get(self, request, pk):
        payment = get_object_or_404(
            FeePayment.objects.select_related('fee__student__user').exclude(method='carried'),
            pk=pk)
        return finance_documents.receipt_pdf(payment)


class StatementDocumentView(FinanceView):
    """Everything one family has been charged and has paid, on one page."""

    def get(self, request, pk):
        student = get_object_or_404(Student, pk=pk)
        term = _current_term(request)
        balance = services.student_balance(student, term)
        return finance_documents.statement_pdf(student, term, balance)


class RemindersDocumentView(FinanceView):
    """
    A letter per family that owes, for the class the picker is showing.

    One page each rather than one list: a reminder is handed to a particular
    parent, and a sheet carrying forty families\' debts tells every one of them
    what the others owe.
    """

    def get(self, request):
        term = _current_term(request)
        fees = Fee.objects.select_related('student__user').prefetch_related('payments')
        if term is not None:
            fees = fees.filter(term=term)
        fees = student_filters(fees, request)

        families = {}
        for fee in fees:
            if fee.student is None:
                continue
            balance = services.balance_of(fee)
            if balance <= Decimal('0'):
                continue
            row = families.setdefault(str(fee.student.id), {
                'student': student_brief(fee.student),
                'outstanding': Decimal('0'),
                'lines': [],
            })
            row['outstanding'] += balance
            row['lines'].append({
                'category': services.category_label(fee.category),
                'due_date': fee.due_date,
                'balance': balance,
            })

        rows = sorted(families.values(), key=lambda r: r['outstanding'], reverse=True)
        return finance_documents.reminders_pdf(rows, term)
