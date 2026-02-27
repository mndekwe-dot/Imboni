from rest_framework import serializers
from .models import Assessment


class AssessmentSerializer(serializers.ModelSerializer):
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
