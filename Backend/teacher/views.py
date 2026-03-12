from datetime import date, timedelta
from django.db.models import Avg, Count, Max, Q
from django.utils import timezone
from rest_framework import generics, viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from authentication.models import User
from authentication.permissions import IsTeacher
from results.models import AcademicTerm
from .models import Timetable, Task, Reminder
from .serializers import (
    TeacherSerializer, TimetableSerializer, ScheduleItemSerializer,
    MyClassSerializer, HomeworkStatusSerializer, TaskSerializer, ReminderSerializer,
    ClassPerformanceSerializer, ActivitySerializer,
    TeacherStudentSerializer, PerformanceDistributionSerializer, AttendanceTrendSerializer,
    TeacherAttendanceStudentSerializer, MarkAttendanceSerializer, AttendancePatternSerializer,
    TeacherResultEntrySerializer, BulkSaveResultsSerializer,
    GradeDistributionSerializer, PerformanceTrendSerializer,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_teacher(request):
    """Return the logged-in user, falling back to first teacher for dev."""
    if request.user.is_authenticated:
        return request.user
    return User.objects.filter(role='teacher').first()


def _current_term():
    return AcademicTerm.objects.filter(is_current=True).first()


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
        from teacher.models import Class, SubjectTeacherAssignment, ClassAssignment
        class_ids = SubjectTeacherAssignment.objects.filter(
            teacher=teacher, term=term
        ).values_list('class_obj_id', flat=True).distinct() if term else []

        # ── Overall attendance across teacher's classes ──────────────────
        from attendance.models import AttendanceSummary
        att_qs = AttendanceSummary.objects.filter(
            student__class_assignments__class_obj_id__in=class_ids,
            student__class_assignments__term=term,
        ) if term else AttendanceSummary.objects.none()
        att_agg = att_qs.aggregate(
            total=Count('id'), present=Count('present_days')
        )
        # Compute a simple average of attendance_percentage
        avg_att = att_qs.aggregate(avg=Avg('attendance_percentage'))['avg'] or 0

        # ── Class average (results) ──────────────────────────────────────
        from results.models import Result
        result_avg = Result.objects.filter(
            teacher=teacher, term=term
        ).aggregate(avg=Avg('final_score'))['avg'] or 0

        # ── Pending grading (draft results this teacher submitted) ───────
        pending_grading = Result.objects.filter(
            teacher=teacher, status='draft'
        ).count()

        # ── Messages ─────────────────────────────────────────────────────
        from messages.models import Message, Conversation
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
        from teacher.models import SubjectTeacherAssignment, ClassAssignment
        from results.models import Result

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

        # ── Grade range filter ───────────────────────────────────────────
        grade_filter = request.query_params.get('grade_filter', '')
        if grade_filter == '1-2':
            assignments = assignments.filter(class_obj__grade__in=['1', '2'])
        elif grade_filter == '3-4':
            assignments = assignments.filter(class_obj__grade__in=['3', '4'])

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
                'subject_name':  sta.subject.name,
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
        from teacher.models import SubjectTeacherAssignment, ClassAssignment
        from results.models import Assessment

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
    GET    /imboni/teacher/tasks/       — list pending tasks
    POST   /imboni/teacher/tasks/       — create task
    PATCH  /imboni/teacher/tasks/<id>/  — update (mark complete, change priority)
    DELETE /imboni/teacher/tasks/<id>/  — delete task
    """
    serializer_class = TaskSerializer
    permission_classes = [IsTeacher]

    def get_queryset(self):
        teacher = _get_teacher(self.request)
        return Task.objects.filter(teacher=teacher)

    def perform_create(self, serializer):
        serializer.save(teacher=_get_teacher(self.request))


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
        from teacher.models import SubjectTeacherAssignment, ClassAssignment
        from results.models import Result
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
        from results.models import Result
        from attendance.models import AttendanceRecord
        from behavior.models import BehaviorReport

        teacher = _get_teacher(request)
        activities = []

        # Recent results submitted by this teacher
        for r in Result.objects.filter(teacher=teacher).select_related('subject', 'student__user').order_by('-updated_at')[:5]:
            activities.append({
                'activity_type': 'result',
                'description':   f"Submitted results — {r.student.full_name} ({r.subject.name})",
                'timestamp':     r.updated_at,
            })

        # Recent attendance marked by this teacher
        for a in AttendanceRecord.objects.filter(marked_by=teacher).select_related('student__user').order_by('-created_at')[:5]:
            activities.append({
                'activity_type': 'attendance',
                'description':   f"Marked attendance — {a.student.full_name} ({a.status})",
                'timestamp':     a.created_at,
            })

        # Recent behaviour reports submitted by this teacher
        for b in BehaviorReport.objects.filter(reported_by=teacher).select_related('student__user').order_by('-created_at')[:5]:
            activities.append({
                'activity_type': 'incident',
                'description':   f"Reported incident — Student: {b.student.full_name}",
                'timestamp':     b.created_at,
            })

        # Sort unified list by timestamp, return top 10
        activities.sort(key=lambda x: x['timestamp'], reverse=True)
        serializer = ActivitySerializer(activities[:10], many=True)
        return Response(serializer.data)


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
        from teacher.models import SubjectTeacherAssignment, ClassAssignment
        from results.models import Result
        from attendance.models import AttendanceSummary

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

            # Attendance rate
            att_obj = AttendanceSummary.objects.filter(student=student, term=term).first()
            attendance_rate = round(float(att_obj.attendance_percentage), 1) if att_obj else None

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
        from teacher.models import SubjectTeacherAssignment, ClassAssignment
        from results.models import Result

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
        from teacher.models import SubjectTeacherAssignment, ClassAssignment
        from attendance.models import AttendanceRecord

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
        from teacher.models import ClassAssignment
        from attendance.models import AttendanceRecord

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
        from teacher.models import ClassAssignment
        from attendance.models import AttendanceRecord

        class_id = request.query_params.get('class_id', '').strip()
        date_str = request.query_params.get('date', '').strip()

        try:
            target_date = date.fromisoformat(date_str) if date_str else timezone.localtime().date()
        except ValueError:
            target_date = timezone.localtime().date()

        term = _current_term()

        if not class_id or not term:
            return Response([])

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
        from attendance.models import AttendanceRecord

        serializer = MarkAttendanceSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        teacher    = _get_teacher(request)
        target_date = serializer.validated_data['date']
        records    = serializer.validated_data['records']

        saved = 0
        for rec in records:
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
        from teacher.models import ClassAssignment
        from attendance.models import AttendanceRecord

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
        from teacher.models import ClassAssignment
        from results.models import Assessment

        class_id         = request.query_params.get('class_id', '').strip()
        assessment_title = request.query_params.get('assessment_title', '').strip()
        term             = _current_term()

        if not class_id or not term:
            return Response({'assessment_titles': [], 'results': []})

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
        from results.models import Assessment, Subject, AcademicTerm

        serializer = BulkSaveResultsSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        d = serializer.validated_data
        term = _current_term()
        if not term:
            return Response({'error': 'No current term found.'}, status=status.HTTP_400_BAD_REQUEST)

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
        from teacher.models import ClassAssignment, Class
        from results.models import Assessment

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
        from teacher.models import ClassAssignment
        from results.models import Assessment
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
