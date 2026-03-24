from rest_framework import serializers
from .models import DisciplineStaff, StudentLeader, BoardingStudent, DiningPlan


class DisciplineStaffSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    email = serializers.CharField(source='user.email', read_only=True)

    class Meta:
        model = DisciplineStaff
        fields = [
            'id', 'full_name', 'email', 'staff_type',
            'assigned_dormitory', 'assigned_grade', 'is_active', 'created_at',
        ]

    def get_full_name(self, obj):
        return obj.user.get_full_name()


class StudentLeaderSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    student_id = serializers.CharField(source='student.student_id', read_only=True)
    grade = serializers.CharField(source='student.grade', read_only=True)
    section = serializers.CharField(source='student.section', read_only=True)
    term_name = serializers.CharField(source='term.name', read_only=True)

    class Meta:
        model = StudentLeader
        fields = [
            'id', 'student_name', 'student_id', 'grade', 'section',
            'role', 'term_name', 'appointed_date', 'is_active', 'notes',
        ]

    def get_student_name(self, obj):
        return obj.student.user.get_full_name()


class BoardingStudentSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    student_id = serializers.CharField(source='student.student_id', read_only=True)
    grade = serializers.CharField(source='student.grade', read_only=True)
    section = serializers.CharField(source='student.section', read_only=True)

    class Meta:
        model = BoardingStudent
        fields = [
            'id', 'student_name', 'student_id', 'grade', 'section',
            'dormitory', 'room_number', 'bed_number', 'boarding_type',
            'check_in_date', 'is_active', 'notes',
        ]

    def get_student_name(self, obj):
        return obj.student.user.get_full_name()


class DiningPlanSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    student_id = serializers.CharField(source='student.student_id', read_only=True)
    term_name = serializers.CharField(source='term.name', read_only=True)

    class Meta:
        model = DiningPlan
        fields = [
            'id', 'student_name', 'student_id', 'term_name',
            'plan_type', 'is_active', 'created_at',
        ]

    def get_student_name(self, obj):
        return obj.student.user.get_full_name()
