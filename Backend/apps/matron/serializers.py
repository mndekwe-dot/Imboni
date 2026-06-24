from rest_framework import serializers
from apps.behavior.models import BehaviorReport
from apps.discipline.models import BoardingStudent, DisciplineStaff
from .models import HealthRecord, ParentCommunication, BoardingScheduleSlot, BoardingScheduleChange


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
            'follow_up_required', 'follow_up_date', 'badge', 'status',
        ]
        read_only_fields = ['id', 'status']

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
    student_pk = serializers.SerializerMethodField()
    student_code = serializers.SerializerMethodField()
    full_name = serializers.SerializerMethodField()
    grade_label = serializers.SerializerMethodField()
    grade = serializers.SerializerMethodField()
    section = serializers.SerializerMethodField()
    dormitory = serializers.SerializerMethodField()
    room_number = serializers.SerializerMethodField()

    class Meta:
        model = BoardingStudent
        fields = [
            'id', 'student_pk', 'student_code', 'full_name', 'grade_label', 'grade', 'section',
            'dormitory', 'room_number', 'boarding_type', 'bed_number',
        ]

    def get_student_pk(self, obj):
        return str(obj.student.id)

    def get_student_code(self, obj):
        return obj.student.student_id

    def get_full_name(self, obj):
        return obj.student.user.get_full_name()

    def get_grade(self, obj):
        return obj.student.grade

    def get_section(self, obj):
        return obj.student.section

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


class HealthRecordSerializer(serializers.ModelSerializer):
    """Powers Sick Bay history, current beds, and the health visit log form."""
    student_pk = serializers.SerializerMethodField()
    name = serializers.SerializerMethodField()

    class Meta:
        model = HealthRecord
        fields = [
            'id', 'student_pk', 'name', 'visit_type', 'condition_tag', 'status',
            'visit_datetime', 'temperature_c', 'complaint', 'action_taken',
            'admitted', 'bed_number', 'discharged_at', 'notify_parent', 'created_at',
        ]
        read_only_fields = ['id', 'bed_number', 'status', 'discharged_at', 'created_at']

    def get_student_pk(self, obj):
        return str(obj.student.id)

    def get_name(self, obj):
        return obj.student.user.get_full_name()


class ParentCommunicationSerializer(serializers.ModelSerializer):
    """Powers the Parent Comms log list and create form."""
    student_pk = serializers.SerializerMethodField()
    student_name = serializers.SerializerMethodField()

    class Meta:
        model = ParentCommunication
        fields = [
            'id', 'student_pk', 'student_name', 'parent_contact', 'comm_type',
            'contacted_at', 'subject', 'notes', 'outcome', 'urgency',
            'follow_up_required', 'follow_up_date', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def get_student_pk(self, obj):
        return str(obj.student.id)

    def get_student_name(self, obj):
        return obj.student.user.get_full_name()


class BoardingScheduleSlotSerializer(serializers.ModelSerializer):
    class Meta:
        model = BoardingScheduleSlot
        fields = [
            'id', 'day_type', 'order', 'time', 'label', 'is_break', 'break_text',
            'cell_class', 'subject', 'supervisor', 'room',
        ]


class BoardingScheduleChangeSerializer(serializers.ModelSerializer):
    changed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = BoardingScheduleChange
        fields = ['id', 'description', 'status', 'changed_by_name', 'change_date']

    def get_changed_by_name(self, obj):
        return obj.changed_by.get_full_name() if obj.changed_by else ''
