from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password

from .models import Student, ParentStudentRelationship


class ParentStudentRelationshipSerializer(serializers.ModelSerializer):
    parent_full_name = serializers.ReadOnlyField(source='parent.get_full_name')
    student_full_name = serializers.ReadOnlyField(source='student.user.get_full_name')

    class Meta:
        model = ParentStudentRelationship
        fields = ['id', 'parent', 'student', 'relationship_type', 'is_primary_contact',
                  'can_pickup', 'created_at', 'parent_full_name', 'student_full_name']
        read_only_fields = ['id', 'created_at']


class StudentSerializer(serializers.ModelSerializer):
    full_name = serializers.ReadOnlyField(source='user.get_full_name')
    email = serializers.ReadOnlyField(source='user.email')
    grade_section = serializers.ReadOnlyField()
    parents = ParentStudentRelationshipSerializer(many=True, read_only=True)

    class Meta:
        model = Student
        fields = [
            'id', 'user', 'student_id', 'grade', 'section', 'enrollment_date',
            'status', 'blood_group', 'allergies', 'medical_conditions',
            'current_gpa', 'attendance_percentage', 'full_name', 'email',
            'grade_section', 'parents', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'attendance_percentage']


class MyChildrenSerializer(serializers.ModelSerializer):
    """Serializes a parent's children for the dashboard child-tabs."""
    student_id = serializers.ReadOnlyField(source='student.id')
    student_code = serializers.ReadOnlyField(source='student.student_id')
    student_name = serializers.ReadOnlyField(source='student.user.get_full_name')
    grade = serializers.ReadOnlyField(source='student.grade')
    section = serializers.ReadOnlyField(source='student.section')

    class Meta:
        model = ParentStudentRelationship
        fields = ['student_id', 'student_code', 'student_name', 'grade', 'section', 'relationship_type']


class AddParentToStudentSerializer(serializers.Serializer):
    """Used by StudentViewSet.add_parent action to create a parent and link to a student."""
    username = serializers.CharField()
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True)
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    phone_number = serializers.CharField(required=False, default='')
    date_of_birth = serializers.DateField(required=False, allow_null=True, default=None)
    address = serializers.CharField(required=False, default='')
    emergency_contact = serializers.CharField(required=False, default='')
    relationship_type = serializers.ChoiceField(choices=ParentStudentRelationship.RELATIONSHIP_TYPES)
    is_primary_contact = serializers.BooleanField(default=False)
    can_pickup = serializers.BooleanField(default=True)

    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({"password": "Passwords didn't match."})
        return attrs
