from rest_framework import serializers
from .models import AttendanceRecord


class AttendanceRecordSerializer(serializers.ModelSerializer):
    """
    One day's attendance record — powers each coloured cell in the calendar.
    status choices: present | absent | late | excused
    """
    class Meta:
        model = AttendanceRecord
        fields = ['id', 'date', 'status', 'time_in', 'minutes_late', 'notes']
