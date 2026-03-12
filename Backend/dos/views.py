from datetime import timedelta
from django.utils import timezone
from django.db.models import Avg, Q
from rest_framework.views import APIView
from rest_framework.response import Response

from authentication.models import User  # used for teaching_staff count
from authentication.permissions import IsDOS
from results.models import AcademicTerm, Result
from parents.models import Student

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
    StudentManagementStatsSerializer,
    DOSStudentSerializer,
    AddStudentSerializer,
    EnrollmentByGradeSerializer,
    StudentPerfDistributionSerializer,
    EnrollmentTrendSerializer,
    BulkAddStudentsSerializer,
    BulkCreateResultSerializer,
    CSVImportSerializer,
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
    permission_classes = [IsDOS]

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
    permission_classes = [IsDOS]

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
    permission_classes = [IsDOS]

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
    permission_classes = [IsDOS]

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
    permission_classes = [IsDOS]

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
    permission_classes = [IsDOS]

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
    permission_classes = [IsDOS]

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
    permission_classes = [IsDOS]

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
    permission_classes = [IsDOS]

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


# ---------------------------------------------------------------------------
# Student Management — Stat Cards
# ---------------------------------------------------------------------------

class StudentManagementStatsView(APIView):
    """
    GET /imboni/dos/students/stats/

    Powers the 4 stat cards:
        total_students         — all students regardless of status
        new_this_term          — enrolled since term start (+15 badge)
        active_students        — status='active'
        enrollment_pct         — active / total * 100 (96% enrollment badge)
        new_admissions         — enrolled this term (same as new_this_term)
        avg_performance        — school-wide avg final_score % (current term)
        avg_performance_change — vs previous term (+3% badge)
    """
    permission_classes = [IsDOS]

    def get(self, request):
        term      = _current_term()
        prev_term = _previous_term()

        total   = Student.objects.count()
        active  = Student.objects.filter(status='active').count()
        enrollment_pct = round(active / total * 100, 1) if total else 0

        new_this_term = (
            Student.objects.filter(enrollment_date__gte=term.start_date).count()
            if term else 0
        )

        avg_raw  = Result.objects.filter(term=term).aggregate(avg=Avg('final_score'))['avg'] if term else None
        avg_perf = round(float(avg_raw), 1) if avg_raw else 0

        prev_raw  = Result.objects.filter(term=prev_term).aggregate(avg=Avg('final_score'))['avg'] if prev_term else None
        prev_perf = float(prev_raw) if prev_raw else 0
        avg_change = round(avg_perf - prev_perf, 1)

        return Response(StudentManagementStatsSerializer({
            'total_students':         total,
            'new_this_term':          new_this_term,
            'active_students':        active,
            'enrollment_pct':         enrollment_pct,
            'new_admissions':         new_this_term,
            'avg_performance':        avg_perf,
            'avg_performance_change': avg_change,
        }).data)


# ---------------------------------------------------------------------------
# Student Management — Student List + Add Student
# ---------------------------------------------------------------------------

class StudentListCreateView(APIView):
    """
    GET  /imboni/dos/students/
    POST /imboni/dos/students/

    GET — Returns the student list.
    Optional query params:
        ?search=name, ID or class  — filter by name, student_code, grade/section
        ?grade=6                   — filter by grade (matches Grade 12/11/10 tabs)
        ?status=active|inactive

    POST — Create a new student account (Add Student button).
    Body: first_name, last_name, email, grade, section, enrollment_date, password
    """
    permission_classes = [IsDOS]

    def get(self, request):
        from attendance.models import AttendanceSummary

        term   = _current_term()
        search = request.query_params.get('search', '').strip()
        grade  = request.query_params.get('grade', '').strip()
        status = request.query_params.get('status', '').strip()

        students = Student.objects.select_related('user').order_by('grade', 'section', 'user__last_name')

        if grade:
            students = students.filter(grade=grade)
        if status:
            students = students.filter(status=status)
        if search:
            students = students.filter(
                Q(user__first_name__icontains=search) |
                Q(user__last_name__icontains=search)  |
                Q(student_id__icontains=search)       |
                Q(grade__icontains=search)
            )

        grade_label = {
            '1': 'Grade 1', '2': 'Grade 2', '3': 'Grade 3',
            '4': 'Grade 4', '5': 'Grade 5', '6': 'Grade 6',
        }

        data = []
        for s in students:
            name_parts = s.full_name.split()
            initials   = ''.join(p[0].upper() for p in name_parts[:2]) if name_parts else '?'

            avg_raw = Result.objects.filter(student=s, term=term).aggregate(avg=Avg('final_score'))['avg'] if term else None
            att_obj = AttendanceSummary.objects.filter(student=s, term=term).first() if term else None

            data.append({
                'student_id':      s.id,
                'student_code':    s.student_id,
                'full_name':       s.full_name,
                'initials':        initials,
                'grade':           s.grade,
                'grade_label':     grade_label.get(s.grade, f"Grade {s.grade}"),
                'section':         s.section,
                'avg_performance': round(float(avg_raw), 1) if avg_raw else None,
                'attendance_rate': round(float(att_obj.attendance_percentage), 1) if att_obj else None,
                'status':          s.status,
                'enrollment_date': s.enrollment_date,
            })

        return Response(DOSStudentSerializer(data, many=True).data)

    def post(self, request):
        from django.utils.crypto import get_random_string

        serializer = AddStudentSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=http_status.HTTP_400_BAD_REQUEST)

        d = serializer.validated_data
        if User.objects.filter(email=d['email']).exists():
            return Response(
                {'email': 'A user with this email already exists.'},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        user = User.objects.create_user(
            username   = d['email'],
            email      = d['email'],
            first_name = d['first_name'],
            last_name  = d['last_name'],
            role       = 'student',
            password   = d['password'],
        )

        # Generate unique student_id
        last = Student.objects.order_by('-created_at').first()
        next_num = 1
        if last and last.student_id.startswith('STU-'):
            try:
                next_num = int(last.student_id.split('-')[1]) + 1
            except ValueError:
                next_num = Student.objects.count() + 1
        student_code = f"STU-{next_num:03d}"

        student = Student.objects.create(
            user            = user,
            student_id      = student_code,
            grade           = d['grade'],
            section         = d['section'],
            enrollment_date = d['enrollment_date'],
            status          = 'active',
        )

        return Response(
            {'id': student.id, 'student_code': student.student_id, 'full_name': student.full_name},
            status=http_status.HTTP_201_CREATED,
        )


# ---------------------------------------------------------------------------
# Student Management — Enrollment by Grade
# ---------------------------------------------------------------------------

class StudentEnrollmentByGradeView(APIView):
    """
    GET /imboni/dos/students/enrollment-by-grade/

    Returns active student count per grade.
    Powers the Student Enrollment by Grade progress-bar section.

    Response: [ { grade, student_count, percentage }, ... ]
    """
    permission_classes = [IsDOS]

    def get(self, request):
        from django.db.models import Count

        total = Student.objects.filter(status='active').count()

        rows = (
            Student.objects
            .filter(status='active')
            .values('grade')
            .annotate(student_count=Count('id'))
            .order_by('-grade')   # Grade 6 first (highest)
        )

        grade_label = {
            '1': 'Grade 1', '2': 'Grade 2', '3': 'Grade 3',
            '4': 'Grade 4', '5': 'Grade 5', '6': 'Grade 6',
        }

        data = [
            {
                'grade':         grade_label.get(row['grade'], f"Grade {row['grade']}"),
                'student_count': row['student_count'],
                'percentage':    round(row['student_count'] / total * 100, 1) if total else 0,
            }
            for row in rows
        ]

        return Response(EnrollmentByGradeSerializer(data, many=True).data)


# ---------------------------------------------------------------------------
# Student Management — Performance Distribution
# ---------------------------------------------------------------------------

class StudentPerformanceDistributionView(APIView):
    """
    GET /imboni/dos/students/performance-distribution/

    Groups all students by their average final_score this term into 4 buckets.
    Powers the Performance Distribution donut chart.

        Excellent  — avg > 80%
        Good       — avg 70–80%
        Average    — avg 60–70%
        Below      — avg < 60%
    """
    permission_classes = [IsDOS]

    def get(self, request):
        term = _current_term()
        if not term:
            return Response([])

        student_avgs = (
            Result.objects
            .filter(term=term)
            .values('student_id')
            .annotate(avg=Avg('final_score'))
        )

        buckets = [
            {'label': 'Excellent', 'range_label': '>80%',    'min': 80,  'count': 0},
            {'label': 'Good',      'range_label': '70-80%',  'min': 70,  'count': 0},
            {'label': 'Average',   'range_label': '60-70%',  'min': 60,  'count': 0},
            {'label': 'Below',     'range_label': '<60%',    'min': 0,   'count': 0},
        ]

        for row in student_avgs:
            avg = float(row['avg'] or 0)
            if   avg > 80: buckets[0]['count'] += 1
            elif avg >= 70: buckets[1]['count'] += 1
            elif avg >= 60: buckets[2]['count'] += 1
            else:           buckets[3]['count'] += 1

        total = sum(b['count'] for b in buckets)
        data = [
            {
                'label':         b['label'],
                'range_label':   b['range_label'],
                'student_count': b['count'],
                'percentage':    round(b['count'] / total * 100, 1) if total else 0,
            }
            for b in buckets
        ]

        return Response(StudentPerfDistributionSerializer(data, many=True).data)


# ---------------------------------------------------------------------------
# Student Management — Enrollment Trends
# ---------------------------------------------------------------------------

class StudentEnrollmentTrendsView(APIView):
    """
    GET /imboni/dos/students/enrollment-trends/

    Returns student count grouped by enrollment year.
    Powers the Enrollment Trends line chart (2023: 1150 | 2024: 1200 | ...).
    """
    permission_classes = [IsDOS]

    def get(self, request):
        from django.db.models import Count
        from django.db.models.functions import ExtractYear

        rows = (
            Student.objects
            .annotate(year=ExtractYear('enrollment_date'))
            .values('year')
            .annotate(student_count=Count('id'))
            .order_by('year')
        )

        data = [
            {'year': row['year'], 'student_count': row['student_count']}
            for row in rows
        ]

        return Response(EnrollmentTrendSerializer(data, many=True).data)


# ---------------------------------------------------------------------------
# Student Management — Bulk Create
# ---------------------------------------------------------------------------

def _next_student_code():
    """Return the next available STU-XXX code (thread-safe via select_for_update)."""
    from parents.models import Student as _Student
    last = _Student.objects.order_by('-created_at').first()
    if last and last.student_id.startswith('STU-'):
        try:
            return int(last.student_id.split('-')[1]) + 1
        except ValueError:
            pass
    return _Student.objects.count() + 1


class BulkCreateStudentsView(APIView):
    """
    POST /imboni/dos/students/bulk-create/

    Create multiple students in one request — designed for term-start enrollment.

    Request body (JSON):
    {
        "default_password": "Imboni@2025",
        "students": [
            {
                "first_name": "Alice", "last_name": "Uwase",
                "email": "alice@school.rw", "grade": "6",
                "section": "A", "enrollment_date": "2025-01-10"
            },
            ...
        ]
    }

    Response:
    {
        "created": 45,
        "skipped": 3,   // duplicate emails
        "failed":  1,   // validation / unexpected errors
        "errors":  [{"row": 4, "email": "x@y.com", "error": "..."}]
    }
    """
    permission_classes = [IsDOS]

    def post(self, request):
        from django.db import transaction
        from parents.models import Student

        serializer = BulkAddStudentsSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=http_status.HTTP_400_BAD_REQUEST)

        d                = serializer.validated_data
        default_password = d['default_password']
        rows             = d['students']

        created = skipped = failed = 0
        errors  = []
        counter = _next_student_code()

        for idx, row in enumerate(rows, start=1):
            email = row['email']
            try:
                if User.objects.filter(email=email).exists():
                    skipped += 1
                    errors.append({'row': idx, 'email': email, 'error': 'Email already exists (skipped)'})
                    continue

                password = row.get('password') or default_password

                with transaction.atomic():
                    user = User.objects.create_user(
                        username   = email,
                        email      = email,
                        first_name = row['first_name'],
                        last_name  = row['last_name'],
                        role       = 'student',
                        password   = password,
                    )
                    Student.objects.create(
                        user            = user,
                        student_id      = f"STU-{counter:03d}",
                        grade           = row['grade'],
                        section         = row['section'],
                        enrollment_date = row['enrollment_date'],
                        status          = 'active',
                    )
                    counter += 1
                    created += 1

            except Exception as exc:
                failed += 1
                errors.append({'row': idx, 'email': email, 'error': str(exc)})

        result = {
            'created': created,
            'skipped': skipped,
            'failed':  failed,
            'errors':  errors,
        }
        status_code = (
            http_status.HTTP_201_CREATED if created > 0
            else http_status.HTTP_400_BAD_REQUEST
        )
        return Response(BulkCreateResultSerializer(result).data, status=status_code)


# ---------------------------------------------------------------------------
# Student Management — CSV Import
# ---------------------------------------------------------------------------

class ImportStudentsCSVView(APIView):
    """
    POST /imboni/dos/students/import-csv/   (multipart/form-data)

    Upload a CSV file to enroll students in bulk.
    Ideal for importing from an existing spreadsheet.

    Form fields:
        file             — CSV file (required)
        default_password — password for all students (default: Imboni@2025)
        enrollment_date  — fallback date if CSV has no enrollment_date column (YYYY-MM-DD)

    Expected CSV columns (header row required, order-independent):
        first_name, last_name, email, grade, section, enrollment_date (optional)

    Example CSV:
        first_name,last_name,email,grade,section,enrollment_date
        Alice,Uwase,alice@school.rw,6,A,2025-01-10
        Bob,Nkurunziza,bob@school.rw,5,B,2025-01-10

    Response: same as bulk-create (created / skipped / failed / errors)
    """
    permission_classes = [IsDOS]

    def post(self, request):
        import csv
        import io
        from django.db import transaction
        from parents.models import Student

        serializer = CSVImportSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=http_status.HTTP_400_BAD_REQUEST)

        d                = serializer.validated_data
        default_password = d['default_password']
        fallback_date    = d.get('enrollment_date')
        csv_file         = d['file']

        # Read and decode the file
        try:
            content = csv_file.read().decode('utf-8-sig')  # utf-8-sig strips Excel BOM
        except UnicodeDecodeError:
            return Response(
                {'file': 'File must be UTF-8 encoded. Save your Excel file as CSV UTF-8.'},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        reader = csv.DictReader(io.StringIO(content))

        # Normalise headers (strip whitespace, lowercase)
        if reader.fieldnames is None:
            return Response({'file': 'CSV file is empty.'}, status=http_status.HTTP_400_BAD_REQUEST)

        required_cols = {'first_name', 'last_name', 'email', 'grade', 'section'}
        actual_cols   = {h.strip().lower() for h in reader.fieldnames}
        missing       = required_cols - actual_cols
        if missing:
            return Response(
                {'file': f"Missing required columns: {', '.join(sorted(missing))}"},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        VALID_GRADES   = {'1', '2', '3', '4', '5', '6'}
        VALID_SECTIONS = {'A', 'B', 'C'}

        created = skipped = failed = 0
        errors  = []
        counter = _next_student_code()

        for idx, raw_row in enumerate(reader, start=2):  # row 1 is header
            # Normalise keys
            row = {k.strip().lower(): (v or '').strip() for k, v in raw_row.items()}

            email      = row.get('email', '').lower()
            first_name = row.get('first_name', '')
            last_name  = row.get('last_name', '')
            grade      = row.get('grade', '').strip()
            section    = row.get('section', '').upper().strip()
            date_str   = row.get('enrollment_date', '')

            # Basic validation
            if not email or '@' not in email:
                failed += 1
                errors.append({'row': idx, 'email': email or '(empty)', 'error': 'Invalid email'})
                continue
            if grade not in VALID_GRADES:
                failed += 1
                errors.append({'row': idx, 'email': email, 'error': f"Invalid grade '{grade}' (must be 1-6)"})
                continue
            if section not in VALID_SECTIONS:
                failed += 1
                errors.append({'row': idx, 'email': email, 'error': f"Invalid section '{section}' (must be A, B or C)"})
                continue

            # Resolve enrollment_date
            if date_str:
                from datetime import datetime
                try:
                    enroll_date = datetime.strptime(date_str, '%Y-%m-%d').date()
                except ValueError:
                    failed += 1
                    errors.append({'row': idx, 'email': email, 'error': f"Invalid enrollment_date '{date_str}' (use YYYY-MM-DD)"})
                    continue
            elif fallback_date:
                enroll_date = fallback_date
            else:
                from django.utils import timezone as _tz
                enroll_date = _tz.localdate()

            try:
                if User.objects.filter(email=email).exists():
                    skipped += 1
                    errors.append({'row': idx, 'email': email, 'error': 'Email already exists (skipped)'})
                    continue

                with transaction.atomic():
                    user = User.objects.create_user(
                        username   = email,
                        email      = email,
                        first_name = first_name,
                        last_name  = last_name,
                        role       = 'student',
                        password   = default_password,
                    )
                    Student.objects.create(
                        user            = user,
                        student_id      = f"STU-{counter:03d}",
                        grade           = grade,
                        section         = section,
                        enrollment_date = enroll_date,
                        status          = 'active',
                    )
                    counter += 1
                    created += 1

            except Exception as exc:
                failed += 1
                errors.append({'row': idx, 'email': email, 'error': str(exc)})

        result = {
            'created': created,
            'skipped': skipped,
            'failed':  failed,
            'errors':  errors,
        }
        status_code = (
            http_status.HTTP_201_CREATED if created > 0
            else http_status.HTTP_400_BAD_REQUEST
        )
        return Response(BulkCreateResultSerializer(result).data, status=status_code)
