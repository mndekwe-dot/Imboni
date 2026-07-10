from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils.translation import gettext_lazy as _
from django.utils import timezone
from datetime import timedelta
import uuid

class User(AbstractUser):    
    USER_ROLES = (
        ('student', 'Student'),
        ('parent', 'Parent'),
        ('teacher', 'Teacher'),
        ('dos', 'Director of Studies'),
        ('matron', 'Matron'),
        ('discipline', 'Director of Discipline'),
        ('admin', 'Administrator'),
    )
    
    EMPLOYMENT_CHOICES = [
        ('full_time', 'Full-Time'),
        ('part_time', 'Part-Time'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    role = models.CharField(max_length=10, choices=USER_ROLES)
    employment_type = models.CharField(
        max_length=10, choices=EMPLOYMENT_CHOICES,
        default='full_time', blank=True,
    )
    phone_number = models.CharField(max_length=20, blank=True)
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    address = models.TextField(blank=True)
    emergency_contact = models.CharField(max_length=15, blank=True)
    is_active = models.BooleanField(default=True)
    email_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    pending_email=models.EmailField(blank=True)
    
    class Meta:
        db_table = 'users'
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['role']),
        ]
    
    def __str__(self):
        return f"{self.get_full_name()} ({self.role})"
    
    @property
    def full_name(self):
        return self.get_full_name() or self.username


class UserPreferences(models.Model):
    """
    User preferences and settings
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='preferences')
    notification_email = models.BooleanField(default=True)
    notification_sms = models.BooleanField(default=False)
    notification_push = models.BooleanField(default=True)
    language = models.CharField(max_length=10, default='en')
    timezone = models.CharField(max_length=50, default='Africa/Kigali')
    theme = models.CharField(max_length=20, default='light', choices=[
        ('light', 'Light'),
        ('dark', 'Dark'),
        ('auto', 'Auto'),
    ])
    
    class Meta:
        db_table = 'user_preferences'
    
    def __str__(self):
        return f"Preferences for {self.user.username}"
class TwoFactorConfig(models.Model):
    """
    TOTP two-factor authentication for an account (authenticator apps like
    Google Authenticator / Authy). One row per user who has started 2FA setup.

    `secret` holds the base32 TOTP shared secret. `is_enabled` is False during
    setup and flips True once the user proves they can generate a valid code.
    `backup_codes` stores *hashed* one-time recovery codes (never plaintext) for
    when the authenticator device is lost.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='two_factor')
    secret = models.CharField(max_length=64)
    is_enabled = models.BooleanField(default=False)
    backup_codes = models.JSONField(default=list, blank=True)   # list of hashed codes
    confirmed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'two_factor_configs'

    def __str__(self):
        return f"2FA({'on' if self.is_enabled else 'setup'}) for {self.user.username}"


class Invitation(models.Model):
    ROLE_CHOICE =(
        ('student','Student'),
        ('parent','Parent'),
        ('teacher','Teacher'),
        ('dos','Director of Studies'),
        ('matron','Matron'),
        ('discipline','Director of Discipline'),
        ('admin','Administator'),
    )
    DELIVERY_STATUS_CHOICE=(
        ('pending','Pending'),
        ('sent','Sent'),
        ('failed','Failed'),
    )
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False)
    email=models.EmailField(blank=True)
    phone_number = models.CharField(max_length=20,blank=True)
    first_name=models.CharField(max_length=100)
    last_name=models.CharField(max_length=100)
    role=models.CharField(max_length=20,choices=ROLE_CHOICE)
    invited_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='invitations_sent'
    )
    token = models.CharField(max_length=200,unique=True)
    uid=models.CharField(max_length=200)
    is_used=models.BooleanField(default=False)
    expires_at=models.DateTimeField()
    channels_sent = models.JSONField(default=list)
    delivery_status=models.CharField(
        max_length=20,
        choices=DELIVERY_STATUS_CHOICE,
        default='pending'
    )
    student = models.ForeignKey(
        'student.Student',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='parent_invitations'
    )
    class_obj = models.ForeignKey(
        'teacher.Class',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='invitations',
        help_text='Class to assign the student to upon registration (students only).',
    )
    
    created_at=models.DateTimeField(auto_now_add=True)
    
    linked_email = models.EmailField(blank=True,default='', help_text='For parent invitations: stores the student email to auto-link on registration.')
    
    class Meta:
        db_table = 'invitations'
        ordering =['-created_at']
    def __str__(self):
        return f"Invitation({self.role}) → {self.email or self.phone_number}"
    @property
    def is_expired(self):
        return timezone.now() > self.expires_at
    @property
    def is_valid(self):
        return not self.is_used and not self.is_expired