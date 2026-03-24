from rest_framework import generics
from rest_framework.views import APIView
from rest_framework.response import Response

from .models import BehaviorReport, ConductGrade
from .serializers import BehaviorReportSerializer


class StudentBehaviorStatsView(APIView):
    """
    Aggregated behaviour stats for the 4 stat cards at the top of the page.

    GET /imboni/behavior/students/<pk>/stats/

    Counts are scoped to the current academic term using its date range.
    Falls back to all-time counts if no current term is configured.

    Response:
        positive_reports  — count of positive report_type entries this term
        warnings          — count of warning report_type entries this term
        conduct_grade     — letter grade from ConductGrade (A / B / C / D / F)
        conduct_label     — human label, e.g. "Excellent"
        achievements      — count of achievement report_type entries this term
    """
    # permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        # Scope counts to the current term's date range
        from apps.results.models import AcademicTerm
        current_term = AcademicTerm.objects.filter(is_current=True).first()

        reports = BehaviorReport.objects.filter(student_id=pk)
        if current_term:
            reports = reports.filter(
                date__gte=current_term.start_date,
                date__lte=current_term.end_date,
            )

        positive_count   = reports.filter(report_type='positive').count()
        warning_count    = reports.filter(report_type='warning').count()
        achievement_count = reports.filter(report_type='achievement').count()

        # Conduct grade for current term
        conduct_grade = None
        conduct_label = 'No grade yet'
        if current_term:
            cg = ConductGrade.objects.filter(student_id=pk, term=current_term).first()
            if cg:
                conduct_grade = cg.grade
                grade_labels = {
                    'A': 'Excellent',
                    'B': 'Good',
                    'C': 'Satisfactory',
                    'D': 'Needs Improvement',
                    'F': 'Unsatisfactory',
                }
                conduct_label = grade_labels.get(cg.grade, '')

        return Response({
            'positive_reports': positive_count,
            'warnings': warning_count,
            'conduct_grade': conduct_grade,
            'conduct_label': conduct_label,
            'achievements': achievement_count,
        })


class StudentBehaviorReportsView(generics.ListAPIView):
    """
    All behaviour report cards for a student, newest first.

    GET /imboni/behavior/students/<pk>/reports/

    Optional query param:  ?type=positive|warning|incident|achievement
    """
    serializer_class = BehaviorReportSerializer
    # permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = (
            BehaviorReport.objects
            .filter(student_id=self.kwargs['pk'])
            .select_related('reported_by')
            .order_by('-date', '-created_at')
        )
        report_type = self.request.query_params.get('type')
        if report_type:
            qs = qs.filter(report_type=report_type)
        return qs
