from rest_framework import serializers


class DOSDashboardStatsSerializer(serializers.Serializer):
    """4 stat cards at the top of the DOS dashboard."""
    total_students       = serializers.IntegerField()
    new_students         = serializers.IntegerField()   # enrolled this month
    teaching_staff       = serializers.IntegerField()
    avg_performance      = serializers.FloatField()     # school-wide avg final_score %
    avg_performance_change = serializers.FloatField()   # vs previous term
    pending_approvals    = serializers.IntegerField()   # Results with status='submitted'


class DOSActivitySerializer(serializers.Serializer):
    """One item in the Recent Activity feed."""
    activity_type = serializers.CharField()   # 'approval' | 'staff' | 'pending'
    description   = serializers.CharField()
    timestamp     = serializers.DateTimeField(allow_null=True)
    time_ago      = serializers.CharField()   # human-readable e.g. "2 hours ago"


class PerformanceOverviewSerializer(serializers.Serializer):
    """School Average + Attendance Rate progress bars."""
    school_average  = serializers.FloatField()
    attendance_rate = serializers.FloatField()


class GradePerformanceSerializer(serializers.Serializer):
    """One bar in the Performance by Grade chart."""
    grade       = serializers.CharField()   # e.g. "Grade 1"
    avg_score   = serializers.FloatField()


# ---------------------------------------------------------------------------
# Teacher Management page
# ---------------------------------------------------------------------------

class TeacherManagementStatsSerializer(serializers.Serializer):
    """4 stat cards on the Teacher Management page."""
    total_teachers        = serializers.IntegerField()
    new_this_term         = serializers.IntegerField()   # joined this term
    full_time_count       = serializers.IntegerField()
    full_time_pct         = serializers.FloatField()     # % of staff
    part_time_count       = serializers.IntegerField()
    part_time_pct         = serializers.FloatField()
    student_teacher_ratio = serializers.CharField()      # e.g. "1:15"
    ratio_label           = serializers.CharField()      # "Optimal" | "High" | "Low"


class TeacherListSerializer(serializers.Serializer):
    """One row in the teacher list table."""
    teacher_id      = serializers.UUIDField()
    full_name       = serializers.CharField()
    email           = serializers.CharField()
    phone_number    = serializers.CharField()
    avatar          = serializers.CharField(allow_null=True)
    employment_type = serializers.CharField()   # full_time | part_time
    subjects        = serializers.ListField(child=serializers.CharField())
    class_count     = serializers.IntegerField()
    joined_at       = serializers.DateTimeField()


class AddTeacherSerializer(serializers.Serializer):
    """Payload for POST /imboni/dos/teachers/ (Add Teacher button)."""
    first_name      = serializers.CharField()
    last_name       = serializers.CharField()
    email           = serializers.EmailField()
    phone_number    = serializers.CharField(required=False, allow_blank=True, default='')
    employment_type = serializers.ChoiceField(choices=['full_time', 'part_time'], default='full_time')
    password        = serializers.CharField(write_only=True, min_length=8)


class TeachersBySubjectSerializer(serializers.Serializer):
    """One progress bar row in Teachers by Subject section."""
    subject_id    = serializers.UUIDField()
    subject_name  = serializers.CharField()
    teacher_count = serializers.IntegerField()
    percentage    = serializers.FloatField()   # share of total teachers


class WorkloadBucketSerializer(serializers.Serializer):
    """One bucket in the Workload Distribution chart."""
    label         = serializers.CharField()    # e.g. "1-2 classes"
    teacher_count = serializers.IntegerField()


class PerformanceRatingSerializer(serializers.Serializer):
    """One bucket in the Performance Ratings chart."""
    label         = serializers.CharField()    # Excellent | Good | Average | Needs Improvement
    teacher_count = serializers.IntegerField()
    percentage    = serializers.FloatField()
