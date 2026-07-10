from rest_framework import serializers
from .models import BehaviorReport


class BehaviorReportSerializer(serializers.ModelSerializer):
    """
    Powers each report card in the Recent Reports list.

    Fields mapped to the UI:
        title               — card heading (e.g. "Outstanding Class Participation")
        reported_by_display — subtitle line (e.g. "Ms. Grace Mwangi - Mathematics")
        badge               — coloured pill (Positive | Excellent | Minor | Moderate …)
        description         — body text
        date                — DATE row
        action_taken        — ACTION TAKEN row
    """
    reported_by_display = serializers.SerializerMethodField()
    badge = serializers.SerializerMethodField()

    class Meta:
        model = BehaviorReport
        fields = [
            'id', 'title', 'report_type', 'severity',
            'description', 'date', 'action_taken',
            'reported_by_display', 'badge', 'marks_deducted', 'status',
        ]

    def get_badge(self, obj):
        """
        Map report_type / severity to the badge label shown in the UI.
          positive   → "Positive"
          achievement → "Excellent"
          warning / incident → severity label (e.g. "Minor", "Moderate")
        """
        if obj.report_type == 'positive':
            return 'Positive'
        if obj.report_type == 'achievement':
            return 'Excellent'
        if obj.severity:
            return obj.severity.capitalize()
        return obj.report_type.replace('_', ' ').capitalize()

    def get_reported_by_display(self, obj):
        """
        Build the subtitle line shown under each report title.
        Teachers → "Mr. John Kariuki - Physics"
        DOS      → "Dr. Samuel Ochieng - Director of Studies"
        Others   → full name only
        """
        if not obj.reported_by:
            return None

        name = obj.reported_by.get_full_name()
        role = obj.reported_by.role

        if role == 'teacher':
            # Read from the reporter's teaching assignments. List views prefetch
            # reported_by__teaching_assignments__subject, so this is cache-only
            # (was a per-report query — an N+1 on lists of up to 100 reports).
            assignments = list(obj.reported_by.teaching_assignments.all())
            if assignments:
                return f"{name} - {assignments[0].subject.name}"

        role_labels = {
            'dos':   'Director of Studies',
            'admin': 'Administrator',
        }
        suffix = role_labels.get(role)
        return f"{name} - {suffix}" if suffix else name
