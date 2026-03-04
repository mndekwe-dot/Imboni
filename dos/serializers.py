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
