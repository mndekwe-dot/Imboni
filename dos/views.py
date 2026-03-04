from datetime import timedelta
from django.utils import timezone
from django.db.models import Avg, Q
from rest_framework.views import APIView
from rest_framework.response import Response

from authentication.models import User  # used for teaching_staff count
from results.models import AcademicTerm, Result
from students.models import Student

from rest_framework import status as http_status

from .serializers import (
    DOSDashboardStatsSerializer,
    DOSActivitySerializer,
    PerformanceOverviewSerializer,
    GradePerformanceSerializer,
    TeacherManagementStatsSerializer,
    TeacherListSerializer,
    AddTeacherSerializer,
    TeachersBySubjectSerializer,
    WorkloadBucketSerializer,
    PerformanceRatingSerializer,
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


# ---------------------------------------------------------------------------
# Teacher Management — Stat Cards
# ---------------------------------------------------------------------------

class TeacherManagementStatsView(APIView):
    """
    GET /imboni/dos/teachers/stats/

    Powers the 4 stat cards on the Teacher Management page:
        total_teachers        — all active teachers
        new_this_term         — teachers who joined this term
        full_time_count/pct   — employment_type='full_time'
        part_time_count/pct   — employment_type='part_time'
        student_teacher_ratio — total active students / total teachers (e.g. "1:15")
        ratio_label           — Optimal (<20), High (20-30), Critical (>30)
    """
    # permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        term = _current_term()

        teachers = User.objects.filter(role='teacher', is_active=True)
        total    = teachers.count()

        new_this_term = (
            teachers.filter(created_at__gte=term.start_date).count()
            if term else 0
        )

        full_time = teachers.filter(employment_type='full_time').count()
        part_time = teachers.filter(employment_type='part_time').count()

        full_time_pct = round(full_time / total * 100, 1) if total else 0
        part_time_pct = round(part_time / total * 100, 1) if total else 0

        # Student-Teacher ratio
        active_students = Student.objects.filter(status='active').count()
        ratio_num = round(active_students / total) if total else 0
        ratio_label = (
            'Optimal'  if ratio_num <= 20 else
            'High'     if ratio_num <= 30 else
            'Critical'
        )

        return Response(TeacherManagementStatsSerializer({
            'total_teachers':        total,
            'new_this_term':         new_this_term,
            'full_time_count':       full_time,
            'full_time_pct':         full_time_pct,
            'part_time_count':       part_time,
            'part_time_pct':         part_time_pct,
            'student_teacher_ratio': f"1:{ratio_num}",
            'ratio_label':           ratio_label,
        }).data)


# ---------------------------------------------------------------------------
# Teacher Management — Teacher List + Add Teacher
# ---------------------------------------------------------------------------

class TeacherListCreateView(APIView):
    """
    GET  /imboni/dos/teachers/
    POST /imboni/dos/teachers/

    GET — Returns the teacher list table.
    Optional query params:
        ?search=name or subject  — filter by name or subject taught
        ?employment_type=full_time|part_time
        ?subject_id=<uuid>       — filter by subject

    POST — Create a new teacher account (Add Teacher button).
    Body: first_name, last_name, email, phone_number, employment_type, password
    """
    # permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from teacher.models import SubjectTeacherAssignment

        term   = _current_term()
        search = request.query_params.get('search', '').strip()
        emp    = request.query_params.get('employment_type', '').strip()
        subj   = request.query_params.get('subject_id', '').strip()

        teachers = User.objects.filter(role='teacher', is_active=True).order_by('last_name', 'first_name')

        if emp:
            teachers = teachers.filter(employment_type=emp)
        if search:
            teachers = teachers.filter(
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search)  |
                Q(subjectteacherassignment__subject__name__icontains=search)
            ).distinct()
        if subj:
            teachers = teachers.filter(
                subjectteacherassignment__subject_id=subj
            ).distinct()

        data = []
        for t in teachers:
            assignments = (
                SubjectTeacherAssignment.objects
                .filter(teacher=t, term=term)
                .select_related('subject', 'class_obj')
            ) if term else []

            subjects    = list({a.subject.name for a in assignments})
            class_count = len({a.class_obj_id for a in assignments})

            data.append({
                'teacher_id':      t.id,
                'full_name':       t.get_full_name() or t.username,
                'email':           t.email,
                'phone_number':    t.phone_number,
                'avatar':          t.avatar.url if t.avatar else None,
                'employment_type': t.employment_type,
                'subjects':        subjects,
                'class_count':     class_count,
                'joined_at':       t.created_at,
            })

        return Response(TeacherListSerializer(data, many=True).data)

    def post(self, request):
        serializer = AddTeacherSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=http_status.HTTP_400_BAD_REQUEST)

        d = serializer.validated_data
        if User.objects.filter(email=d['email']).exists():
            return Response(
                {'email': 'A user with this email already exists.'},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        teacher = User.objects.create_user(
            username        = d['email'],
            email           = d['email'],
            first_name      = d['first_name'],
            last_name       = d['last_name'],
            phone_number    = d.get('phone_number', ''),
            employment_type = d.get('employment_type', 'full_time'),
            role            = 'teacher',
            password        = d['password'],
        )
        return Response(
            {'id': teacher.id, 'full_name': teacher.get_full_name(), 'email': teacher.email},
            status=http_status.HTTP_201_CREATED,
        )


# ---------------------------------------------------------------------------
# Teacher Management — Teachers by Subject
# ---------------------------------------------------------------------------

class TeachersBySubjectView(APIView):
    """
    GET /imboni/dos/teachers/by-subject/

    Returns teacher count per subject for the current term.
    Powers the Teachers by Subject progress-bar section.

    Response: [ { subject_id, subject_name, teacher_count, percentage }, ... ]
    percentage = subject teacher count / total teachers * 100
    """
    # permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from teacher.models import SubjectTeacherAssignment
        from django.db.models import Count

        term = _current_term()
        if not term:
            return Response([])

        rows = (
            SubjectTeacherAssignment.objects
            .filter(term=term)
            .values('subject__id', 'subject__name')
            .annotate(teacher_count=Count('teacher', distinct=True))
            .order_by('-teacher_count')
        )

        total = User.objects.filter(role='teacher', is_active=True).count()

        data = [
            {
                'subject_id':    row['subject__id'],
                'subject_name':  row['subject__name'],
                'teacher_count': row['teacher_count'],
                'percentage':    round(row['teacher_count'] / total * 100, 1) if total else 0,
            }
            for row in rows
        ]

        return Response(TeachersBySubjectSerializer(data, many=True).data)


# ---------------------------------------------------------------------------
# Teacher Management — Workload Distribution
# ---------------------------------------------------------------------------

class TeacherWorkloadDistributionView(APIView):
    """
    GET /imboni/dos/teachers/workload-distribution/

    Groups teachers by how many distinct classes they teach this term:
        1-2 classes  → light
        3-4 classes  → moderate
        5+ classes   → heavy

    Powers the Workload Distribution bar chart.
    """
    # permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from teacher.models import SubjectTeacherAssignment
        from django.db.models import Count

        term = _current_term()
        if not term:
            return Response([])

        teacher_class_counts = (
            SubjectTeacherAssignment.objects
            .filter(term=term)
            .values('teacher_id')
            .annotate(class_count=Count('class_obj', distinct=True))
        )

        buckets = {'1-2 classes': 0, '3-4 classes': 0, '5+ classes': 0}
        for row in teacher_class_counts:
            c = row['class_count']
            if c <= 2:
                buckets['1-2 classes'] += 1
            elif c <= 4:
                buckets['3-4 classes'] += 1
            else:
                buckets['5+ classes'] += 1

        data = [{'label': k, 'teacher_count': v} for k, v in buckets.items()]
        return Response(WorkloadBucketSerializer(data, many=True).data)


# ---------------------------------------------------------------------------
# Teacher Management — Performance Ratings
# ---------------------------------------------------------------------------

class TeacherPerformanceRatingsView(APIView):
    """
    GET /imboni/dos/teachers/performance-ratings/

    Rates each teacher by the average final_score of their students this term:
        Excellent         — avg >= 85%
        Good              — avg 70–84%
        Average           — avg 50–69%
        Needs Improvement — avg < 50%

    Powers the Performance Ratings chart.
    """
    # permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        term = _current_term()
        if not term:
            return Response([])

        teachers = User.objects.filter(role='teacher', is_active=True)
        buckets  = {'Excellent': 0, 'Good': 0, 'Average': 0, 'Needs Improvement': 0}
        total    = 0

        for t in teachers:
            avg_raw = (
                Result.objects
                .filter(teacher=t, term=term)
                .aggregate(avg=Avg('final_score'))['avg']
            )
            if avg_raw is None:
                continue
            avg   = float(avg_raw)
            total += 1
            if avg >= 85:
                buckets['Excellent'] += 1
            elif avg >= 70:
                buckets['Good'] += 1
            elif avg >= 50:
                buckets['Average'] += 1
            else:
                buckets['Needs Improvement'] += 1

        data = [
            {
                'label':         label,
                'teacher_count': count,
                'percentage':    round(count / total * 100, 1) if total else 0,
            }
            for label, count in buckets.items()
        ]
        return Response(PerformanceRatingSerializer(data, many=True).data)
