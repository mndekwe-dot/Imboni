from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from .models import User, UserPreferences,Invitation
from .validators import validate_avatar


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


class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True)
    
    class Meta:
        model = User
        fields = [
            'username', 'email', 'password', 'password_confirm',
            'first_name', 'last_name', 'role', 'phone_number'
        ]
    
    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({
                "password": "Password fields didn't match."
            })
        return attrs
    
    def create(self, validated_data):
        validated_data.pop('password_confirm')
        user = User.objects.create_user(**validated_data)
        return user


class UserPreferencesSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserPreferences
        fields = '__all__'
        read_only_fields = ['user']


class PasswordChangeSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, validators=[validate_password])
    new_password_confirm = serializers.CharField(required=True)

    def validate(self, attrs):
        if attrs['new_password'] != attrs['new_password_confirm']:
            raise serializers.ValidationError({
                "new_password": "Password fields didn't match."
            })
        return attrs


class AccountProfileSerializer(serializers.ModelSerializer):
    """
    Powers the Personal Profile section of Account Settings.

    GET  — returns editable fields + read-only relationship_type from primary child link.
    PATCH — updates first_name, last_name, email, phone_number only.
    """
    full_name = serializers.ReadOnlyField()
    relationship_type = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'first_name', 'last_name', 'full_name',
            'email', 'phone_number', 'avatar',
            'role', 'relationship_type',
        ]
        read_only_fields = ['id', 'role', 'relationship_type']

    def get_relationship_type(self, obj):
        """
        Returns the relationship_type from the user's primary (or first) child link.
        Only relevant for parents — returns None for other roles.
        """
        if obj.role != 'parent':
            return None
        # Deferred import to avoid circular dependency
        from apps.parents.models import ParentStudentRelationship
        rel = (
            ParentStudentRelationship.objects
            .filter(parent=obj)
            .order_by('-is_primary_contact', 'created_at')
            .first()
        )
        return rel.relationship_type if rel else None


class AvatarUploadSerializer(serializers.ModelSerializer):
    """Used by AccountAvatarView — accepts only the avatar file field."""
    avatar = serializers.ImageField(validators=[validate_avatar])

    class Meta:
        model = User
        fields = ['avatar']
class InvitationSerializer(serializers.ModelSerializer):
    class_obj_id   = serializers.UUIDField(write_only=True, required=False, allow_null=True)
    class_obj_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Invitation
        fields =[
            'id','email','phone_number','first_name',
            'last_name','role',
            'class_obj_id','class_obj_name',
            'is_used','is_expired','channels_sent',
            'delivery_status','created_at','expires_at',
        ]
        read_only_fields = [
            'id','is_used','is_expired','channels_sent',
            'delivery_status','created_at','expires_at',
        ]

    def get_class_obj_name(self, obj):
        return obj.class_obj.name if obj.class_obj else None

    def validate(self, data):
        # At least one of email or phone must be provided
        if not data.get('email') and not data.get('phone_number'):
            raise serializers.ValidationError(
               'At least one of email or phone number must be provided.'
            )
        # class_obj_id is only valid for students
        if data.get('class_obj_id') and data.get('role') != 'student':
            raise serializers.ValidationError(
                'class_obj_id can only be set for students.'
            )
        # Resolve class_obj_id to actual Class instance
        if data.get('class_obj_id'):
            from apps.teacher.models import Class
            try:
                data['class_obj'] = Class.objects.get(pk=data.pop('class_obj_id'))
            except Class.DoesNotExist:
                raise serializers.ValidationError(
                    {'class_obj_id': 'Class not found.'}
                )
        else:
            data.pop('class_obj_id', None)
            data['class_obj'] = None
        return data
class CompleteRegistrationSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    username=serializers.CharField(max_length=150)
    password=serializers.CharField(min_length=8,write_only=True)
    confirm_password=serializers.CharField(min_length=8,write_only=True)
    phone_number=serializers.CharField(max_length=20,required=False,
    allow_blank=True)
    date_of_birth = serializers.DateField(required=False,allow_null=True)

    def validate(self,data):
        if data['password'] != data['confirm_password']:
            raise serializers.ValidationError(
                'Passwords do not match.'
            )
        return data
    
class EmailChangeRequestSerializer(serializers.Serializer):
    new_email = serializers.EmailField()

    def validate_new_email(self, value):
        from .models import User
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError(
                'This email is already in use.'
            )
        return value


class CSVInviteSerializer(serializers.Serializer):
    """
    Payload for POST /imboni/auth/invite/csv/
    Upload a CSV file to send invitations in bulk.

    Required field : file — CSV file
    Optional field : default_role — applied when CSV row has no role column

    Expected CSV columns (header row required):
        first_name, last_name, role, email (optional), phone_number (optional)

    Example CSV:
        first_name,last_name,role,email,phone_number
        Alice,Uwase,teacher,alice@school.rw,+250788000001
        Bob,Nkurunziza,student,bob@school.rw,
    """
    file         = serializers.FileField()
    default_role = serializers.ChoiceField(
        choices=['student', 'parent', 'teacher', 'dos', 'matron', 'discipline', 'admin'],
        required=False,
        default='student',
    )
    