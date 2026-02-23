from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from authentication.models import User, UserPreferences
from .models import Student, ParentStudentRelationship


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.ReadOnlyField()
    
    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name', 'full_name',
            'role', 'phone_number', 'avatar', 'date_of_birth', 'address',
            'emergency_contact', 'is_active', 'email_verified', 'created_at'
        ]
        read_only_fields = ['id', 'created_at', 'email_verified']


class StudentSerializer(serializers.ModelSerializer):
    """Serializer for Student model"""
    full_name = serializers.ReadOnlyField(source='user.get_full_name')
    email = serializers.ReadOnlyField(source='user.email')
    grade_section = serializers.ReadOnlyField()
    
    class Meta:
        model = Student
        fields = [
            'id', 'user', 'student_id', 'grade', 'section', 'enrollment_date',
            'status', 'blood_group', 'allergies', 'medical_conditions',
            'current_gpa', 'attendance_percentage', 'full_name', 'email',
            'grade_section', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'attendance_percentage']


class StudentCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating students with user data"""
    username = serializers.CharField(write_only=True)
    email = serializers.EmailField(write_only=True)
    password = serializers.CharField(write_only=True, validators=[validate_password])
    first_name = serializers.CharField(write_only=True)
    last_name = serializers.CharField(write_only=True)
    phone_number = serializers.CharField(write_only=True, required=False)
    
    class Meta:
        model = Student
        fields = [
            'username', 'email', 'password', 'first_name', 'last_name', 'phone_number',
            'student_id', 'grade', 'section', 'enrollment_date', 'status',
            'blood_group', 'allergies', 'medical_conditions'
        ]
    
    def create(self, validated_data):
        # Extract user data
        user_data = {
            'username': validated_data.pop('username'),
            'email': validated_data.pop('email'),
            'first_name': validated_data.pop('first_name'),
            'last_name': validated_data.pop('last_name'),
            'role': 'student',
        }
        if 'phone_number' in validated_data:
            user_data['phone_number'] = validated_data.pop('phone_number')
        
        password = validated_data.pop('password')
        
        # Create user
        user = User.objects.create_user(**user_data, password=password)
        
        # Create student profile
        student = Student.objects.create(user=user, **validated_data)
        return student


class ParentStudentRelationshipSerializer(serializers.ModelSerializer):
    """Serializer for parent-student relationships"""
    parent_name = serializers.ReadOnlyField(source='parent.get_full_name')
    student_name = serializers.ReadOnlyField(source='student.full_name')
    
    class Meta:
        model = ParentStudentRelationship
        fields = [
            'id', 'parent', 'student', 'relationship_type', 'is_primary_contact',
            'can_pickup', 'parent_name', 'student_name', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class UserPreferencesSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserPreferences
        fields = '__all__'
        read_only_fields = ['user']
