from datetime import date, timedelta
from django.db.models import Sum
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from apps.authentication.permissions import IsTeacherOrDOS, IsDOSOrAdmin
from apps.authentication.models import User
from apps.notifications.models import Notification

from .models import AttendanceRecord, AttendanceSummary, TeacherAttendanceRecord
from .serializers import (
    AttendanceRecordSerializer, AttendanceSummarySerializer,
    BulkMarkAttendanceSerializer,
)


class StudentAttendanceStatsView(APIView):
    """
    Aggregated attendance stats for the 4 stat cards at the top of the page.

    GET /imboni/attendance/students/<pk>/stats/

    Response:
        overall_rate        — e.g. 96.0  (percentage)
        attendance_label    — e.g. "Excellent attendance"
        days_present        — total present days across all summaries
        days_absent         — total absent days (excused included in separate field)
        excused_absences    — subset of absences that are excused
        late_arrivals       — total late days
        late_label          — e.g. "Below average" / "On track"
    """
    # permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        summaries = AttendanceSummary.objects.filter(student_id=pk)

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
            attendance_label = 'Excellent attendance'
        elif overall_rate >= 85:
            attendance_label = 'Good attendance'
        elif overall_rate >= 75:
            attendance_label = 'Average attendance'
        else:
            attendance_label = 'Needs improvement'

        late_label = 'Below average' if late > 2 else 'On track'

        return Response({
            'overall_rate': overall_rate,
            'attendance_label': attendance_label,
            'days_present': present,
            'days_absent': absent,
            'excused_absences': excused,
            'late_arrivals': late,
            'late_label': late_label,
        })


class StudentAttendanceCalendarView(generics.ListAPIView):
    """
    All attendance records for a student in a given month — powers the calendar grid.
    Days missing from the response are weekends/holidays (frontend colours them grey).

    GET /imboni/attendance/students/<pk>/calendar/?month=2&year=2026

    Defaults to the current month/year when query params are omitted.
    status values: present (green) | absent (red) | late (orange) | excused (grey)
    """
    serializer_class = AttendanceRecordSerializer
    # permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        today = date.today()
        month = int(self.request.query_params.get('month', today.month))
        year  = int(self.request.query_params.get('year',  today.year))

        return (
            AttendanceRecord.objects
            .filter(
                student_id=self.kwargs['pk'],
                date__month=month,
                date__year=year,
            )
            .order_by('date')
        )


class ClassAttendanceView(generics.ListAPIView):
    """
    All attendance records for a given class (grade+section) on a specific date.
    Teachers use this to see who is marked for a day.

    GET /imboni/attendance/class/?grade=3&section=A&date=2026-03-24
    """
    serializer_class   = AttendanceRecordSerializer
    permission_classes = [IsTeacherOrDOS]

    def get_queryset(self):
        grade   = self.request.query_params.get('grade')
        section = self.request.query_params.get('section')
        day     = self.request.query_params.get('date', str(date.today()))

        qs = AttendanceRecord.objects.select_related('student__user').filter(date=day)
        if grade:
            qs = qs.filter(student__grade=grade)
        if section:
            qs = qs.filter(student__section=section)
        return qs.order_by('student__user__last_name')


class BulkMarkAttendanceView(APIView):
    """
    Mark attendance for an entire class in one request.

    POST /imboni/attendance/bulk-mark/
    Body: { date: "2026-03-24", records: [{ student_id, status, ... }, ...] }

    Creates or updates each AttendanceRecord for the given date.
    Returns counts of created/updated records.
    """
    permission_classes = [IsTeacherOrDOS]

    def post(self, request):
        serializer = BulkMarkAttendanceSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        mark_date = serializer.validated_data['date']
        records   = serializer.validated_data['records']
        created   = 0
        updated   = 0

        for entry in records:
            obj, is_new = AttendanceRecord.objects.update_or_create(
                student_id=entry['student_id'],
                date=mark_date,
                defaults={
                    'status':       entry['status'],
                    'time_in':      entry.get('time_in'),
                    'minutes_late': entry.get('minutes_late', 0),
                    'notes':        entry.get('notes', ''),
                    'marked_by':    request.user,
                },
            )
            if is_new:
                created += 1
            else:
                updated += 1

        return Response({'date': str(mark_date), 'created': created, 'updated': updated})


class DosClassWeeklyAttendanceView(APIView):
    """
    Weekly attendance grid for the DOS attendance page.

    GET /imboni/attendance/class/weekly/?grade=1&section=A&week_of=2026-03-09

    grade   — numeric grade (1-6)
    section — stream letter (A, B, C …)
    week_of — any ISO date in the target week; view snaps to Monday

    Response:
        class_name    — e.g. "S1A"
        class_teacher — teacher full name or null
        week_start    — ISO date of Monday
        week_end      — ISO date of Friday
        students      — list of student rows with per-day status and weekly rate
    """
    permission_classes = [IsDOSOrAdmin]

    def get(self, request):
        from apps.results.models import AcademicTerm
        from apps.teacher.models import ClassAssignment

        grade     = request.query_params.get('grade', '').strip()
        section   = request.query_params.get('section', '').strip()
        week_of   = request.query_params.get('week_of', '').strip()
        try:
            page      = max(1, int(request.query_params.get('page', 1)))
            page_size = min(100, max(1, int(request.query_params.get('page_size', 25))))
        except (ValueError, TypeError):
            page, page_size = 1, 25

        try:
            week_date = date.fromisoformat(week_of) if week_of else date.today()
        except ValueError:
            week_date = date.today()

        monday = week_date - timedelta(days=week_date.weekday())
        weekdays = {
            'mon': monday,
            'tue': monday + timedelta(days=1),
            'wed': monday + timedelta(days=2),
            'thu': monday + timedelta(days=3),
            'fri': monday + timedelta(days=4),
        }
        friday = monday + timedelta(days=4)

        term = AcademicTerm.objects.filter(is_current=True).first()
        if not term:
            return Response({'class_name': '', 'week_start': str(monday), 'week_end': str(friday),
                             'count': 0, 'total_pages': 1, 'page': 1, 'page_size': page_size, 'students': []})

        filters = {'term': term}
        if grade:
            filters['class_obj__grade'] = grade
        if section:
            filters['class_obj__section'] = section

        enrollments = (
            ClassAssignment.objects
            .filter(**filters)
            .select_related('student__user', 'class_obj')
            .order_by('class_obj__grade', 'class_obj__section', 'student__user__last_name', 'student__user__first_name')
        )

        total_count = enrollments.count()
        total_pages = max(1, -(-total_count // page_size))  # ceiling division
        page        = min(page, total_pages)
        offset      = (page - 1) * page_size
        page_enrollments = enrollments[offset: offset + page_size]

        student_ids = [e.student_id for e in page_enrollments]

        week_records = AttendanceRecord.objects.filter(
            student_id__in=student_ids,
            date__gte=monday,
            date__lte=friday,
        )
        record_map = {(str(r.student_id), r.date): r.status for r in week_records}

        students = []
        for enr in page_enrollments:
            s = enr.student
            name_parts = s.full_name.split()
            initials = ''.join(p[0].upper() for p in name_parts[:2]) if name_parts else '?'
            day_statuses = {day: record_map.get((str(s.id), d)) for day, d in weekdays.items()}
            present_count = sum(1 for v in day_statuses.values() if v == 'present')
            rate = round(present_count / 5 * 100)
            students.append({
                'student_id':    s.id,
                'full_name':     s.full_name,
                'initials':      initials,
                'student_code':  s.student_id,
                'class_name':    f'S{enr.class_obj.grade}{enr.class_obj.section}',
                'days':          day_statuses,
                'present_count': present_count,
                'rate':          rate,
            })

        # Class teacher only meaningful when viewing a single class
        class_teacher = None
        if grade and section and enrollments.exists():
            class_obj = enrollments.first().class_obj
            if class_obj.class_teacher:
                u = class_obj.class_teacher
                class_teacher = u.get_full_name() or u.email

        if grade and section:
            class_name = f'S{grade}{section}'
        elif grade:
            class_name = f'S{grade} — All Classes'
        elif section:
            class_name = f'All Years — Class {section}'
        else:
            class_name = 'All Classes'

        return Response({
            'class_name':    class_name,
            'class_teacher': class_teacher,
            'week_start':    str(monday),
            'week_end':      str(friday),
            'count':         total_count,
            'total_pages':   total_pages,
            'page':          page,
            'page_size':     page_size,
            'students':      students,
        })


class StudentAttendanceSummaryListView(generics.ListAPIView):
    """
    Monthly attendance summaries for all students, filterable by grade/month/year.
    Used by DOS attendance overview.

    GET /imboni/attendance/summaries/?grade=3&month=3&year=2026
    """
    serializer_class   = AttendanceSummarySerializer
    permission_classes = [IsDOSOrAdmin]

    def get_queryset(self):
        today   = date.today()
        month   = int(self.request.query_params.get('month', today.month))
        year    = int(self.request.query_params.get('year',  today.year))
        grade   = self.request.query_params.get('grade')

        qs = AttendanceSummary.objects.select_related('student__user').filter(month=month, year=year)
        if grade:
            qs = qs.filter(student__grade=grade)
        return qs.order_by('student__grade', 'student__section', 'student__user__last_name')


class DosTeacherWeeklyAttendanceView(APIView):
    """
    Weekly attendance grid for all teachers (DOS view).

    GET /imboni/attendance/teacher/weekly/?week_of=2026-03-09&page=1&page_size=25

    Response:
        week_start, week_end, count, total_pages, page, page_size,
        teachers — list of { teacher_id, full_name, initials, email,
                              days: {mon…fri: status|null},
                              present_count, rate }
    """
    permission_classes = [IsDOSOrAdmin]

    def get(self, request):
        from apps.authentication.models import User

        week_of = request.query_params.get('week_of', '').strip()
        try:
            page      = max(1, int(request.query_params.get('page', 1)))
            page_size = min(100, max(1, int(request.query_params.get('page_size', 25))))
        except (ValueError, TypeError):
            page, page_size = 1, 25

        try:
            week_date = date.fromisoformat(week_of) if week_of else date.today()
        except ValueError:
            week_date = date.today()

        monday = week_date - timedelta(days=week_date.weekday())
        weekdays = {
            'mon': monday,
            'tue': monday + timedelta(days=1),
            'wed': monday + timedelta(days=2),
            'thu': monday + timedelta(days=3),
            'fri': monday + timedelta(days=4),
        }
        friday = monday + timedelta(days=4)

        teachers_qs = (
            User.objects
            .filter(role='teacher')
            .order_by('last_name', 'first_name')
        )

        total_count = teachers_qs.count()
        total_pages = max(1, -(-total_count // page_size))
        page        = min(page, total_pages)
        offset      = (page - 1) * page_size
        page_teachers = teachers_qs[offset: offset + page_size]

        teacher_ids = [t.id for t in page_teachers]
        week_records = TeacherAttendanceRecord.objects.filter(
            teacher_id__in=teacher_ids,
            date__gte=monday,
            date__lte=friday,
        )
        record_map = {(str(r.teacher_id), r.date): r.status for r in week_records}

        teachers = []
        for t in page_teachers:
            name = t.get_full_name() or t.email
            parts = name.split()
            initials = ''.join(p[0].upper() for p in parts[:2]) if parts else '?'
            day_statuses = {day: record_map.get((str(t.id), d)) for day, d in weekdays.items()}
            present_count = sum(1 for v in day_statuses.values() if v == 'present')
            rate = round(present_count / 5 * 100)
            teachers.append({
                'teacher_id':    str(t.id),
                'full_name':     name,
                'initials':      initials,
                'email':         t.email,
                'days':          day_statuses,
                'present_count': present_count,
                'rate':          rate,
            })

        return Response({
            'week_start':  str(monday),
            'week_end':    str(friday),
            'count':       total_count,
            'total_pages': total_pages,
            'page':        page,
            'page_size':   page_size,
            'teachers':    teachers,
        })


class MarkTeacherAttendanceView(APIView):
    """
    POST /imboni/attendance/teacher/mark/

    Body: { date: "2026-03-10", records: [{ teacher_id, status, notes? }, ...] }
    Creates or updates TeacherAttendanceRecord rows.
    """
    permission_classes = [IsDOSOrAdmin]

    def post(self, request):
        mark_date_str = request.data.get('date', '')
        records       = request.data.get('records', [])

        try:
            mark_date = date.fromisoformat(mark_date_str)
        except (ValueError, TypeError):
            return Response({'error': 'Invalid date.'}, status=400)

        if not isinstance(records, list) or not records:
            return Response({'error': 'records must be a non-empty list.'}, status=400)

        saved = 0
        for rec in records:
            teacher_id = rec.get('teacher_id')
            att_status = rec.get('status')
            if not teacher_id or att_status not in ('present', 'absent', 'late', 'excused'):
                continue
            TeacherAttendanceRecord.objects.update_or_create(
                teacher_id=teacher_id,
                date=mark_date,
                defaults={
                    'status':    att_status,
                    'notes':     rec.get('notes', ''),
                    'marked_by': request.user if request.user.is_authenticated else None,
                },
            )
            saved += 1

            if att_status == 'absent':
                absent_teacher = User.objects.filter(pk=teacher_id).first()
                teacher_name = absent_teacher.get_full_name() if absent_teacher else 'A teacher'
                for dos_user in User.objects.filter(role='dos'):
                    Notification.objects.create(
                        user=dos_user,
                        title='Teacher marked absent',
                        message=f"{teacher_name} was marked absent on {mark_date}.",
                        type='staff',
                        path='/dos/attendance',
                    )

        return Response({'saved': saved})
