"""
The staff register API.

Not part of the finance plan: every school has departments and workers, and the
admin keeps the register whether or not the bursar runs payroll through Imboni.
The head teacher and the finance office both maintain it.
"""
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.permissions import IsBursarOrAdmin
from apps.common import documents

from .models import Department, StaffMember
from .serializers import DepartmentSerializer, StaffMemberSerializer


def _fail(message, status=400):
    return Response({'detail': message}, status=status)


class StaffView(APIView):
    permission_classes = [IsBursarOrAdmin]


class DepartmentListView(StaffView):
    def get(self, request):
        # Ordered explicitly: Django drops Meta.ordering from a GROUP BY query,
        # so the counted list came back in whatever order Postgres grouped it.
        rows = Department.objects.select_related('head').annotate(
            active_members=Count('members', filter=Q(members__is_active=True))
        ).order_by('sort_order', 'name')
        if (request.query_params.get('active') or '').lower() in ('1', 'true', 'yes'):
            rows = rows.filter(is_active=True)
        return Response(DepartmentSerializer(rows, many=True).data)

    def post(self, request):
        serializer = DepartmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if Department.objects.filter(code=serializer.validated_data['code']).exists():
            return _fail('There is already a department with that name.')
        return Response(DepartmentSerializer(serializer.save()).data, status=201)


class DepartmentDetailView(StaffView):
    def patch(self, request, pk):
        department = get_object_or_404(Department, pk=pk)
        serializer = DepartmentSerializer(department, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        return Response(DepartmentSerializer(serializer.save()).data)

    def delete(self, request, pk):
        department = get_object_or_404(Department, pk=pk)
        if department.members.exists():
            # Workers and past payslips name it; retire it instead of losing that.
            department.is_active = False
            department.save(update_fields=['is_active'])
            return Response(DepartmentSerializer(department).data)
        department.delete()
        return Response(status=204)


class StaffMemberListView(StaffView):
    """Every worker, with or without an Imboni login."""

    def get(self, request):
        rows = StaffMember.objects.select_related('department', 'user', 'salary')
        params = request.query_params

        search = (params.get('q') or '').strip()
        if search:
            rows = rows.filter(Q(first_name__icontains=search) | Q(last_name__icontains=search)
                               | Q(staff_no__icontains=search) | Q(job_title__icontains=search))
        department = (params.get('department') or '').strip()
        if department == 'none':
            rows = rows.filter(department__isnull=True)
        elif department:
            rows = rows.filter(department_id=department)
        status = params.get('status') or 'active'
        if status == 'active':
            rows = rows.filter(is_active=True)
        elif status == 'left':
            rows = rows.filter(is_active=False)
        account = params.get('account')
        if account == 'yes':
            rows = rows.filter(user__isnull=False)
        elif account == 'no':
            rows = rows.filter(user__isnull=True)

        if documents.wants(request, 'csv'):
            return documents.csv_response(
                'staff-register',
                ['Staff no', 'Name', 'Job title', 'Department', 'Employment', 'Phone', 'Email',
                 'National ID', 'Started', 'Left', 'Imboni account', 'Active'],
                ([m.staff_no, m.full_name, m.job_title, m.department.name if m.department_id else '',
                  m.get_employment_type_display(), m.phone, m.email, m.national_id,
                  m.start_date or '', m.end_date or '', m.user.role if m.user_id else '',
                  'yes' if m.is_active else 'no'] for m in rows))
        return Response(StaffMemberSerializer(rows, many=True).data)

    def post(self, request):
        serializer = StaffMemberSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(StaffMemberSerializer(serializer.save()).data, status=201)


class StaffMemberDetailView(StaffView):
    def get(self, request, pk):
        return Response(StaffMemberSerializer(get_object_or_404(StaffMember, pk=pk)).data)

    def patch(self, request, pk):
        member = get_object_or_404(StaffMember, pk=pk)
        serializer = StaffMemberSerializer(member, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        return Response(StaffMemberSerializer(serializer.save()).data)

    def delete(self, request, pk):
        member = get_object_or_404(StaffMember, pk=pk)
        if member.user_id:
            return _fail('This worker has an Imboni account. Mark them as left instead.')
        if member.payslips.exists():
            return _fail('This worker has been paid through payroll. Mark them as left instead.')
        member.delete()
        return Response(status=204)
