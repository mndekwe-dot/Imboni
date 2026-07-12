from datetime import timedelta
from django.utils import timezone
from django.db.models import Avg, Q
from rest_framework.views import APIView
from rest_framework.response import Response

from apps.authentication.models import User  # used for teaching_staff count
from apps.authentication.permissions import IsDOS,IsDOSOrAdmin,IsTeacherOrDOS,IsDOSOrAdminOrDiscipline
from apps.results.models import AcademicTerm, Result
from apps.student.models import Student
from apps.tenants.limits import enforce_capacity, remaining_seats

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
    DOSResultSerializer,
    ExamScheduleSerializer,
    SchoolSectionSerializer,
    SchoolSettingSerializer,
    SubjectSerializer,
)
from .models import ExamSchedule, SchoolSection,SchoolSetting


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
    permission_classes = [IsDOSOrAdmin]

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
    permission_classes = [IsDOSOrAdmin]

    def get(self, request):
        limit  = min(int(request.query_params.get('limit', 10)), 50)
        offset = int(request.query_params.get('offset', 0))

        activities = []

        for r in (
            Result.objects
            .filter(status='approved', approved_at__isnull=False)
            .select_related('student')
            .order_by('-approved_at')
        ):
            activities.append({
                'activity_type': 'approval',
                'description':   f"Grade {r.student.grade} Results Approved",
                'timestamp':     r.approved_at,
                'time_ago':      _time_ago(r.approved_at),
            })

        for t in User.objects.filter(role='teacher').order_by('-created_at'):
            activities.append({
                'activity_type': 'staff',
                'description':   f"New Teacher Added — {t.get_full_name() or t.username}",
                'timestamp':     t.created_at,
                'time_ago':      _time_ago(t.created_at),
            })

        pending_count = Result.objects.filter(status='submitted').count()
        if pending_count > 0:
            activities.append({
                'activity_type': 'pending',
                'description':   f"{pending_count} Results Pending Review",
                'timestamp':     None,
                'time_ago':      '',
            })

        activities.sort(
            key=lambda x: x['timestamp'] or timezone.datetime.min.replace(tzinfo=timezone.UTC),
            reverse=True,
        )

        total = len(activities)
        page  = activities[offset: offset + limit]

        return Response({
            'total':    total,
            'offset':   offset,
            'limit':    limit,
            'has_more': (offset + limit) < total,
            'results':  DOSActivitySerializer(page, many=True).data,
        })


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
        from apps.attendance.models import AttendanceSummary

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
    permission_classes = [IsDOSOrAdmin]

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
    permission_classes = [IsDOSOrAdmin]

    def get(self, request):
        from apps.teacher.models import SubjectTeacherAssignment

        term   = _current_term()
        search = request.query_params.get('search', '').strip()
        emp    = request.query_params.get('employment_type', '').strip()
        subj   = request.query_params.get('subject_id', '').strip()
        class_id = request.query_params.get('class_id','').strip()

        teachers = User.objects.filter(role='teacher', is_active=True).order_by('last_name', 'first_name')

        if emp:
            teachers = teachers.filter(employment_type=emp)
        if search:
            teachers = teachers.filter(
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search)  |
                Q(teaching_assignments__subject__name__icontains=search)
            ).distinct()
        if subj:
            teachers = teachers.filter(
                teaching_assignments__subject_id=subj
            ).distinct()
        if class_id:
            teachers = teachers.filter(
                teaching_assignments__class_obj_id=class_id
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

        enforce_capacity('staff')  # plan gating — raises 402 if the staff seats are full

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
        from apps.teacher.models import SubjectTeacherAssignment
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
        from apps.teacher.models import SubjectTeacherAssignment
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
    permission_classes = [IsDOSOrAdmin]

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
    permission_classes = [IsDOSOrAdmin]

    def get(self, request):
        from apps.attendance.models import AttendanceSummary

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
            att_obj = AttendanceSummary.objects.filter(student=s, year=term.start_date.year).order_by('-month').first() if term else None

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

        enforce_capacity('students')  # plan gating — raises 402 if the roster is full

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
    from apps.student.models import Student as _Student
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
        from apps.student.models import Student

        serializer = BulkAddStudentsSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=http_status.HTTP_400_BAD_REQUEST)

        d                = serializer.validated_data
        default_password = d['default_password']
        rows             = d['students']

        created = skipped = failed = 0
        errors  = []
        counter = _next_student_code()
        slots   = remaining_seats('students')  # None => unlimited; else seats left

        for idx, row in enumerate(rows, start=1):
            email = row['email']
            try:
                if User.objects.filter(email=email).exists():
                    skipped += 1
                    errors.append({'row': idx, 'email': email, 'error': 'Email already exists (skipped)'})
                    continue

                if slots is not None and slots <= 0:
                    failed += 1
                    errors.append({'row': idx, 'email': email,
                                   'error': 'Plan limit reached — upgrade your plan to add more students.'})
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
                    if slots is not None:
                        slots -= 1

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
        from apps.student.models import Student

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
        slots   = remaining_seats('students')  # None => unlimited; else seats left

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

                if slots is not None and slots <= 0:
                    failed += 1
                    errors.append({'row': idx, 'email': email,
                                   'error': 'Plan limit reached — upgrade your plan to add more students.'})
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
                    if slots is not None:
                        slots -= 1

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
# Results Approval
# ---------------------------------------------------------------------------

class DOSResultsListView(APIView):
    """GET /imboni/dos/results/ -- list results with optional filters."""
    permission_classes = [IsDOSOrAdmin]

    def get(self, request):
        from apps.results.models import Result
        qs = Result.objects.select_related(
            'student__user', 'subject', 'term', 'teacher'
        ).order_by('-submitted_at')

        status_filter  = request.query_params.get('status')
        grade_filter   = request.query_params.get('grade')
        subject_filter = request.query_params.get('subject_id')
        term_filter    = request.query_params.get('term_id')

        if status_filter:
            qs = qs.filter(status=status_filter)
        if grade_filter:
            qs = qs.filter(student__grade=grade_filter)
        if subject_filter:
            qs = qs.filter(subject_id=subject_filter)
        if term_filter:
            qs = qs.filter(term_id=term_filter)

        data = []
        for r in qs:
            s = r.student
            data.append({
                'id':               str(r.id),
                'student':          '%s %s' % (s.user.first_name, s.user.last_name),
                'student_id_code':  s.student_id,
                'grade':            s.grade,
                'section':          s.section,
                'subject':          r.subject.name,
                'term':             str(r.term),
                'class_test_marks': float(r.class_test_marks) if r.class_test_marks is not None else None,
                'exam_score':       float(r.exam_score),
                'final_score':      float(r.final_score),
                'grade_letter':     r.grade,
                'teacher_comment':  r.teacher_comment,
                'dos_comment':      r.dos_comment or '',
                'status':           r.status,
                'submitted_at':     r.submitted_at.isoformat() if r.submitted_at else None,
                'teacher':          ('%s %s' % (r.teacher.first_name, r.teacher.last_name)) if r.teacher else '',
            })
        return Response(DOSResultSerializer(data, many=True).data)


class DOSResultApproveView(APIView):
    """PATCH /imboni/dos/results/<pk>/approve/"""
    permission_classes = [IsDOSOrAdmin]

    def patch(self, request, pk):
        from apps.results.models import Result
        try:
            result = Result.objects.get(pk=pk)
        except Result.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=http_status.HTTP_404_NOT_FOUND)

        if result.status != 'submitted':
            return Response(
                {'detail': 'Cannot approve a result with status %s.' % result.status},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        from django.utils import timezone
        result.status      = 'approved'
        result.approved_by = request.user
        result.approved_at = timezone.now()
        result.dos_comment = request.data.get('dos_comment', result.dos_comment or '')
        result.save(update_fields=['status', 'approved_by', 'approved_at', 'dos_comment'])
        from apps.audit.services import audit
        audit(request.user, 'result.approved',
              target=f"{result.student.full_name} — {result.subject.name}",
              detail={'result_id': str(result.id)})
        return Response({'detail': 'Result approved.'})


class DOSResultRejectView(APIView):
    """PATCH /imboni/dos/results/<pk>/reject/"""
    permission_classes = [IsDOSOrAdmin]

    def patch(self, request, pk):
        from apps.results.models import Result
        try:
            result = Result.objects.get(pk=pk)
        except Result.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=http_status.HTTP_404_NOT_FOUND)

        if result.status != 'submitted':
            return Response(
                {'detail': 'Cannot reject a result with status %s.' % result.status},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        result.status           = 'rejected'
        result.rejection_reason = request.data.get('rejection_reason', '')
        result.dos_comment      = request.data.get('dos_comment', result.dos_comment or '')
        result.save(update_fields=['status', 'rejection_reason', 'dos_comment'])
        from apps.audit.services import audit
        audit(request.user, 'result.rejected',
              target=f"{result.student.full_name} — {result.subject.name}",
              detail={'result_id': str(result.id), 'reason': result.rejection_reason})
        return Response({'detail': 'Result rejected.'})


class DOSResultBulkApproveView(APIView):
    """POST /imboni/dos/results/bulk-approve/  body: {ids: [uuid, ...]}"""
    permission_classes = [IsDOSOrAdmin]

    def post(self, request):
        from apps.results.models import Result
        ids = request.data.get('ids', [])
        if not ids:
            return Response({'detail': 'No ids provided.'}, status=http_status.HTTP_400_BAD_REQUEST)
        updated = Result.objects.filter(id__in=ids, status='submitted').update(status='approved')
        from apps.audit.services import audit
        audit(request.user, 'result.bulk_approved', target=f"{updated} results",
              detail={'count': updated})
        return Response({'approved': updated})


# ---------------------------------------------------------------------------
# Exam Schedule
# ---------------------------------------------------------------------------

class ExamScheduleListView(APIView):
    """GET /imboni/dos/exam-schedule/  |  POST /imboni/dos/exam-schedule/"""

    def get(self, request):
        from .models import ExamSchedule
        term_id = request.query_params.get('term_id')
        qs = ExamSchedule.objects.select_related(
            'subject', 'class_obj', 'term', 'invigilator'
        ).order_by('exam_date', 'start_time')
        if term_id:
            qs = qs.filter(term_id=term_id)

        data = []
        for e in qs:
            data.append({
                'id':             str(e.id),
                'title':          e.title,
                'subject':        e.subject.name,
                'subject_id':     str(e.subject.id),
                'class_name':     (f"S{e.class_obj.grade}{e.class_obj.section}" if e.class_obj else None),
                'class_id':       str(e.class_obj.id) if e.class_obj else None,
                'term':           str(e.term),
                'exam_date':      str(e.exam_date),
                'start_time':     str(e.start_time),
                'end_time':       str(e.end_time),
                'venue':          e.venue,
                'exam_type':      e.exam_type,
                'invigilator':    (
                    '%s %s' % (e.invigilator.first_name, e.invigilator.last_name)
                    if e.invigilator else None
                ),
                'invigilator_id': str(e.invigilator.id) if e.invigilator else None,
                'notes':          e.notes,
            })
        return Response(ExamScheduleSerializer(data, many=True).data)

    def post(self, request):
        from .models import ExamSchedule
        from apps.results.models import Subject, AcademicTerm
        from apps.teacher.models import Class
        d = request.data
        try:
            subject = Subject.objects.get(id=d['subject_id'])
            term    = AcademicTerm.objects.get(id=d['term_id'])
        except (Subject.DoesNotExist, AcademicTerm.DoesNotExist, KeyError) as exc:
            return Response({'detail': str(exc)}, status=http_status.HTTP_400_BAD_REQUEST)

        class_obj   = Class.objects.filter(id=d.get('class_id')).first() if d.get('class_id') else None
        invigilator = User.objects.filter(id=d.get('invigilator_id')).first() if d.get('invigilator_id') else None

        exam = ExamSchedule.objects.create(
            title       = d.get('title', ''),
            subject     = subject,
            class_obj   = class_obj,
            term        = term,
            exam_date   = d['exam_date'],
            start_time  = d['start_time'],
            end_time    = d['end_time'],
            venue       = d.get('venue', ''),
            exam_type   = d.get('exam_type', 'midterm'),
            invigilator = invigilator,
            notes       = d.get('notes', ''),
        )
        return Response({'id': str(exam.id), 'detail': 'Exam schedule created.'}, status=http_status.HTTP_201_CREATED)


class ExamScheduleDetailView(APIView):
    """GET|PATCH|DELETE /imboni/dos/exam-schedule/<pk>/"""

    def _get_obj(self, pk):
        from .models import ExamSchedule
        try:
            return ExamSchedule.objects.select_related(
                'subject', 'class_obj', 'term', 'invigilator'
            ).get(pk=pk)
        except ExamSchedule.DoesNotExist:
            return None

    def get(self, request, pk):
        exam = self._get_obj(pk)
        if not exam:
            return Response({'detail': 'Not found.'}, status=http_status.HTTP_404_NOT_FOUND)
        data = {
            'id':          str(exam.id),
            'title':       exam.title,
            'subject':     exam.subject.name,
            'class_name':  (f"S{exam.class_obj.grade}{exam.class_obj.section}" if exam.class_obj else None),
            'term':        str(exam.term),
            'exam_date':   str(exam.exam_date),
            'start_time':  str(exam.start_time),
            'end_time':    str(exam.end_time),
            'venue':       exam.venue,
            'exam_type':   exam.exam_type,
            'invigilator': (
                '%s %s' % (exam.invigilator.first_name, exam.invigilator.last_name)
                if exam.invigilator else None
            ),
            'notes':       exam.notes,
        }
        return Response(ExamScheduleSerializer(data).data)

    def patch(self, request, pk):
        exam = self._get_obj(pk)
        if not exam:
            return Response({'detail': 'Not found.'}, status=http_status.HTTP_404_NOT_FOUND)
        d = request.data
        for field in ('title', 'exam_date', 'start_time', 'end_time', 'venue', 'exam_type', 'notes'):
            if field in d:
                setattr(exam, field, d[field])
        if 'subject_id' in d:
            from apps.results.models import Subject
            subj = Subject.objects.filter(id=d['subject_id']).first()
            if subj:
                exam.subject = subj
        if 'class_id' in d:
            setattr(exam, 'class_obj_id', d['class_id'] or None)
        if 'invigilator_id' in d:
            setattr(exam, 'invigilator_id', d['invigilator_id'] or None)
        exam.save()
        return Response({'detail': 'Updated.'})

    def delete(self, request, pk):
        exam = self._get_obj(pk)
        if not exam:
            return Response({'detail': 'Not found.'}, status=http_status.HTTP_404_NOT_FOUND)
        exam.delete()
        return Response(status=http_status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Class List
# ---------------------------------------------------------------------------

class DosClassListView(APIView):
    """
    GET /imboni/dos/classes/
    Returns all Class objects ordered by grade and section.
    Used to populate the class picker on the DOS attendance page.
    """
    permission_classes = [IsDOSOrAdmin]

    def get(self, request):
        from apps.teacher.models import Class
        classes = Class.objects.all().order_by('grade', 'section')
        return Response([
            {'id': str(c.id), 'grade': c.grade, 'section': c.section}
            for c in classes
        ])


# ---------------------------------------------------------------------------
# Attendance Overview
# ---------------------------------------------------------------------------

class DOSAttendanceOverviewView(APIView):
    """GET /imboni/dos/attendance/overview/"""

    def get(self, request):
        from apps.attendance.models import AttendanceRecord, TeacherAttendanceRecord
        from django.utils import timezone
        from datetime import timedelta

        term      = _current_term()
        today     = timezone.now().date()
        week_start = today - timedelta(days=today.weekday())  # Monday

        base = AttendanceRecord.objects
        if term and hasattr(term, 'start_date') and term.start_date:
            qs = base.filter(date__gte=term.start_date, date__lte=term.end_date)
        else:
            qs = base.filter(date__year=today.year)

        total   = qs.count()
        present = qs.filter(status='present').count()
        absent  = qs.filter(status='absent').count()
        late    = qs.filter(status='late').count()
        rate    = round(present / total * 100, 1) if total else 0.0

        absent_today   = base.filter(date=today, status='absent').count()
        late_this_week = base.filter(date__gte=week_start, date__lte=today, status='late').count()

        teacher_total   = TeacherAttendanceRecord.objects.filter(date=today).count()
        teacher_present = TeacherAttendanceRecord.objects.filter(date=today, status='present').count()
        teacher_rate    = round(teacher_present / teacher_total * 100, 1) if teacher_total else 0.0

        by_grade = []
        for grade in ['1', '2', '3', '4', '5', '6']:
            g_total = qs.filter(student__grade=grade).count()
            g_pres  = qs.filter(student__grade=grade, status='present').count()
            by_grade.append({
                'grade':           f'Grade {grade}',
                'attendance_rate': round(g_pres / g_total * 100, 1) if g_total else 0.0,
            })

        return Response({
            'term':             str(term) if term else None,
            'total_records':    total,
            'present':          present,
            'absent':           absent,
            'late':             late,
            'attendance_rate':  rate,
            'absent_today':     absent_today,
            'late_this_week':   late_this_week,
            'teacher_rate':     teacher_rate,
            'by_grade':         by_grade,
        })


# ---------------------------------------------------------------------------
# DOS Announcements
# ---------------------------------------------------------------------------

def _ann_dict(a):
    return {
        'id':               str(a.id),
        'title':            a.title,
        'content':          a.content,
        'category':         a.category,
        'target_audience':  a.target_audience,
        'target_grade':     a.target_grade,
        'status':           a.status,
        'author':           ('%s %s' % (a.author.first_name, a.author.last_name)) if a.author else '',
        'published_at':     a.published_at.isoformat() if a.published_at else None,
        'expires_at':       a.expires_at.isoformat()   if a.expires_at   else None,
        'created_at':       a.created_at.isoformat(),
        'updated_at':       a.updated_at.isoformat(),
        'attachment':       a.attachment.url if a.attachment else None,
    }


class DOSAnnouncementsView(APIView):
    """GET /imboni/dos/announcements/  |  POST /imboni/dos/announcements/"""

    def get(self, request):
        from apps.announcements.models import Announcement
        status_filter = request.query_params.get('status')
        limit  = min(int(request.query_params.get('limit', 50)), 100)
        offset = int(request.query_params.get('offset', 0))

        qs = Announcement.objects.select_related('author').order_by('-created_at')
        if status_filter:
            qs = qs.filter(status=status_filter)

        total   = qs.count()
        results = qs[offset: offset + limit]
        return Response({
            'total':    total,
            'offset':   offset,
            'limit':    limit,
            'has_more': (offset + limit) < total,
            'results':  [_ann_dict(a) for a in results],
        })

    def post(self, request):
        from apps.announcements.models import Announcement
        from django.utils import timezone as tz
        d      = request.data
        status = d.get('status', 'draft')
        ann = Announcement.objects.create(
            title            = d.get('title', ''),
            content          = d.get('content', ''),
            category         = d.get('category', 'general'),
            target_audience  = d.get('target_audience', 'all'),
            target_grade     = d.get('target_grade', ''),
            status           = status,
            published_at     = tz.now() if status == 'published' else None,
            author           = request.user if request.user.is_authenticated else None,
        )
        return Response(_ann_dict(ann), status=http_status.HTTP_201_CREATED)


class DOSAnnouncementDetailView(APIView):
    """GET | PATCH | DELETE /imboni/dos/announcements/<uuid:pk>/"""

    def _get(self, pk):
        from apps.announcements.models import Announcement
        try:
            return Announcement.objects.select_related('author').get(pk=pk)
        except Announcement.DoesNotExist:
            return None

    def get(self, request, pk):
        ann = self._get(pk)
        if not ann:
            return Response({'detail': 'Not found.'}, status=http_status.HTTP_404_NOT_FOUND)
        return Response(_ann_dict(ann))

    def patch(self, request, pk):
        from django.utils import timezone as tz
        ann = self._get(pk)
        if not ann:
            return Response({'detail': 'Not found.'}, status=http_status.HTTP_404_NOT_FOUND)
        d = request.data
        for field in ('title', 'content', 'category', 'target_audience', 'target_grade'):
            if field in d:
                setattr(ann, field, d[field])
        if 'status' in d:
            ann.status = d['status']
            if d['status'] == 'published' and not ann.published_at:
                ann.published_at = tz.now()
        ann.save()
        return Response(_ann_dict(ann))

    def delete(self, request, pk):
        ann = self._get(pk)
        if not ann:
            return Response({'detail': 'Not found.'}, status=http_status.HTTP_404_NOT_FOUND)
        ann.delete()
        return Response(status=http_status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Student Detail, Suspend, Change Class, Leadership
# ---------------------------------------------------------------------------

class StudentDetailView(APIView):
    """GET /imboni/dos/students/<uuid:pk>/"""
    permission_classes = [IsDOSOrAdmin]

    def get(self, request, pk):
        from apps.attendance.models import AttendanceSummary
        from apps.discipline.models import StudentLeader

        try:
            student = Student.objects.select_related('user').get(pk=pk)
        except Student.DoesNotExist:
            return Response({'error': 'Student not found.'}, status=404)

        term    = _current_term()
        avg_raw = Result.objects.filter(student=student, term=term).aggregate(avg=Avg('final_score'))['avg'] if term else None
        att_obj = AttendanceSummary.objects.filter(student=student, year=term.start_date.year).order_by('-month').first() if term else None

        leadership = [
            {
                'id':             str(sl.id),
                'role':           sl.role,
                'role_display':   sl.get_role_display(),
                'appointed_date': str(sl.appointed_date),
            }
            for sl in StudentLeader.objects.filter(student=student, term=term, is_active=True)
        ] if term else []

        return Response({
            'id':              str(student.id),
            'student_code':    student.student_id,
            'full_name':       student.full_name,
            'email':           student.user.email,
            'grade':           student.grade,
            'section':         student.section,
            'status':          student.status,
            'enrollment_date': str(student.enrollment_date),
            'avg_performance': round(float(avg_raw), 1) if avg_raw else None,
            'attendance_rate': round(float(att_obj.attendance_percentage), 1) if att_obj else None,
            'leadership':      leadership,
        })


class SuspendStudentView(APIView):
    """PATCH /imboni/dos/students/<uuid:pk>/suspend/"""
    permission_classes = [IsDOSOrAdmin]

    def patch(self, request, pk):
        try:
            student = Student.objects.get(pk=pk)
        except Student.DoesNotExist:
            return Response({'error': 'Student not found.'}, status=404)

        suspend = request.data.get('suspended', True)
        student.status = 'suspended' if suspend else 'active'
        student.save(update_fields=['status'])
        from apps.audit.services import audit
        audit(request.user,
              'student.suspended' if suspend else 'student.reinstated',
              target=f"{student.full_name} ({student.student_id})")
        return Response({'status': student.status})


class ChangeStudentClassView(APIView):
    """PATCH /imboni/dos/students/<uuid:pk>/change-class/"""
    permission_classes = [IsDOSOrAdmin]

    def patch(self, request, pk):
        from apps.teacher.models import Class, ClassAssignment

        try:
            student = Student.objects.get(pk=pk)
        except Student.DoesNotExist:
            return Response({'error': 'Student not found.'}, status=404)

        grade   = request.data.get('grade', '').strip()
        section = request.data.get('section', '').strip()
        if not grade or not section:
            return Response({'error': 'grade and section are required.'}, status=400)

        student.grade   = grade
        student.section = section
        student.save(update_fields=['grade', 'section'])

        roster_updated = False
        class_obj = Class.objects.filter(grade=grade, section=section).first()
        if class_obj:
            term = _current_term()
            if term:
                ClassAssignment.objects.filter(student=student, term=term).delete()
                ClassAssignment.objects.get_or_create(
                    class_obj=class_obj, student=student, term=term
                )
                roster_updated = True

        return Response({
            'grade':          student.grade,
            'section':        student.section,
            'roster_updated': roster_updated,
            'warning':        None if roster_updated else f'S{grade}{section} class record not found — student profile updated but not added to the class roster.',
        })


class AppointLeaderView(APIView):
    """POST /imboni/dos/students/<uuid:pk>/appoint-leader/"""
    permission_classes = [IsDOSOrAdmin]

    def post(self, request, pk):
        from apps.discipline.models import StudentLeader

        try:
            student = Student.objects.get(pk=pk)
        except Student.DoesNotExist:
            return Response({'error': 'Student not found.'}, status=404)

        role  = request.data.get('role', '').strip()
        notes = request.data.get('notes', '').strip()
        valid_roles = [r[0] for r in StudentLeader.ROLE_CHOICES]
        if role not in valid_roles:
            return Response({'error': f'Invalid role. Valid options: {", ".join(valid_roles)}'}, status=400)

        term = _current_term()
        if not term:
            return Response({'error': 'No active academic term found.'}, status=400)

        existing = (
            StudentLeader.objects
            .filter(role=role, term=term, is_active=True)
            .exclude(student=student)
            .select_related('student__user')
            .first()
        )
        if existing:
            return Response({
                'error': f'"{existing.get_role_display()}" is already held by {existing.student.full_name} this term.',
                'current_holder': existing.student.full_name,
            }, status=409)

        sl, created = StudentLeader.objects.get_or_create(
            student=student, role=role, term=term,
            defaults={'appointed_date': timezone.now().date(), 'is_active': True, 'notes': notes},
        )
        if not created:
            sl.is_active      = True
            sl.notes          = notes
            sl.appointed_date = timezone.now().date()
            sl.save()

        return Response({
            'id':             str(sl.id),
            'role':           sl.role,
            'role_display':   sl.get_role_display(),
            'appointed_date': str(sl.appointed_date),
        }, status=201 if created else 200)


class RemoveLeaderView(APIView):
    """DELETE /imboni/dos/students/<uuid:pk>/remove-leader/<str:role>/"""
    permission_classes = [IsDOSOrAdmin]

    def delete(self, request, pk, role):
        from apps.discipline.models import StudentLeader

        try:
            student = Student.objects.get(pk=pk)
        except Student.DoesNotExist:
            return Response({'error': 'Student not found.'}, status=404)

        term    = _current_term()
        updated = StudentLeader.objects.filter(student=student, role=role, term=term, is_active=True).update(is_active=False)
        if not updated:
            return Response({'error': 'Leadership role not found.'}, status=404)
        return Response(status=204)


# ---------------------------------------------------------------------------
# Student Leaders
# ---------------------------------------------------------------------------

class DOSStudentLeadersView(APIView):
    """GET /imboni/dos/student-leaders/"""

    def get(self, request):
        from apps.discipline.models import StudentLeader
        term = _current_term()
        qs = StudentLeader.objects.filter(
            term=term, is_active=True
        ).select_related('student__user') if term else StudentLeader.objects.none()

        data = [
            {
                'id':             str(sl.id),
                'student_id':     str(sl.student.id),
                'full_name':      '%s %s' % (sl.student.user.first_name, sl.student.user.last_name),
                'grade':          sl.student.grade,
                'section':        sl.student.section,
                'role':           sl.role,
                'appointed_date': str(sl.appointed_date),
                'notes':          sl.notes,
            }
            for sl in qs
        ]
        return Response(data)


# ---------------------------------------------------------------------------
# DOS Analytics
# ---------------------------------------------------------------------------

class DOSAnalyticsView(APIView):
    """GET /imboni/dos/analytics/?term_id=<uuid>"""

    def get(self, request):
        from apps.results.models import Result, AcademicTerm
        from apps.attendance.models import AttendanceRecord
        from django.db.models import Avg, Count, Q
        from django.db.models.functions import TruncMonth

        terms   = list(AcademicTerm.objects.order_by('-start_date')[:6])
        current = _current_term()

        term_id = request.query_params.get('term_id')
        if term_id:
            try:
                term = AcademicTerm.objects.get(pk=term_id)
            except AcademicTerm.DoesNotExist:
                term = current
        else:
            term = current

        # Performance trend (last 4 terms)
        perf_trend = []
        for t in reversed(terms[:4]):
            avg = Result.objects.filter(term=t, status='approved').aggregate(a=Avg('final_score'))['a']
            perf_trend.append({'term': str(t), 'avg_score': round(float(avg or 0), 1)})

        terms_list = [{'id': str(t.id), 'name': str(t)} for t in terms]

        if not term:
            return Response({
                'terms': terms_list, 'current_term_id': None,
                'performance_trend': perf_trend,
                'stats': {'overall_avg': 0, 'attendance_rate': 0, 'ratio': 'N/A', 'top_performers': 0},
                'subject_averages': [], 'grade_performance': [],
                'grade_distribution': [], 'pass_fail': [],
                'submissions': [], 'attendance_monthly': [],
            })

        # Subject averages for selected term
        subj_avgs = [
            {'subject': row['subject__name'], 'avg_score': round(float(row['avg'] or 0), 1)}
            for row in (
                Result.objects.filter(term=term, status='approved')
                .values('subject__name').annotate(avg=Avg('final_score')).order_by('subject__name')
            )
            if row['avg'] is not None and row['subject__name']
        ]

        # Grade performance
        grade_perf = [
            {'grade': f"S{row['student__grade']}", 'score': round(float(row['avg']), 1)}
            for row in (
                Result.objects.filter(term=term, status='approved')
                .values('student__grade').annotate(avg=Avg('final_score')).order_by('student__grade')
            )
            if row['avg'] is not None
        ]

        # Grade distribution bands
        BANDS = [
            ('A (80–100)', 80, 101, '#10b981'),
            ('B (70–79)',  70,  80, '#003d7a'),
            ('C (60–69)',  60,  70, '#3b82f6'),
            ('D (50–59)',  50,  60, '#f59e0b'),
            ('F (<50)',     0,  50, '#ef4444'),
        ]
        total_r = Result.objects.filter(term=term, status='approved', final_score__isnull=False).count()
        grade_dist = [
            {
                'name': name, 'color': color,
                'value': round(
                    Result.objects.filter(
                        term=term, status='approved',
                        final_score__gte=low, final_score__lt=high,
                    ).count() / total_r * 100
                ) if total_r else 0,
            }
            for name, low, high, color in BANDS
        ]

        # Pass/fail by grade year (pass threshold = 50)
        pass_fail = [
            {
                'class': f"S{row['student__grade']}",
                'pass':  round(row['passed'] / (row['total'] or 1) * 100),
                'fail':  100 - round(row['passed'] / (row['total'] or 1) * 100),
            }
            for row in (
                Result.objects.filter(term=term, status='approved', final_score__isnull=False)
                .values('student__grade')
                .annotate(total=Count('id'), passed=Count('id', filter=Q(final_score__gte=50)))
                .order_by('student__grade')
            )
        ]

        # Submissions by subject
        submissions = [
            {'subject': row['subject__name'], 'submitted': row['approved'], 'pending': row['pending']}
            for row in (
                Result.objects.filter(term=term)
                .values('subject__name')
                .annotate(
                    approved=Count('id', filter=Q(status='approved')),
                    pending=Count('id', filter=Q(status='submitted')),
                )
                .order_by('subject__name')
            )
            if row['subject__name']
        ]

        # Monthly attendance for the term (from individual records)
        attendance_monthly = [
            {
                'month': row['month'].strftime('%b'),
                'rate':  round(row['present'] / row['total'] * 100, 1) if row['total'] else 0,
            }
            for row in (
                AttendanceRecord.objects.filter(date__gte=term.start_date, date__lte=term.end_date)
                .annotate(month=TruncMonth('date'))
                .values('month')
                .annotate(total=Count('id'), present=Count('id', filter=Q(status='present')))
                .order_by('month')
            )
            if row['month']
        ]

        # Stat card values
        overall_avg  = Result.objects.filter(term=term, status='approved').aggregate(a=Avg('final_score'))['a']
        att_total    = AttendanceRecord.objects.filter(date__gte=term.start_date, date__lte=term.end_date).count()
        att_present  = AttendanceRecord.objects.filter(date__gte=term.start_date, date__lte=term.end_date, status='present').count()
        att_rate     = round(att_present / att_total * 100, 1) if att_total else 0.0
        total_stu    = Student.objects.filter(status='active').count()
        total_tea    = User.objects.filter(role='teacher', is_active=True).count()
        ratio        = f"1:{round(total_stu / total_tea)}" if total_tea else 'N/A'
        top_performers = (
            Result.objects.filter(term=term, status='approved', final_score__gte=80)
            .values('student').distinct().count()
        )

        return Response({
            'terms':              terms_list,
            'current_term_id':    str(term.id),
            'performance_trend':  perf_trend,
            'subject_averages':   subj_avgs,
            'grade_performance':  grade_perf,
            'grade_distribution': grade_dist,
            'pass_fail':          pass_fail,
            'submissions':        submissions,
            'attendance_monthly': attendance_monthly,
            'stats': {
                'overall_avg':     round(float(overall_avg or 0), 1),
                'attendance_rate': att_rate,
                'ratio':           ratio,
                'top_performers':  top_performers,
            },
        })


# ---------------------------------------------------------------------------
# Dashboard — Weekly Trend
# ---------------------------------------------------------------------------

class DOSDashboardWeeklyTrendView(APIView):
    """GET /imboni/dos/dashboard/weekly-trend/"""

    def get(self, request):
        from apps.attendance.models import AttendanceRecord
        from apps.results.models import Result
        from datetime import timedelta
        from django.utils import timezone
        from django.db.models import Avg

        term  = _current_term()
        today = timezone.now().date()
        start = term.start_date if term and term.start_date else today - timedelta(weeks=8)

        buckets = []
        wk_start = start
        for i in range(8):
            wk_end = min(wk_start + timedelta(days=6), today)
            label  = f"Wk {i + 1}"

            att_total   = AttendanceRecord.objects.filter(date__gte=wk_start, date__lte=wk_end).count()
            att_present = AttendanceRecord.objects.filter(date__gte=wk_start, date__lte=wk_end, status='present').count()
            att_rate    = round(att_present / att_total * 100, 1) if att_total else 0

            perf_avg = None
            if term:
                perf_avg = Result.objects.filter(
                    term=term, status='approved',
                    approved_at__date__gte=wk_start,
                    approved_at__date__lte=wk_end,
                ).aggregate(a=Avg('final_score'))['a']
            perf_val = round(float(perf_avg), 1) if perf_avg else 0

            buckets.append({'week': label, 'attendance': att_rate, 'performance': perf_val})
            wk_start = wk_end + timedelta(days=1)
            if wk_start > today:
                break

        return Response(buckets)

# ---------------------------------------------------------------------------
# School Config
# ---------------------------------------------------------------------------

class SchoolConfigView(APIView):
    """
    GET /imboni/dos/school-config/  — return all school sections (DOS, Discipline, Admin)
    PUT /imboni/dos/school-config/  — replace all school sections (DOS, Admin only)
    """
    def get_permissions(self):
        if getattr(self, 'request', None) and self.request.method == 'GET':
            return [IsDOSOrAdminOrDiscipline()]
        return [IsDOSOrAdmin()]

    def get(self,request):
        sections = SchoolSection.objects.filter(is_active=True)
        return Response (SchoolSectionSerializer(sections,many=True).data)
    def put(self,request):
        #request.data should be a list of section objects
        sections_data = request.data
        if not isinstance(sections_data,list):
            return Response(
                {'error':'Expected a list of sections. '},
                status=http_status.HTTP_400_BAD_REQUEST
            )

        # Delete existing and recreate - simple replace strategy
        SchoolSection.objects.all().delete()
        created = []
        for item in sections_data:
            serializer =SchoolSectionSerializer(data=item)
            if serializer.is_valid():
                serializer.save()
                created.append(serializer.data)
            else:
                return Response(serializer.errors, status=http_status.HTTP_400_BAD_REQUEST)
        return Response(created)
    
# ---------------------------------------------------------------------------
# School Settings
# ---------------------------------------------------------------------------

class SchoolSettingsView(APIView):
    """
    GET   /imboni/dos/school-settings/  — return timezone and school name
    PATCH /imboni/dos/school-settings/  — update timezone or school name
    """
    permission_classes = [IsDOSOrAdmin]

    def get(self, request):
        settings = SchoolSetting.get_setting()
        return Response(SchoolSettingSerializer(settings).data)

    def patch(self, request):
        settings = SchoolSetting.get_setting()
        serializer = SchoolSettingSerializer(settings, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=http_status.HTTP_400_BAD_REQUEST)


# ---------------------------------------------------------------------------
# Subject Management
# ---------------------------------------------------------------------------

class SubjectListCreateView(APIView):
    """
    GET  /imboni/dos/subjects/  — list all active subjects
    POST /imboni/dos/subjects/  — create a new subject
    """
    permission_classes = [IsDOSOrAdmin]

    def get(self, request):
        from apps.results.models import Subject
        subjects = Subject.objects.filter(is_active=True).order_by('name')
        return Response(SubjectSerializer(subjects, many=True).data)

    def post(self, request):
        from apps.results.models import Subject
        serializer = SubjectSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=http_status.HTTP_201_CREATED)
        return Response(serializer.errors, status=http_status.HTTP_400_BAD_REQUEST)


class SubjectDetailView(APIView):
    """
    PATCH  /imboni/dos/subjects/<pk>/  — rename a subject
    DELETE /imboni/dos/subjects/<pk>/  — delete a subject
    """
    permission_classes = [IsDOSOrAdmin]

    def _get_subject(self, pk):
        from apps.results.models import Subject
        try:
            return Subject.objects.get(pk=pk)
        except Subject.DoesNotExist:
            return None

    def patch(self, request, pk):
        subject = self._get_subject(pk)
        if not subject:
            return Response({'detail': 'Not found.'}, status=http_status.HTTP_404_NOT_FOUND)
        serializer = SubjectSerializer(subject, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=http_status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        subject = self._get_subject(pk)
        if not subject:
            return Response({'detail': 'Not found.'}, status=http_status.HTTP_404_NOT_FOUND)
        subject.delete()
        return Response(status=http_status.HTTP_204_NO_CONTENT)


class SubjectCategoryRenameView(APIView):
    """
    POST /imboni/dos/subject-categories/rename/
    Body: { old_name, new_name }
    Renames all subjects in a category at once.

    DELETE /imboni/dos/subject-categories/delete/
    Body: { name }
    Deletes all subjects in that category.
    """
    permission_classes = [IsDOSOrAdmin]

    def post(self, request):
        from apps.results.models import Subject
        old_name = request.data.get('old_name', '').strip()
        new_name = request.data.get('new_name', '').strip()
        if not old_name or not new_name:
            return Response({'detail': 'old_name and new_name are required.'}, status=http_status.HTTP_400_BAD_REQUEST)
        updated = Subject.objects.filter(category=old_name).update(category=new_name)
        return Response({'updated': updated, 'category': new_name})

    def delete(self, request):
        from apps.results.models import Subject
        name = request.data.get('name', '').strip()
        if not name:
            return Response({'detail': 'name is required.'}, status=http_status.HTTP_400_BAD_REQUEST)
        deleted, _ = Subject.objects.filter(category=name).delete()
        return Response({'deleted': deleted})
    
class StudentInviteView(APIView):
    permission_classes=[IsDOSOrAdmin]
    
    def post(self,request):
        from django.conf import settings
        from django.contrib.auth.tokens import default_token_generator
        from django.utils.http import urlsafe_base64_encode
        from django.utils.encoding import force_bytes
        from apps.authentication.models import Invitation
        from apps.authentication.service import dispatch_invitation

        student_data=request.data.get('student',{})
        parent_data =request.data.get('parent',{})

        # Validate Student
        s_first =student_data.get('first_name','').strip()
        s_last = student_data.get('last_name','').strip()
        s_email=student_data.get('email','').strip()
        if not s_first or not s_last or not s_email:
            return Response(
                {'error':'Student first name,last name and email are required'},
                status=http_status.HTTP_400_BAD_REQUEST
            )

        # Block if a student account already exists with this email
        if User.objects.filter(email__iexact=s_email, role='student').exists():
            return Response(
                {'error': f'A student account for {s_email} is already registered. No invitation needed.'},
                status=http_status.HTTP_400_BAD_REQUEST
            )

        # Block if an active unused invitation already exists for this email
        from apps.authentication.models import Invitation
        if Invitation.objects.filter(email__iexact=s_email, role='student', is_used=False).exists():
            return Response(
                {'error': f'A pending invitation already exists for {s_email}. Use Resend from Invitation History instead.'},
                status=http_status.HTTP_400_BAD_REQUEST
            )
        
        # Validate Parent
        p_first =parent_data.get('first_name','').strip()
        p_last = parent_data.get('last_name','').strip()
        p_email=parent_data.get('email','').strip()
        p_phone=parent_data.get('phone_number','').strip()
        if not p_first or not p_last:
            return Response(
                {'error':'Parent first name and last name are required'},
                status=http_status.HTTP_400_BAD_REQUEST
            )
        if not p_email and not p_phone:
            return Response(
                {'error':'Parent must have at least one contact: email or phone number.'},
                status=http_status.HTTP_400_BAD_REQUEST
            )
        # Resolve year + stream to a Class object so the student is assigned on registration
        year   = student_data.get('year',   '').strip()
        stream = student_data.get('stream', '').strip()
        class_obj = None
        if year and stream:
            from apps.teacher.models import Class
            grade = year[1:] if year.upper().startswith('S') else year
            class_obj = Class.objects.filter(grade=grade, section=stream).first()

        # Plan gating — a pending student invitation reserves a seat, so count it
        # against the plan before we send one (parent invites are not metered).
        enforce_capacity('students')

        expires_at= timezone.now()+timedelta(days=settings.INVITATION_EXPIRY_DAYS)
        results={}

        # Send student invitation
        student_inv = Invitation.objects.create(
            first_name=s_first,last_name=s_last,email=s_email,
            role='student',invited_by=request.user,
            expires_at=expires_at,token='pending',uid='pending',
            class_obj=class_obj,
        )   
        uid=urlsafe_base64_encode(force_bytes(student_inv.pk))
        token=default_token_generator.make_token(request.user)
        student_inv.uid=uid
        student_inv.token=token
        student_inv.save()
        link = f"{settings.FRONTEND_URL}/register/{uid}/{token}/"
        channels =dispatch_invitation(student_inv,link)
        student_inv.channels_sent=channels
        student_inv.delivery_status='sent' if channels else 'failed'
        student_inv.save()
        results['student']={'email':s_email,'channels':channels}

        # Send parent invitation
        # linked_email stores the student's email so we can auto-link them
        # when the parent completes registration
        parent_inv = Invitation.objects.create(
            first_name=p_first,last_name=p_last,
            email=p_email,phone_number=p_phone,
            role='parent',invited_by=request.user,
            expires_at=expires_at,token='pending',uid='pending',
            linked_email=s_email,
        )
        uid=urlsafe_base64_encode(force_bytes(parent_inv.pk))
        token=default_token_generator.make_token(request.user)
        parent_inv.uid=uid
        parent_inv.token=token
        parent_inv.save()
        link=f"{settings.FRONTEND_URL}/register/{uid}/{token}/"
        channels=dispatch_invitation(parent_inv,link)
        parent_inv.channels_sent=channels
        parent_inv.delivery_status='sent' if channels else 'failed'
        parent_inv.save()
        results['parent']={'contact':p_email or p_phone, 'channels':channels}

        return Response(
            {'detail':'Invitation sent to student and parent.','results': results},
            status=http_status.HTTP_201_CREATED
        )


class StudentBulkInviteView(APIView):
    """
    POST /imboni/dos/students/invite/bulk/   (multipart/form-data, field: file)

    CSV columns (header row required):
        student_first_name, student_last_name, student_email,
        year, stream,
        parent_first_name, parent_last_name, parent_email, parent_phone

    For every valid row: creates one student invitation + one parent invitation.
    parent_email and parent_phone are both optional but at least one is required.
    """
    permission_classes = [IsDOSOrAdmin]

    def post(self, request):
        import csv, io
        from django.conf import settings
        from django.contrib.auth.tokens import default_token_generator
        from django.utils.http import urlsafe_base64_encode
        from django.utils.encoding import force_bytes
        from apps.authentication.models import Invitation
        from apps.authentication.service import dispatch_invitation

        file = request.FILES.get('file')
        if not file:
            return Response({'error': 'CSV file is required.'}, status=http_status.HTTP_400_BAD_REQUEST)

        try:
            text = file.read().decode('utf-8-sig')
        except Exception:
            return Response(
                {'error': 'Could not read file. Make sure it is a UTF-8 encoded CSV.'},
                status=http_status.HTTP_400_BAD_REQUEST
            )

        reader = csv.DictReader(io.StringIO(text))
        required = {'student_first_name', 'student_last_name', 'student_email',
                    'parent_first_name', 'parent_last_name'}
        missing = required - set(reader.fieldnames or [])
        if missing:
            return Response(
                {'error': f'CSV is missing required columns: {", ".join(sorted(missing))}'},
                status=http_status.HTTP_400_BAD_REQUEST
            )

        expires_at = timezone.now() + timedelta(days=settings.INVITATION_EXPIRY_DAYS)
        created = 0
        errors  = []
        slots   = remaining_seats('students')  # None => unlimited; each row reserves one seat

        for row_num, row in enumerate(reader, start=2):
            s_first = row.get('student_first_name', '').strip()
            s_last  = row.get('student_last_name',  '').strip()
            s_email = row.get('student_email',       '').strip()
            p_first = row.get('parent_first_name',  '').strip()
            p_last  = row.get('parent_last_name',   '').strip()
            p_email = row.get('parent_email',        '').strip()
            p_phone = row.get('parent_phone',        '').strip()
            year    = row.get('year',                '').strip()
            stream  = row.get('stream',              '').strip()

            if not s_first or not s_last or not s_email:
                errors.append({'row': row_num, 'error': 'Student first name, last name, and email are required.'})
                continue
            if not p_first or not p_last:
                errors.append({'row': row_num, 'error': 'Parent first name and last name are required.'})
                continue
            if not p_email and not p_phone:
                errors.append({'row': row_num, 'error': 'Parent must have at least one contact: email or phone.'})
                continue

            if User.objects.filter(email__iexact=s_email, role='student').exists():
                errors.append({'row': row_num, 'error': f'{s_email} is already registered — skipped.'})
                continue

            from apps.authentication.models import Invitation as _Inv
            if _Inv.objects.filter(email__iexact=s_email, role='student', is_used=False).exists():
                errors.append({'row': row_num, 'error': f'{s_email} already has a pending invitation — skipped.'})
                continue

            if slots is not None and slots <= 0:
                errors.append({'row': row_num,
                               'error': 'Plan limit reached — upgrade your plan to invite more students.'})
                continue

            # Resolve year + stream to a Class object
            row_class_obj = None
            if year and stream:
                from apps.teacher.models import Class
                grade = year[1:] if year.upper().startswith('S') else year
                row_class_obj = Class.objects.filter(grade=grade, section=stream).first()

            try:
                student_inv = Invitation.objects.create(
                    first_name=s_first, last_name=s_last, email=s_email,
                    role='student', invited_by=request.user,
                    expires_at=expires_at, token='pending', uid='pending',
                    class_obj=row_class_obj,
                )
                uid   = urlsafe_base64_encode(force_bytes(student_inv.pk))
                token = default_token_generator.make_token(request.user)
                student_inv.uid   = uid
                student_inv.token = token
                student_inv.save()
                link     = f"{settings.FRONTEND_URL}/register/{uid}/{token}/"
                channels = dispatch_invitation(student_inv, link)
                student_inv.channels_sent   = channels
                student_inv.delivery_status = 'sent' if channels else 'failed'
                student_inv.save()

                parent_inv = Invitation.objects.create(
                    first_name=p_first, last_name=p_last,
                    email=p_email, phone_number=p_phone,
                    role='parent', invited_by=request.user,
                    expires_at=expires_at, token='pending', uid='pending',
                    linked_email=s_email,
                )
                uid   = urlsafe_base64_encode(force_bytes(parent_inv.pk))
                token = default_token_generator.make_token(request.user)
                parent_inv.uid   = uid
                parent_inv.token = token
                parent_inv.save()
                link     = f"{settings.FRONTEND_URL}/register/{uid}/{token}/"
                channels = dispatch_invitation(parent_inv, link)
                parent_inv.channels_sent   = channels
                parent_inv.delivery_status = 'sent' if channels else 'failed'
                parent_inv.save()

                created += 1
                if slots is not None:
                    slots -= 1
            except Exception as e:
                errors.append({'row': row_num, 'error': str(e)})

        code = http_status.HTTP_201_CREATED if created else http_status.HTTP_400_BAD_REQUEST
        return Response({'created': created, 'failed': len(errors), 'errors': errors}, status=code)


class TeacherClassesView(APIView):
    permission_classes = [IsDOSOrAdmin]

    def get(self, request, pk):
        from apps.teacher.models import TeacherClassList
        names = TeacherClassList.objects.filter(
            teacher_id=pk
        ).values_list('class_name', flat=True)
        return Response({'classes': list(names)})

    def patch(self, request, pk):
        from apps.teacher.models import TeacherClassList
        class_names = request.data.get('classes', [])
        TeacherClassList.objects.filter(teacher_id=pk).delete()
        for name in class_names:
            TeacherClassList.objects.create(teacher_id=pk, class_name=name)
        return Response({'classes': class_names})


class TeacherDetailView(APIView):
    permission_classes = [IsDOSOrAdmin]

    def patch(self, request, pk):
        try:
            teacher = User.objects.get(pk=pk, role='teacher')
        except User.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=http_status.HTTP_404_NOT_FOUND)
        
        for field in ('first_name', 'last_name', 'employment_type'):
            if field in request.data:
                setattr(teacher, field, request.data[field])
        teacher.save()
        return Response({'detail': 'Updated.'})

# ── DOS Timetable ─────────────────────────────────────────────────────────────
def _find_timetable_conflicts(term, day, start_time, end_time,
                              teacher_id=None, room='',
                              exclude_class_id=None, exclude_start=None,
                              exclude_pk=None):
    """
    Return a list of conflict dicts for any timetable slot in the same term/day
    whose time range overlaps [start_time, end_time) and which either:
      - has the same teacher (teacher double-booked), or
      - uses the same room (room double-booked).
    The slot being replaced/updated is excluded from the scan.
    """
    from apps.teacher.models import Timetable

    overlapping = (
        Timetable.objects
        .filter(term=term, day=day, start_time__lt=end_time, end_time__gt=start_time)
        .select_related('class_obj', 'subject', 'teacher')
    )
    if exclude_pk:
        overlapping = overlapping.exclude(pk=exclude_pk)
    if exclude_class_id and exclude_start:
        # update_or_create will overwrite this exact slot — not a conflict
        overlapping = overlapping.exclude(
            class_obj_id=exclude_class_id, start_time=exclude_start,
        )

    conflicts = []
    for other in overlapping:
        if teacher_id and other.teacher_id and str(other.teacher_id) == str(teacher_id):
            conflicts.append({
                'type':       'teacher',
                'message':    f"{other.teacher.get_full_name()} already teaches "
                              f"{other.subject.name} to {other.class_obj.name} at this time.",
                'class_name': other.class_obj.name,
                'day':        other.day,
                'start_time': other.start_time.strftime('%H:%M'),
                'end_time':   other.end_time.strftime('%H:%M'),
            })
        if room and other.room_number and other.room_number.strip().lower() == room.strip().lower():
            conflicts.append({
                'type':       'room',
                'message':    f"Room {other.room_number} is already used by "
                              f"{other.class_obj.name} ({other.subject.name}) at this time.",
                'class_name': other.class_obj.name,
                'day':        other.day,
                'start_time': other.start_time.strftime('%H:%M'),
                'end_time':   other.end_time.strftime('%H:%M'),
            })
    return conflicts


class DosTimetableView(APIView):
    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsTeacherOrDOS()]
        return [IsDOSOrAdmin()]

    def get(self,request):
        from apps.teacher.models import Timetable,Class
        from apps.results.models import AcademicTerm


        class_id = request.query_params.get('class_id','').strip()
        term = AcademicTerm.objects.filter(is_current=True).first()

        if not class_id or not term:
            return Response({'slots': [], 'class_name': '', 'term_name': ''})

        try:
            class_obj = Class.objects.get(id=class_id)
        except Class.DoesNotExist:
            return Response({'slots':[],'class_name':'','term_name':''})

        slots =(
            Timetable.objects
            .filter(class_obj=class_obj,term=term)
            .select_related('subject','teacher')
            .order_by('day','start_time')
        )

        result =[]
        for slot in slots:
            result.append({
                'id':str(slot.id),
                'day':slot.day,
                'start_time':slot.start_time.strftime('%H:%M'),
                'end_time':slot.end_time.strftime('%H:%M'),
                'subject_id':str(slot.subject.id),
                'subject_name': slot.subject.name,
                'teacher_id':str(slot.teacher.id) if slot.teacher else None,
                'teacher_name': slot.teacher.get_full_name() if slot.teacher else '',
                'room': slot.room_number,
            })

        return Response({
            'class_name':class_obj.name,
            'term_name': term.name,
            'slots': result,
        })
    def post(self,request):
        from apps.teacher.models import Timetable,Class
        from apps.results.models import AcademicTerm ,Subject

        term = AcademicTerm.objects.filter(is_current=True).first()
        if not term:
            return Response({'error':'No active term.'},status=400)

        class_id = request.data.get('class_id')
        subject_id = request.data.get('subject_id')
        teacher_id = request.data.get('teacher_id')
        day = request.data.get('day','').lower()
        start_time = request.data.get('start_time')
        end_time = request.data.get('end_time')
        room  = request.data.get('room','')

        if not all([class_id,subject_id,day,start_time,end_time]):
            return Response({'error':'class_id,subject_id,day,start_time,end_time are required'})

        # Refuse to double-book a teacher or room. Pass "force": true to
        # override (e.g. shared venues like the sports field).
        if not request.data.get('force'):
            conflicts = _find_timetable_conflicts(
                term=term, day=day, start_time=start_time, end_time=end_time,
                teacher_id=teacher_id, room=room,
                exclude_class_id=class_id, exclude_start=start_time,
            )
            if conflicts:
                return Response({'error': 'Scheduling conflict.', 'conflicts': conflicts}, status=409)

        slot ,created = Timetable.objects.update_or_create(
            class_obj_id=class_id,
            day=day,
            start_time=start_time,
            term=term,
            defaults={
                'subject_id':subject_id,
                'teacher_id': teacher_id or None,
                'end_time': end_time,
                'room_number':room,
            },
        )
        return Response({'id':str(slot.id),'created':created},status=201 if created else 200)
    
class DosTimetableSlotView(APIView):
    permission_classes = [IsDOSOrAdmin]

    def patch(self,request,pk):
        from apps.teacher.models import Timetable

        try:
            slot = Timetable.objects.get(id=pk)
        except Timetable.DoesNotExist:
            return Response({'error':'Slot not found.'},status=404)
        
        for field in('day','start_time','end_time','room_number'):
            if field in request.data:
                setattr(slot,field,request.data[field])
        if 'subject_id' in request.data:
            slot.subject_id = request.data['subject_id']
        if 'teacher_id' in request.data:
            slot.teacher_id = request.data['teacher_id'] or None

        if not request.data.get('force'):
            conflicts = _find_timetable_conflicts(
                term=slot.term, day=slot.day,
                start_time=slot.start_time, end_time=slot.end_time,
                teacher_id=slot.teacher_id, room=slot.room_number,
                exclude_pk=slot.pk,
            )
            if conflicts:
                return Response({'error': 'Scheduling conflict.', 'conflicts': conflicts}, status=409)

        slot.save()
        return Response({'id':str(slot.id),'detail':'Updated.'})
    
    def delete(self,request,pk):
        from apps.teacher.models import Timetable
        
        try:
            slot = Timetable.objects.get(id=pk)
        except Timetable.DoesNotExist:
            return Response({'error':'Slot not Found'},status=404)
        
        slot.delete()
        return Response(status=204)


class DosRoomListView(APIView):
    """
    GET  /imboni/dos/rooms/ — list all active rooms
    POST /imboni/dos/rooms/ — create a new room
    """
    permission_classes = [IsDOSOrAdmin]

    def get(self, request):
        from .models import Room
        from .serializers import RoomSerializer
        rooms = Room.objects.filter(is_active=True)
        return Response(RoomSerializer(rooms, many=True).data)

    def post(self, request):
        from .models import Room
        from .serializers import RoomSerializer
        serializer = RoomSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=http_status.HTTP_201_CREATED)
        return Response(serializer.errors, status=http_status.HTTP_400_BAD_REQUEST)


class DosRoomDetailView(APIView):
    """
    DELETE /imboni/dos/rooms/<uuid:pk>/ — remove a room
    """
    permission_classes = [IsDOSOrAdmin]

    def delete(self, request, pk):
        from .models import Room
        try:
            room = Room.objects.get(pk=pk)
        except Room.DoesNotExist:
            return Response({'error': 'Not found.'}, status=http_status.HTTP_404_NOT_FOUND)
        room.delete()
        return Response(status=http_status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# DOS Activity (Club) Management
# ---------------------------------------------------------------------------

class DosActivityListView(APIView):
    """GET /imboni/dos/activities/ — list all clubs/activities"""
    permission_classes = [IsDOS]

    def get(self, request):
        from apps.student.models import Activity
        from apps.student.serializers import ActivitySerializer
        qs = Activity.objects.all().order_by('name')
        return Response(ActivitySerializer(qs, many=True).data)


class DosActivityDetailView(APIView):
    """
    PATCH  /imboni/dos/activities/<pk>/ — toggle is_active
    DELETE /imboni/dos/activities/<pk>/ — hard delete
    """
    permission_classes = [IsDOS]

    def _get(self, pk):
        from apps.student.models import Activity
        try:
            return Activity.objects.get(pk=pk)
        except Activity.DoesNotExist:
            return None

    def patch(self, request, pk):
        from apps.student.serializers import ActivitySerializer
        activity = self._get(pk)
        if not activity:
            return Response({'error': 'Not found.'}, status=404)
        if 'is_active' in request.data:
            activity.is_active = bool(request.data['is_active'])
            activity.save(update_fields=['is_active'])
        return Response(ActivitySerializer(activity).data)

    def delete(self, request, pk):
        activity = self._get(pk)
        if not activity:
            return Response({'error': 'Not found.'}, status=404)
        activity.delete()
        return Response(status=http_status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Term Rollover (Admin)
# ---------------------------------------------------------------------------

class TermRolloverView(APIView):
    """
    POST /imboni/dos/term-rollover/

    Ends the current term and starts the next one. When the new term starts a
    new academic year (term1 after term3, or a later year), students are
    promoted one grade (S6 graduates); otherwise class rosters are simply
    carried over to the new term.

    Body: {
        dry_run: bool,                 — preview counts without changing anything
        term: 'term1'|'term2'|'term3',
        year: 2027,
        name: 'Term 1 2027',
        start_date: 'YYYY-MM-DD',
        end_date:   'YYYY-MM-DD',
    }
    """
    def get_permissions(self):
        from apps.authentication.permissions import IsAdminRole
        return [IsAdminRole()]

    def post(self, request):
        from django.db import transaction
        from apps.results.models import AcademicTerm
        from apps.student.models import Student
        from apps.teacher.models import Class, ClassAssignment

        current = AcademicTerm.objects.filter(is_current=True).first()
        if not current:
            return Response({'error': 'No current term configured.'}, status=400)

        term_key = request.data.get('term')
        year     = request.data.get('year')
        name     = request.data.get('name', '').strip()
        start    = request.data.get('start_date')
        end      = request.data.get('end_date')
        dry_run  = bool(request.data.get('dry_run'))

        if term_key not in ('term1', 'term2', 'term3'):
            return Response({'error': "term must be 'term1', 'term2' or 'term3'."}, status=400)
        try:
            year = int(year)
        except (TypeError, ValueError):
            return Response({'error': 'year is required.'}, status=400)
        if not (name and start and end):
            return Response({'error': 'name, start_date and end_date are required.'}, status=400)
        if AcademicTerm.objects.filter(term=term_key, year=year).exists():
            return Response({'error': f'{name} already exists.'}, status=400)

        order = {'term1': 1, 'term2': 2, 'term3': 3}
        is_new_year = (year > current.year) or (
            year == current.year and order[term_key] < order[current.term]
        )
        # Moving backwards makes no sense
        if year < current.year or (year == current.year and order[term_key] <= order[current.term]):
            if not is_new_year:
                return Response({'error': 'The new term must come after the current one.'}, status=400)

        active_students = Student.objects.filter(status='active')
        summary = {
            'mode':               'promotion' if is_new_year else 'carry_over',
            'current_term':       current.name,
            'new_term':           name,
            'students_promoted':  0,
            'students_graduated': 0,
            'rosters_created':    0,
            'missing_classes':    [],
        }

        classes_by_key = {
            (c.grade, c.section): c for c in Class.objects.filter(is_active=True)
        }
        current_assignments = (
            ClassAssignment.objects
            .filter(term=current)
            .select_related('student', 'class_obj')
        )

        with transaction.atomic():
            new_term = None
            if not dry_run:
                new_term = AcademicTerm.objects.create(
                    name=name, term=term_key, year=year,
                    start_date=start, end_date=end, is_current=True,
                )
                AcademicTerm.objects.exclude(pk=new_term.pk).update(is_current=False)

            if is_new_year:
                for student in active_students:
                    if student.grade == '6':
                        summary['students_graduated'] += 1
                        if not dry_run:
                            student.status = 'graduated'
                            student.save(update_fields=['status'])
                        continue

                    new_grade = str(int(student.grade) + 1)
                    summary['students_promoted'] += 1
                    if not dry_run:
                        student.grade = new_grade
                        student.save(update_fields=['grade'])

                    target = classes_by_key.get((new_grade, student.section))
                    if target:
                        summary['rosters_created'] += 1
                        if not dry_run:
                            ClassAssignment.objects.get_or_create(
                                class_obj=target, student=student, term=new_term,
                            )
                    else:
                        key = f'S{new_grade}{student.section}'
                        if key not in summary['missing_classes']:
                            summary['missing_classes'].append(key)
            else:
                for ca in current_assignments:
                    if ca.student.status != 'active':
                        continue
                    summary['rosters_created'] += 1
                    if not dry_run:
                        ClassAssignment.objects.get_or_create(
                            class_obj=ca.class_obj, student=ca.student, term=new_term,
                        )

            if dry_run:
                # Nothing was written inside a dry run, but keep the guarantee explicit
                transaction.set_rollback(True)

        if not dry_run:
            from apps.audit.services import audit
            audit(request.user, 'term.rollover',
                  target=f'{current.name} → {name}',
                  detail={k: v for k, v in summary.items() if k != 'missing_classes'})

        summary['dry_run'] = dry_run
        return Response(summary)
