from django.utils import timezone
from rest_framework import serializers
from apps.authentication.models import User
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


class TeacherStudentSerializer(serializers.Serializer):
    """
    Powers the Students table on the Teacher Students page.
    One row per student enrolled in any of the teacher's classes.
    """
    student_id    = serializers.UUIDField()
    student_code  = serializers.CharField()   # e.g. STU-0001
    full_name     = serializers.CharField()
    initials      = serializers.CharField()   # e.g. "JD"
    class_name    = serializers.CharField()
    attendance_rate   = serializers.FloatField(allow_null=True)
    performance_rate  = serializers.FloatField(allow_null=True)


class PerformanceDistributionSerializer(serializers.Serializer):
    """
    Powers the Performance Distribution histogram.
    One bucket per score band.
    """
    range_label   = serializers.CharField()   # e.g. "85-100%"
    min_score     = serializers.IntegerField()
    max_score     = serializers.IntegerField()
    student_count = serializers.IntegerField()


class AttendanceTrendSerializer(serializers.Serializer):
    """
    Powers the Attendance Trends weekly graph.
    One entry per week (last 4 weeks).
    """
    week_label      = serializers.CharField()   # e.g. "Week 1"
    week_start      = serializers.DateField()
    attendance_rate = serializers.FloatField()


# ---------------------------------------------------------------------------
# Teacher Attendance Management page serializers
# ---------------------------------------------------------------------------

class TeacherAttendanceStudentSerializer(serializers.Serializer):
    """
    One row in the attendance marking table.
    status is null when attendance has not yet been marked for that date.
    """
    student_id   = serializers.UUIDField()
    student_code = serializers.CharField()
    full_name    = serializers.CharField()
    initials     = serializers.CharField()
    status       = serializers.CharField(allow_null=True)   # present|absent|late|excused|null
    notes        = serializers.CharField(allow_blank=True)


class AttendanceRecordInputSerializer(serializers.Serializer):
    """Single record in the bulk mark-attendance payload."""
    student_id = serializers.UUIDField()
    status     = serializers.ChoiceField(choices=['present', 'absent', 'late', 'excused'])
    notes      = serializers.CharField(required=False, allow_blank=True, default='')


class MarkAttendanceSerializer(serializers.Serializer):
    """
    Payload for POST /imboni/teacher/attendance/mark/
    Bulk-saves attendance records for a class on a given date.
    """
    class_id = serializers.UUIDField()
    date     = serializers.DateField()
    records  = AttendanceRecordInputSerializer(many=True)


class AttendancePatternSerializer(serializers.Serializer):
    """
    One entry per weekday for the Attendance Patterns line chart.
    day: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri'
    """
    day             = serializers.CharField()
    attendance_rate = serializers.FloatField()


# ---------------------------------------------------------------------------
# Teacher Results Management page serializers
# ---------------------------------------------------------------------------

class TeacherResultEntrySerializer(serializers.Serializer):
    """
    One row in the results table.
    score_display: e.g. "85/100"
    grade: A|B|C|D|F derived from percentage
    """
    assessment_id  = serializers.UUIDField()
    student_id     = serializers.UUIDField()
    student_code   = serializers.CharField()
    full_name      = serializers.CharField()
    initials       = serializers.CharField()
    assessment_title = serializers.CharField()
    score_obtained = serializers.FloatField()
    max_score      = serializers.FloatField()
    score_display  = serializers.CharField()   # e.g. "85/100"
    percentage     = serializers.FloatField()
    grade          = serializers.CharField()   # A|B|C|D|F
    date           = serializers.DateField()


class ResultEntryInputSerializer(serializers.Serializer):
    """Single row in the bulk-save payload."""
    student_id       = serializers.UUIDField()
    score_obtained   = serializers.FloatField(min_value=0)
    notes            = serializers.CharField(required=False, allow_blank=True, default='')


class BulkSaveResultsSerializer(serializers.Serializer):
    """
    Payload for POST /imboni/teacher/results/bulk-save/
    Creates or updates Assessment records for all students in a class.
    """
    class_id         = serializers.UUIDField()
    subject_id       = serializers.UUIDField()
    assessment_title = serializers.CharField()
    assessment_type  = serializers.ChoiceField(
        choices=['quiz', 'homework', 'project', 'presentation', 'lab']
    )
    date             = serializers.DateField()
    max_score        = serializers.FloatField(min_value=1)
    entries          = ResultEntryInputSerializer(many=True)


class GradeDistributionSerializer(serializers.Serializer):
    """
    Powers the Grade Distribution Analysis section.
    Buckets + summary stats for a class assessment.
    """
    assessment_title  = serializers.CharField()
    class_name        = serializers.CharField()
    subject_name      = serializers.CharField()
    class_average     = serializers.FloatField()
    avg_change        = serializers.FloatField()   # vs previous assessment, e.g. +3.0
    highest_score     = serializers.FloatField()
    highest_scorer    = serializers.CharField()    # student full name
    pass_rate         = serializers.FloatField()   # percentage
    passed_count      = serializers.IntegerField()
    total_count       = serializers.IntegerField()
    buckets           = serializers.ListField(child=serializers.DictField())


class PerformanceTrendSerializer(serializers.Serializer):
    """
    One data point for the Performance Trends Over Time line graph.
    One entry per month that has assessment data.
    """
    month_label    = serializers.CharField()   # e.g. "Jan", "Feb"
    month          = serializers.IntegerField()
    year           = serializers.IntegerField()
    avg_score      = serializers.FloatField()
