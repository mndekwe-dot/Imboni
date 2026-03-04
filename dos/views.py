from datetime import timedelta
from django.utils import timezone
from django.db.models import Avg, Q
from rest_framework.views import APIView
from rest_framework.response import Response

from authentication.models import User  # used for teaching_staff count
from results.models import AcademicTerm, Result
from students.models import Student

from .serializers import (
    DOSDashboardStatsSerializer,
    DOSActivitySerializer,
    PerformanceOverviewSerializer,
    GradePerformanceSerializer,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _current_term():
    return AcademicTerm.objects.filter(is_current=True).first()


def _previous_term():
    term = _current_term()
    if not term:
        return None
    return (
        AcademicTerm.objects
        .filter(
            Q(year__lt=term.year) |
            Q(year=term.year, term__lt=term.term)
        )
        .order_by('-year', '-term')
        .first()
    )


def _time_ago(dt):
    """Convert a datetime to a human-readable 'X ago' string."""
    if dt is None:
        return ''
    diff    = timezone.now() - dt
    seconds = int(diff.total_seconds())
    if seconds < 60:
        return f"{seconds} seconds ago"
    if seconds < 3600:
        return f"{seconds // 60} minutes ago"
    if seconds < 86400:
        return f"{seconds // 3600} hours ago"
    return f"{diff.days} days ago"


# ---------------------------------------------------------------------------
# Stat Cards
# ---------------------------------------------------------------------------

class DOSDashboardStatsView(APIView):
    """
    GET /imboni/dos/dashboard/stats/

    Powers the 4 stat cards:
        total_students         — active students
        new_students           — enrolled in the last 30 days
        teaching_staff         — total active teachers
        avg_performance        — school-wide avg final_score % (current term)
        avg_performance_change — vs previous term
        pending_approvals      — Results with status='submitted'
    """
    # permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        term      = _current_term()
        prev_term = _previous_term()
        month_ago = timezone.localtime().date() - timedelta(days=30)

        total_students = Student.objects.filter(status='active').count()
        new_students   = Student.objects.filter(enrollment_date__gte=month_ago).count()
        teaching_staff = User.objects.filter(role='teacher', is_active=True).count()

        avg_raw  = Result.objects.filter(term=term).aggregate(avg=Avg('final_score'))['avg'] if term else None
        avg_perf = round(float(avg_raw), 1) if avg_raw else 0

        prev_raw  = Result.objects.filter(term=prev_term).aggregate(avg=Avg('final_score'))['avg'] if prev_term else None
        prev_perf = float(prev_raw) if prev_raw else 0
        avg_change = round(avg_perf - prev_perf, 1)

        pending_approvals = Result.objects.filter(status='submitted').count()

        return Response(DOSDashboardStatsSerializer({
            'total_students':         total_students,
            'new_students':           new_students,
            'teaching_staff':         teaching_staff,
            'avg_performance':        avg_perf,
            'avg_performance_change': avg_change,
            'pending_approvals':      pending_approvals,
        }).data)


# ---------------------------------------------------------------------------
# Recent Activity
# ---------------------------------------------------------------------------

class DOSRecentActivityView(APIView):
    """
    GET /imboni/dos/dashboard/recent-activity/

    Unified feed of school-level events:
        - Results approved
        - New teachers added
        - Pending results summary item
    Max 10 items, newest first.
    """
    # permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        activities = []

        # Recently approved results
        for r in (
            Result.objects
            .filter(status='approved', approved_at__isnull=False)
            .select_related('student')
            .order_by('-approved_at')[:5]
        ):
            activities.append({
                'activity_type': 'approval',
                'description':   f"Grade {r.student.grade} Results Approved",
                'timestamp':     r.approved_at,
                'time_ago':      _time_ago(r.approved_at),
            })

        # Recently added teachers
        for t in User.objects.filter(role='teacher').order_by('-created_at')[:5]:
            activities.append({
                'activity_type': 'staff',
                'description':   f"New Teacher Added — {t.get_full_name() or t.username}",
                'timestamp':     t.created_at,
                'time_ago':      _time_ago(t.created_at),
            })

        # Pending results — single summary entry
        pending_count = Result.objects.filter(status='submitted').count()
        if pending_count > 0:
            activities.append({
                'activity_type': 'pending',
                'description':   f"{pending_count} Results Pending Review",
                'timestamp':     None,
                'time_ago':      '',
            })

        # Sort newest first; None timestamps go last
        activities.sort(
            key=lambda x: x['timestamp'] or timezone.datetime.min.replace(tzinfo=timezone.utc),
            reverse=True,
        )

        return Response(DOSActivitySerializer(activities[:10], many=True).data)


# ---------------------------------------------------------------------------
# Performance Overview
# ---------------------------------------------------------------------------

class DOSPerformanceOverviewView(APIView):
    """
    GET /imboni/dos/dashboard/performance-overview/

    Powers the Performance Overview progress bars:
        school_average  — avg final_score % (current term)
        attendance_rate — avg attendance_percentage (all AttendanceSummary records)
    """
    # permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from attendance.models import AttendanceSummary

        term = _current_term()

        avg_raw = Result.objects.filter(term=term).aggregate(avg=Avg('final_score'))['avg'] if term else None
        school_average = round(float(avg_raw), 1) if avg_raw else 0

        att_raw = AttendanceSummary.objects.aggregate(avg=Avg('attendance_percentage'))['avg']
        attendance_rate = round(float(att_raw), 1) if att_raw else 0

        return Response(PerformanceOverviewSerializer({
            'school_average':  school_average,
            'attendance_rate': attendance_rate,
        }).data)


# ---------------------------------------------------------------------------
# Performance by Grade
# ---------------------------------------------------------------------------

class DOSPerformanceByGradeView(APIView):
    """
    GET /imboni/dos/dashboard/performance-by-grade/

    Returns average final_score grouped by student grade (current term).
    Powers the Performance by Grade bar chart.

    Response: [ { grade: "Grade 1", avg_score: 72.5 }, ... ]
    """
    # permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        term = _current_term()

        rows = (
            Result.objects
            .filter(term=term)
            .values('student__grade')
            .annotate(avg=Avg('final_score'))
            .order_by('student__grade')
        ) if term else []

        grade_label = {
            '1': 'Grade 1', '2': 'Grade 2', '3': 'Grade 3',
            '4': 'Grade 4', '5': 'Grade 5', '6': 'Grade 6',
        }

        data = [
            {
                'grade':     grade_label.get(row['student__grade'], f"Grade {row['student__grade']}"),
                'avg_score': round(float(row['avg']), 1),
            }
            for row in rows
        ]

        return Response(GradePerformanceSerializer(data, many=True).data)
