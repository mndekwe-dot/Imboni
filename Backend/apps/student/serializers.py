from rest_framework import serializers
from .models import Activity, ActivityEnrollment, ActivityEvent, Assignment, AssignmentSubmission


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


class AssignmentSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    class_name = serializers.CharField(source='class_obj.name', read_only=True)
    teacher_name = serializers.SerializerMethodField()

    class Meta:
        model = Assignment
        fields = [
            'id', 'title', 'description', 'subject_name', 'class_name',
            'teacher_name', 'due_date', 'attachment', 'created_at',
        ]

    def get_teacher_name(self, obj):
        return obj.teacher.get_full_name()


class AssignmentWithStatusSerializer(serializers.ModelSerializer):
    """Assignment enriched with the requesting student's submission status."""
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    teacher_name = serializers.SerializerMethodField()
    submission_status = serializers.SerializerMethodField()
    submission_grade = serializers.SerializerMethodField()

    class Meta:
        model = Assignment
        fields = [
            'id', 'title', 'description', 'subject_name', 'teacher_name',
            'due_date', 'submission_status', 'submission_grade',
        ]

    def get_teacher_name(self, obj):
        return obj.teacher.get_full_name()

    def get_submission_status(self, obj):
        student = self.context.get('student')
        if not student:
            return 'pending'
        sub = AssignmentSubmission.objects.filter(assignment=obj, student=student).first()
        return sub.status if sub else 'pending'

    def get_submission_grade(self, obj):
        student = self.context.get('student')
        if not student:
            return None
        sub = AssignmentSubmission.objects.filter(assignment=obj, student=student).first()
        return float(sub.grade) if sub and sub.grade else None


class AssignmentSubmissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AssignmentSubmission
        fields = ['id', 'assignment', 'submitted_at', 'file', 'notes', 'status', 'grade', 'feedback']
        read_only_fields = ['submitted_at', 'grade', 'feedback', 'status']
