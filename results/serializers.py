from rest_framework import serializers
from .models import Assessment


class AssessmentSerializer(serializers.ModelSerializer):
    """
    Read-only serializer — used by parents viewing a child's assessments.
    No student/subject/term FK fields since the view is already filtered by student.
    """
    subject_name = serializers.ReadOnlyField(source='subject.name')
    score_display = serializers.SerializerMethodField()

    class Meta:
        model = Assessment
        fields = [
            'id', 'title', 'assessment_type', 'date',
            'score_obtained', 'max_score', 'percentage',
            'subject_name', 'score_display', 'teacher_notes',
        ]

    def get_score_display(self, obj):
        """Returns score in '18/20' format as shown in the frontend."""
        return f"{int(obj.score_obtained)}/{int(obj.max_score)}"


class AssessmentCreateSerializer(serializers.ModelSerializer):
    """
    Used by teachers to create and update assessment grades.
    Includes writable student/subject/term FK fields.
    Returns student_name and subject_name on read for display.
    """
    student_name = serializers.ReadOnlyField(source='student.user.get_full_name')
    subject_name = serializers.ReadOnlyField(source='subject.name')
    score_display = serializers.SerializerMethodField()

    class Meta:
        model = Assessment
        fields = [
            'id', 'student', 'subject', 'term',
            'title', 'assessment_type', 'date',
            'max_score', 'score_obtained', 'percentage',
            'teacher_notes', 'created_at',
            # Computed read-only fields
            'student_name', 'subject_name', 'score_display',
        ]
        read_only_fields = ['id', 'percentage', 'created_at']

    def get_score_display(self, obj):
        return f"{int(obj.score_obtained)}/{int(obj.max_score)}"
