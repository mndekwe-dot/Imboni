from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from .models import User, UserPreferences


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
        from parents.models import ParentStudentRelationship
        rel = (
            ParentStudentRelationship.objects
            .filter(parent=obj)
            .order_by('-is_primary_contact', 'created_at')
            .first()
        )
        return rel.relationship_type if rel else None


class AvatarUploadSerializer(serializers.ModelSerializer):
    """Used by AccountAvatarView — accepts only the avatar file field."""
    class Meta:
        model = User
        fields = ['avatar']
