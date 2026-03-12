from rest_framework import serializers
from behavior.models import BehaviorReport
from discipline.models import BoardingStudent, DisciplineStaff


class MatronBehaviorReportSerializer(serializers.ModelSerializer):
    """Powers the incident list and create form in the matron portal."""
    student_name = serializers.SerializerMethodField()
    student_id_code = serializers.SerializerMethodField()
    badge = serializers.SerializerMethodField()

    class Meta:
        model = BehaviorReport
        fields = [
            'id', 'student_name', 'student_id_code', 'title',
            'report_type', 'severity', 'description', 'date',
            'location', 'action_taken', 'parents_notified',
            'follow_up_required', 'follow_up_date', 'badge',
        ]
        read_only_fields = ['id']

    def get_student_name(self, obj):
        return obj.student.user.get_full_name()

    def get_student_id_code(self, obj):
        return obj.student.student_id

    def get_badge(self, obj):
        if obj.report_type == 'positive':
            return 'Positive'
        if obj.report_type == 'achievement':
            return 'Excellent'
        if obj.severity:
            return obj.severity.capitalize()
        return obj.report_type.replace('_', ' ').capitalize()


class MatronStudentSerializer(serializers.ModelSerializer):
    """Student card shown in the Matron › My Students list."""
    full_name = serializers.SerializerMethodField()
    grade_label = serializers.SerializerMethodField()
    dormitory = serializers.SerializerMethodField()
    room_number = serializers.SerializerMethodField()

    class Meta:
        model = BoardingStudent
        fields = [
            'id', 'full_name', 'grade_label', 'dormitory', 'room_number',
            'boarding_type', 'bed_number',
        ]

    def get_full_name(self, obj):
        return obj.student.user.get_full_name()

    def get_grade_label(self, obj):
        grade_labels = {
            '1': 'Secondary 1', '2': 'Secondary 2', '3': 'Secondary 3',
            '4': 'Secondary 4', '5': 'Secondary 5', '6': 'Secondary 6',
        }
        grade = grade_labels.get(obj.student.grade, obj.student.grade)
        return f"{grade} {obj.student.section}"

    def get_dormitory(self, obj):
        return obj.dormitory

    def get_room_number(self, obj):
        return obj.room_number
