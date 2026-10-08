"""One student, seen from the academic office and the discipline office at once.

A student whose marks fall is often the same student who has started missing
school or collecting demerits, but each office only sees its own half. This puts
the halves side by side, for the current term, for either office to open.

    GET /imboni/analytics/student/<pk>/360/
"""
from django.db.models import Avg, Count, Q, Sum
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.permissions import IsDOSOrAdminOrDiscipline

PASS_MARK = 50


class Student360View(APIView):
    permission_classes = [IsDOSOrAdminOrDiscipline]

    def get(self, request, pk):
        from apps.attendance.models import AttendanceRecord
        from apps.behavior.models import BehaviorReport, ConductGrade
        from apps.discipline.ladder import step_for
        from apps.discipline.models import ExeatPass
        from apps.results.models import AcademicTerm, Result
        from apps.student.models import Student

        try:
            student = Student.objects.select_related('user').get(pk=pk)
        except Student.DoesNotExist:
            return Response({'detail': 'Student not found.'}, status=404)

        term = AcademicTerm.objects.filter(is_current=True).first()

        # Academics: approved results only, as everywhere else they are quoted.
        results = Result.objects.filter(student=student, status='approved', term=term).select_related('subject') if term else Result.objects.none()
        scores = [{'subject': r.subject.name, 'score': float(r.final_score), 'grade': r.grade} for r in results]
        average = results.aggregate(a=Avg('final_score'))['a']

        # Attendance: excused days are neither held for nor against the student.
        attendance = {'rate': None, 'days_absent': 0, 'days_recorded': 0}
        if term:
            rows = AttendanceRecord.objects.filter(student=student, date__gte=term.start_date, date__lte=term.end_date)
            counted = rows.exclude(status='excused')
            total = counted.count()
            attended = counted.filter(status__in=['present', 'late']).count()
            attendance = {
                'rate': round(100 * attended / total, 1) if total else None,
                'days_absent': counted.filter(status='absent').count(),
                'days_recorded': total,
            }

        # Discipline: marks lost this term and where that sits on the ladder.
        reports = BehaviorReport.objects.filter(student=student, status='approved')
        if term:
            reports = reports.filter(date__gte=term.start_date)
        marks = reports.aggregate(m=Sum('marks_deducted'))['m'] or 0
        conduct = ConductGrade.objects.filter(student=student, term=term).values_list('grade', flat=True).first() if term else None

        active_exeat = (
            ExeatPass.objects.filter(student=student, status__in=['approved', 'out']).order_by('departure_at').first()
        )

        return Response({
            'id': str(student.id),
            'student_id': student.student_id,
            'name': student.user.get_full_name(),
            'class_name': f"{student.grade}{student.section}",
            'term': term.name if term else None,
            'academics': {
                'average': round(float(average), 1) if average is not None else None,
                'subjects_failing': sum(1 for s in scores if s['score'] < PASS_MARK),
                'subjects': scores,
            },
            'attendance': attendance,
            'discipline': {
                'marks_deducted': marks,
                'ladder_step': step_for(marks),
                'conduct_grade': conduct,
                'recent': [
                    {'title': r.title, 'type': r.report_type, 'date': str(r.date)}
                    for r in reports.order_by('-date')[:3]
                ],
            },
            'exeat': (
                {'status': active_exeat.status, 'expected_return_at': active_exeat.expected_return_at}
                if active_exeat else None
            ),
        })
