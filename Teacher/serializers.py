from django.utils import timezone
from rest_framework import serializers
from authentication.models import User
from .models import Timetable, Task, Reminder


class TeacherSerializer(serializers.ModelSerializer):
    full_name = serializers.ReadOnlyField()

    class Meta:
        model = User
        fields = ['id', 'username', 'full_name', 'email', 'phone_number', 'avatar']


class TimetableSerializer(serializers.ModelSerializer):
    subject_name = serializers.ReadOnlyField(source='subject.name')
    teacher_name = serializers.ReadOnlyField(source='teacher.get_full_name')
    class_name   = serializers.ReadOnlyField(source='class_obj.name')
    grade        = serializers.ReadOnlyField(source='class_obj.grade')
    section      = serializers.ReadOnlyField(source='class_obj.section')

    class Meta:
        model = Timetable
        fields = [
            'id', 'day', 'start_time', 'end_time', 'room_number',
            'subject_name', 'teacher_name', 'class_name', 'grade', 'section',
        ]
        read_only_fields = ['id']


class ScheduleItemSerializer(TimetableSerializer):
    """
    Extends TimetableSerializer with a `status` field for Today's Schedule:
      completed   — period already finished
      in_progress — period is currently running
      upcoming    — period hasn't started yet
    """
    status = serializers.SerializerMethodField()

    class Meta(TimetableSerializer.Meta):
        fields = TimetableSerializer.Meta.fields + ['status']

    def get_status(self, obj):
        now = timezone.localtime().time()
        if now > obj.end_time:
            return 'completed'
        if now >= obj.start_time:
            return 'in_progress'
        return 'upcoming'


class MyClassSerializer(serializers.Serializer):
    """
    Powers the My Classes cards:
      class_name, subject_name, student_count, avg_score,
      schedule_days ("Mon, Wed, Fri"), schedule_time (08:00 AM),
      room_number, next_period
    """
    class_id       = serializers.UUIDField()
    class_name     = serializers.CharField()
    subject_name   = serializers.CharField()
    student_count  = serializers.IntegerField()
    avg_score      = serializers.FloatField(allow_null=True)
    schedule_days  = serializers.CharField()         # e.g. "Mon, Wed, Fri"
    schedule_time  = serializers.TimeField(allow_null=True)  # first period start
    room_number    = serializers.CharField()
    next_period    = serializers.TimeField(allow_null=True)


class HomeworkStatusSerializer(serializers.Serializer):
    """
    Powers the Homework Submission Status progress bars.
    One row per class showing the most recent assessment submission rate.
    bar_color: green (>=90%) | orange (>=75%) | red (<75%)
    """
    class_id         = serializers.UUIDField()
    class_name       = serializers.CharField()
    assessment_title = serializers.CharField()
    submitted_count  = serializers.IntegerField()
    total_students   = serializers.IntegerField()
    submission_rate  = serializers.FloatField()
    bar_color        = serializers.CharField()


class TaskSerializer(serializers.ModelSerializer):
    """Pending Tasks panel — full CRUD."""
    class Meta:
        model = Task
        fields = ['id', 'title', 'description', 'priority', 'due_date',
                  'is_completed', 'created_at']
        read_only_fields = ['id', 'created_at']


class ReminderSerializer(serializers.ModelSerializer):
    """Quick Reminders widget — full CRUD."""
    class Meta:
        model = Reminder
        fields = ['id', 'content', 'is_completed', 'created_at']
        read_only_fields = ['id', 'created_at']


class ClassPerformanceSerializer(serializers.Serializer):
    """Class Performance section — average score per class."""
    class_id      = serializers.UUIDField()
    class_name    = serializers.CharField()
    average_score = serializers.FloatField()


class ActivitySerializer(serializers.Serializer):
    """Recent Activities feed item."""
    activity_type = serializers.CharField()   # e.g. 'result' | 'attendance' | 'incident'
    description   = serializers.CharField()
    timestamp     = serializers.DateTimeField()
