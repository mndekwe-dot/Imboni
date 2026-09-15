"""
Setting up what the school charges: categories, fee lines, discounts, and
turning them into bills.

Reads are open to the finance office and the head (`FinanceView`); every write
belongs to the bursar alone.
"""
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework.response import Response

from apps.results.models import AcademicTerm
from apps.student.models import Fee, Student

from . import services
from .models import FeeCategory, FeeDiscount, FeeStructure, money
from .serializers import (
    FeeCategorySerializer, FeeDiscountSerializer, FeeStructureSerializer, student_brief,
)
from .views import FinanceView, _current_term, student_filters


def _fail(message, status=400):
    return Response({'detail': message}, status=status)


def _bursar_only(request):
    if request.user.role != 'bursar':
        return _fail('Only the finance office changes what the school charges.', 403)
    return None


def _truthy(value):
    return str(value).lower() in ('1', 'true', 'yes')


# ── Categories ────────────────────────────────────────────────────────────────

class FeeCategoryListView(FinanceView):
    def get(self, request):
        rows = FeeCategory.objects.all()
        if _truthy(request.query_params.get('active')):
            rows = rows.filter(is_active=True)
        return Response(FeeCategorySerializer(rows, many=True).data)

    def post(self, request):
        if (refused := _bursar_only(request)):
            return refused
        serializer = FeeCategorySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if FeeCategory.objects.filter(code=serializer.validated_data['code']).exists():
            return _fail('There is already a category with that name.')
        return Response(FeeCategorySerializer(serializer.save()).data, status=201)


class FeeCategoryDetailView(FinanceView):
    def patch(self, request, pk):
        if (refused := _bursar_only(request)):
            return refused
        category = get_object_or_404(FeeCategory, pk=pk)
        serializer = FeeCategorySerializer(category, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        return Response(FeeCategorySerializer(serializer.save()).data)

    def delete(self, request, pk):
        if (refused := _bursar_only(request)):
            return refused
        category = get_object_or_404(FeeCategory, pk=pk)
        if Fee.objects.filter(category=category.code).exists() or \
                FeeStructure.objects.filter(category=category.code).exists():
            # Charges carry the code; deleting it would leave them unnamed.
            category.is_active = False
            category.save(update_fields=['is_active'])
            return Response(FeeCategorySerializer(category).data)
        category.delete()
        return Response(status=204)


# ── Fee lines ─────────────────────────────────────────────────────────────────

class FeeStructureListView(FinanceView):
    def get(self, request):
        term = _current_term(request)
        rows = FeeStructure.objects.select_related('term').prefetch_related('students')
        if term is not None:
            rows = rows.filter(term=term)
        return Response(FeeStructureSerializer(rows, many=True).data)

    def post(self, request):
        if (refused := _bursar_only(request)):
            return refused
        data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
        if not data.get('term'):
            term = _current_term(request)
            if term is None:
                return _fail('There is no current term to bill for.')
            data['term'] = str(term.id)
        serializer = FeeStructureSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        return Response(FeeStructureSerializer(serializer.save()).data, status=201)


class FeeStructureDetailView(FinanceView):
    def get(self, request, pk):
        return Response(FeeStructureSerializer(get_object_or_404(FeeStructure, pk=pk)).data)

    def patch(self, request, pk):
        if (refused := _bursar_only(request)):
            return refused
        line = get_object_or_404(FeeStructure, pk=pk)
        serializer = FeeStructureSerializer(line, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        return Response(FeeStructureSerializer(serializer.save()).data)

    def delete(self, request, pk):
        if (refused := _bursar_only(request)):
            return refused
        line = get_object_or_404(FeeStructure, pk=pk)
        if line.charges.exists():
            # Its bills exist; deleting the line would hide where they came from.
            return _fail('Families have already been billed for this line. Switch it off instead.')
        line.delete()
        return Response(status=204)


class FeeStructurePreviewView(FinanceView):
    """Who a line would bill now, and how much each, before anything is raised."""

    def get(self, request, pk):
        line = get_object_or_404(FeeStructure, pk=pk)
        rows, skipped = services.plan_structure(line)
        return Response({
            'students': [{
                'student': student_brief(row['student']),
                'amount': str(row['amount']),
                'reasons': row['reasons'],
                'parts': [{'instalment': n, 'amount': str(a), 'due_date': d} for n, a, d in row['parts']],
            } for row in rows],
            'skipped': skipped,
            'total': str(sum((row['amount'] for row in rows), money(0))),
        })


class InvoiceView(FinanceView):
    """Raise the charges for one line. Safe to press twice."""

    def post(self, request, pk):
        if (refused := _bursar_only(request)):
            return refused
        line = get_object_or_404(FeeStructure, pk=pk)
        try:
            created = services.invoice_from_structure(line)
        except services.FinanceError as exc:
            return _fail(str(exc))
        return Response({
            'created': len(created),
            'students': len({fee.student_id for fee in created}),
            'structure': FeeStructureSerializer(line).data,
        }, status=201)


class InvoiceTermView(FinanceView):
    """Every active line of the term: a preview (`dry_run`), or the bills themselves."""

    def post(self, request):
        dry_run = _truthy(request.data.get('dry_run'))
        if not dry_run and (refused := _bursar_only(request)):
            return refused
        term = _current_term(request)
        if term is None:
            return _fail('There is no current term to bill for.')
        try:
            result = services.invoice_term(term, dry_run=dry_run)
        except services.FinanceError as exc:
            return _fail(str(exc))
        return Response({
            **result,
            'total': str(result['total']),
            'lines': [{**line, 'total': str(line['total'])} for line in result['lines']],
        }, status=200 if dry_run else 201)


class CopyStructuresView(FinanceView):
    """Start this term's fee lines from another term's."""

    def post(self, request):
        if (refused := _bursar_only(request)):
            return refused
        target = _current_term(request)
        source = AcademicTerm.objects.filter(pk=request.data.get('from_term')).first()
        if target is None or source is None:
            return _fail('Pick the term to copy from.')
        try:
            copied = services.copy_structures(source, target)
        except services.FinanceError as exc:
            return _fail(str(exc))
        return Response({'copied': copied}, status=201)


# ── Discounts ─────────────────────────────────────────────────────────────────

class FeeDiscountListView(FinanceView):
    def get(self, request):
        rows = FeeDiscount.objects.select_related('term').prefetch_related('students')
        return Response(FeeDiscountSerializer(rows, many=True).data)

    def post(self, request):
        if (refused := _bursar_only(request)):
            return refused
        serializer = FeeDiscountSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(FeeDiscountSerializer(serializer.save()).data, status=201)


class FeeDiscountDetailView(FinanceView):
    def patch(self, request, pk):
        if (refused := _bursar_only(request)):
            return refused
        discount = get_object_or_404(FeeDiscount, pk=pk)
        serializer = FeeDiscountSerializer(discount, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        return Response(FeeDiscountSerializer(serializer.save()).data)

    def delete(self, request, pk):
        if (refused := _bursar_only(request)):
            return refused
        # Charges already raised keep their discounted amounts and the reason
        # written on them; removing the discount only stops future ones.
        get_object_or_404(FeeDiscount, pk=pk).delete()
        return Response(status=204)


# ── Finding students ──────────────────────────────────────────────────────────

class FinanceStudentSearchView(FinanceView):
    """Any active student, by name, id or class - not only the ones who owe."""

    def get(self, request):
        rows = Student.objects.filter(status='active').select_related('user')
        rows = student_filters(rows, request, prefix='')
        if not (request.query_params.get('q') or request.query_params.get('grade')):
            return Response([])
        rows = rows.filter(~Q(user__isnull=True)).order_by('grade', 'section', 'user__last_name')[:40]
        return Response([student_brief(s) for s in rows])
