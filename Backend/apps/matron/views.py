from datetime import date

from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import generics

from apps.behavior.models import BehaviorReport
from apps.discipline.models import BoardingStudent, DisciplineStaff
from .serializers import MatronBehaviorReportSerializer, MatronStudentSerializer
from apps.authentication.permissions import IsMatron

def _get_matron_staff(request):
    """Return the DisciplineStaff profile for the logged-in matron, or None."""
    try:
        return request.user.discipline_staff_profile
    except Exception:
        return None


# Dashboard

class MatronDashboardView(APIView):
    """
    Matron dashboard: my students, today's schedule, recent incidents I filed.

    GET /imboni/matron/dashboard/
    """
    permission_classes = [IsMatron]
    def get(self, request):
        staff = _get_matron_staff(request)

        # Students this matron manages (via dormitory assignment)
        my_students_qs = BoardingStudent.objects.filter(is_active=True)
        if staff and staff.assigned_dormitory:
            my_students_qs = my_students_qs.filter(dormitory=staff.assigned_dormitory)

        my_students_count = my_students_qs.count()

        # Recent incidents filed by this matron
        incidents_qs = (
            BehaviorReport.objects
            .filter(reported_by=request.user)
            .select_related('student__user')
            .order_by('-date', '-created_at')[:5]
        )

        recent_incidents = [
            {
                'id': str(r.id),
                'student': r.student.user.get_full_name(),
                'title': r.title,
                'report_type': r.report_type,
                'severity': r.severity,
                'date': str(r.date),
            }
            for r in incidents_qs
        ]

        # Today's schedule (timetable for assigned grade/class)
        from apps.results.models import AcademicTerm
        from apps.teacher.models import Timetable

        today = date.today()
        day_map = {0: 'monday', 1: 'tuesday', 2: 'wednesday',
                   3: 'thursday', 4: 'friday', 5: 'saturday', 6: 'sunday'}
        today_day = day_map[today.weekday()]

        current_term = AcademicTerm.objects.filter(is_current=True).first()
        schedule = []
        if current_term and staff and staff.assigned_grade:
            # Get timetable for assigned grade (any section)
            periods = (
                Timetable.objects
                .filter(
                    class_obj__grade=staff.assigned_grade,
                    day=today_day,
                    term=current_term,
                )
                .select_related('subject', 'teacher', 'class_obj')
                .order_by('class_obj__section', 'start_time')
            )
            for p in periods:
                schedule.append({
                    'class': p.class_obj.name,
                    'subject': p.subject.name,
                    'teacher': p.teacher.get_full_name() if p.teacher else '',
                    'start_time': str(p.start_time),
                    'end_time': str(p.end_time),
                    'room': p.room_number,
                })

        # Pending follow-ups
        pending_followups = BehaviorReport.objects.filter(
            reported_by=request.user,
            follow_up_required=True,
            follow_up_completed=False,
        ).count()

        return Response({
            'stats': {
                'my_students': my_students_count,
                'incidents_filed': BehaviorReport.objects.filter(reported_by=request.user).count(),
                'pending_follow_ups': pending_followups,
                'dormitory': staff.assigned_dormitory if staff else '',
            },
            'recent_incidents': recent_incidents,
            'today_schedule': schedule,
        })


# My Students

class MatronStudentListView(APIView):
    """
    Students in the matron's assigned dormitory.

    GET /imboni/matron/students/
    Optional: ?search=<name>
    """
    permission_classes = [IsMatron]
    def get(self, request):
        staff = _get_matron_staff(request)

        qs = BoardingStudent.objects.select_related('student__user').filter(is_active=True)
        if staff and staff.assigned_dormitory:
            qs = qs.filter(dormitory=staff.assigned_dormitory)

        search = request.query_params.get('search')
        if search:
            qs = qs.filter(student__user__first_name__icontains=search) | \
                 qs.filter(student__user__last_name__icontains=search) | \
                 qs.filter(student__student_id__icontains=search)

        return Response(MatronStudentSerializer(qs, many=True).data)


class MatronStudentDetailView(APIView):
    """
    Single student detail for the matron.

    GET /imboni/matron/students/<pk>/
    """
    permission_classes = [IsMatron]
    def get(self, request, pk):
        try:
            record = BoardingStudent.objects.select_related('student__user').get(pk=pk)
        except BoardingStudent.DoesNotExist:
            return Response({'error': 'Not found.'}, status=404)

        student = record.student
        from apps.results.models import AcademicTerm
        from apps.behavior.models import ConductGrade

        current_term = AcademicTerm.objects.filter(is_current=True).first()
        conduct_grade = None
        if current_term:
            cg = ConductGrade.objects.filter(student=student, term=current_term).first()
            if cg:
                conduct_grade = cg.grade

        recent_incidents = (
            BehaviorReport.objects
            .filter(student=student)
            .select_related('reported_by')
            .order_by('-date')[:5]
        )

        return Response({
            'id': str(record.id),
            'student_id': student.student_id,
            'name': student.user.get_full_name(),
            'grade': student.grade,
            'section': student.section,
            'dormitory': record.dormitory,
            'room_number': record.room_number,
            'bed_number': record.bed_number,
            'boarding_type': record.boarding_type,
            'conduct_grade': conduct_grade,
            'recent_incidents': [
                {
                    'id': str(r.id),
                    'title': r.title,
                    'report_type': r.report_type,
                    'severity': r.severity,
                    'date': str(r.date),
                    'reported_by': r.reported_by.get_full_name() if r.reported_by else '',
                }
                for r in recent_incidents
            ],
        })


# Incidents

class MatronIncidentListView(APIView):
    """
    List incidents filed by this matron, or create a new one.

    GET  /imboni/matron/incidents/
    POST /imboni/matron/incidents/
    Body: { student_id, title, report_type, severity, description, date, location,
            action_taken, follow_up_required, follow_up_date, parents_notified }
    """
    permission_classes = [IsMatron]
    def get(self, request):
        qs = (
            BehaviorReport.objects
            .filter(reported_by=request.user)
            .select_related('student__user')
            .order_by('-date', '-created_at')
        )

        report_type = request.query_params.get('type')
        if report_type:
            qs = qs.filter(report_type=report_type)

        return Response(MatronBehaviorReportSerializer(qs, many=True).data)

    def post(self, request):
        from apps.parents.models import Student

        try:
            student = Student.objects.get(pk=request.data.get('student_id'))
        except Student.DoesNotExist:
            return Response({'error': 'Student not found.'}, status=404)

        report = BehaviorReport.objects.create(
            student=student,
            reported_by=request.user,
            title=request.data.get('title', ''),
            report_type=request.data.get('report_type', 'incident'),
            severity=request.data.get('severity', 'minor'),
            description=request.data.get('description', ''),
            date=request.data.get('date', date.today()),
            location=request.data.get('location', ''),
            action_taken=request.data.get('action_taken', ''),
            follow_up_required=request.data.get('follow_up_required', False),
            follow_up_date=request.data.get('follow_up_date') or None,
            parents_notified=request.data.get('parents_notified', False),
        )
        return Response(MatronBehaviorReportSerializer(report).data, status=201)


class MatronIncidentDetailView(APIView):
    """
    View or update a single incident.

    GET   /imboni/matron/incidents/<pk>/
    PATCH /imboni/matron/incidents/<pk>/
    """
    permission_classes = [IsMatron]
    def get(self, request, pk):
        try:
            r = BehaviorReport.objects.select_related('student__user', 'reported_by').get(pk=pk)
        except BehaviorReport.DoesNotExist:
            return Response({'error': 'Not found.'}, status=404)
        return Response(MatronBehaviorReportSerializer(r).data)

    def patch(self, request, pk):
        try:
            r = BehaviorReport.objects.get(pk=pk)
        except BehaviorReport.DoesNotExist:
            return Response({'error': 'Not found.'}, status=404)

        updatable = ['title', 'description', 'action_taken', 'follow_up_required',
                     'follow_up_date', 'follow_up_completed', 'parents_notified',
                     'parent_notification_date']
        for field in updatable:
            if field in request.data:
                setattr(r, field, request.data[field])
        r.save()
        return Response(MatronBehaviorReportSerializer(r).data)


# Schedule

class MatronScheduleView(APIView):
    """
    Daily schedule for the matron's assigned grade.

    GET /imboni/matron/schedule/
    Optional: ?date=2026-03-12  (defaults to today)
    """
    permission_classes = [IsMatron]
    def get(self, request):
        from apps.results.models import AcademicTerm
        from apps.teacher.models import Timetable

        staff = _get_matron_staff(request)

        date_param = request.query_params.get('date')
        if date_param:
            try:
                from datetime import datetime
                target_date = datetime.strptime(date_param, '%Y-%m-%d').date()
            except ValueError:
                target_date = date.today()
        else:
            target_date = date.today()

        day_map = {0: 'monday', 1: 'tuesday', 2: 'wednesday',
                   3: 'thursday', 4: 'friday', 5: 'saturday', 6: 'sunday'}
        target_day = day_map[target_date.weekday()]

        current_term = AcademicTerm.objects.filter(is_current=True).first()
        if not current_term:
            return Response({'schedule': [], 'date': str(target_date)})

        periods_qs = Timetable.objects.filter(
            day=target_day, term=current_term
        ).select_related('subject', 'teacher', 'class_obj')

        if staff and staff.assigned_grade:
            periods_qs = periods_qs.filter(class_obj__grade=staff.assigned_grade)

        periods_qs = periods_qs.order_by('class_obj__grade', 'class_obj__section', 'start_time')

        schedule = [
            {
                'class': p.class_obj.name,
                'subject': p.subject.name,
                'teacher': p.teacher.get_full_name() if p.teacher else '',
                'start_time': str(p.start_time),
                'end_time': str(p.end_time),
                'room': p.room_number,
            }
            for p in periods_qs
        ]

        return Response({'schedule': schedule, 'date': str(target_date), 'day': target_day})


# ---------------------------------------------------------------------------
# Night Attendance Check
# ---------------------------------------------------------------------------

class MatronNightCheckView(APIView):
    """
    GET  /imboni/matron/night-check/?date=YYYY-MM-DD
    POST /imboni/matron/night-check/
         body: {date, records: [{boarding_student_id, is_present, notes}]}
    """
    permission_classes = [IsMatron]
    def get(self, request):
        from apps.discipline.models import BoardingStudent, NightAttendance
        from django.utils import timezone

        date_str = request.query_params.get('date')
        if date_str:
            from datetime import date as _date, datetime
            try:
                check_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            except ValueError:
                return Response({'detail': 'Invalid date format. Use YYYY-MM-DD.'}, status=400)
        else:
            check_date = timezone.localdate()

        boarders = BoardingStudent.objects.filter(is_active=True).select_related('student__user')
        records  = {
            na.student_id: na
            for na in NightAttendance.objects.filter(date=check_date)
        }

        data = []
        for b in boarders:
            na = records.get(b.id)
            data.append({
                'boarding_student_id': str(b.id),
                'student_id':          str(b.student.id),
                'full_name':           '%s %s' % (b.student.user.first_name, b.student.user.last_name),
                'dormitory':           b.dormitory,
                'room_number':         b.room_number,
                'is_present':          na.is_present if na else None,
                'notes':               na.notes if na else '',
                'checked':             na is not None,
            })

        return Response({'date': str(check_date), 'boarders': data})

    def post(self, request):
        from apps.discipline.models import BoardingStudent, NightAttendance
        from django.utils import timezone

        d = request.data
        date_str = d.get('date')
        if not date_str:
            return Response({'detail': 'date is required.'}, status=400)

        from datetime import datetime
        try:
            check_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({'detail': 'Invalid date format. Use YYYY-MM-DD.'}, status=400)

        records = d.get('records', [])
        saved = 0
        for rec in records:
            bid = rec.get('boarding_student_id')
            if not bid:
                continue
            try:
                boarder = BoardingStudent.objects.get(pk=bid)
            except BoardingStudent.DoesNotExist:
                continue
            NightAttendance.objects.update_or_create(
                student=boarder,
                date=check_date,
                defaults={
                    'is_present':   bool(rec.get('is_present', True)),
                    'notes':        rec.get('notes', ''),
                    'recorded_by':  request.user if request.user.is_authenticated else None,
                },
            )
            saved += 1

        return Response({'detail': 'Night check saved.', 'saved': saved})
