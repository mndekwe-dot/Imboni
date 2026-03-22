from datetime import date

from django.db.models import Avg
from rest_framework import generics
from rest_framework.response import Response
from rest_framework.views import APIView
from authentication.permissions import IsStudent

from .models import Activity, ActivityEnrollment, ActivityEvent, Assignment, AssignmentSubmission
from .serializers import (
    ActivitySerializer,
    ActivityEnrollmentSerializer,
    ActivityEventSerializer,
    AssignmentWithStatusSerializer,
    AssignmentSubmissionSerializer,
)


def _get_student(request):
    """Return the Student profile linked to the logged-in user, or None."""
    try:
        return request.user.student_profile
    except Exception:
        return None


# ─────────────────────────────────────────────
# Dashboard
# ─────────────────────────────────────────────

class StudentDashboardView(APIView):
    """
    Main dashboard cards + today's schedule + upcoming assignments + recent grades.

    GET /imboni/student/dashboard/
    """
    permission_classes = [IsStudent]
    def get(self, request):
        student = _get_student(request)
        if not student:
            return Response({'error': 'Student profile not found.'}, status=404)

        from results.models import AcademicTerm, Result
        from behavior.models import ConductGrade
        from teacher.models import ClassAssignment, Timetable

        today = date.today()
        current_term = AcademicTerm.objects.filter(is_current=True).first()

        # ── Stat cards ──────────────────────────────────────────────────
        attendance_pct = float(student.attendance_percentage)

        conduct_grade = 'N/A'
        if current_term:
            cg = ConductGrade.objects.filter(student=student, term=current_term).first()
            if cg:
                conduct_grade = cg.grade

        pending_assignments = 0
        student_class_assignment = None
        if current_term:
            student_class_assignment = (
                ClassAssignment.objects
                .filter(student=student, term=current_term)
                .select_related('class_obj')
                .first()
            )
            if student_class_assignment:
                total = Assignment.objects.filter(
                    class_obj=student_class_assignment.class_obj,
                    term=current_term,
                    due_date__gte=today,
                ).count()
                submitted = AssignmentSubmission.objects.filter(
                    student=student,
                    assignment__class_obj=student_class_assignment.class_obj,
                    assignment__term=current_term,
                ).count()
                pending_assignments = max(total - submitted, 0)

        recent_grade = 'N/A'
        latest_result = (
            Result.objects
            .filter(student=student, status='approved')
            .order_by('-created_at')
            .first()
        )
        if latest_result:
            recent_grade = latest_result.grade

        # ── Today's schedule ────────────────────────────────────────────
        day_map = {0: 'monday', 1: 'tuesday', 2: 'wednesday',
                   3: 'thursday', 4: 'friday', 5: 'saturday', 6: 'sunday'}
        today_day = day_map[today.weekday()]
        today_schedule = []

        if current_term and student_class_assignment:
            periods = (
                Timetable.objects
                .filter(
                    class_obj=student_class_assignment.class_obj,
                    day=today_day,
                    term=current_term,
                )
                .select_related('subject', 'teacher')
                .order_by('start_time')
            )
            for p in periods:
                today_schedule.append({
                    'subject': p.subject.name,
                    'teacher': p.teacher.get_full_name() if p.teacher else '',
                    'start_time': str(p.start_time),
                    'end_time': str(p.end_time),
                    'room': p.room_number,
                })

        # ── Upcoming assignments (next 5) ───────────────────────────────
        upcoming_list = []
        if current_term and student_class_assignment:
            upcoming = (
                Assignment.objects
                .filter(
                    class_obj=student_class_assignment.class_obj,
                    term=current_term,
                    due_date__gte=today,
                )
                .select_related('subject')
                .order_by('due_date')[:5]
            )
            # Pre-fetch all submissions in one query instead of one per assignment
            subs_map = {
                s.assignment_id: s
                for s in AssignmentSubmission.objects.filter(
                    student=student, assignment__in=upcoming
                )
            }
            for a in upcoming:
                sub = subs_map.get(a.id)
                upcoming_list.append({
                    'id': str(a.id),
                    'title': a.title,
                    'subject': a.subject.name,
                    'due_date': str(a.due_date),
                    'status': sub.status if sub else 'pending',
                })

        # ── Recent grades (last 5 approved results) ─────────────────────
        recent_grades = []
        results = (
            Result.objects
            .filter(student=student, status='approved')
            .select_related('subject', 'term')
            .order_by('-created_at')[:5]
        )
        for r in results:
            recent_grades.append({
                'subject': r.subject.name,
                'grade': r.grade,
                'final_score': float(r.final_score),
                'term': r.term.name,
            })

        return Response({
            'stats': {
                'attendance_percentage': attendance_pct,
                'conduct_grade': conduct_grade,
                'pending_assignments': pending_assignments,
                'recent_grade': recent_grade,
            },
            'today_schedule': today_schedule,
            'upcoming_assignments': upcoming_list,
            'recent_grades': recent_grades,
        })


# ─────────────────────────────────────────────
# Timetable
# ─────────────────────────────────────────────

class StudentTimetableView(APIView):
    """
    Full weekly timetable grouped by day.

    GET /imboni/student/timetable/
    """
    permission_classes = [IsStudent]
    def get(self, request):
        student = _get_student(request)
        if not student:
            return Response({'error': 'Student profile not found.'}, status=404)

        from results.models import AcademicTerm
        from teacher.models import ClassAssignment, Timetable

        current_term = AcademicTerm.objects.filter(is_current=True).first()
        if not current_term:
            return Response({'timetable': {}})

        student_class_assignment = (
            ClassAssignment.objects
            .filter(student=student, term=current_term)
            .select_related('class_obj')
            .first()
        )
        if not student_class_assignment:
            return Response({'timetable': {}})

        periods = (
            Timetable.objects
            .filter(class_obj=student_class_assignment.class_obj, term=current_term)
            .select_related('subject', 'teacher')
            .order_by('day', 'start_time')
        )

        timetable = {}
        for p in periods:
            day = p.day
            if day not in timetable:
                timetable[day] = []
            timetable[day].append({
                'subject': p.subject.name,
                'teacher': p.teacher.get_full_name() if p.teacher else '',
                'start_time': str(p.start_time),
                'end_time': str(p.end_time),
                'room': p.room_number,
            })

        return Response({
            'class': student_class_assignment.class_obj.name,
            'term': current_term.name,
            'timetable': timetable,
        })


class StudentTodayScheduleView(APIView):
    """
    Today's schedule only.

    GET /imboni/student/timetable/today/
    """
    permission_classes = [IsStudent]
    def get(self, request):
        student = _get_student(request)
        if not student:
            return Response({'error': 'Student profile not found.'}, status=404)

        from results.models import AcademicTerm
        from teacher.models import ClassAssignment, Timetable

        today = date.today()
        day_map = {0: 'monday', 1: 'tuesday', 2: 'wednesday',
                   3: 'thursday', 4: 'friday', 5: 'saturday', 6: 'sunday'}
        today_day = day_map[today.weekday()]

        current_term = AcademicTerm.objects.filter(is_current=True).first()
        if not current_term:
            return Response({'schedule': []})

        student_class_assignment = (
            ClassAssignment.objects
            .filter(student=student, term=current_term)
            .select_related('class_obj')
            .first()
        )
        if not student_class_assignment:
            return Response({'schedule': []})

        periods = (
            Timetable.objects
            .filter(
                class_obj=student_class_assignment.class_obj,
                day=today_day,
                term=current_term,
            )
            .select_related('subject', 'teacher')
            .order_by('start_time')
        )

        schedule = []
        from datetime import datetime
        now = datetime.now().time()
        for p in periods:
            if p.start_time <= now <= p.end_time:
                period_status = 'in_progress'
            elif p.start_time > now:
                period_status = 'upcoming'
            else:
                period_status = 'completed'

            schedule.append({
                'subject': p.subject.name,
                'teacher': p.teacher.get_full_name() if p.teacher else '',
                'start_time': str(p.start_time),
                'end_time': str(p.end_time),
                'room': p.room_number,
                'status': period_status,
            })

        return Response({'schedule': schedule, 'day': today_day})


# ─────────────────────────────────────────────
# Results
# ─────────────────────────────────────────────

class StudentResultsView(APIView):
    """
    All approved results grouped by academic term.

    GET /imboni/student/results/
    """
    permission_classes = [IsStudent]
    def get(self, request):
        student = _get_student(request)
        if not student:
            return Response({'error': 'Student profile not found.'}, status=404)

        from results.models import Result, AcademicTerm

        terms = AcademicTerm.objects.order_by('-year', '-term')
        response_data = []

        for term in terms:
            term_results = (
                Result.objects
                .filter(student=student, term=term, status='approved')
                .select_related('subject')
            )
            if not term_results.exists():
                continue

            subjects = []
            for r in term_results:
                subjects.append({
                    'subject': r.subject.name,
                    'quiz_average': float(r.quiz_average) if r.quiz_average else None,
                    'group_work': float(r.group_work) if r.group_work else None,
                    'exam_score': float(r.exam_score),
                    'final_score': float(r.final_score),
                    'grade': r.grade,
                    'teacher_comment': r.teacher_comment,
                })

            avg = term_results.aggregate(avg=Avg('final_score'))['avg']
            response_data.append({
                'term': term.name,
                'term_id': str(term.id),
                'year': term.year,
                'average_score': round(float(avg), 1) if avg else 0,
                'subjects': subjects,
            })

        return Response(response_data)


# ─────────────────────────────────────────────
# Attendance
# ─────────────────────────────────────────────

class StudentAttendanceStatsView(APIView):
    """
    Attendance stat cards for the student's own profile.

    GET /imboni/student/attendance/stats/
    """
    permission_classes = [IsStudent]
    def get(self, request):
        student = _get_student(request)
        if not student:
            return Response({'error': 'Student profile not found.'}, status=404)

        from attendance.models import AttendanceSummary
        from django.db.models import Sum

        summaries = AttendanceSummary.objects.filter(student=student)
        totals = summaries.aggregate(
            total_days=Sum('total_days'),
            present_days=Sum('present_days'),
            absent_days=Sum('absent_days'),
            late_days=Sum('late_days'),
            excused_days=Sum('excused_days'),
        )

        total   = totals['total_days']   or 0
        present = totals['present_days'] or 0
        absent  = totals['absent_days']  or 0
        late    = totals['late_days']    or 0
        excused = totals['excused_days'] or 0

        overall_rate = round((present / total) * 100, 1) if total > 0 else 0

        if overall_rate >= 95:
            label = 'Excellent attendance'
        elif overall_rate >= 85:
            label = 'Good attendance'
        elif overall_rate >= 75:
            label = 'Average attendance'
        else:
            label = 'Needs improvement'

        return Response({
            'overall_rate': overall_rate,
            'attendance_label': label,
            'days_present': present,
            'days_absent': absent,
            'excused_absences': excused,
            'late_arrivals': late,
            'late_label': 'Below average' if late > 2 else 'On track',
        })


class StudentAttendanceCalendarView(APIView):
    """
    Monthly attendance calendar grid.

    GET /imboni/student/attendance/calendar/?month=3&year=2026
    """
    permission_classes = [IsStudent]
    def get(self, request):
        student = _get_student(request)
        if not student:
            return Response({'error': 'Student profile not found.'}, status=404)

        from attendance.models import AttendanceRecord

        today = date.today()
        month = int(request.query_params.get('month', today.month))
        year  = int(request.query_params.get('year',  today.year))

        records = (
            AttendanceRecord.objects
            .filter(student=student, date__month=month, date__year=year)
            .order_by('date')
        )

        calendar = [
            {'date': str(r.date), 'status': r.status, 'time_in': str(r.time_in) if r.time_in else None}
            for r in records
        ]

        return Response({'month': month, 'year': year, 'records': calendar})


# ─────────────────────────────────────────────
# Announcements
# ─────────────────────────────────────────────


class StudentAnnouncementsSimpleView(APIView):
    """
    Simpler version — published announcements for all or students.

    GET /imboni/student/announcements/
    """
    permission_classes = [IsStudent]
    def get(self, request):
        student = _get_student(request)

        from announcements.models import Announcement

        qs = (
            Announcement.objects
            .filter(status='published', target_audience__in=['all', 'students'])
            .select_related('author')
            .order_by('-published_at')
        )

        if student:
            grade_qs = (
                Announcement.objects
                .filter(status='published', target_audience='grade_specific', target_grade=student.grade)
                .select_related('author')
            )
            from itertools import chain
            from operator import attrgetter
            qs = sorted(chain(qs, grade_qs), key=attrgetter('published_at'), reverse=True)

        category = request.query_params.get('category')
        if category:
            qs = [a for a in qs if a.category == category]

        data = [
            {
                'id': str(a.id),
                'title': a.title,
                'content': a.content,
                'category': a.category,
                'published_at': str(a.published_at) if a.published_at else None,
                'author': a.author.get_full_name() if a.author else '',
            }
            for a in list(qs)[:50]
        ]

        return Response(data)


# ─────────────────────────────────────────────
# Discipline / Conduct
# ─────────────────────────────────────────────

class StudentDisciplineView(APIView):
    """
    Conduct score + behavior records for the student's own profile.

    GET /imboni/student/discipline/
    Optional: ?type=positive|warning|incident|achievement
    """
    permission_classes = [IsStudent]
    def get(self, request):
        student = _get_student(request)
        if not student:
            return Response({'error': 'Student profile not found.'}, status=404)

        from behavior.models import BehaviorReport, ConductGrade
        from results.models import AcademicTerm

        current_term = AcademicTerm.objects.filter(is_current=True).first()

        # Conduct grade
        conduct_grade = None
        conduct_label = 'No grade yet'
        if current_term:
            cg = ConductGrade.objects.filter(student=student, term=current_term).first()
            if cg:
                conduct_grade = cg.grade
                labels = {'A': 'Excellent', 'B': 'Good', 'C': 'Satisfactory',
                          'D': 'Needs Improvement', 'F': 'Unsatisfactory'}
                conduct_label = labels.get(cg.grade, '')

        # Behavior reports
        reports_qs = (
            BehaviorReport.objects
            .filter(student=student)
            .select_related('reported_by')
            .order_by('-date', '-created_at')
        )

        report_type = request.query_params.get('type')
        if report_type:
            reports_qs = reports_qs.filter(report_type=report_type)

        grade_labels = {'A': 'Excellent', 'B': 'Good', 'C': 'Satisfactory',
                        'D': 'Needs Improvement', 'F': 'Unsatisfactory'}

        reports = []
        for r in reports_qs[:30]:
            reports.append({
                'id': str(r.id),
                'title': r.title,
                'report_type': r.report_type,
                'severity': r.severity,
                'description': r.description,
                'date': str(r.date),
                'action_taken': r.action_taken,
                'reported_by': r.reported_by.get_full_name() if r.reported_by else '',
            })

        return Response({
            'conduct_grade': conduct_grade,
            'conduct_label': conduct_label,
            'reports': reports,
        })


# ─────────────────────────────────────────────
# Activities
# ─────────────────────────────────────────────

class StudentActivitiesView(APIView):
    """
    Enrolled activities + available activities to join.

    GET /imboni/student/activities/
    """
    permission_classes = [IsStudent]
    def get(self, request):
        student = _get_student(request)
        if not student:
            return Response({'error': 'Student profile not found.'}, status=404)

        enrolled_ids = ActivityEnrollment.objects.filter(
            student=student, status='active'
        ).values_list('activity_id', flat=True)

        enrolled = Activity.objects.filter(id__in=enrolled_ids, is_active=True)
        available = Activity.objects.filter(is_active=True).exclude(id__in=enrolled_ids)

        return Response({
            'enrolled': ActivitySerializer(enrolled, many=True).data,
            'available': ActivitySerializer(available, many=True).data,
        })


class StudentActivityApplyView(APIView):
    """
    Apply to join an activity.

    POST /imboni/student/activities/<pk>/apply/
    """
    permission_classes = [IsStudent]
    def post(self, request, pk):
        student = _get_student(request)
        if not student:
            return Response({'error': 'Student profile not found.'}, status=404)

        try:
            activity = Activity.objects.get(pk=pk, is_active=True)
        except Activity.DoesNotExist:
            return Response({'error': 'Activity not found.'}, status=404)

        if ActivityEnrollment.objects.filter(activity=activity, student=student).exists():
            return Response({'error': 'Already enrolled or applied.'}, status=400)

        if activity.enrolled_count >= activity.max_members:
            return Response({'error': 'Activity is full.'}, status=400)

        enrollment = ActivityEnrollment.objects.create(
            activity=activity, student=student, status='active'
        )
        return Response({'message': 'Successfully joined activity.', 'id': str(enrollment.id)}, status=201)


class StudentActivityWithdrawView(APIView):
    """
    Withdraw from an activity.

    POST /imboni/student/activities/<pk>/withdraw/
    """
    permission_classes = [IsStudent]
    def post(self, request, pk):
        student = _get_student(request)
        if not student:
            return Response({'error': 'Student profile not found.'}, status=404)

        enrollment = ActivityEnrollment.objects.filter(
            activity_id=pk, student=student
        ).first()

        if not enrollment:
            return Response({'error': 'Not enrolled in this activity.'}, status=404)

        enrollment.status = 'withdrawn'
        enrollment.save()
        return Response({'message': 'Successfully withdrawn from activity.'})


class StudentActivityEventsView(generics.ListAPIView):
    """
    Upcoming events for activities the student is enrolled in.

    GET /imboni/student/activities/events/
    """
    serializer_class = ActivityEventSerializer
    permission_classes = [IsStudent]

    def get_queryset(self):
        student = _get_student(self.request)
        if not student:
            return ActivityEvent.objects.none()

        enrolled_ids = ActivityEnrollment.objects.filter(
            student=student, status='active'
        ).values_list('activity_id', flat=True)

        return (
            ActivityEvent.objects
            .filter(activity_id__in=enrolled_ids, date__gte=date.today())
            .select_related('activity')
            .order_by('date', 'start_time')
        )


# ─────────────────────────────────────────────
# Assignments
# ─────────────────────────────────────────────

class StudentAssignmentsView(APIView):
    """
    All assignments for the student's class with submission status.

    GET /imboni/student/assignments/
    Optional: ?status=pending|submitted|graded|late|overdue
    """
    permission_classes = [IsStudent]
    def get(self, request):
        student = _get_student(request)
        if not student:
            return Response({'error': 'Student profile not found.'}, status=404)

        from results.models import AcademicTerm
        from teacher.models import ClassAssignment

        current_term = AcademicTerm.objects.filter(is_current=True).first()
        if not current_term:
            return Response([])

        student_class = (
            ClassAssignment.objects
            .filter(student=student, term=current_term)
            .select_related('class_obj')
            .first()
        )
        if not student_class:
            return Response([])

        assignments = (
            Assignment.objects
            .filter(class_obj=student_class.class_obj, term=current_term)
            .select_related('subject', 'teacher')
            .order_by('due_date')
        )

        status_filter = request.query_params.get('status')
        today = date.today()

        # Pre-fetch all submissions in one query instead of one per assignment
        subs_map = {
            s.assignment_id: s
            for s in AssignmentSubmission.objects.filter(
                student=student, assignment__in=assignments
            )
        }

        result = []
        for a in assignments:
            sub = subs_map.get(a.id)

            if sub:
                computed_status = sub.status
            elif a.due_date < today:
                computed_status = 'overdue'
            else:
                computed_status = 'pending'

            if status_filter and computed_status != status_filter:
                continue

            result.append({
                'id': str(a.id),
                'title': a.title,
                'description': a.description,
                'subject': a.subject.name,
                'teacher': a.teacher.get_full_name(),
                'due_date': str(a.due_date),
                'status': computed_status,
                'grade': float(sub.grade) if sub and sub.grade else None,
                'feedback': sub.feedback if sub else '',
                'has_attachment': bool(a.attachment),
            })

        return Response(result)


class StudentAssignmentSubmitView(APIView):
    """
    Submit an assignment.

    POST /imboni/student/assignments/<pk>/submit/
    Body: { file (optional), notes (optional) }
    """
    permission_classes = [IsStudent]
    def post(self, request, pk):
        student = _get_student(request)
        if not student:
            return Response({'error': 'Student profile not found.'}, status=404)

        try:
            assignment = Assignment.objects.get(pk=pk)
        except Assignment.DoesNotExist:
            return Response({'error': 'Assignment not found.'}, status=404)

        if AssignmentSubmission.objects.filter(assignment=assignment, student=student).exists():
            return Response({'error': 'Already submitted.'}, status=400)

        today = date.today()
        sub_status = 'late' if assignment.due_date < today else 'submitted'

        submission = AssignmentSubmission.objects.create(
            assignment=assignment,
            student=student,
            file=request.FILES.get('file'),
            notes=request.data.get('notes', ''),
            status=sub_status,
        )

        return Response({
            'message': 'Assignment submitted successfully.',
            'id': str(submission.id),
            'status': sub_status,
        }, status=201)


# ---------------------------------------------------------------------------
# Student Profile
# ---------------------------------------------------------------------------

class StudentProfileView(APIView):
    """GET /imboni/student/profile/"""
    permission_classes = [IsStudent]

    def get(self, request):
        from parents.models import Student
        from results.models import AcademicTerm, Result
        from attendance.models import Attendance
        from django.db.models import Avg

        if not request.user.is_authenticated:
            return Response({'detail': 'Authentication required.'}, status=401)

        try:
            student = Student.objects.select_related('user').get(user=request.user)
        except Student.DoesNotExist:
            return Response({'detail': 'Student profile not found.'}, status=404)

        term = AcademicTerm.objects.filter(is_current=True).first()

        avg_perf = Result.objects.filter(
            student=student, term=term, status='approved'
        ).aggregate(a=Avg('final_score'))['a'] if term else None

        att_qs    = Attendance.objects.filter(student=student, term=term) if term else Attendance.objects.none()
        att_total = att_qs.count()
        att_pres  = att_qs.filter(status='present').count()
        att_rate  = round(att_pres / att_total * 100, 1) if att_total else None

        return Response({
            'student_id':     str(student.id),
            'student_code':   student.student_id,
            'first_name':     student.user.first_name,
            'last_name':      student.user.last_name,
            'email':          student.user.email,
            'grade':          student.grade,
            'section':        student.section,
            'status':         student.status,
            'enrollment_date': str(student.enrollment_date),
            'avg_performance': round(avg_perf, 1) if avg_perf is not None else None,
            'attendance_rate': att_rate,
        })
