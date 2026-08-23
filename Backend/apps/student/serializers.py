from rest_framework import serializers
from .models import Activity, ActivityEnrollment, ActivityEvent


class ActivitySerializer(serializers.ModelSerializer):
    enrolled_count = serializers.SerializerMethodField()
    teacher_name = serializers.SerializerMethodField()
    is_full = serializers.SerializerMethodField()

    class Meta:
        model = Activity
        fields = [
            'id', 'name', 'description', 'category', 'schedule',
            'venue', 'max_members', 'teacher_name',
            'enrolled_count', 'is_full', 'is_active',
        ]

    def get_enrolled_count(self, obj):
        return obj.enrollments.filter(status='active').count()

    def get_teacher_name(self, obj):
        if obj.teacher_in_charge:
            return obj.teacher_in_charge.get_full_name()
        return None

    def get_is_full(self, obj):
        return obj.enrollments.filter(status='active').count() >= obj.max_members


class ActivityEnrollmentSerializer(serializers.ModelSerializer):
    activity = ActivitySerializer(read_only=True)

    class Meta:
        model = ActivityEnrollment
        fields = ['id', 'activity', 'enrolled_at', 'status']


class ActivityEventSerializer(serializers.ModelSerializer):
    activity_name = serializers.CharField(source='activity.name', read_only=True)

    class Meta:
        model = ActivityEvent
        fields = [
            'id', 'activity_name', 'title', 'date',
            'start_time', 'end_time', 'venue', 'description',
        ]
