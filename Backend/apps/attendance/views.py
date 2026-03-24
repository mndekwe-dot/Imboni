from datetime import date
from django.db.models import Sum
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from apps.authentication.permissions import IsTeacherOrDOS, IsDOSOrAdmin

from .models import AttendanceRecord, AttendanceSummary
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
