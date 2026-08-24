import logging
from datetime import date, timedelta
from django.db.models import Avg, Count, Max, Q
from django.utils import timezone
from rest_framework import generics, viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.authentication.models import User
from apps.authentication.permissions import IsTeacher
from rest_framework.permissions import IsAuthenticated
from apps.results.models import AcademicTerm
from .models import Timetable, Task, Reminder, Assignment, AssignmentSubmission, QuestionBank
from .serializers import (
    TeacherSerializer, TimetableSerializer, ScheduleItemSerializer,
    MyClassSerializer, HomeworkStatusSerializer, TaskSerializer, ReminderSerializer,
    ClassPerformanceSerializer, ActivitySerializer,
    TeacherStudentSerializer, PerformanceDistributionSerializer, AttendanceTrendSerializer,
    TeacherAttendanceStudentSerializer, MarkAttendanceSerializer, AttendancePatternSerializer,
    TeacherResultEntrySerializer, BulkSaveResultsSerializer,
    GradeDistributionSerializer, PerformanceTrendSerializer,
    AssignmentSerializer, AssignmentWriteSerializer,
    AssignmentSubmissionSerializer, QuizSubmitSerializer, QuestionBankSerializer,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_teacher(request):
    """Return the logged-in user, falling back to first teacher for dev."""
    if request.user.is_authenticated:
        return request.user
    return User.objects.filter(role='teacher').first()


logger = logging.getLogger(__name__)


def _current_term():
    return AcademicTerm.objects.filter(is_current=True).first()


def _teacher_teaches_class(teacher, class_id, term):
    """
    Without this check, the attendance/results views below accepted any
    class_id with no verification the requesting teacher actually teaches
    that class — a teacher could view or mark attendance/results for any
    class in the school just by changing the class_id query param/body field.
    """
    if not class_id or not term:
        return False
    from apps.teacher.models import SubjectTeacherAssignment
    return SubjectTeacherAssignment.objects.filter(
        teacher=teacher, class_obj_id=class_id, term=term
    ).exists()


# ---------------------------------------------------------------------------
# Existing views (unchanged)
# ---------------------------------------------------------------------------

class TeacherViewSet(viewsets.ReadOnlyModelViewSet):
    """
    GET /imboni/teacher/         — list all teachers
    GET /imboni/teacher/<uuid>/  — single teacher detail
    """
    queryset = User.objects.filter(role='teacher').order_by('last_name', 'first_name')
    serializer_class = TeacherSerializer
    permission_classes = [IsTeacher]


class MyTimetableView(generics.ListAPIView):
    """
    GET /imboni/teacher/my-timetable/
    Full weekly timetable for the logged-in teacher.
    """
    serializer_class = TimetableSerializer
    permission_classes = [IsTeacher]
    pagination_class = None  # timetable is a small fixed set — no paging needed

    def get_queryset(self):
        term = _current_term()
        if not term:
            return Timetable.objects.none()
        return (
            Timetable.objects
            .filter(teacher=_get_teacher(self.request), term=term)
            .select_related('subject', 'class_obj', 'teacher')
            .order_by('day', 'start_time')
        )


class MyTodayScheduleView(generics.ListAPIView):
    """
    GET /imboni/teacher/my-timetable/today/
    Today's periods with Completed / In Progress / Upcoming status.
    """
    serializer_class = ScheduleItemSerializer
    permission_classes = [IsTeacher]

    def get_queryset(self):
        today = timezone.localtime().date().strftime('%A').lower()
        term = _current_term()
        if not term:
            return Timetable.objects.none()
        return (
            Timetable.objects
            .filter(teacher=_get_teacher(self.request), term=term, day=today)
            .select_related('subject', 'class_obj', 'teacher')
            .order_by('start_time')
        )


# ---------------------------------------------------------------------------
# Dashboard Stats
# ---------------------------------------------------------------------------

class TeacherDashboardStatsView(APIView):
    """
    GET /imboni/teacher/dashboard/stats/

    Returns two rows of stat cards shown on the Teacher Dashboard.

    Row 1 (primary):
        overall_attendance  — average attendance % across teacher's classes
        class_average       — average final_score % across teacher's classes
        pending_grading     — Results in draft status submitted by this teacher
        messages_total      — total conversations for this user
        messages_unread     — unread messages count

    Row 2 (secondary):
        total_students      — unique students across teacher's classes
        classes_today       — periods scheduled today
        classes_completed   — periods already finished today
        pending_results     — Results in draft/submitted state
    """
    permission_classes = [IsTeacher]

    def get(self, request):
        teacher = _get_teacher(request)
        term    = _current_term()
        today   = timezone.localtime().date()
        now     = timezone.localtime().time()

        # Classes this teacher teaches this term
        from apps.teacher.models import Class, SubjectTeacherAssignment, ClassAssignment
        class_ids = SubjectTeacherAssignment.objects.filter(
            teacher=teacher, term=term
        ).values_list('class_obj_id', flat=True).distinct() if term else []

        # ── Overall attendance across teacher's classes ──────────────────
        from apps.attendance.models import AttendanceSummary
        att_qs = AttendanceSummary.objects.filter(
            student__class_assignments__class_obj_id__in=class_ids,
            student__class_assignments__term=term,
        ) if term else AttendanceSummary.objects.none()
        # Compute a simple average of attendance_percentage
        avg_att = att_qs.aggregate(avg=Avg('attendance_percentage'))['avg'] or 0

        # ── Class average (results) ──────────────────────────────────────
        from apps.results.models import Result
        result_avg = Result.objects.filter(
            teacher=teacher, term=term
        ).aggregate(avg=Avg('final_score'))['avg'] or 0

        # ── Pending grading (draft results this teacher submitted) ───────
        pending_grading = Result.objects.filter(
            teacher=teacher, status='draft'
        ).count()

        # ── Messages ─────────────────────────────────────────────────────
        from apps.messages.models import Message, Conversation
        my_convs = Conversation.objects.filter(participants=teacher)
        messages_total  = my_convs.count()
        messages_unread = Message.objects.filter(
            conversation__in=my_convs,
            is_read=False,
        ).exclude(sender=teacher).count()

        # ── Total students across teacher's classes ───────────────────────
        total_students = ClassAssignment.objects.filter(
            class_obj_id__in=class_ids, term=term
        ).values('student').distinct().count() if term else 0

        # ── Today's periods ───────────────────────────────────────────────
        today_name = today.strftime('%A').lower()
        today_qs = Timetable.objects.filter(
            teacher=teacher, term=term, day=today_name
        ) if term else Timetable.objects.none()
        classes_today     = today_qs.count()
        classes_completed = today_qs.filter(end_time__lt=now).count()

        # ── Pending results ───────────────────────────────────────────────
        pending_results = Result.objects.filter(
            teacher=teacher, status__in=['draft', 'submitted']
        ).count()

        return Response({
            # Row 1
            'overall_attendance': round(float(avg_att), 1),
            'class_average':      round(float(result_avg), 1),
            'pending_grading':    pending_grading,
            'messages_total':     messages_total,
            'messages_unread':    messages_unread,
            # Row 2
            'total_students':     total_students,
            'classes_today':      classes_today,
            'classes_completed':  classes_completed,
            'classes_remaining':  classes_today - classes_completed,
            'pending_results':    pending_results,
        })


# ---------------------------------------------------------------------------
# My Classes
# ---------------------------------------------------------------------------

_DAY_ABBR  = {'monday': 'Mon', 'tuesday': 'Tue', 'wednesday': 'Wed',
               'thursday': 'Thu', 'friday': 'Fri'}
_DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']


class MyClassesView(APIView):
    """
    GET /imboni/teacher/my-classes/

    Powers the My Classes grid. Each card shows:
        class_name, subject_name, student_count, avg_score,
        schedule_days ("Mon, Wed, Fri"), schedule_time, room_number, next_period

    Optional query params:
        ?search=form3          — filter by class or subject name
        ?grade_filter=1-2      — only Grade 1 & 2 classes
        ?grade_filter=3-4      — only Grade 3 & 4 classes
        ?high_performers=true  — only classes with avg_score >= 80
    """
    permission_classes = [IsTeacher]

    def get(self, request):
        from apps.teacher.models import SubjectTeacherAssignment, ClassAssignment
        from apps.results.models import Result

        teacher = _get_teacher(request)
        term    = _current_term()
        today   = timezone.localtime().date().strftime('%A').lower()
        now     = timezone.localtime().time()

        if not term:
            return Response([])

        assignments = (
            SubjectTeacherAssignment.objects
            .filter(teacher=teacher, term=term)
            .select_related('class_obj', 'subject')
            .order_by('class_obj__grade', 'class_obj__section')
        )

        # ── Search filter ────────────────────────────────────────────────
        search = request.query_params.get('search', '').strip()
        if search:
            assignments = assignments.filter(
                Q(class_obj__name__icontains=search) |
                Q(subject__name__icontains=search)
            )

        # ── Year filter ──────────────────────────────────────────────────
        # A comma-separated list of the school's own year codes ('S1,S2'). This
        # used to be two literal buckets, '1-2' and '3-4', which named years
        # that only a Rwandan secondary school has.
        grade_filter = request.query_params.get('grade_filter', '').strip()
        if grade_filter:
            wanted = [g.strip() for g in grade_filter.split(',') if g.strip()]
            if wanted:
                assignments = assignments.filter(class_obj__grade__in=wanted)

        high_performers = request.query_params.get('high_performers', '').lower() == 'true'

        results = []
        for sta in assignments:
            class_obj = sta.class_obj

            # Student count
            student_count = ClassAssignment.objects.filter(
                class_obj=class_obj, term=term
            ).count()

            # Average score for this class
            avg_raw = Result.objects.filter(
                student__class_assignments__class_obj=class_obj,
                student__class_assignments__term=term,
                term=term,
            ).aggregate(avg=Avg('final_score'))['avg']
            avg_score = round(float(avg_raw), 1) if avg_raw else None

            # Skip if high_performers filter is active and class doesn't qualify
            if high_performers and (avg_score is None or avg_score < 80):
                continue

            # Schedule days sorted Mon→Fri
            days_qs = (
                Timetable.objects
                .filter(class_obj=class_obj, teacher=teacher, term=term)
                .values_list('day', flat=True)
                .distinct()
            )
            days_sorted   = sorted(set(days_qs), key=lambda d: _DAY_ORDER.index(d))
            schedule_days = ', '.join(_DAY_ABBR[d] for d in days_sorted)

            # Earliest period start time + room
            first_slot = (
                Timetable.objects
                .filter(class_obj=class_obj, teacher=teacher, term=term)
                .order_by('start_time')
                .values('start_time', 'room_number')
                .first()
            )
            schedule_time = first_slot['start_time'] if first_slot else None
            room_number   = first_slot['room_number'] if first_slot else ''

            # Next upcoming period today
            next_period = (
                Timetable.objects
                .filter(
                    class_obj=class_obj, teacher=teacher, term=term,
                    day=today, start_time__gte=now,
                )
                .order_by('start_time')
                .values_list('start_time', flat=True)
                .first()
            )

            results.append({
                'class_id':      class_obj.id,
                'class_name':    class_obj.name,
                'grade':         class_obj.grade,
                'section':       class_obj.section,
                'subject_name':  sta.subject.name,
                'subject_id':    sta.subject.id,
                'student_count': student_count,
                'avg_score':     avg_score,
                'schedule_days': schedule_days,
                'schedule_time': schedule_time,
                'room_number':   room_number,
                'next_period':   next_period,
            })

        return Response(MyClassSerializer(results, many=True).data)


class HomeworkSubmissionStatusView(APIView):
    """
    GET /imboni/teacher/my-classes/homework-status/

    Powers the Homework Submission Status progress bars.
    For each class, returns the most recent assessment and how many
    students in that class have submitted it.

        submitted_count / total_students = submission_rate (%)
        bar_color: green (>=90%) | orange (>=75%) | red (<75%)
    """
    permission_classes = [IsTeacher]

    def get(self, request):
        from apps.teacher.models import SubjectTeacherAssignment, ClassAssignment
        from apps.results.models import Assessment

        teacher = _get_teacher(request)
        term    = _current_term()

        if not term:
            return Response([])

        assignments = (
            SubjectTeacherAssignment.objects
            .filter(teacher=teacher, term=term)
            .select_related('class_obj')
        )

        data = []
        seen = set()

        for sta in assignments:
            class_obj = sta.class_obj
            if class_obj.id in seen:
                continue
            seen.add(class_obj.id)

            student_ids = list(
                ClassAssignment.objects
                .filter(class_obj=class_obj, term=term)
                .values_list('student_id', flat=True)
            )
            total = len(student_ids)
            if total == 0:
                continue

            # Most recent assessment title for students in this class
            recent = (
                Assessment.objects
                .filter(student_id__in=student_ids, term=term)
                .values('title')
                .annotate(latest=Max('date'))
                .order_by('-latest')
                .first()
            )
            if not recent:
                continue

            submitted = Assessment.objects.filter(
                student_id__in=student_ids,
                title=recent['title'],
                term=term,
            ).count()

            rate = round(submitted / total * 100, 1) if total else 0
            bar_color = 'green' if rate >= 90 else ('orange' if rate >= 75 else 'red')

            data.append({
                'class_id':         class_obj.id,
                'class_name':       class_obj.name,
                'assessment_title': recent['title'],
                'submitted_count':  submitted,
                'total_students':   total,
                'submission_rate':  rate,
                'bar_color':        bar_color,
            })

        return Response(HomeworkStatusSerializer(data, many=True).data)


# ---------------------------------------------------------------------------
# Pending Tasks  (full CRUD)
# ---------------------------------------------------------------------------

class TeacherTaskViewSet(viewsets.ModelViewSet):
    """
    GET    /imboni/teacher/tasks/       — list tasks for the current user
    POST   /imboni/teacher/tasks/       — create task
    PATCH  /imboni/teacher/tasks/<id>/  — update (mark complete, change priority)
    DELETE /imboni/teacher/tasks/<id>/  — delete task

    Open to any authenticated user so DOS, Discipline, Matron, etc. can also
    maintain personal task lists via the same endpoint.
    """
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated]
    # A personal to-do list is small and the widget always renders all of it.
    # With the project-wide PAGE_SIZE of 20 the 21st task would simply never
    # appear, and the paginated envelope is what made the whole list read as
    # empty on the dashboards.
    pagination_class = None

    def get_queryset(self):
        return Task.objects.filter(teacher=self.request.user)

    def perform_create(self, serializer):
        serializer.save(teacher=self.request.user)


# ---------------------------------------------------------------------------
# Quick Reminders (full CRUD)
# ---------------------------------------------------------------------------

class TeacherReminderViewSet(viewsets.ModelViewSet):
    """
    GET    /imboni/teacher/reminders/       — list reminders
    POST   /imboni/teacher/reminders/       — add reminder
    PATCH  /imboni/teacher/reminders/<id>/  — toggle completed / edit content
    DELETE /imboni/teacher/reminders/<id>/  — delete reminder
    """
    serializer_class = ReminderSerializer
    permission_classes = [IsTeacher]
    pagination_class = None          # same reasoning as TeacherTaskViewSet

    def get_queryset(self):
        teacher = _get_teacher(self.request)
        return Reminder.objects.filter(teacher=teacher)

    def perform_create(self, serializer):
        serializer.save(teacher=_get_teacher(self.request))


# ---------------------------------------------------------------------------
# Class Performance
# ---------------------------------------------------------------------------

class TeacherClassPerformanceView(APIView):
    """
    GET /imboni/teacher/class-performance/

    Returns average final_score per class for the current term.
    Powers the Class Performance progress-bar section.
    """
    permission_classes = [IsTeacher]

    def get(self, request):
        from apps.teacher.models import SubjectTeacherAssignment, ClassAssignment
        from apps.results.models import Result
        teacher = _get_teacher(request)
        term    = _current_term()

        if not term:
            return Response([])

        assignments = (
            SubjectTeacherAssignment.objects
            .filter(teacher=teacher, term=term)
            .select_related('class_obj')
            .order_by('class_obj__grade', 'class_obj__section')
        )

        data = []
        seen = set()
        for sta in assignments:
            class_obj = sta.class_obj
            if class_obj.id in seen:
                continue
            seen.add(class_obj.id)

            # Students in this class
            student_ids = ClassAssignment.objects.filter(
                class_obj=class_obj, term=term
            ).values_list('student_id', flat=True)

            avg = Result.objects.filter(
                student_id__in=student_ids, term=term
            ).aggregate(avg=Avg('final_score'))['avg']

            data.append({
                'class_id':      class_obj.id,
                'class_name':    class_obj.name,
                'average_score': round(float(avg), 1) if avg else 0,
            })

        serializer = ClassPerformanceSerializer(data, many=True)
        return Response(serializer.data)


# ---------------------------------------------------------------------------
# Recent Activities
# ---------------------------------------------------------------------------

class TeacherRecentActivitiesView(APIView):
    """
    GET /imboni/teacher/recent-activities/

    Returns a unified activity feed of the teacher's recent actions:
      - Results submitted
      - Attendance marked
      - Behaviour incidents reported
    Ordered by most recent first, max 10 items.
    """
    permission_classes = [IsTeacher]

    def get(self, request):
        from apps.results.models import Result
        from apps.attendance.models import AttendanceRecord
        from apps.behavior.models import BehaviorReport

        teacher = _get_teacher(request)
        activities = []

        # Recent results submitted by this teacher
        for r in Result.objects.filter(teacher=teacher).select_related('subject', 'student__user').order_by('-updated_at')[:5]:
            activities.append({
                'activity_type': 'result',
                'description':   f"Submitted results: {r.student.full_name} ({r.subject.name})",
                'timestamp':     r.updated_at,
            })

        # Recent attendance marked by this teacher
        for a in AttendanceRecord.objects.filter(marked_by=teacher).select_related('student__user').order_by('-created_at')[:5]:
            activities.append({
                'activity_type': 'attendance',
                'description':   f"Marked attendance: {a.student.full_name} ({a.status})",
                'timestamp':     a.created_at,
            })

        # Recent behaviour reports submitted by this teacher
        for b in BehaviorReport.objects.filter(reported_by=teacher).select_related('student__user').order_by('-created_at')[:5]:
            activities.append({
                'activity_type': 'incident',
                'description':   f"Reported incident. Student: {b.student.full_name}",
                'timestamp':     b.created_at,
            })

        # Sort unified list by timestamp, paginate
        activities.sort(key=lambda x: x['timestamp'], reverse=True)
        limit  = min(int(request.query_params.get('limit',  10)), 50)
        offset = int(request.query_params.get('offset', 0))
        page   = activities[offset: offset + limit]
        serializer = ActivitySerializer(page, many=True)
        return Response({
            'results':  serializer.data,
            'has_more': offset + limit < len(activities),
            'total':    len(activities),
        })


# ---------------------------------------------------------------------------
# Upcoming Deadlines  (Task due dates for the calendar)
# ---------------------------------------------------------------------------

class TeacherUpcomingDeadlinesView(APIView):
    """
    GET /imboni/teacher/deadlines/

    Returns tasks that have a due_date set, for the calendar dot indicators.
    Optional query param: ?month=2&year=2026 to scope to a specific month.
    """
    permission_classes = [IsTeacher]

    def get(self, request):
        teacher = _get_teacher(request)
        today   = timezone.localtime().date()
        month   = int(request.query_params.get('month', today.month))
        year    = int(request.query_params.get('year',  today.year))

        tasks = Task.objects.filter(
            teacher=teacher,
            due_date__month=month,
            due_date__year=year,
        ).order_by('due_date')

        data = TaskSerializer(tasks, many=True).data
        return Response(data)


# ---------------------------------------------------------------------------
# Teacher Students page
# ---------------------------------------------------------------------------

class TeacherStudentListView(APIView):
    """
    GET /imboni/teacher/students/

    Lists every student enrolled in any of the teacher's classes this term.

    Optional query params:
        ?search=john          — filter by name, student_code, or class name
        ?class_id=<uuid>      — filter by specific class
        ?performance=high     — avg final_score >= 75
        ?performance=medium   — 50 <= avg_final_score < 75
        ?performance=low      — avg_final_score < 50
        ?attendance=high      — attendance_percentage >= 75
        ?attendance=medium    — 50 <= attendance_percentage < 75
        ?attendance=low       — attendance_percentage < 50
    """
    permission_classes = [IsTeacher]

    def get(self, request):
        from apps.teacher.models import SubjectTeacherAssignment, ClassAssignment
        from apps.results.models import Result
        from apps.attendance.models import AttendanceSummary

        teacher = _get_teacher(request)
        term    = _current_term()

        if not term:
            return Response([])

        # All class IDs this teacher teaches this term
        class_ids = list(
            SubjectTeacherAssignment.objects
            .filter(teacher=teacher, term=term)
            .values_list('class_obj_id', flat=True)
            .distinct()
        )

        # Optional: filter to a single class
        class_id_filter = request.query_params.get('class_id', '').strip()
        if class_id_filter:
            class_ids = [cid for cid in class_ids if str(cid) == class_id_filter]

        # Fetch all student enrollments for those classes
        enrollments = (
            ClassAssignment.objects
            .filter(class_obj_id__in=class_ids, term=term)
            .select_related('student__user', 'class_obj')
            .distinct()
        )

        # Build lookup: student_id → class_name (first class if enrolled in multiple)
        seen_students = {}
        for enr in enrollments:
            sid = enr.student_id
            if sid not in seen_students:
                seen_students[sid] = {
                    'enrollment': enr,
                    'class_name': enr.class_obj.name,
                }

        search = request.query_params.get('search', '').strip().lower()
        perf_filter = request.query_params.get('performance', '').strip().lower()
        att_filter  = request.query_params.get('attendance', '').strip().lower()

        results = []
        for sid, info in seen_students.items():
            student    = info['enrollment'].student
            class_name = info['class_name']

            # Search filter
            if search:
                haystack = f"{student.full_name} {student.student_id} {class_name}".lower()
                if search not in haystack:
                    continue

            # Attendance rate — AttendanceSummary uses month/year, not term FK
            from django.db.models import Sum as _Sum
            _att = AttendanceSummary.objects.filter(
                student=student,
                year__gte=term.start_date.year, year__lte=term.end_date.year,
                month__gte=term.start_date.month, month__lte=term.end_date.month,
            ).aggregate(total=_Sum('total_days'), present=_Sum('present_days'))
            attendance_rate = (
                round(_att['present'] / _att['total'] * 100, 1) if _att['total'] else None
            )

            # Performance rate (average final_score this term)
            avg_raw = Result.objects.filter(
                student=student, term=term
            ).aggregate(avg=Avg('final_score'))['avg']
            performance_rate = round(float(avg_raw), 1) if avg_raw else None

            # Performance filter
            if perf_filter:
                if performance_rate is None:
                    continue
                if perf_filter == 'high' and performance_rate < 75:
                    continue
                if perf_filter == 'medium' and not (50 <= performance_rate < 75):
                    continue
                if perf_filter == 'low' and performance_rate >= 50:
                    continue

            # Attendance filter
            if att_filter:
                if attendance_rate is None:
                    continue
                if att_filter == 'high' and attendance_rate < 75:
                    continue
                if att_filter == 'medium' and not (50 <= attendance_rate < 75):
                    continue
                if att_filter == 'low' and attendance_rate >= 50:
                    continue

            # Initials from full name
            name_parts = student.full_name.split()
            initials = ''.join(p[0].upper() for p in name_parts[:2]) if name_parts else '?'

            results.append({
                'student_id':       student.id,
                'student_code':     student.student_id,
                'full_name':        student.full_name,
                'initials':         initials,
                'class_name':       class_name,
                'attendance_rate':  attendance_rate,
                'performance_rate': performance_rate,
            })

        results.sort(key=lambda x: x['full_name'])
        return Response(TeacherStudentSerializer(results, many=True).data)


class StudentPerformanceDistributionView(APIView):
    """
    GET /imboni/teacher/students/performance-distribution/

    Returns histogram buckets for the Performance Distribution chart.
    Students are bucketed by their average final_score across all subjects
    this term, for all classes taught by the teacher.

    Buckets:
        85–100%  → "85-100%"
        70–84%   → "70-84%"
        50–69%   → "50-69%"
        0–49%    → "Below 50%"
    """
    permission_classes = [IsTeacher]

    def get(self, request):
        from apps.teacher.models import SubjectTeacherAssignment, ClassAssignment
        from apps.results.models import Result

        teacher = _get_teacher(request)
        term    = _current_term()

        if not term:
            return Response([])

        class_ids = list(
            SubjectTeacherAssignment.objects
            .filter(teacher=teacher, term=term)
            .values_list('class_obj_id', flat=True)
            .distinct()
        )

        student_ids = list(
            ClassAssignment.objects
            .filter(class_obj_id__in=class_ids, term=term)
            .values_list('student_id', flat=True)
            .distinct()
        )

        # Compute each student's average final_score
        student_avgs = (
            Result.objects
            .filter(student_id__in=student_ids, term=term)
            .values('student_id')
            .annotate(avg=Avg('final_score'))
        )

        buckets = [
            {'range_label': '85-100%',   'min_score': 85, 'max_score': 100, 'student_count': 0},
            {'range_label': '70-84%',    'min_score': 70, 'max_score': 84,  'student_count': 0},
            {'range_label': '50-69%',    'min_score': 50, 'max_score': 69,  'student_count': 0},
            {'range_label': 'Below 50%', 'min_score': 0,  'max_score': 49,  'student_count': 0},
        ]

        for row in student_avgs:
            avg = row['avg'] or 0
            if avg >= 85:
                buckets[0]['student_count'] += 1
            elif avg >= 70:
                buckets[1]['student_count'] += 1
            elif avg >= 50:
                buckets[2]['student_count'] += 1
            else:
                buckets[3]['student_count'] += 1

        return Response(PerformanceDistributionSerializer(buckets, many=True).data)


class StudentAttendanceTrendsView(APIView):
    """
    GET /imboni/teacher/students/attendance-trends/

    Returns last 4 weeks of attendance rates (Mon–Fri) for all students
    in the teacher's classes, as a weekly average.

    Response: [ { week_label, week_start, attendance_rate }, ... ]
    """
    permission_classes = [IsTeacher]

    def get(self, request):
        from apps.teacher.models import SubjectTeacherAssignment, ClassAssignment
        from apps.attendance.models import AttendanceRecord

        teacher = _get_teacher(request)
        term    = _current_term()

        if not term:
            return Response([])

        class_ids = list(
            SubjectTeacherAssignment.objects
            .filter(teacher=teacher, term=term)
            .values_list('class_obj_id', flat=True)
            .distinct()
        )

        student_ids = list(
            ClassAssignment.objects
            .filter(class_obj_id__in=class_ids, term=term)
            .values_list('student_id', flat=True)
            .distinct()
        )

        today = timezone.localtime().date()
        # Align to the most recent Monday
        monday = today - timedelta(days=today.weekday())

        data = []
        for i in range(4):
            week_start = monday - timedelta(weeks=3 - i)
            week_end   = week_start + timedelta(days=4)   # Friday

            total = AttendanceRecord.objects.filter(
                student_id__in=student_ids,
                date__gte=week_start,
                date__lte=week_end,
            ).count()

            present = AttendanceRecord.objects.filter(
                student_id__in=student_ids,
                date__gte=week_start,
                date__lte=week_end,
                status='present',
            ).count()

            rate = round(present / total * 100, 1) if total else 0

            data.append({
                'week_label':      f"Week {i + 1}",
                'week_start':      week_start,
                'attendance_rate': rate,
            })

        return Response(AttendanceTrendSerializer(data, many=True).data)


# ---------------------------------------------------------------------------
# Teacher Attendance Management page
# ---------------------------------------------------------------------------

class TeacherAttendanceStatsView(APIView):
    """
    GET /imboni/teacher/attendance/stats/?class_id=<uuid>&date=2026-02-03

    Returns the 4 stat cards at the top of the Attendance Management page:
        present_count   — students present today
        absent_count    — students absent today
        late_count      — students marked late today
        class_total     — total students in the class
        present_pct     — present_count / class_total * 100 (e.g. "90% of class")
        weekly_rate     — attendance % across the current Mon–Fri week
        weekly_rate_change — difference vs the previous Mon–Fri week (e.g. +2.0)
    """
    permission_classes = [IsTeacher]

    def get(self, request):
        from apps.teacher.models import ClassAssignment
        from apps.attendance.models import AttendanceRecord

        class_id = request.query_params.get('class_id', '').strip()
        date_str = request.query_params.get('date', '').strip()

        try:
            target_date = date.fromisoformat(date_str) if date_str else timezone.localtime().date()
        except ValueError:
            target_date = timezone.localtime().date()

        term = _current_term()

        # Students in this class
        student_ids = list(
            ClassAssignment.objects
            .filter(class_obj_id=class_id, term=term)
            .values_list('student_id', flat=True)
        ) if class_id and term else []

        class_total = len(student_ids)

        # Today's records
        day_qs = AttendanceRecord.objects.filter(
            student_id__in=student_ids, date=target_date
        )
        present_count = day_qs.filter(status='present').count()
        absent_count  = day_qs.filter(status='absent').count()
        late_count    = day_qs.filter(status='late').count()
        present_pct   = round(present_count / class_total * 100, 1) if class_total else 0

        # Current week (Mon–Fri)
        monday = target_date - timedelta(days=target_date.weekday())
        friday = monday + timedelta(days=4)

        def _week_rate(start, end):
            total   = AttendanceRecord.objects.filter(student_id__in=student_ids, date__gte=start, date__lte=end).count()
            present = AttendanceRecord.objects.filter(student_id__in=student_ids, date__gte=start, date__lte=end, status='present').count()
            return round(present / total * 100, 1) if total else 0

        weekly_rate      = _week_rate(monday, friday)
        prev_monday      = monday - timedelta(weeks=1)
        prev_friday      = prev_monday + timedelta(days=4)
        prev_weekly_rate = _week_rate(prev_monday, prev_friday)
        weekly_rate_change = round(weekly_rate - prev_weekly_rate, 1)

        return Response({
            'present_count':      present_count,
            'absent_count':       absent_count,
            'late_count':         late_count,
            'class_total':        class_total,
            'present_pct':        present_pct,
            'weekly_rate':        weekly_rate,
            'weekly_rate_change': weekly_rate_change,
        })


class TeacherAttendanceStudentsView(APIView):
    """
    GET /imboni/teacher/attendance/students/?class_id=<uuid>&date=2026-02-03

    Returns the student list for the attendance marking table.
    Each row includes the student's existing attendance record for that date
    (status=null and notes='' when not yet marked).
    """
    permission_classes = [IsTeacher]

    def get(self, request):
        from apps.teacher.models import ClassAssignment
        from apps.attendance.models import AttendanceRecord

        class_id = request.query_params.get('class_id', '').strip()
        date_str = request.query_params.get('date', '').strip()

        try:
            target_date = date.fromisoformat(date_str) if date_str else timezone.localtime().date()
        except ValueError:
            target_date = timezone.localtime().date()

        term = _current_term()

        if not class_id or not term:
            return Response([])

        if not _teacher_teaches_class(_get_teacher(request), class_id, term):
            return Response({'detail': 'You do not teach this class.'}, status=status.HTTP_403_FORBIDDEN)

        enrollments = (
            ClassAssignment.objects
            .filter(class_obj_id=class_id, term=term)
            .select_related('student__user')
            .order_by('student__user__last_name', 'student__user__first_name')
        )

        # Existing records for this class + date
        existing = {
            str(r.student_id): r
            for r in AttendanceRecord.objects.filter(
                student_id__in=enrollments.values_list('student_id', flat=True),
                date=target_date,
            )
        }

        data = []
        for enr in enrollments:
            student = enr.student
            record  = existing.get(str(student.id))
            name_parts = student.full_name.split()
            initials   = ''.join(p[0].upper() for p in name_parts[:2]) if name_parts else '?'
            data.append({
                'student_id':   student.id,
                'student_code': student.student_id,
                'full_name':    student.full_name,
                'initials':     initials,
                'status':       record.status if record else None,
                'notes':        record.notes  if record else '',
            })

        return Response(TeacherAttendanceStudentSerializer(data, many=True).data)


class MarkAttendanceView(APIView):
    """
    POST /imboni/teacher/attendance/mark/

    Bulk-saves attendance records for a class on a given date.
    Creates new records or updates existing ones (upsert via unique_together).

    Body:
    {
        "class_id": "<uuid>",
        "date": "2026-02-03",
        "records": [
            { "student_id": "<uuid>", "status": "present", "notes": "" },
            { "student_id": "<uuid>", "status": "absent",  "notes": "Sick leave" },
            ...
        ]
    }
    """
    permission_classes = [IsTeacher]

    def post(self, request):
        from apps.attendance.models import AttendanceRecord

        serializer = MarkAttendanceSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        teacher     = _get_teacher(request)
        class_id    = serializer.validated_data['class_id']
        target_date = serializer.validated_data['date']
        records     = serializer.validated_data['records']
        term        = _current_term()

        if not _teacher_teaches_class(teacher, class_id, term):
            return Response({'detail': 'You do not teach this class.'}, status=status.HTTP_403_FORBIDDEN)

        # Restrict to students actually enrolled in this class — class_id was
        # validated by the serializer but previously never used for anything,
        # so any student_id could be marked regardless of class.
        from apps.teacher.models import ClassAssignment
        enrolled_student_ids = set(
            ClassAssignment.objects.filter(class_obj_id=class_id, term=term).values_list('student_id', flat=True)
        )

        # Snapshot existing statuses so parents are only notified when a student
        # is NEWLY marked absent, not on every re-save of the register.
        previous_status = dict(
            AttendanceRecord.objects
            .filter(student_id__in=enrolled_student_ids, date=target_date)
            .values_list('student_id', 'status')
        )

        saved = 0
        newly_absent_ids = []
        for rec in records:
            if rec['student_id'] not in enrolled_student_ids:
                continue
            AttendanceRecord.objects.update_or_create(
                student_id=rec['student_id'],
                date=target_date,
                defaults={
                    'status':    rec['status'],
                    'notes':     rec.get('notes', ''),
                    'marked_by': teacher,
                },
            )
            saved += 1
            if rec['status'] == 'absent' and previous_status.get(rec['student_id']) != 'absent':
                newly_absent_ids.append(rec['student_id'])

        if newly_absent_ids:
            from apps.notifications.services import notify_parents_of
            from apps.student.models import Student
            for student in Student.objects.filter(id__in=newly_absent_ids).select_related('user'):
                notify_parents_of(
                    student,
                    title='Absence recorded',
                    message=f"{student.full_name} was marked absent on {target_date.strftime('%d %b %Y')}.",
                    type='attendance',
                    path='/parent/attendance',
                )

        return Response({'saved': saved}, status=status.HTTP_200_OK)


class TeacherAttendancePatternsView(APIView):
    """
    GET /imboni/teacher/attendance/patterns/?class_id=<uuid>

    Returns the day-of-week attendance rate for the Attendance Patterns line chart.
    Looks at the last 8 weeks of records for all students in the given class.

    Response: [ { day: "Mon", attendance_rate: 96.0 }, ... ]
    """
    permission_classes = [IsTeacher]

    def get(self, request):
        from apps.teacher.models import ClassAssignment
        from apps.attendance.models import AttendanceRecord

        class_id = request.query_params.get('class_id', '').strip()
        term     = _current_term()

        if not class_id or not term:
            return Response([])

        student_ids = list(
            ClassAssignment.objects
            .filter(class_obj_id=class_id, term=term)
            .values_list('student_id', flat=True)
        )

        today     = timezone.localtime().date()
        since     = today - timedelta(weeks=8)

        day_names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
        # Django isoweekday: Mon=1 … Fri=5
        data = []
        for idx, day_name in enumerate(day_names, start=1):
            total = AttendanceRecord.objects.filter(
                student_id__in=student_ids,
                date__gte=since,
                date__week_day=idx + 1,   # Django: Sun=1, Mon=2 … Fri=6
            ).count()
            present = AttendanceRecord.objects.filter(
                student_id__in=student_ids,
                date__gte=since,
                date__week_day=idx + 1,
                status='present',
            ).count()
            data.append({
                'day':             day_name,
                'attendance_rate': round(present / total * 100, 1) if total else 0,
            })

        return Response(AttendancePatternSerializer(data, many=True).data)


# ---------------------------------------------------------------------------
# Teacher Results Management page
# ---------------------------------------------------------------------------

def _grade_from_pct(pct):
    """Letter grade from a percentage (matches UI histogram buckets)."""
    if pct >= 80: return 'A'
    if pct >= 70: return 'B'
    if pct >= 60: return 'C'
    if pct >= 50: return 'D'
    return 'F'


class TeacherResultListView(APIView):
    """
    GET /imboni/teacher/results/list/?class_id=<uuid>&assessment_title=Mid-Term Exam

    Returns the results table rows for the Enter Results page.
    Each row = one student's Assessment record for the given title.

    Also returns `assessment_titles` — distinct titles available for the
    class this term (powers the dropdown).

    Query params:
        class_id          — required
        assessment_title  — optional; omit to return all assessments for the class
    """
    permission_classes = [IsTeacher]

    def get(self, request):
        from apps.teacher.models import ClassAssignment
        from apps.results.models import Assessment

        class_id         = request.query_params.get('class_id', '').strip()
        assessment_title = request.query_params.get('assessment_title', '').strip()
        term             = _current_term()

        if not class_id or not term:
            return Response({'assessment_titles': [], 'results': []})

        if not _teacher_teaches_class(_get_teacher(request), class_id, term):
            return Response({'detail': 'You do not teach this class.'}, status=status.HTTP_403_FORBIDDEN)

        student_ids = list(
            ClassAssignment.objects
            .filter(class_obj_id=class_id, term=term)
            .values_list('student_id', flat=True)
        )

        # All distinct assessment titles for this class (for the dropdown)
        titles = list(
            Assessment.objects
            .filter(student_id__in=student_ids, term=term)
            .values_list('title', flat=True)
            .distinct()
            .order_by('title')
        )

        qs = (
            Assessment.objects
            .filter(student_id__in=student_ids, term=term)
            .select_related('student__user')
            .order_by('student__user__last_name', 'student__user__first_name', '-date')
        )
        if assessment_title:
            qs = qs.filter(title=assessment_title)

        rows = []
        for a in qs:
            pct  = float(a.percentage)
            name_parts = a.student.full_name.split()
            initials   = ''.join(p[0].upper() for p in name_parts[:2]) if name_parts else '?'
            rows.append({
                'assessment_id':   a.id,
                'student_id':      a.student_id,
                'student_code':    a.student.student_id,
                'full_name':       a.student.full_name,
                'initials':        initials,
                'assessment_title': a.title,
                'score_obtained':  float(a.score_obtained),
                'max_score':       float(a.max_score),
                'score_display':   f"{int(a.score_obtained)}/{int(a.max_score)}",
                'percentage':      round(pct, 1),
                'grade':           _grade_from_pct(pct),
                'date':            a.date,
            })

        return Response({
            'assessment_titles': titles,
            'results': TeacherResultEntrySerializer(rows, many=True).data,
        })


class TeacherBulkSaveResultsView(APIView):
    """
    POST /imboni/teacher/results/bulk-save/

    Creates or updates Assessment records for multiple students at once.
    Powers both "Add New Results" (new title) and "Bulk Entry Mode" (existing).

    Body:
    {
        "class_id":         "<uuid>",
        "subject_id":       "<uuid>",
        "assessment_title": "Mid-Term Exam",
        "assessment_type":  "quiz",
        "date":             "2026-01-15",
        "max_score":        100,
        "entries": [
            { "student_id": "<uuid>", "score_obtained": 85, "notes": "" },
            ...
        ]
    }
    """
    permission_classes = [IsTeacher]

    def post(self, request):
        from apps.results.models import Assessment, Subject, AcademicTerm

        serializer = BulkSaveResultsSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        d = serializer.validated_data
        term = _current_term()
        if not term:
            return Response({'error': 'No current term found.'}, status=status.HTTP_400_BAD_REQUEST)

        if not _teacher_teaches_class(_get_teacher(request), d['class_id'], term):
            return Response({'detail': 'You do not teach this class.'}, status=status.HTTP_403_FORBIDDEN)

        saved = 0
        for entry in d['entries']:
            max_s  = d['max_score']
            score  = entry['score_obtained']
            pct    = round(score / max_s * 100, 2) if max_s else 0
            Assessment.objects.update_or_create(
                student_id=entry['student_id'],
                subject_id=d['subject_id'],
                term=term,
                title=d['assessment_title'],
                defaults={
                    'assessment_type': d['assessment_type'],
                    'date':            d['date'],
                    'max_score':       max_s,
                    'score_obtained':  score,
                    'percentage':      pct,
                    'teacher_notes':   entry.get('notes', ''),
                },
            )
            saved += 1

        return Response({'saved': saved}, status=status.HTTP_200_OK)


class TeacherGradeDistributionView(APIView):
    """
    GET /imboni/teacher/results/grade-distribution/
        ?class_id=<uuid>&assessment_title=Mid-Term Exam

    Powers the Grade Distribution Analysis section:
        - Grade buckets histogram (A/B/C/D/F)
        - class_average, avg_change (vs previous assessment of same class)
        - highest_score + highest_scorer name
        - pass_rate (D and above, i.e. percentage >= 50)
    """
    permission_classes = [IsTeacher]

    def get(self, request):
        from apps.teacher.models import ClassAssignment, Class
        from apps.results.models import Assessment

        class_id         = request.query_params.get('class_id', '').strip()
        assessment_title = request.query_params.get('assessment_title', '').strip()
        term             = _current_term()

        if not class_id or not assessment_title or not term:
            return Response({})

        # Class info
        try:
            class_obj = Class.objects.get(id=class_id)
        except Class.DoesNotExist:
            return Response({})

        student_ids = list(
            ClassAssignment.objects
            .filter(class_obj_id=class_id, term=term)
            .values_list('student_id', flat=True)
        )

        assessments = list(
            Assessment.objects
            .filter(
                student_id__in=student_ids,
                term=term,
                title=assessment_title,
            )
            .select_related('student__user', 'subject')
            .order_by('-percentage')
        )

        if not assessments:
            return Response({})

        total = len(assessments)
        pcts  = [float(a.percentage) for a in assessments]
        class_average = round(sum(pcts) / total, 1)

        # Highest score
        top        = assessments[0]
        high_score = float(top.percentage)
        high_name  = top.student.full_name

        # Pass rate (>= 50%)
        passed     = sum(1 for p in pcts if p >= 50)
        pass_rate  = round(passed / total * 100, 1)

        # Grade buckets
        buckets = [
            {'grade': 'A', 'range': '80-100%', 'min': 80, 'max': 100, 'count': 0},
            {'grade': 'B', 'range': '70-79%',  'min': 70, 'max': 79,  'count': 0},
            {'grade': 'C', 'range': '60-69%',  'min': 60, 'max': 69,  'count': 0},
            {'grade': 'D', 'range': '50-59%',  'min': 50, 'max': 59,  'count': 0},
            {'grade': 'F', 'range': '<50%',    'min': 0,  'max': 49,  'count': 0},
        ]
        for p in pcts:
            if   p >= 80: buckets[0]['count'] += 1
            elif p >= 70: buckets[1]['count'] += 1
            elif p >= 60: buckets[2]['count'] += 1
            elif p >= 50: buckets[3]['count'] += 1
            else:         buckets[4]['count'] += 1

        # Change vs previous assessment (different title, same class, same term)
        prev_titles = (
            Assessment.objects
            .filter(student_id__in=student_ids, term=term)
            .exclude(title=assessment_title)
            .values_list('title', flat=True)
            .distinct()
            .order_by('-date')
        )
        avg_change = 0.0
        if prev_titles.exists():
            prev_title = prev_titles.first()
            prev_pcts  = list(
                Assessment.objects
                .filter(student_id__in=student_ids, term=term, title=prev_title)
                .values_list('percentage', flat=True)
            )
            if prev_pcts:
                prev_avg   = sum(float(p) for p in prev_pcts) / len(prev_pcts)
                avg_change = round(class_average - prev_avg, 1)

        subject_name = assessments[0].subject.name if assessments else ''

        data = {
            'assessment_title': assessment_title,
            'class_name':       class_obj.name,
            'subject_name':     subject_name,
            'class_average':    class_average,
            'avg_change':       avg_change,
            'highest_score':    round(high_score, 1),
            'highest_scorer':   high_name,
            'pass_rate':        pass_rate,
            'passed_count':     passed,
            'total_count':      total,
            'buckets':          buckets,
        }
        return Response(GradeDistributionSerializer(data).data)


class TeacherPerformanceTrendsView(APIView):
    """
    GET /imboni/teacher/results/performance-trends/
        ?class_id=<uuid>&subject_id=<uuid>

    Returns month-by-month average assessment scores for the class,
    used for the Performance Trends Over Time line graph.

    Response: [ { month_label, month, year, avg_score }, ... ]
    """
    permission_classes = [IsTeacher]

    def get(self, request):
        from apps.teacher.models import ClassAssignment
        from apps.results.models import Assessment
        from django.db.models.functions import TruncMonth
        from django.db.models import Avg as DAvg

        class_id   = request.query_params.get('class_id', '').strip()
        subject_id = request.query_params.get('subject_id', '').strip()
        term       = _current_term()

        if not class_id or not term:
            return Response([])

        student_ids = list(
            ClassAssignment.objects
            .filter(class_obj_id=class_id, term=term)
            .values_list('student_id', flat=True)
        )

        qs = Assessment.objects.filter(student_id__in=student_ids, term=term)
        if subject_id:
            qs = qs.filter(subject_id=subject_id)

        monthly = (
            qs
            .annotate(month=TruncMonth('date'))
            .values('month')
            .annotate(avg=DAvg('percentage'))
            .order_by('month')
        )

        month_abbr = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        data = [
            {
                'month_label': month_abbr[row['month'].month],
                'month':       row['month'].month,
                'year':        row['month'].year,
                'avg_score':   round(float(row['avg']), 1),
            }
            for row in monthly
        ]
        return Response(PerformanceTrendSerializer(data, many=True).data)


# ---------------------------------------------------------------------------
# Incident Reporting
# ---------------------------------------------------------------------------

class TeacherReportIncidentView(APIView):
    """POST /imboni/teacher/incidents/  — teacher logs a behaviour incident."""
    permission_classes = [IsTeacher]

    def post(self, request):
        from apps.behavior.models import BehaviorReport
        from apps.student.models import Student
        from django.utils import timezone

        d = request.data
        student_id = d.get('student_id')
        if not student_id:
            return Response({'detail': 'student_id is required.'}, status=400)

        try:
            student = Student.objects.get(pk=student_id)
        except Student.DoesNotExist:
            return Response({'detail': 'Student not found.'}, status=404)

        report = BehaviorReport.objects.create(
            student       = student,
            report_type   = d.get('report_type', 'incident'),
            severity      = d.get('severity', 'minor'),
            title         = d.get('title', 'Incident Report'),
            description   = d.get('description', ''),
            date          = d.get('date') or timezone.localdate(),
            location      = d.get('location', ''),
            reported_by   = request.user if request.user.is_authenticated else None,
            action_taken  = d.get('action_taken', ''),
            follow_up_required = bool(d.get('follow_up_required', False)),
        )
        return Response({'id': str(report.id), 'detail': 'Incident reported.'}, status=201)


# ---------------------------------------------------------------------------
# Subjects list (for assignment form dropdowns)
# ---------------------------------------------------------------------------

class TeacherSubjectsView(APIView):
    """GET /imboni/teacher/subjects/ — all active subjects for assignment form."""
    permission_classes = [IsTeacher]

    def get(self, request):
        from apps.results.models import Subject
        subjects = Subject.objects.filter(is_active=True).order_by('name')
        return Response([
            {'id': str(s.id), 'name': s.name, 'code': s.code}
            for s in subjects
        ])


# ---------------------------------------------------------------------------
# Assignments (teacher creates, publishes to class → triggers notification)
# ---------------------------------------------------------------------------

class AssignmentViewSet(viewsets.ModelViewSet):
    """
    GET    /imboni/teacher/assignments/          — list teacher's assignments
    POST   /imboni/teacher/assignments/          — create
    PATCH  /imboni/teacher/assignments/<id>/     — update (publish → creates Announcement)
    DELETE /imboni/teacher/assignments/<id>/     — delete
    """
    permission_classes = [IsTeacher]

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return AssignmentWriteSerializer
        return AssignmentSerializer

    def get_queryset(self):
        return (
            Assignment.objects
            .filter(teacher=self.request.user)
            .select_related('class_obj', 'subject')
        )

    def perform_create(self, serializer):
        instance = serializer.save(teacher=self.request.user)
        if instance.status == 'active':
            instance.published_at = timezone.now()
            instance.save(update_fields=['published_at'])
            self._notify_class(instance)

    def perform_update(self, serializer):
        old_status = self.get_object().status
        instance   = serializer.save()
        if old_status != 'active' and instance.status == 'active':
            instance.published_at = timezone.now()
            instance.save(update_fields=['published_at'])
            self._notify_class(instance)

    @action(detail=True, methods=['post'])
    def close(self, request, pk=None):
        """
        POST /imboni/teacher/assignments/<id>/close/ — stop accepting work.

        `closed` was a declared status that nothing could reach: the student
        and parent lists already read it, the teacher UI already had a Closed
        tab, but no code path ever set it. So an assignment stayed open to
        submissions indefinitely, months past its due date.

        Closing keeps the assignment and its marks visible to everyone; it only
        refuses new submissions (see StudentAssignmentSubmitView).
        """
        assignment = self.get_object()
        if assignment.status == 'draft':
            return Response(
                {'error': 'A draft has not been published, so there is nothing to close.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        assignment.status = 'closed'
        assignment.save(update_fields=['status'])
        return Response(AssignmentSerializer(assignment).data)

    @action(detail=True, methods=['post'])
    def reopen(self, request, pk=None):
        """Undo a close - a deadline extended, or one closed by mistake."""
        assignment = self.get_object()
        if assignment.status != 'closed':
            return Response({'error': 'This assignment is not closed.'},
                            status=status.HTTP_400_BAD_REQUEST)
        assignment.status = 'active'
        assignment.save(update_fields=['status'])
        return Response(AssignmentSerializer(assignment).data)

    def perform_destroy(self, instance):
        """
        Deleting cascades to every submission, so a graded assignment cannot
        go quietly.

        AssignmentSubmission.assignment is CASCADE: deleting an assignment with
        marks in it destroys every student's work and score with no warning and
        no way back. A teacher who wants it out of the way should close it.
        Deleting stays possible only while nothing has been handed in.
        """
        if AssignmentSubmission.objects.filter(assignment=instance).exists():
            raise ValidationError({
                'detail': 'This assignment has submissions and cannot be deleted. '
                          'Close it instead - that stops new work coming in and '
                          'keeps the marks already given.',
            })
        # The noticeboard post outlives the assignment otherwise, advertising
        # something no longer there and linking to a page that 404s.
        if instance.announcement_id:
            from apps.announcements.models import Announcement
            Announcement.objects.filter(pk=instance.announcement_id).delete()
        instance.delete()

    @action(detail=True, methods=['post'])
    def release(self, request, pk=None):
        """
        POST /imboni/teacher/assignments/<id>/release/ — publish held marks.

        The other half of release_marks_immediately=False: mark the whole class
        in your own time, then let everyone see their result at once. Without
        this there was no return step at all - a score became visible to the
        student and their parents the instant it was typed.
        """
        assignment = self.get_object()
        pending = AssignmentSubmission.objects.filter(
            assignment=assignment, is_graded=True, released_at__isnull=True,
        ).select_related('student__user')

        graded = [(sub.student, float(sub.score)) for sub in pending if sub.student]
        count = pending.update(released_at=timezone.now())

        if graded:
            _notify_graded(assignment, graded, assignment.max_score)
            _record_assessments(assignment, graded, assignment.max_score)

        return Response({'released': count})

    @action(detail=True, methods=['get'])
    def stats(self, request, pk=None):
        """
        GET /imboni/teacher/assignments/<id>/stats/ — how the class did.

        A teacher could see every individual mark and no summary at all: no
        average, no spread, and for a quiz no sense of which question the class
        actually struggled with, even though every graded answer is stored.
        """
        assignment = self.get_object()
        subs = [s for s in AssignmentSubmission.objects.filter(assignment=assignment)
                if s.is_submitted]
        marked = [s for s in subs if s.is_graded]

        from apps.teacher.models import ClassAssignment

        term = _current_term()
        total_students = ClassAssignment.objects.filter(
            class_obj=assignment.class_obj, term=term).count() if term else 0

        scores = sorted(float(s.score) for s in marked)
        percentages = [float(s.percentage) for s in marked]

        def median(values):
            if not values:
                return None
            mid = len(values) // 2
            return values[mid] if len(values) % 2 else (values[mid - 1] + values[mid]) / 2

        # Bands rather than raw scores: the shape of the class is the point,
        # and it stays comparable between a paper out of 20 and one out of 100.
        bands = [('0-39', 0, 40), ('40-54', 40, 55), ('55-69', 55, 70),
                 ('70-84', 70, 85), ('85-100', 85, 101)]
        distribution = [
            {'label': label, 'count': sum(1 for p in percentages if lo <= p < hi)}
            for label, lo, hi in bands
        ]

        return Response({
            'assignment_id':  str(assignment.id),
            'title':          assignment.title,
            'max_score':      assignment.max_score,
            'total_students': total_students,
            'submitted':      len(subs),
            'marked':         len(marked),
            'late':           sum(1 for s in subs if s.is_late),
            'not_submitted':  max(total_students - len(subs), 0),
            'average':        round(sum(percentages) / len(percentages), 1) if percentages else None,
            'median':         median(scores),
            'highest':        scores[-1] if scores else None,
            'lowest':         scores[0] if scores else None,
            'pass_rate':      round(sum(1 for p in percentages if p >= 50) / len(percentages) * 100, 1)
                              if percentages else None,
            'distribution':   distribution,
            'questions':      _question_stats(assignment, marked),
        })

    def _notify_class(self, assignment):
        """
        Tell the class an assignment has been published.

        Two things happen, because they reach different places. The
        announcement puts it on the noticeboard, where it stays and can be
        read back later. The notification puts it in the bell, where it is
        seen today - which is what matters for something with a due date.
        Publishing used to do only the first, so a new assignment was quieter
        than an absence mark.
        """
        self._announce(assignment)
        self._notify_students(assignment)

    def _notify_students(self, assignment):
        from apps.student.models import Student
        from apps.teacher.models import ClassAssignment
        from apps.notifications.services import notify_users

        term = _current_term()
        students = Student.objects.filter(
            id__in=ClassAssignment.objects
                .filter(class_obj=assignment.class_obj, term=term)
                .values_list('student_id', flat=True),
        ).select_related('user')

        users = [s.user for s in students if s.user_id]
        if not users:
            return

        path = (f'/student/quiz/{assignment.id}' if assignment.mode == 'online'
                else '/student/assignments')
        try:
            notify_users(
                users,
                f'New assignment: {assignment.title}',
                f'{assignment.subject.name} - due {assignment.due_date}.',
                'assignment',
                path,
            )
        except Exception:
            # The assignment is published either way; the nudge is not worth
            # failing the request over.
            logger.warning('Could not notify class of assignment %s',
                           assignment.pk, exc_info=True)

    def _announce(self, assignment):
        from apps.announcements.models import Announcement
        class_name = assignment.class_obj.name
        content = (
            f"A new assignment has been published for {class_name}.\n"
            f"Subject: {assignment.subject.name}\n"
            f"Due date: {assignment.due_date}\n"
            f"Max score: {assignment.max_score}"
        )
        if assignment.instructions:
            content += f"\n\nInstructions: {assignment.instructions}"
        # Updated in place on a re-publish rather than posted again: active →
        # draft → active used to leave a second identical notice on the board.
        fields = dict(
            title          = f"New Assignment: {assignment.title}",
            content        = content,
            category       = 'academic',
            target_audience= 'grade_specific',
            target_grade   = class_name,
            author         = assignment.teacher,
            status         = 'published',
            published_at   = timezone.now(),
        )
        if assignment.announcement_id:
            Announcement.objects.filter(pk=assignment.announcement_id).update(**fields)
        else:
            assignment.announcement = Announcement.objects.create(**fields)
            assignment.save(update_fields=['announcement'])


# ---------------------------------------------------------------------------
# Auto-grade helper
# ---------------------------------------------------------------------------

def _auto_grade(assignment, answers_submitted):
    """
    Grade MCQ and True/False automatically. Short-answer and fill-blank use
    case-insensitive string matching (teacher can override later).
    Returns (graded_answers list, score, max_score).
    """
    questions  = assignment.questions or []
    total      = 0
    max_total  = 0
    graded     = []

    for q in questions:
        qid    = str(q.get('id', ''))
        points = int(q.get('points', 1))
        qtype  = q.get('type', 'mcq')
        correct = q.get('correct')
        max_total += points

        student_answer = next(
            (a.get('answer') for a in answers_submitted if str(a.get('question_id', '')) == qid),
            None,
        )

        is_correct   = False
        points_earned = 0

        if student_answer is not None:
            if qtype in ('mcq', 'true_false'):
                try:
                    is_correct = int(student_answer) == int(correct)
                except (TypeError, ValueError):
                    is_correct = False
            elif qtype in ('short_answer', 'fill_blank'):
                is_correct = (
                    str(student_answer).strip().lower() == str(correct).strip().lower()
                    if correct is not None else False
                )

        if is_correct:
            points_earned = points
            total += points

        graded.append({
            'question_id':   qid,
            'answer':        student_answer,
            'correct_answer': correct,
            'is_correct':    is_correct,
            'points_earned': points_earned,
            'max_points':    points,
        })

    return graded, total, max_total


# ---------------------------------------------------------------------------
# Quiz submission (student submits answers)
# ---------------------------------------------------------------------------

class QuizSubmissionViewSet(viewsets.ViewSet):
    """
    POST /imboni/quiz/<assignment_id>/submit/  — student submits answers
    GET  /imboni/quiz/<assignment_id>/         — student fetches questions (no correct answers)
    GET  /imboni/teacher/assignments/<id>/submissions/ — teacher views all submissions
    """
    permission_classes = [IsAuthenticated]

    def list(self, request):
        """GET /imboni/quiz/ — list all available active online quizzes for the logged-in student."""
        from apps.teacher.models import ClassAssignment
        data = []
        try:
            student = request.user.student_profile
            term    = _current_term()
            class_ids = list(
                ClassAssignment.objects
                .filter(student=student, term=term)
                .values_list('class_obj_id', flat=True)
            )
            quizzes = (
                Assignment.objects
                .filter(class_obj_id__in=class_ids, mode='online', status='active')
                .select_related('subject', 'class_obj')
            )
            for q in quizzes:
                sub = AssignmentSubmission.objects.filter(assignment=q, student=student).first()
                data.append({
                    'id':                 str(q.id),
                    'title':              q.title,
                    'subject_name':       q.subject.name,
                    'class_name':         q.class_obj.name,
                    'due_date':           q.due_date,
                    'max_score':          q.max_score,
                    'question_count':     len(q.questions or []),
                    'time_limit_minutes': q.time_limit_minutes,
                    'submitted':          sub is not None,
                    'score':              float(sub.score)      if sub else None,
                    'percentage':         float(sub.percentage) if sub else None,
                })
        except Exception:
            pass
        return Response(data)

    def retrieve(self, request, pk=None):
        """Return quiz questions without revealing correct answers."""
        import random
        try:
            assignment = Assignment.objects.select_related('subject', 'class_obj').get(
                pk=pk, mode='online', status='active'
            )
        except Assignment.DoesNotExist:
            return Response({'detail': 'Quiz not found or not published.'}, status=404)

        # The clock starts on the server, not in the browser. Without a start
        # recorded here the time limit was a countdown the client could simply
        # not run - close the tab, or POST straight to submit, and it never
        # applied. Only the first open counts: re-fetching must not buy time.
        student = getattr(request.user, 'student_profile', None)
        if student is not None:
            AssignmentSubmission.objects.get_or_create(
                assignment=assignment, student=student,
                defaults={
                    'student_name': student.full_name,
                    'student_code': student.student_id,
                    'max_score':    assignment.max_score,
                    'started_at':   timezone.now(),
                    'is_graded':    False,
                },
            )

        questions = [
            {k: v for k, v in q.items() if k not in ('correct', 'correct_answer')}
            for q in (assignment.questions or [])
        ]
        if assignment.shuffle_questions:
            random.shuffle(questions)

        return Response({
            'id':                 str(assignment.id),
            'title':              assignment.title,
            'instructions':       assignment.instructions,
            'subject_name':       assignment.subject.name,
            'class_name':         assignment.class_obj.name,
            'due_date':           assignment.due_date,
            'max_score':          assignment.max_score,
            'time_limit_minutes': assignment.time_limit_minutes,
            'questions':          questions,
            'question_count':     len(questions),
        })

    def review(self, request, pk=None):
        """
        GET /imboni/quiz/<pk>/review/

        After submitting, a student can revisit the quiz to see their own
        answers next to the correct answers and explanations. Only available
        to the student who submitted; questions keep their original order.
        """
        try:
            assignment = Assignment.objects.select_related('subject', 'class_obj').get(
                pk=pk, mode='online'
            )
        except Assignment.DoesNotExist:
            return Response({'detail': 'Quiz not found.'}, status=404)

        try:
            student = request.user.student_profile
        except Exception:
            return Response({'detail': 'Only students can review their submissions.'}, status=403)

        submission = AssignmentSubmission.objects.filter(assignment=assignment, student=student).first()
        if not submission:
            return Response({'detail': 'You have not submitted this quiz yet.'}, status=404)

        answers_by_qid = {str(a.get('question_id')): a for a in (submission.answers or [])}
        questions = []
        for q in (assignment.questions or []):
            qid = str(q.get('id'))
            ans = answers_by_qid.get(qid, {})
            questions.append({
                'id':            qid,
                'type':          q.get('type'),
                'text':          q.get('text'),
                'options':       q.get('options', []),
                'image':         q.get('image', ''),
                'points':        q.get('points', 1),
                'correct':       q.get('correct'),
                'explanation':   q.get('explanation', ''),
                'your_answer':   ans.get('answer'),
                'is_correct':    ans.get('is_correct'),
                'points_earned': ans.get('points_earned'),
            })

        return Response({
            'id':           str(assignment.id),
            'title':        assignment.title,
            'subject_name': assignment.subject.name,
            'class_name':   assignment.class_obj.name,
            'due_date':     assignment.due_date,
            'score':        float(submission.score),
            'max_score':    submission.max_score,
            'percentage':   float(submission.percentage),
            'is_late':      submission.is_late,
            'submitted_at': submission.submitted_at.isoformat(),
            'questions':    questions,
        })

    def submit(self, request, pk=None):
        """Accept student answers, auto-grade, save submission."""
        from django.utils import timezone as tz

        try:
            assignment = Assignment.objects.get(pk=pk, mode='online', status='active')
        except Assignment.DoesNotExist:
            return Response({'detail': 'Quiz not found or not published.'}, status=404)

        serializer = QuizSubmitSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        answers = serializer.validated_data['answers']
        graded, score, max_score = _auto_grade(assignment, answers)

        pct = round(score / max_score * 100, 1) if max_score else 0
        is_late = date.today() > assignment.due_date

        # Resolve student record
        student = None
        student_name = ''
        student_code = ''
        try:
            student = request.user.student_profile
            student_name = student.full_name
            student_code = student.student_id
        except Exception:
            student_name = request.user.get_full_name() or request.user.username

        # `retrieve` leaves an un-submitted row behind holding the start time,
        # so an existing row is not by itself a completed attempt.
        existing = AssignmentSubmission.objects.filter(
            assignment=assignment, student=student).first()
        attempts_used = existing.attempt_count if (existing and existing.answers) else 0

        # Attempts are capped. update_or_create alone silently overwrote the
        # previous try, and the review screen hands back the correct answers
        # and explanations - so sit the quiz, read the review, sit it again for
        # full marks. The paper path always refused a second hand-in.
        if attempts_used >= (assignment.max_attempts or 1):
            return Response(
                {'error': 'You have used all your attempts at this quiz.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Work handed in after the due date is refused outright when the
        # teacher has turned late submissions off.
        if is_late and not assignment.accept_late_submissions:
            return Response(
                {'error': 'The due date has passed and this assignment is not accepting late work.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # The time limit, measured against the server's own start time. A small
        # grace covers the round trip and a slow last click - the point is to
        # stop someone sitting the paper all evening, not to punish a few
        # seconds of latency.
        started_at = existing.started_at if existing else None
        elapsed = int((timezone.now() - started_at).total_seconds()) if started_at else 0
        if assignment.time_limit_minutes and started_at:
            allowed = assignment.time_limit_minutes * 60 + 30
            if elapsed > allowed:
                return Response(
                    {'error': 'Your time for this quiz has run out.',
                     'time_limit_minutes': assignment.time_limit_minutes},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        submission, _ = AssignmentSubmission.objects.update_or_create(
            assignment=assignment,
            student=student,
            defaults={
                'student_name': student_name,
                'student_code': student_code,
                'answers':      graded,
                'score':        score,
                'max_score':    max_score,
                'percentage':   pct,
                'is_graded':    True,
                'is_late':      is_late,
                'attempt_count': attempts_used + 1,
                'time_spent_seconds': elapsed,
                'started_at':   started_at,
                # An auto-marked quiz is released as it is marked unless the
                # teacher is holding the whole class back.
                'released_at':  timezone.now() if assignment.release_marks_immediately else None,
            },
        )
        if assignment.release_marks_immediately:
            _record_assessments(assignment, [(student, score)], max_score)

        return Response({
            'submitted': True,
            'score':     score,
            'max_score': max_score,
            'percentage': pct,
            'is_late':   is_late,
            'answers':   graded,
            'attempt':   attempts_used + 1,
            'attempts_allowed': assignment.max_attempts or 1,
        # 201 for a first sitting, 200 for a permitted retake. Not `created`:
        # opening the quiz already made the row to start the clock, so that
        # flag now says whether the paper was fetched, not whether it was sat.
        }, status=201 if attempts_used == 0 else 200)


class AssignmentSubmissionsView(APIView):
    """
    GET /imboni/teacher/assignments/<pk>/submissions/ — the teacher's own
    submissions for one assignment.

    Scoped to the assignment's owner. It used to filter on the assignment id
    alone, so any authenticated teacher holding a UUID could read another
    teacher's class list - student names, student codes, marks and all. Every
    sibling endpoint scopes this way (AssignmentViewSet.get_queryset,
    PaperAssignmentGradeView); this one did not.
    """
    permission_classes = [IsTeacher]

    def get(self, request, pk):
        if not Assignment.objects.filter(pk=pk, teacher=request.user).exists():
            # 404 rather than 403: a teacher has no business learning whether
            # another teacher's assignment id exists.
            return Response({'detail': 'Assignment not found.'}, status=404)

        subs = (AssignmentSubmission.objects
                .filter(assignment_id=pk)
                .select_related('student__user'))
        return Response(AssignmentSubmissionSerializer(subs, many=True).data)


def _question_stats(assignment, marked):
    """
    Per-question performance for an online quiz.

    Every graded submission already stores which questions each student got
    right (AssignmentSubmission.answers), so the hardest question in a paper is
    sitting in the database - it was simply never aggregated. Teaching to it is
    the whole point of setting a quiz.
    """
    if assignment.mode != 'online':
        return []

    questions = assignment.questions or []
    if not questions:
        return []

    correct = {}
    answered = {}
    for sub in marked:
        for row in (sub.answers or []):
            qid = str(row.get('question_id', ''))
            answered[qid] = answered.get(qid, 0) + 1
            if row.get('is_correct'):
                correct[qid] = correct.get(qid, 0) + 1

    out = []
    for index, q in enumerate(questions, start=1):
        qid = str(q.get('id', ''))
        seen = answered.get(qid, 0)
        got = correct.get(qid, 0)
        out.append({
            'question_id':    qid,
            'number':         index,
            'text':           q.get('text', ''),
            'type':           q.get('type', 'mcq'),
            'points':         q.get('points', 1),
            'answered':       seen,
            'correct':        got,
            'percent_correct': round(got / seen * 100, 1) if seen else None,
        })
    return out


def _notify_graded(assignment, graded, max_score):
    """
    Tell each student their work has been marked, and their parents with
    them.

    Marking used to be silent: the score landed in the database and the
    student found out only if they went looking. A parent had no way to
    find out at all.

    Notifications are per student rather than one broadcast because each
    one carries that student's own mark, and are best-effort - a mark that
    saved must not be rolled back because a message failed to send.
    """
    if not graded:
        return
    from apps.notifications.services import notify_user, notify_parents_of

    for student, score in graded:
        body = f'{assignment.title}: {score:g}/{max_score}.'
        try:
            if student.user_id:
                notify_user(
                    student.user, 'Assignment marked', body,
                    'assignment', '/student/assignments',
                )
            notify_parents_of(
                student,
                f'{student.full_name} - assignment marked',
                body, 'assignment', '/parent/assignments',
            )
        except Exception:
            logger.warning('Could not notify about grade for %s', student.pk,
                           exc_info=True)


def _record_assessments(assignment, graded, max_score):
    """
    Mirror assignment marks into the gradebook as continuous assessment.

    Assignment marks used to live only on the assignment. Nothing carried them
    into apps.results, so the term report's continuous-assessment component was
    typed in by hand from marks the system already held, and the teacher's own
    "homework submission" dashboard widget - which counts Assessment rows - was
    blind to every assignment actually set.

    One Assessment row per student per assignment, keyed on the assignment's
    title so re-marking updates rather than duplicates. Best-effort: a mark that
    saved must not be lost because the mirror failed.
    """
    from apps.results.models import Assessment

    term = _current_term()
    if not term or not graded:
        return

    kind = 'quiz' if assignment.mode == 'online' else 'homework'
    for student, score in graded:
        try:
            Assessment.objects.update_or_create(
                student=student,
                subject=assignment.subject,
                term=term,
                title=assignment.title,
                defaults={
                    'assessment_type': kind,
                    'date':            assignment.due_date,
                    'max_score':       max_score,
                    'score_obtained':  score,
                    # Assessment.save recomputes this, but it is non-null in the
                    # schema so it has to be given something on insert.
                    'percentage':      (score / max_score * 100) if max_score else 0,
                },
            )
        except Exception:
            logger.warning('Could not mirror assignment %s to the gradebook for %s',
                           assignment.pk, student.pk, exc_info=True)


class QuizSubmissionReviewView(APIView):
    """
    Read and correct one student's quiz.

    GET   /imboni/teacher/submissions/<pk>/   — the answers, with the marking
    PATCH /imboni/teacher/submissions/<pk>/   — override marks and add feedback
          Body: { answers: [{question_id, is_correct, points_earned}], feedback }

    Short-answer and fill-blank questions are auto-marked by exact string
    match, so "8 cm" against a stored "8cm" is wrong. The code that does it
    said the teacher could override later; nothing implemented that. There was
    no endpoint, and no screen in the product showed what a student had even
    written - so a wrong auto-mark was permanent.
    """
    permission_classes = [IsTeacher]

    def _get(self, request, pk):
        return (AssignmentSubmission.objects
                .filter(pk=pk, assignment__teacher=request.user)
                .select_related('assignment', 'student__user')
                .first())

    def get(self, request, pk):
        sub = self._get(request, pk)
        if not sub:
            return Response({'detail': 'Submission not found.'}, status=404)
        return Response(self._payload(sub))

    def patch(self, request, pk):
        sub = self._get(request, pk)
        if not sub:
            return Response({'detail': 'Submission not found.'}, status=404)

        overrides = {
            str(row.get('question_id')): row
            for row in request.data.get('answers', [])
            if row.get('question_id') is not None
        }

        answers = sub.answers or []
        for row in answers:
            override = overrides.get(str(row.get('question_id')))
            if not override:
                continue
            if 'is_correct' in override:
                row['is_correct'] = bool(override['is_correct'])
            if 'points_earned' in override:
                try:
                    earned = float(override['points_earned'])
                except (TypeError, ValueError):
                    return Response({'detail': 'points_earned must be a number.'}, status=400)
                cap = float(row.get('max_points', 0) or 0)
                if earned < 0 or (cap and earned > cap):
                    return Response(
                        {'detail': f"points_earned must be between 0 and {cap:g}."}, status=400)
                row['points_earned'] = earned
            elif 'is_correct' in override:
                # Marking an answer right without saying what it is worth gives
                # it the full marks for that question, which is the ordinary case.
                row['points_earned'] = row.get('max_points', 0) if row['is_correct'] else 0
            row['overridden'] = True

        score = sum(float(r.get('points_earned', 0) or 0) for r in answers)
        max_score = sub.max_score or sum(float(r.get('max_points', 0) or 0) for r in answers)

        sub.answers = answers
        sub.score = score
        sub.max_score = max_score
        sub.percentage = round(score / max_score * 100, 2) if max_score else 0
        if 'feedback' in request.data:
            sub.feedback = request.data.get('feedback') or ''
        sub.is_graded = True
        sub.save(update_fields=['answers', 'score', 'max_score', 'percentage',
                                'feedback', 'is_graded'])

        # A corrected mark has to reach the gradebook too, or the report card
        # keeps the auto-marked one.
        if sub.released_at and sub.student:
            _record_assessments(sub.assignment, [(sub.student, score)], max_score)

        return Response(self._payload(sub))

    def _payload(self, sub):
        return {
            'id':           str(sub.id),
            'student_name': sub.student_name,
            'student_code': sub.student_code,
            'score':        float(sub.score),
            'max_score':    sub.max_score,
            'percentage':   float(sub.percentage),
            'is_late':      sub.is_late,
            'feedback':     sub.feedback,
            'released':     sub.released_at is not None,
            'time_spent_seconds': sub.time_spent_seconds,
            'answers':      sub.answers or [],
            # The correct answer and the explanation, so a teacher checking an
            # auto-mark can see what it was compared against.
            'questions':    sub.assignment.questions or [],
        }


class PaperAssignmentGradeView(APIView):
    """
    Grading queue for paper-mode assignments.

    GET  /imboni/teacher/assignments/<pk>/grade/
         Class roster with any scores already entered.
    POST /imboni/teacher/assignments/<pk>/grade/
         Body: { records: [ { student_id, score }, ... ] }
         Upserts a graded submission per student.
    """
    permission_classes = [IsTeacher]

    def _get_assignment(self, request, pk):
        try:
            assignment = Assignment.objects.select_related('class_obj').get(
                pk=pk, teacher=request.user, mode='paper'
            )
        except Assignment.DoesNotExist:
            return None
        return assignment

    def get(self, request, pk):
        from apps.teacher.models import ClassAssignment

        assignment = self._get_assignment(request, pk)
        if not assignment:
            return Response({'detail': 'Paper assignment not found.'}, status=404)

        term = _current_term()
        roster = (
            ClassAssignment.objects
            .filter(class_obj=assignment.class_obj, term=term)
            .select_related('student__user')
            .order_by('student__user__last_name')
        )
        existing = {
            sub.student_id: sub for sub in
            AssignmentSubmission.objects.filter(assignment=assignment)
        }

        return Response({
            'assignment_id': str(assignment.id),
            'title':         assignment.title,
            'max_score':     assignment.max_score,
            'class_name':    assignment.class_obj.name,
            'students': [
                {
                    'student_id':   str(ca.student.id),
                    'full_name':    ca.student.full_name,
                    'student_code': ca.student.student_id,
                    'score':        float(existing[ca.student.id].score) if ca.student.id in existing else None,
                    'feedback':     existing[ca.student.id].feedback if ca.student.id in existing else '',
                }
                for ca in roster
            ],
        })

    def post(self, request, pk):
        assignment = self._get_assignment(request, pk)
        if not assignment:
            return Response({'detail': 'Paper assignment not found.'}, status=404)

        records = request.data.get('records', [])
        if not isinstance(records, list) or not records:
            return Response({'detail': 'records list is required.'}, status=400)

        from apps.student.models import Student
        max_score = assignment.max_score or 0
        saved = 0
        errors = []
        graded = []      # (student, score) pairs to notify once all are saved
        for rec in records:
            sid = rec.get('student_id')
            raw = rec.get('score')
            feedback = (rec.get('feedback') or '').strip()
            if raw in (None, ''):
                continue
            try:
                score = float(raw)
            except (TypeError, ValueError):
                errors.append({'student_id': sid, 'error': 'Score must be a number.'})
                continue
            if score < 0 or (max_score and score > max_score):
                errors.append({'student_id': sid, 'error': f'Score must be between 0 and {max_score}.'})
                continue
            student = Student.objects.filter(pk=sid).select_related('user').first()
            if not student:
                errors.append({'student_id': sid, 'error': 'Student not found.'})
                continue

            pct = round(score / max_score * 100, 1) if max_score else 0
            released = timezone.now() if assignment.release_marks_immediately else None
            _, created = AssignmentSubmission.objects.update_or_create(
                assignment=assignment,
                student=student,
                defaults={
                    'student_name': student.full_name,
                    'student_code': student.student_id,
                    'score':        score,
                    'max_score':    max_score,
                    'percentage':   pct,
                    'is_graded':    True,
                    'feedback':     feedback,
                    'released_at':  released,
                },
            )
            graded.append((student, score))
            saved += 1

        if assignment.release_marks_immediately:
            _notify_graded(assignment, graded, max_score)
        # Marks entered under a hold are announced by the release step instead -
        # telling a student their work is marked while withholding the mark
        # would be worse than saying nothing.

        # Assignment marks are part of continuous assessment, so they belong in
        # the gradebook, not only on this page. See _record_assessments.
        _record_assessments(assignment, graded, max_score)

        return Response({'saved': saved, 'errors': errors,
                         'released': assignment.release_marks_immediately})



# ---------------------------------------------------------------------------
# Question Bank CRUD (teacher only)
# ---------------------------------------------------------------------------

class QuestionBankViewSet(viewsets.ModelViewSet):
    """
    GET    /imboni/teacher/question-bank/       — own questions + questions
             shared by other teachers (?scope=mine|shared to narrow)
    POST   /imboni/teacher/question-bank/       — save a question
    PATCH  /imboni/teacher/question-bank/<id>/  — update (own only)
    DELETE /imboni/teacher/question-bank/<id>/  — delete (own only)
    """
    permission_classes   = [IsTeacher]
    serializer_class     = QuestionBankSerializer
    # The QuestionBankModal consumes a plain array; global PageNumberPagination
    # would wrap it in {results: []} and the bank would always render empty.
    pagination_class     = None

    def get_queryset(self):
        from django.db.models import Q
        scope = self.request.query_params.get('scope', '').strip()
        if scope == 'mine':
            qs = QuestionBank.objects.filter(teacher=self.request.user)
        elif scope == 'shared':
            qs = QuestionBank.objects.filter(is_shared=True).exclude(teacher=self.request.user)
        else:
            qs = QuestionBank.objects.filter(
                Q(teacher=self.request.user) | Q(is_shared=True)
            )
        q  = self.request.query_params.get('q', '').strip()
        t  = self.request.query_params.get('type', '').strip()
        if q:
            qs = qs.filter(text__icontains=q)
        if t:
            qs = qs.filter(question_type=t)
        return qs.select_related('teacher', 'subject')

    def perform_create(self, serializer):
        serializer.save(teacher=self.request.user)

    def perform_update(self, serializer):
        if serializer.instance.teacher_id != self.request.user.id:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('You can only edit your own questions.')
        serializer.save()

    def perform_destroy(self, instance):
        if instance.teacher_id != self.request.user.id:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('You can only delete your own questions.')
        instance.delete()
