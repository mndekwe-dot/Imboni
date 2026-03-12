from datetime import date
from django.db.models import Sum
from rest_framework import generics
from rest_framework.views import APIView
from rest_framework.response import Response

from .models import AttendanceRecord, AttendanceSummary
from .serializers import AttendanceRecordSerializer


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
