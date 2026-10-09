"""
The awaiting-deposit queue.

    GET  /imboni/finance/admissions/                  students held until their deposit is confirmed
    POST /imboni/finance/admissions/<student>/confirm/   make one active and place them in their class

Only meaningful for a school that has switched on "hold new students until the
deposit is confirmed"; for any other school the list is simply empty.
"""
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.permissions import IsBursarOrAdmin
from apps.student.admission import PENDING, confirm_enrolment
from apps.student.models import Student

from .balances import balances_for


class AdmissionsListView(APIView):
    permission_classes = [IsBursarOrAdmin]

    def get(self, request):
        students = list(
            Student.objects.filter(status=PENDING).select_related('user')
            .order_by('enrollment_date', 'user__last_name', 'user__first_name', 'id')
        )
        balances = balances_for([s.id for s in students])
        rows = []
        for s in students:
            b = balances[s.id]
            rows.append({
                'student_id': s.id,
                'student_code': s.student_id,
                'full_name': s.full_name,
                'grade': s.grade,
                'section': s.section,
                'enrollment_date': s.enrollment_date,
                'charged': float(b['charged']),
                'paid': float(b['paid']),
                'owed': float(b['owed']),
            })
        return Response({'count': len(rows), 'results': rows})


class AdmissionConfirmView(APIView):
    permission_classes = [IsBursarOrAdmin]

    def post(self, request, pk):
        student = Student.objects.select_related('user').filter(pk=pk).first()
        if student is None:
            return Response({'detail': 'Student not found.'}, status=status.HTTP_404_NOT_FOUND)
        if student.status != PENDING:
            # Confirming twice, or confirming a student who was never held, must
            # not quietly re-activate someone suspended or transferred.
            return Response({'detail': 'This student is not awaiting a deposit.'},
                            status=status.HTTP_409_CONFLICT)

        placement = confirm_enrolment(student)
        return Response({
            'student_id': student.id,
            'full_name': student.full_name,
            'status': student.status,
            **placement,
        })
