from rest_framework import serializers
from .models import AttendanceRecord, AttendanceSummary


class AttendanceRecordSerializer(serializers.ModelSerializer):
    """
    One day's attendance record — powers each coloured cell in the calendar.
    status choices: present | absent | late | excused
    """
    class Meta:
        model  = AttendanceRecord
        fields = ['id', 'date', 'status', 'time_in', 'minutes_late', 'notes']


class AttendanceSummarySerializer(serializers.ModelSerializer):
    """
    Monthly attendance summary for a student — used by DOS and parent portals.
    """
    student_name = serializers.ReadOnlyField(source='student.user.get_full_name')
    student_code = serializers.ReadOnlyField(source='student.student_id')
    grade        = serializers.ReadOnlyField(source='student.grade')

    class Meta:
        model  = AttendanceSummary
        fields = [
            'id', 'student_name', 'student_code', 'grade',
            'month', 'year',
            'total_days', 'present_days', 'absent_days',
            'late_days', 'excused_days', 'attendance_percentage',
        ]


class BulkAttendanceEntrySerializer(serializers.Serializer):
    """Single row inside a bulk-mark request."""
    student_id = serializers.UUIDField()
    status     = serializers.ChoiceField(choices=['present', 'absent', 'late', 'excused'])
    time_in    = serializers.TimeField(required=False, allow_null=True)
    minutes_late = serializers.IntegerField(required=False, default=0)
    notes      = serializers.CharField(required=False, allow_blank=True, default='')


class BulkMarkAttendanceSerializer(serializers.Serializer):
    """
    Payload for POST /imboni/attendance/bulk-mark/

    Body:
        date     — ISO date string e.g. "2026-03-24"
        records  — list of { student_id, status, time_in?, minutes_late?, notes? }
    """
    date    = serializers.DateField()
    records = BulkAttendanceEntrySerializer(many=True)
