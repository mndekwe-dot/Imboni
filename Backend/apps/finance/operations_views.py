"""
The rest of a school finance office: payroll, budgets, cash, and income that is
not school fees.

Kept out of `views.py` because that file is the fee cycle -- charge, receipt,
debtor, structure -- and this is the surrounding machinery. Same two gates
(role, then plan) via the same base classes, so nothing here can be reached by
a school that has not bought finance.

Every list answers `?format=csv` and `?format=pdf` as well as JSON. Exports are
built from the FILTERED queryset before any display cap is applied: a bursar
who exports a list and gets the first 300 rows of 900 has been misled by their
own tools.
"""
from decimal import Decimal, InvalidOperation

from django.db.models import Q, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.response import Response

from apps.authentication.models import User
from apps.common import documents
from apps.results.models import AcademicTerm

from . import documents as finance_documents
from . import services
from .models import (
    Budget, BudgetLine, CashAccount, CashMovement, Expense, ExpenseCategory,
    IncomeCategory, OtherIncome, PayrollRun, Payslip, Reconciliation,
    StaffSalary, money,
)
from .serializers import (
    BudgetLineSerializer, BudgetSerializer, CashAccountSerializer,
    CashMovementSerializer, IncomeCategorySerializer, OtherIncomeSerializer,
    PayrollRunSerializer, PayslipSerializer, ReconciliationSerializer,
    StaffSalarySerializer,
)
from .views import BursarView, FinanceView, _current_term

ZERO = Decimal('0.00')


def _amount(raw, field='amount'):
    """Parse an amount or raise a message a person can act on."""
    try:
        return money(Decimal(str(raw)))
    except (InvalidOperation, TypeError, ValueError):
        raise ValueError(f'That {field} is not a number.')


def _fail(message, status=400):
    return Response({'detail': message}, status=status)


# ── Cash and bank ─────────────────────────────────────────────────────────────

class CashAccountListView(FinanceView):
    """The accounts the school holds money in."""

    def get(self, request):
        accounts = CashAccount.objects.all()
        if request.query_params.get('active') != 'all':
            accounts = accounts.filter(is_active=True)
        rows = [{**CashAccountSerializer(a).data,
                 'balance': str(services.account_balance(a))}
                for a in accounts]

        if documents.wants(request, 'csv'):
            return documents.csv_response(
                'cash-accounts',
                ['Account', 'Kind', 'Reference', 'Opening', 'Balance'],
                ([r['name'], r['kind'], r['reference'], r['opening_balance'],
                  r['balance']] for r in rows))
        return Response(rows)

    def post(self, request):
        if request.user.role != 'bursar':
            return _fail('Only the finance office opens an account.', 403)
        serializer = CashAccountSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        account = serializer.save()
        return Response(CashAccountSerializer(account).data, status=201)


class CashAccountDetailView(BursarView):
    def patch(self, request, pk):
        account = get_object_or_404(CashAccount, pk=pk)
        serializer = CashAccountSerializer(account, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(CashAccountSerializer(account).data)


class CashPositionView(FinanceView):
    """
    Where the money is, right now, plus how it got there.

    The answer to the question the dashboard could not answer: it said 767,500
    collected without saying where any of it is.
    """

    def get(self, request):
        position = services.cash_position()
        movements = (CashMovement.objects
                     .select_related('account', 'payment', 'expense')
                     .order_by('-occurred_on', '-created_at'))

        account_id = request.query_params.get('account')
        if account_id:
            movements = movements.filter(account_id=account_id)
        date_from = (request.query_params.get('from') or '').strip()
        date_to = (request.query_params.get('to') or '').strip()
        if date_from:
            movements = movements.filter(occurred_on__gte=date_from)
        if date_to:
            movements = movements.filter(occurred_on__lte=date_to)
        kind = (request.query_params.get('kind') or '').strip()
        if kind:
            movements = movements.filter(kind=kind)

        if documents.wants(request, 'csv'):
            return documents.csv_response(
                'cash-movements',
                ['Date', 'Account', 'Reason', 'Description', 'Amount'],
                ([m.occurred_on, m.account.name, m.get_kind_display(),
                  m.description, m.amount] for m in movements))
        if documents.wants(request, 'pdf'):
            return finance_documents.cash_position_pdf(position, movements[:60])

        return Response({
            'accounts': [{**CashAccountSerializer(r['account']).data,
                          'balance': str(r['balance'])}
                         for r in position['accounts']],
            'total': str(position['total']),
            'movements': CashMovementSerializer(movements[:200], many=True).data,
        })


class CashTransferView(BursarView):
    """Bank the week's takings, or move a float between tills."""

    def post(self, request):
        source = get_object_or_404(CashAccount, pk=request.data.get('from_account'))
        target = get_object_or_404(CashAccount, pk=request.data.get('to_account'))
        try:
            amount = _amount(request.data.get('amount'))
        except ValueError as exc:
            return _fail(str(exc))
        try:
            out, into = services.transfer(
                source, target, amount,
                description=request.data.get('description', ''),
                occurred_on=request.data.get('occurred_on') or None,
                recorded_by=request.user)
        except services.FinanceError as exc:
            return _fail(str(exc))
        return Response(CashMovementSerializer([out, into], many=True).data, status=201)


class CashAdjustmentView(BursarView):
    """
    A deliberate correction, with a reason attached.

    Separate from a reconciliation on purpose: counting is one act, deciding to
    change the books is another, and a system that does both in one step lets
    a shortfall be papered over without anybody choosing to.
    """

    def post(self, request):
        account = get_object_or_404(CashAccount, pk=request.data.get('account'))
        try:
            amount = _amount(request.data.get('amount'))
        except ValueError as exc:
            return _fail(str(exc))
        reason = (request.data.get('description') or '').strip()
        if not reason:
            return _fail('Say why the balance is being corrected.')
        movement = services.post_movement(
            account, request.data.get('kind') or 'adjustment', amount,
            description=reason,
            occurred_on=request.data.get('occurred_on') or None,
            recorded_by=request.user)
        return Response(CashMovementSerializer(movement).data, status=201)


class ReconciliationListView(FinanceView):
    def get(self, request):
        rows = Reconciliation.objects.select_related('account', 'counted_by')
        account_id = request.query_params.get('account')
        if account_id:
            rows = rows.filter(account_id=account_id)
        if documents.wants(request, 'csv'):
            return documents.csv_response(
                'reconciliations',
                ['Date', 'Account', 'Books', 'Counted', 'Difference', 'Note'],
                ([r.counted_on, r.account.name, r.book_balance, r.counted_balance,
                  r.difference, r.note] for r in rows))
        return Response(ReconciliationSerializer(rows[:200], many=True).data)

    def post(self, request):
        if request.user.role != 'bursar':
            return _fail('Only the finance office records a count.', 403)
        account = get_object_or_404(CashAccount, pk=request.data.get('account'))
        try:
            counted = _amount(request.data.get('counted_balance'), 'balance')
        except ValueError as exc:
            return _fail(str(exc))
        row = services.reconcile(account, counted, counted_by=request.user,
                                 counted_on=request.data.get('counted_on') or None,
                                 note=request.data.get('note', ''))
        return Response(ReconciliationSerializer(row).data, status=201)


# ── Income that is not school fees ────────────────────────────────────────────

class IncomeCategoryListView(FinanceView):
    def get(self, request):
        return Response(IncomeCategorySerializer(
            IncomeCategory.objects.filter(is_active=True), many=True).data)

    def post(self, request):
        if request.user.role != 'bursar':
            return _fail('Only the finance office adds a category.', 403)
        serializer = IncomeCategorySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=201)


class OtherIncomeListView(FinanceView):
    def get(self, request):
        rows = OtherIncome.objects.select_related('category', 'account', 'received_by')
        term = _current_term(request)
        if term is not None and request.query_params.get('term') != 'all':
            rows = rows.filter(term=term)
        category = request.query_params.get('category')
        if category:
            rows = rows.filter(category_id=category)
        date_from = (request.query_params.get('from') or '').strip()
        date_to = (request.query_params.get('to') or '').strip()
        if date_from:
            rows = rows.filter(received_on__gte=date_from)
        if date_to:
            rows = rows.filter(received_on__lte=date_to)
        search = (request.query_params.get('q') or '').strip()
        if search:
            rows = rows.filter(Q(description__icontains=search)
                               | Q(reference__icontains=search))

        if documents.wants(request, 'csv'):
            return documents.csv_response(
                'other-income',
                ['Date', 'Category', 'Description', 'Method', 'Reference',
                 'Account', 'Amount'],
                ([r.received_on, r.category.name, r.description,
                  r.get_method_display(), r.reference,
                  r.account.name if r.account else '', r.amount] for r in rows))

        total = rows.aggregate(total=Sum('amount'))['total'] or ZERO
        return Response({
            'total': str(total),
            'results': OtherIncomeSerializer(rows[:300], many=True).data,
        })

    def post(self, request):
        if request.user.role != 'bursar':
            return _fail('Only the finance office takes income.', 403)
        category = get_object_or_404(IncomeCategory, pk=request.data.get('category'))
        try:
            amount = _amount(request.data.get('amount'))
        except ValueError as exc:
            return _fail(str(exc))
        account = None
        if request.data.get('account'):
            account = get_object_or_404(CashAccount, pk=request.data['account'])
        try:
            entry = services.record_income(
                category, amount,
                description=request.data.get('description', ''),
                method=request.data.get('method', 'cash'),
                reference=request.data.get('reference', ''),
                received_on=request.data.get('received_on') or None,
                account=account, received_by=request.user)
        except services.FinanceError as exc:
            return _fail(str(exc))
        return Response(OtherIncomeSerializer(entry).data, status=201)


# ── Arrears ───────────────────────────────────────────────────────────────────

class ArrearsView(FinanceView):
    """
    What families still owe from terms that have already finished.

    Before this, an unpaid balance simply stopped being counted when the term
    turned over: every screen measures the current term, so last term's debt
    vanished from the system while remaining owed in real life.
    """

    def get(self, request):
        from apps.student.models import Student
        from .views import class_label_of, student_filters

        term = _current_term(request)
        roster = student_filters(Student.objects.select_related('user'), request, prefix='')

        rows = []
        for student in roster:
            owed = services.arrears_for(student, before_term=term)
            if owed > ZERO:
                rows.append({
                    'student': {
                        'id': str(student.id), 'name': student.full_name,
                        'student_id': student.student_id,
                        'class_label': f'{student.grade}{student.section}',
                    },
                    'arrears': owed,
                })
        rows.sort(key=lambda r: r['arrears'], reverse=True)

        if documents.wants(request, 'csv'):
            return documents.csv_response(
                f'arrears-{class_label_of(request)}',
                ['Student', 'Class', 'Student ID', 'Brought forward'],
                ([r['student']['name'], r['student']['class_label'],
                  r['student']['student_id'], r['arrears']] for r in rows))

        return Response({
            'total': str(sum((r['arrears'] for r in rows), ZERO)),
            'results': [{**r, 'arrears': str(r['arrears'])} for r in rows],
        })

    def post(self, request):
        """Raise the brought-forward charges. Safe to run twice."""
        if request.user.role != 'bursar':
            return _fail('Only the finance office carries balances forward.', 403)
        term = _current_term(request)
        if term is None:
            return _fail('There is no current term to carry balances into.')
        try:
            result = services.carry_arrears_forward(
                term, due_date=request.data.get('due_date') or None)
        except services.FinanceError as exc:
            return _fail(str(exc))
        return Response(result)


# ── Budget ────────────────────────────────────────────────────────────────────

class BudgetListView(FinanceView):
    def get(self, request):
        budgets = Budget.objects.select_related('term').prefetch_related('lines__category')
        term = _current_term(request)
        if term is not None and request.query_params.get('term') != 'all':
            budgets = budgets.filter(term=term)
        return Response(BudgetSerializer(budgets, many=True).data)

    def post(self, request):
        if request.user.role != 'bursar':
            return _fail('Only the finance office sets a budget.', 403)
        term = _current_term(request)
        if term is None:
            return _fail('Set the current term before building a budget.')
        serializer = BudgetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        budget = serializer.save(term=term)
        return Response(BudgetSerializer(budget).data, status=201)


class BudgetDetailView(FinanceView):
    def get(self, request, pk):
        budget = get_object_or_404(Budget, pk=pk)
        report = services.budget_report(budget)
        if documents.wants(request, 'csv'):
            return documents.csv_response(
                f'budget-{budget.name}',
                ['Category', 'Planned', 'Actual', 'Variance', 'Used %'],
                ([line['category'].name if line['category'] else '',
                  line['planned'], line['actual'], line['variance'],
                  f"{line['used_percent']:.0f}" if line['used_percent'] else '']
                 for line in report['lines']))
        if documents.wants(request, 'pdf'):
            return finance_documents.budget_pdf(report)

        return Response({
            'budget': BudgetSerializer(budget).data,
            'lines': [{
                'category': line['category'].name if line['category'] else '',
                'category_id': str(line['category'].id) if line['category'] else None,
                'planned': str(line['planned']),
                'actual': str(line['actual']),
                'variance': str(line['variance']),
                'used_percent': line['used_percent'],
                'over': line['over'],
                'unbudgeted': line.get('unbudgeted', False),
            } for line in report['lines']],
            'planned_total': str(report['planned_total']),
            'actual_total': str(report['actual_total']),
            'variance_total': str(report['variance_total']),
        })

    def patch(self, request, pk):
        if request.user.role != 'bursar':
            return _fail('Only the finance office edits a budget.', 403)
        budget = get_object_or_404(Budget, pk=pk)
        if 'status' in request.data and request.data['status'] == 'approved':
            budget.approved_by = request.user
            budget.approved_at = timezone.now()
        serializer = BudgetSerializer(budget, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save(approved_by=budget.approved_by, approved_at=budget.approved_at)
        return Response(BudgetSerializer(budget).data)

    def delete(self, request, pk):
        if request.user.role != 'bursar':
            return _fail('Only the finance office deletes a budget.', 403)
        get_object_or_404(Budget, pk=pk).delete()
        return Response(status=204)


class BudgetLineView(BursarView):
    """Set or clear one category's planned figure."""

    def post(self, request, pk):
        budget = get_object_or_404(Budget, pk=pk)
        category = get_object_or_404(ExpenseCategory, pk=request.data.get('category'))
        try:
            planned = _amount(request.data.get('planned'), 'figure')
        except ValueError as exc:
            return _fail(str(exc))
        # update_or_create, so setting a category twice corrects it rather than
        # tripping the unique constraint with a 500.
        line, _ = BudgetLine.objects.update_or_create(
            budget=budget, category=category,
            defaults={'planned': planned, 'note': request.data.get('note', '')})
        return Response(BudgetLineSerializer(line).data, status=201)

    def delete(self, request, pk):
        line = get_object_or_404(BudgetLine, pk=request.data.get('line'), budget_id=pk)
        line.delete()
        return Response(status=204)


# ── Payroll ───────────────────────────────────────────────────────────────────

class StaffSalaryListView(FinanceView):
    """What each member of staff is paid, standing."""

    def get(self, request):
        rows = StaffSalary.objects.select_related('staff')
        search = (request.query_params.get('q') or '').strip()
        if search:
            rows = rows.filter(Q(staff__first_name__icontains=search)
                               | Q(staff__last_name__icontains=search))
        role = (request.query_params.get('role') or '').strip()
        if role:
            rows = rows.filter(staff__role=role)

        if documents.wants(request, 'csv'):
            return documents.csv_response(
                'staff-salaries',
                ['Staff', 'Role', 'Gross', 'Allowances', 'Pension %', 'Tax %',
                 'Other deduction', 'Net (estimate)', 'Bank'],
                ([f'{r.staff.first_name} {r.staff.last_name}'.strip(), r.staff.role,
                  r.gross, r.allowances, r.pension_percent, r.tax_percent,
                  r.other_deduction, r.net_estimate, r.bank_account] for r in rows))
        return Response(StaffSalarySerializer(rows, many=True).data)

    def post(self, request):
        """Set or update one person's salary."""
        if request.user.role != 'bursar':
            return _fail('Only the finance office sets a salary.', 403)
        staff = get_object_or_404(User, pk=request.data.get('staff'))
        if staff.role not in services.PAYROLL_ROLES:
            return _fail('Payroll covers staff, not students or parents.')
        salary, _ = StaffSalary.objects.get_or_create(staff=staff)
        serializer = StaffSalarySerializer(salary, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(StaffSalarySerializer(salary).data, status=201)


class PayrollRunListView(FinanceView):
    def get(self, request):
        runs = PayrollRun.objects.prefetch_related('payslips')
        year = request.query_params.get('year')
        if year:
            runs = runs.filter(period_year=year)
        return Response(PayrollRunSerializer(runs, many=True).data)

    def post(self, request):
        """Open a run for a month and fill it from the salary list."""
        if request.user.role != 'bursar':
            return _fail('Only the finance office prepares payroll.', 403)
        today = timezone.localdate()
        try:
            month = int(request.data.get('period_month') or today.month)
            year = int(request.data.get('period_year') or today.year)
        except (TypeError, ValueError):
            return _fail('That month is not a date.')
        if not 1 <= month <= 12:
            return _fail('That month is not a month.')
        if PayrollRun.objects.filter(period_year=year, period_month=month).exclude(
                status='cancelled').exists():
            return _fail('There is already a payroll run for that month.')

        run = PayrollRun.objects.create(period_month=month, period_year=year,
                                        prepared_by=request.user,
                                        note=request.data.get('note', ''))
        made = services.build_payroll(run)
        return Response({**PayrollRunSerializer(run).data, 'payslips_made': made},
                        status=201)


class PayrollRunDetailView(FinanceView):
    def get(self, request, pk):
        run = get_object_or_404(PayrollRun, pk=pk)
        payslips = list(run.payslips.all())
        totals = services.payroll_totals(run)

        if documents.wants(request, 'csv'):
            return documents.csv_response(
                f'payroll-{run.period_year}-{run.period_month:02d}',
                ['Staff', 'Role', 'Gross', 'Allowances', 'Pension', 'Tax',
                 'Other', 'Net', 'Bank'],
                ([p.staff_name, p.role, p.gross, p.allowances, p.pension, p.tax,
                  p.other_deduction, p.net, p.bank_account] for p in payslips))
        if documents.wants(request, 'pdf'):
            return finance_documents.payroll_register_pdf(run, payslips, totals)

        return Response({
            'run': PayrollRunSerializer(run).data,
            'payslips': PayslipSerializer(payslips, many=True).data,
            'totals': {k: str(v) for k, v in totals.items()},
        })

    def delete(self, request, pk):
        if request.user.role != 'bursar':
            return _fail('Only the finance office cancels a run.', 403)
        run = get_object_or_404(PayrollRun, pk=pk)
        if run.status == 'paid':
            return _fail('A paid run cannot be cancelled. Record a correction instead.')
        run.status = 'cancelled'
        run.save(update_fields=['status'])
        return Response(PayrollRunSerializer(run).data)


class PayrollActionView(BursarView):
    """rebuild / approve / pay — the three steps a run moves through."""

    def post(self, request, pk, action):
        run = get_object_or_404(PayrollRun, pk=pk)
        try:
            if action == 'rebuild':
                made = services.build_payroll(run)
                return Response({**PayrollRunSerializer(run).data,
                                 'payslips_made': made})
            if action == 'approve':
                services.approve_payroll(run, approved_by=request.user)
            elif action == 'pay':
                account = None
                if request.data.get('account'):
                    account = get_object_or_404(CashAccount, pk=request.data['account'])
                services.pay_payroll(run, account=account,
                                     paid_on=request.data.get('paid_on') or None,
                                     paid_by=request.user)
            else:
                return _fail('Unknown action.')
        except services.FinanceError as exc:
            return _fail(str(exc))
        return Response(PayrollRunSerializer(run).data)


class PayslipDocumentView(FinanceView):
    """One payslip, as the person's own document."""

    def get(self, request, pk):
        payslip = get_object_or_404(Payslip.objects.select_related('run'), pk=pk)
        return finance_documents.payslip_pdf(payslip)
