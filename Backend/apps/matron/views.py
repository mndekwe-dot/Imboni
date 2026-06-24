from datetime import date

from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import generics

from apps.behavior.models import BehaviorReport
from apps.discipline.models import BoardingStudent, DisciplineStaff
from .models import (
    HealthRecord, ParentCommunication, BoardingScheduleSlot, BoardingScheduleChange,
    TOTAL_SICKBAY_BEDS,
)
from .serializers import (
    MatronBehaviorReportSerializer, MatronStudentSerializer,
    HealthRecordSerializer, ParentCommunicationSerializer,
    BoardingScheduleSlotSerializer, BoardingScheduleChangeSerializer,
)
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
        from apps.student.models import Student

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


# ---------------------------------------------------------------------------
# Health & Wellness
# ---------------------------------------------------------------------------

class MatronHealthView(APIView):
    """
    GET  /imboni/matron/health/?student_id=<uuid>
    POST /imboni/matron/health/
         body: {student_id, visit_type, condition_tag, visit_datetime, temperature_c,
                complaint, action_taken, admitted, notify_parent}
    """
    permission_classes = [IsMatron]

    def get(self, request):
        from django.utils import timezone

        history_qs = HealthRecord.objects.select_related('student__user').all()
        student_id = request.query_params.get('student_id')
        if student_id:
            history_qs = history_qs.filter(student_id=student_id)

        now = timezone.localtime()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        active_qs = HealthRecord.objects.filter(status__in=['in_sick_bay', 'observation'])
        occupied_beds = {r.bed_number: r for r in active_qs.filter(admitted=True).select_related('student__user') if r.bed_number}

        beds = []
        for n in range(1, TOTAL_SICKBAY_BEDS + 1):
            record = occupied_beds.get(n)
            if record:
                beds.append({
                    'bed': f'BED {n}',
                    'badgeClass': 'occupied' if record.status == 'in_sick_bay' else 'recovery',
                    'badge': 'Occupied' if record.status == 'in_sick_bay' else 'Observation',
                    'record_id': str(record.id),
                    'student': record.student.user.get_full_name(),
                    'condition': record.complaint,
                    'since': record.visit_datetime.strftime('Admitted %b %d'),
                    'isEmpty': False,
                })
            else:
                beds.append({'bed': f'BED {n}', 'badgeClass': 'empty', 'badge': 'Available',
                             'record_id': None, 'student': None, 'condition': None, 'since': None, 'isEmpty': True})

        stats = {
            'in_sick_bay_now':   active_qs.filter(status='in_sick_bay').count(),
            'under_observation': active_qs.filter(status='observation').count(),
            'visits_this_month': HealthRecord.objects.filter(created_at__gte=month_start).count(),
            'cleared_this_month': HealthRecord.objects.filter(status='cleared', discharged_at__gte=month_start).count(),
            'beds_total': TOTAL_SICKBAY_BEDS,
            'beds_occupied': len(occupied_beds),
        }

        return Response({
            'stats': stats,
            'beds': beds,
            'history': HealthRecordSerializer(history_qs, many=True).data,
        })

    def post(self, request):
        from django.utils import timezone
        from apps.student.models import Student

        d = request.data
        try:
            student = Student.objects.get(pk=d.get('student_id'))
        except Student.DoesNotExist:
            return Response({'error': 'Student not found.'}, status=404)

        admitted = bool(d.get('admitted', False))
        visit_type = d.get('visit_type', 'routine_checkup')

        if visit_type == 'discharge':
            status_value = 'cleared'
            admitted = False
        elif admitted:
            status_value = 'in_sick_bay'
        elif visit_type == 'follow_up':
            status_value = 'observation'
        else:
            status_value = 'cleared'

        bed_number = None
        if admitted:
            active_qs = HealthRecord.objects.filter(status__in=['in_sick_bay', 'observation'], admitted=True)
            taken = set(active_qs.values_list('bed_number', flat=True))
            free = next((n for n in range(1, TOTAL_SICKBAY_BEDS + 1) if n not in taken), None)
            if free is None:
                return Response({'error': 'No sick bay beds available.'}, status=400)
            bed_number = free

        record = HealthRecord.objects.create(
            student=student,
            visit_type=visit_type,
            condition_tag=d.get('condition_tag', 'illness'),
            status=status_value,
            visit_datetime=d.get('visit_datetime') or timezone.now(),
            temperature_c=d.get('temperature_c') or None,
            complaint=d.get('complaint', ''),
            action_taken=d.get('action_taken', ''),
            admitted=admitted,
            bed_number=bed_number,
            discharged_at=timezone.now() if status_value == 'cleared' else None,
            notify_parent=d.get('notify_parent', 'none'),
            recorded_by=request.user,
        )
        return Response(HealthRecordSerializer(record).data, status=201)


class MatronHealthRecordDetailView(APIView):
    """
    PATCH /imboni/matron/health/<pk>/
          body: {status, action_taken, complaint, temperature_c, notify_parent}
          Setting status='cleared' discharges the patient and frees their bed.
    """
    permission_classes = [IsMatron]

    def patch(self, request, pk):
        from django.utils import timezone

        try:
            record = HealthRecord.objects.get(pk=pk)
        except HealthRecord.DoesNotExist:
            return Response({'error': 'Not found.'}, status=404)

        updatable = ['action_taken', 'complaint', 'temperature_c', 'notify_parent']
        for field in updatable:
            if field in request.data:
                setattr(record, field, request.data[field])

        if request.data.get('status') == 'cleared' and record.status != 'cleared':
            record.status = 'cleared'
            record.admitted = False
            record.bed_number = None
            record.discharged_at = timezone.now()

        record.save()
        return Response(HealthRecordSerializer(record).data)


# ---------------------------------------------------------------------------
# Parent Communications
# ---------------------------------------------------------------------------

class MatronParentCommsView(APIView):
    """
    GET  /imboni/matron/parent-comms/?type=&outcome=&student_id=&period=
    POST /imboni/matron/parent-comms/
         body: {student_id, parent_contact, comm_type, contacted_at, subject, notes,
                outcome, urgency, follow_up_required, follow_up_date}
    """
    permission_classes = [IsMatron]

    def get(self, request):
        from datetime import timedelta
        from django.utils import timezone

        qs = ParentCommunication.objects.select_related('student__user').all()

        comm_type = request.query_params.get('type')
        if comm_type:
            qs = qs.filter(comm_type=comm_type)

        outcome = request.query_params.get('outcome')
        if outcome:
            qs = qs.filter(outcome=outcome)

        student_id = request.query_params.get('student_id')
        if student_id:
            qs = qs.filter(student_id=student_id)

        now = timezone.localtime()
        period = request.query_params.get('period')
        if period == 'this_month':
            qs = qs.filter(contacted_at__gte=now.replace(day=1, hour=0, minute=0, second=0, microsecond=0))
        elif period == 'last_month':
            month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            last_month_start = (month_start - timedelta(days=1)).replace(day=1)
            qs = qs.filter(contacted_at__gte=last_month_start, contacted_at__lt=month_start)
        elif period == 'last_3_months':
            qs = qs.filter(contacted_at__gte=now - timedelta(days=90))

        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        this_month_qs = ParentCommunication.objects.filter(contacted_at__gte=month_start)
        stats = {
            'calls_this_month':  this_month_qs.filter(comm_type='call').count(),
            'sms_sent':          this_month_qs.filter(comm_type='sms').count(),
            'emails_sent':       this_month_qs.filter(comm_type='email').count(),
            'awaiting_reply':    ParentCommunication.objects.filter(outcome='awaiting_reply').count(),
        }

        return Response({
            'stats': stats,
            'log': ParentCommunicationSerializer(qs, many=True).data,
        })

    def post(self, request):
        from apps.student.models import Student

        d = request.data
        try:
            student = Student.objects.get(pk=d.get('student_id'))
        except Student.DoesNotExist:
            return Response({'error': 'Student not found.'}, status=404)

        record = ParentCommunication.objects.create(
            student=student,
            parent_contact=d.get('parent_contact', ''),
            comm_type=d.get('comm_type', 'call'),
            contacted_at=d.get('contacted_at'),
            subject=d.get('subject', ''),
            notes=d.get('notes', ''),
            outcome=d.get('outcome', 'completed'),
            urgency=d.get('urgency', 'routine'),
            follow_up_required=d.get('follow_up_required', False),
            follow_up_date=d.get('follow_up_date') or None,
            recorded_by=request.user,
        )
        return Response(ParentCommunicationSerializer(record).data, status=201)


# ---------------------------------------------------------------------------
# Boarding Schedule (standing weekly routine — read-only for the matron)
# ---------------------------------------------------------------------------

class MatronBoardingScheduleView(APIView):
    """
    GET /imboni/matron/boarding-schedule/

    Issued by the Discipline Master; read-only for the matron. Returns the
    standing weekday routine plus the Saturday/Sunday routine paired by row,
    and the recent change log.
    """
    permission_classes = [IsMatron]

    def get(self, request):
        from apps.results.models import AcademicTerm

        weekday_slots = BoardingScheduleSlot.objects.filter(day_type='weekday').order_by('order')
        sat_slots = list(BoardingScheduleSlot.objects.filter(day_type='saturday').order_by('order'))
        sun_slots = list(BoardingScheduleSlot.objects.filter(day_type='sunday').order_by('order'))

        weekday_rows = [
            {
                'time': s.time, 'label': s.label, 'isBreak': s.is_break, 'breakText': s.break_text,
                'cellClass': s.cell_class, 'subject': s.subject, 'teacher': s.supervisor, 'room': s.room,
            }
            for s in weekday_slots
        ]

        def slot_payload(s):
            if not s:
                return None
            return {'cellClass': s.cell_class, 'subject': s.subject, 'teacher': s.supervisor, 'room': s.room}

        weekend_rows = []
        for sat, sun in zip(sat_slots, sun_slots):
            weekend_rows.append({
                'time': sat.time, 'label': sat.label, 'isBreak': sat.is_break, 'breakText': sat.break_text,
                'sat': slot_payload(sat), 'sun': slot_payload(sun),
            })

        changes_qs = BoardingScheduleChange.objects.select_related('changed_by').all()
        changes_this_week = changes_qs.filter(status='new').count()
        current_term = AcademicTerm.objects.filter(is_current=True).first()

        return Response({
            'weekday_rows': weekday_rows,
            'weekend_rows': weekend_rows,
            'changes': BoardingScheduleChangeSerializer(changes_qs[:10], many=True).data,
            'stats': {
                'days_in_schedule': 7,
                'total_activities': sum(1 for s in weekday_slots if not s.is_break) + sum(1 for s in sat_slots + sun_slots if not s.is_break),
                'changes_this_week': changes_this_week,
                'current_term': current_term.name if current_term else '—',
            },
        })
