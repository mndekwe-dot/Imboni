from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import DisciplineStaff, StudentLeader, BoardingStudent, DiningPlan
from .serializers import (
    DisciplineStaffSerializer,
    StudentLeaderSerializer,
    BoardingStudentSerializer,
    DiningPlanSerializer,
)
from apps.behavior.models import BehaviorReport, ConductGrade
from apps.behavior.serializers import BehaviorReportSerializer
from apps.authentication.permissions import IsDiscipline,IsMatron


# Dashboard

class DisciplineDashboardView(APIView):
    """
    Dashboard stat cards + recent incidents.

    GET /imboni/discipline/dashboard/
    """
    permission_classes = [IsDiscipline]
    def get(self, request):
        from apps.results.models import AcademicTerm
        from apps.parents.models import Student
        from datetime import date
        from django.utils import timezone

        today = date.today()
        current_term = AcademicTerm.objects.filter(is_current=True).first()

        # Stat cards
        pending_reports = BehaviorReport.objects.filter(
            report_type__in=['incident', 'warning'],
            follow_up_required=True,
            follow_up_completed=False,
        ).count()

        incidents_this_month = BehaviorReport.objects.filter(
            report_type='incident',
            date__month=today.month,
            date__year=today.year,
        ).count()

        active_students = Student.objects.filter(status='active').count()
        boarding_count  = BoardingStudent.objects.filter(is_active=True).count()

        # Recent incidents (last 10)
        recent = (
            BehaviorReport.objects
            .filter(report_type__in=['incident', 'warning'])
            .select_related('student__user', 'reported_by')
            .order_by('-date', '-created_at')[:10]
        )

        recent_list = []
        for r in recent:
            recent_list.append({
                'id': str(r.id),
                'student': r.student.user.get_full_name(),
                'student_id': r.student.student_id,
                'title': r.title,
                'report_type': r.report_type,
                'severity': r.severity,
                'date': str(r.date),
                'reported_by': r.reported_by.get_full_name() if r.reported_by else '',
                'follow_up_required': r.follow_up_required,
                'follow_up_completed': r.follow_up_completed,
            })

        # Student leaders summary
        leaders_count = 0
        if current_term:
            leaders_count = StudentLeader.objects.filter(term=current_term, is_active=True).count()

        return Response({
            'stats': {
                'pending_follow_ups': pending_reports,
                'incidents_this_month': incidents_this_month,
                'active_students': active_students,
                'boarding_students': boarding_count,
                'student_leaders': leaders_count,
            },
            'recent_incidents': recent_list,
        })


# Behavior Reports

class DisciplineReportListView(APIView):
    """
    All behavior reports with filtering. Also exposes pending follow-up queue.

    GET /imboni/discipline/reports/
    Optional: ?type=incident|warning|positive|achievement  ?student=<name>  ?pending=true
    """
    permission_classes = [IsDiscipline]
    def get(self, request):
        qs = (
            BehaviorReport.objects
            .select_related('student__user', 'reported_by')
            .order_by('-date', '-created_at')
        )

        report_type = request.query_params.get('type')
        if report_type:
            qs = qs.filter(report_type=report_type)

        student_search = request.query_params.get('student')
        if student_search:
            qs = qs.filter(
                student__user__first_name__icontains=student_search
            ) | qs.filter(
                student__user__last_name__icontains=student_search
            ) | qs.filter(
                student__student_id__icontains=student_search
            )

        if request.query_params.get('pending') == 'true':
            qs = qs.filter(follow_up_required=True, follow_up_completed=False)

        data = []
        for r in qs[:100]:
            data.append({
                'id': str(r.id),
                'student': r.student.user.get_full_name(),
                'student_id': r.student.student_id,
                'grade': r.student.grade,
                'section': r.student.section,
                'title': r.title,
                'report_type': r.report_type,
                'severity': r.severity,
                'description': r.description,
                'date': str(r.date),
                'location': r.location,
                'action_taken': r.action_taken,
                'reported_by': r.reported_by.get_full_name() if r.reported_by else '',
                'parents_notified': r.parents_notified,
                'follow_up_required': r.follow_up_required,
                'follow_up_completed': r.follow_up_completed,
            })

        return Response(data)


class DisciplineReportDetailView(APIView):
    """
    View or update a single behavior report.

    GET  /imboni/discipline/reports/<pk>/
    PATCH /imboni/discipline/reports/<pk>/
    Body: { action_taken, follow_up_completed, parents_notified }
    """
    permission_classes = [IsDiscipline]
    def get(self, request, pk):
        try:
            r = BehaviorReport.objects.select_related('student__user', 'reported_by').get(pk=pk)
        except BehaviorReport.DoesNotExist:
            return Response({'error': 'Report not found.'}, status=404)

        return Response({
            'id': str(r.id),
            'student': r.student.user.get_full_name(),
            'student_id': r.student.student_id,
            'grade': r.student.grade,
            'section': r.student.section,
            'title': r.title,
            'report_type': r.report_type,
            'severity': r.severity,
            'description': r.description,
            'date': str(r.date),
            'location': r.location,
            'action_taken': r.action_taken,
            'reported_by': r.reported_by.get_full_name() if r.reported_by else '',
            'parents_notified': r.parents_notified,
            'parent_notification_date': str(r.parent_notification_date) if r.parent_notification_date else None,
            'follow_up_required': r.follow_up_required,
            'follow_up_date': str(r.follow_up_date) if r.follow_up_date else None,
            'follow_up_completed': r.follow_up_completed,
        })

    def patch(self, request, pk):
        try:
            r = BehaviorReport.objects.get(pk=pk)
        except BehaviorReport.DoesNotExist:
            return Response({'error': 'Report not found.'}, status=404)

        updatable = ['action_taken', 'follow_up_completed', 'parents_notified',
                     'parent_notification_date', 'follow_up_date']
        for field in updatable:
            if field in request.data:
                setattr(r, field, request.data[field])
        r.save()
        return Response({'message': 'Report updated.'})


# Student Conduct

class DisciplineStudentListView(APIView):
    """
    All students with conduct grade, searchable and filterable.

    GET /imboni/discipline/students/
    Optional: ?grade=1-6  ?section=A|B|C  ?search=<name>
    """
    permission_classes = [IsDiscipline]
    def get(self, request):
        from apps.parents.models import Student
        from apps.results.models import AcademicTerm

        current_term = AcademicTerm.objects.filter(is_current=True).first()

        qs = Student.objects.filter(status='active').select_related('user').order_by('grade', 'section', 'user__last_name')

        grade = request.query_params.get('grade')
        if grade:
            qs = qs.filter(grade=grade)

        section = request.query_params.get('section')
        if section:
            qs = qs.filter(section=section)

        search = request.query_params.get('search')
        if search:
            qs = qs.filter(user__first_name__icontains=search) | \
                 qs.filter(user__last_name__icontains=search) | \
                 qs.filter(student_id__icontains=search)

        grade_labels = {
            '1': 'S1', '2': 'S2', '3': 'S3',
            '4': 'S4', '5': 'S5', '6': 'S6',
        }

        data = []
        for s in qs[:200]:
            conduct_grade = None
            if current_term:
                cg = ConductGrade.objects.filter(student=s, term=current_term).first()
                if cg:
                    conduct_grade = cg.grade

            incident_count = BehaviorReport.objects.filter(
                student=s, report_type='incident'
            ).count()

            data.append({
                'id': str(s.id),
                'student_id': s.student_id,
                'name': s.user.get_full_name(),
                'grade': grade_labels.get(s.grade, s.grade),
                'section': s.section,
                'conduct_grade': conduct_grade,
                'incident_count': incident_count,
                'status': s.status,
            })

        return Response(data)


class DisciplineStudentDetailView(APIView):
    """
    Full conduct detail for a single student.

    GET /imboni/discipline/students/<pk>/
    """
    permission_classes = [IsDiscipline]
    def get(self, request, pk):
        from apps.parents.models import Student
        from apps.results.models import AcademicTerm

        try:
            student = Student.objects.select_related('user').get(pk=pk)
        except Student.DoesNotExist:
            return Response({'error': 'Student not found.'}, status=404)

        current_term = AcademicTerm.objects.filter(is_current=True).first()

        conduct_grade = None
        conduct_history = []
        for cg in ConductGrade.objects.filter(student=student).select_related('term').order_by('-term__year', '-term__term'):
            if current_term and cg.term_id == current_term.id:
                conduct_grade = cg.grade
            conduct_history.append({
                'term': cg.term.name,
                'grade': cg.grade,
                'positive_count': cg.positive_count,
                'warning_count': cg.warning_count,
                'incident_count': cg.incident_count,
                'comment': cg.comment,
            })

        reports = (
            BehaviorReport.objects
            .filter(student=student)
            .select_related('reported_by')
            .order_by('-date')[:20]
        )

        reports_data = [
            {
                'id': str(r.id),
                'title': r.title,
                'report_type': r.report_type,
                'severity': r.severity,
                'date': str(r.date),
                'action_taken': r.action_taken,
                'reported_by': r.reported_by.get_full_name() if r.reported_by else '',
            }
            for r in reports
        ]

        leaders = StudentLeader.objects.filter(student=student, is_active=True).select_related('term')
        leader_roles = [
            {'role': l.get_role_display(), 'term': l.term.name}
            for l in leaders
        ]

        return Response({
            'id': str(student.id),
            'student_id': student.student_id,
            'name': student.user.get_full_name(),
            'grade': student.grade,
            'section': student.section,
            'current_conduct_grade': conduct_grade,
            'conduct_history': conduct_history,
            'reports': reports_data,
            'leadership_roles': leader_roles,
        })


# Discipline Staff (Matrons & Patrons)

class DisciplineStaffListView(APIView):
    """
    List all discipline staff or create a new one.

    GET  /imboni/discipline/staff/
    POST /imboni/discipline/staff/
    Body: { user_id, staff_type, assigned_dormitory, assigned_grade }
    """
    permission_classes = [IsDiscipline]
    def get(self, request):
        staff = DisciplineStaff.objects.select_related('user').filter(is_active=True)
        staff_type = request.query_params.get('type')
        if staff_type:
            staff = staff.filter(staff_type=staff_type)
        return Response(DisciplineStaffSerializer(staff, many=True).data)

    def post(self, request):
        from apps.authentication.models import User
        try:
            user = User.objects.get(pk=request.data.get('user_id'))
        except User.DoesNotExist:
            return Response({'error': 'User not found.'}, status=404)

        staff = DisciplineStaff.objects.create(
            user=user,
            staff_type=request.data.get('staff_type', 'matron'),
            assigned_dormitory=request.data.get('assigned_dormitory', ''),
            assigned_grade=request.data.get('assigned_grade', ''),
        )
        return Response(DisciplineStaffSerializer(staff).data, status=201)


class DisciplineStaffDetailView(APIView):
    """
    GET / PATCH / DELETE a discipline staff member.

    /imboni/discipline/staff/<pk>/
    """
    permission_classes = [IsDiscipline]
    def get(self, request, pk):
        try:
            staff = DisciplineStaff.objects.select_related('user').get(pk=pk)
        except DisciplineStaff.DoesNotExist:
            return Response({'error': 'Staff not found.'}, status=404)
        return Response(DisciplineStaffSerializer(staff).data)

    def patch(self, request, pk):
        try:
            staff = DisciplineStaff.objects.get(pk=pk)
        except DisciplineStaff.DoesNotExist:
            return Response({'error': 'Staff not found.'}, status=404)

        for field in ['staff_type', 'assigned_dormitory', 'assigned_grade', 'is_active']:
            if field in request.data:
                setattr(staff, field, request.data[field])
        staff.save()
        return Response(DisciplineStaffSerializer(staff).data)

    def delete(self, request, pk):
        try:
            staff = DisciplineStaff.objects.get(pk=pk)
        except DisciplineStaff.DoesNotExist:
            return Response({'error': 'Staff not found.'}, status=404)
        staff.is_active = False
        staff.save()
        return Response({'message': 'Staff deactivated.'})


# Student Leaders

class StudentLeaderListView(APIView):
    """
    List student leaders or appoint a new one.

    GET  /imboni/discipline/student-leaders/
    POST /imboni/discipline/student-leaders/
    Body: { student_id, role, term_id, appointed_date }
    """
    permission_classes = [IsDiscipline]
    def get(self, request):
        from apps.results.models import AcademicTerm

        current_term = AcademicTerm.objects.filter(is_current=True).first()
        qs = StudentLeader.objects.select_related('student__user', 'term').filter(is_active=True)

        if current_term:
            qs = qs.filter(term=current_term)

        return Response(StudentLeaderSerializer(qs, many=True).data)

    def post(self, request):
        from apps.parents.models import Student
        from apps.results.models import AcademicTerm

        try:
            student = Student.objects.get(pk=request.data.get('student_id'))
            term = AcademicTerm.objects.get(pk=request.data.get('term_id'))
        except (Student.DoesNotExist, AcademicTerm.DoesNotExist) as e:
            return Response({'error': str(e)}, status=404)

        leader = StudentLeader.objects.create(
            student=student,
            role=request.data.get('role'),
            term=term,
            appointed_date=request.data.get('appointed_date'),
            notes=request.data.get('notes', ''),
        )
        return Response(StudentLeaderSerializer(leader).data, status=201)


class StudentLeaderDetailView(APIView):
    """
    GET / PATCH / DELETE a student leader record.

    /imboni/discipline/student-leaders/<pk>/
    """
    permission_classes = [IsDiscipline]
    def get(self, request, pk):
        try:
            leader = StudentLeader.objects.select_related('student__user', 'term').get(pk=pk)
        except StudentLeader.DoesNotExist:
            return Response({'error': 'Not found.'}, status=404)
        return Response(StudentLeaderSerializer(leader).data)

    def patch(self, request, pk):
        try:
            leader = StudentLeader.objects.get(pk=pk)
        except StudentLeader.DoesNotExist:
            return Response({'error': 'Not found.'}, status=404)
        for field in ['role', 'is_active', 'notes']:
            if field in request.data:
                setattr(leader, field, request.data[field])
        leader.save()
        return Response(StudentLeaderSerializer(leader).data)

    def delete(self, request, pk):
        try:
            leader = StudentLeader.objects.get(pk=pk)
        except StudentLeader.DoesNotExist:
            return Response({'error': 'Not found.'}, status=404)
        leader.is_active = False
        leader.save()
        return Response({'message': 'Role removed.'})


# Boarding

class BoardingStudentListView(APIView):
    """
    List boarding students, optionally filtered by dormitory.

    GET /imboni/discipline/boarding/
    Optional: ?dormitory=<name>  ?type=full_boarder|weekly_boarder|day_scholar
    """
    permission_classes = [IsDiscipline]
    def get(self, request):
        qs = BoardingStudent.objects.select_related('student__user').filter(is_active=True)

        dormitory = request.query_params.get('dormitory')
        if dormitory:
            qs = qs.filter(dormitory__icontains=dormitory)

        boarding_type = request.query_params.get('type')
        if boarding_type:
            qs = qs.filter(boarding_type=boarding_type)

        return Response(BoardingStudentSerializer(qs, many=True).data)

    def post(self, request):
        from apps.parents.models import Student

        try:
            student = Student.objects.get(pk=request.data.get('student_id'))
        except Student.DoesNotExist:
            return Response({'error': 'Student not found.'}, status=404)

        if BoardingStudent.objects.filter(student=student).exists():
            return Response({'error': 'Boarding record already exists for this student.'}, status=400)

        record = BoardingStudent.objects.create(
            student=student,
            dormitory=request.data.get('dormitory'),
            room_number=request.data.get('room_number'),
            bed_number=request.data.get('bed_number', ''),
            boarding_type=request.data.get('boarding_type', 'full_boarder'),
            check_in_date=request.data.get('check_in_date'),
            notes=request.data.get('notes', ''),
        )
        return Response(BoardingStudentSerializer(record).data, status=201)


class BoardingStudentDetailView(APIView):
    """
    GET / PATCH a boarding record.

    /imboni/discipline/boarding/<pk>/
    """
    permission_classes = [IsDiscipline]
    def get(self, request, pk):
        try:
            record = BoardingStudent.objects.select_related('student__user').get(pk=pk)
        except BoardingStudent.DoesNotExist:
            return Response({'error': 'Not found.'}, status=404)
        return Response(BoardingStudentSerializer(record).data)

    def patch(self, request, pk):
        try:
            record = BoardingStudent.objects.get(pk=pk)
        except BoardingStudent.DoesNotExist:
            return Response({'error': 'Not found.'}, status=404)

        for field in ['dormitory', 'room_number', 'bed_number', 'boarding_type', 'is_active', 'notes']:
            if field in request.data:
                setattr(record, field, request.data[field])
        record.save()
        return Response(BoardingStudentSerializer(record).data)


# Dining Plans

class DiningPlanListView(APIView):
    """
    List dining plans or create one.

    GET  /imboni/discipline/dining/
    POST /imboni/discipline/dining/
    Body: { student_id, term_id, plan_type }
    """
    permission_classes = [IsDiscipline]
    def get(self, request):
        from apps.results.models import AcademicTerm

        current_term = AcademicTerm.objects.filter(is_current=True).first()
        qs = DiningPlan.objects.select_related('student__user', 'term').filter(is_active=True)

        if current_term:
            qs = qs.filter(term=current_term)

        plan_type = request.query_params.get('type')
        if plan_type:
            qs = qs.filter(plan_type=plan_type)

        return Response(DiningPlanSerializer(qs, many=True).data)

    def post(self, request):
        from apps.parents.models import Student
        from apps.results.models import AcademicTerm

        try:
            student = Student.objects.get(pk=request.data.get('student_id'))
            term = AcademicTerm.objects.get(pk=request.data.get('term_id'))
        except (Student.DoesNotExist, AcademicTerm.DoesNotExist) as e:
            return Response({'error': str(e)}, status=404)

        plan, created = DiningPlan.objects.get_or_create(
            student=student,
            term=term,
            defaults={'plan_type': request.data.get('plan_type', 'full_board')},
        )
        if not created:
            plan.plan_type = request.data.get('plan_type', plan.plan_type)
            plan.save()

        return Response(DiningPlanSerializer(plan).data, status=201 if created else 200)


# Activities (managed by Discipline)

class DisciplineActivityListView(APIView):
    """
    List all activities or create one.

    GET  /imboni/discipline/activities/
    POST /imboni/discipline/activities/
    """
    permission_classes = [IsDiscipline]
    def get(self, request):
        from apps.student.models import Activity
        qs = Activity.objects.all().order_by('name')
        active_only = request.query_params.get('active')
        if active_only == 'true':
            qs = qs.filter(is_active=True)

        from apps.student.serializers import ActivitySerializer
        return Response(ActivitySerializer(qs, many=True).data)

    def post(self, request):
        from apps.student.models import Activity
        from apps.student.serializers import ActivitySerializer
        from apps.authentication.models import User

        teacher = None
        teacher_id = request.data.get('teacher_id')
        if teacher_id:
            teacher = User.objects.filter(pk=teacher_id).first()

        activity = Activity.objects.create(
            name=request.data.get('name'),
            description=request.data.get('description', ''),
            category=request.data.get('category', 'other'),
            schedule=request.data.get('schedule', ''),
            venue=request.data.get('venue', ''),
            max_members=int(request.data.get('max_members', 30)),
            teacher_in_charge=teacher,
        )
        return Response(ActivitySerializer(activity).data, status=201)


class DisciplineActivityDetailView(APIView):
    """
    GET / PATCH / DELETE an activity.

    /imboni/discipline/activities/<pk>/
    """
    permission_classes = [IsDiscipline]
    def get(self, request, pk):
        from apps.student.models import Activity
        from apps.student.serializers import ActivitySerializer
        try:
            activity = Activity.objects.get(pk=pk)
        except Activity.DoesNotExist:
            return Response({'error': 'Activity not found.'}, status=404)
        return Response(ActivitySerializer(activity).data)

    def patch(self, request, pk):
        from apps.student.models import Activity
        from apps.student.serializers import ActivitySerializer
        try:
            activity = Activity.objects.get(pk=pk)
        except Activity.DoesNotExist:
            return Response({'error': 'Activity not found.'}, status=404)

        for field in ['name', 'description', 'category', 'schedule', 'venue', 'max_members', 'is_active']:
            if field in request.data:
                setattr(activity, field, request.data[field])
        activity.save()
        return Response(ActivitySerializer(activity).data)

    def delete(self, request, pk):
        from apps.student.models import Activity
        try:
            activity = Activity.objects.get(pk=pk)
        except Activity.DoesNotExist:
            return Response({'error': 'Activity not found.'}, status=404)
        activity.is_active = False
        activity.save()
        return Response({'message': 'Activity deactivated.'})


class DisciplineActivityEventCreateView(APIView):
    """
    Add an event to an activity.

    POST /imboni/discipline/activities/<pk>/events/
    Body: { title, date, start_time, end_time, venue, description }
    """
    permission_classes = [IsDiscipline]
    def post(self, request, pk):
        from apps.student.models import Activity, ActivityEvent
        from apps.student.serializers import ActivityEventSerializer
        try:
            activity = Activity.objects.get(pk=pk)
        except Activity.DoesNotExist:
            return Response({'error': 'Activity not found.'}, status=404)

        event = ActivityEvent.objects.create(
            activity=activity,
            title=request.data.get('title'),
            date=request.data.get('date'),
            start_time=request.data.get('start_time'),
            end_time=request.data.get('end_time'),
            venue=request.data.get('venue', ''),
            description=request.data.get('description', ''),
        )
        return Response(ActivityEventSerializer(event).data, status=201)


# ---------------------------------------------------------------------------
# Discipline Timetable
# ---------------------------------------------------------------------------

class DisciplineTimetableView(APIView):
    """GET /imboni/discipline/timetable/?grade=&date=YYYY-MM-DD"""
    permission_classes = [IsDiscipline]
    def get(self, request):
        from apps.teacher.models import TimetablePeriod, Class
        from django.utils import timezone

        date_str = request.query_params.get('date')
        grade    = request.query_params.get('grade')

        if date_str:
            from datetime import datetime
            try:
                target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            except ValueError:
                return Response({'detail': 'Invalid date format. Use YYYY-MM-DD.'}, status=400)
        else:
            target_date = timezone.localdate()

        day_name = target_date.strftime('%A').lower()

        qs = TimetablePeriod.objects.select_related(
            'subject', 'teacher', 'class_obj'
        ).filter(day_of_week=day_name).order_by('class_obj__grade', 'class_obj__section', 'start_time')

        if grade:
            qs = qs.filter(class_obj__grade=grade)

        data = [
            {
                'class':       p.class_obj.name,
                'grade':       p.class_obj.grade,
                'section':     p.class_obj.section,
                'subject':     p.subject.name,
                'teacher':     p.teacher.get_full_name() if p.teacher else '',
                'start_time':  str(p.start_time),
                'end_time':    str(p.end_time),
                'room':        p.room_number,
            }
            for p in qs
        ]
        return Response({'date': str(target_date), 'day': day_name, 'periods': data})
