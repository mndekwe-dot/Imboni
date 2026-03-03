from rest_framework import serializers
from authentication.models import User
from .models import Timetable


class TeacherSerializer(serializers.ModelSerializer):
    full_name = serializers.ReadOnlyField()

    class Meta:
        model = User
        fields = ['id', 'username', 'full_name', 'email', 'phone_number', 'avatar']


class TimetableSerializer(serializers.ModelSerializer):
    subject_name = serializers.ReadOnlyField(source='subject.name')
    teacher_name = serializers.ReadOnlyField(source='teacher.get_full_name')
    class_name = serializers.ReadOnlyField(source='class_obj.name')
    grade = serializers.ReadOnlyField(source='class_obj.grade')
    section = serializers.ReadOnlyField(source='class_obj.section')

    class Meta:
        model = Timetable
        fields = [
            'id', 'day', 'start_time', 'end_time', 'room_number',
            'subject_name', 'teacher_name', 'class_name', 'grade', 'section',
        ]
        read_only_fields = ['id']
