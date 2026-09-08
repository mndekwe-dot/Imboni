import uuid
from django.db import models
from apps.authentication.models import User


class Notification(models.Model):
    TYPE_CHOICES = [
        ('exam',         'Exam Scheduled'),
        ('attendance',   'Attendance Alert'),
        ('results',      'Results Ready'),
        ('timetable',    'Timetable Conflict'),
        ('staff',        'Staff Status'),
        ('announcement', 'Announcement'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')

    title = models.CharField(max_length=200)
    message = models.TextField()
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    path = models.CharField(max_length=200, blank=True)   # frontend route to navigate to on click

    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'notifications'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'is_read']),
            # The notification feed is polled: filter(user=…) ordered by newest.
            # This composite serves both the filter and the sort from one index.
            models.Index(fields=['user', '-created_at']),
        ]

    def __str__(self):
        return f"{self.user.email} ({self.title})"


class PushSubscription(models.Model):
    """
    One browser's Web Push subscription for a user.

    A person can have several — phone, laptop, the school office desktop — so
    this is a plain FK, not a OneToOne. `endpoint` is the push service URL the
    browser handed us and is globally unique, which makes it the natural key:
    re-subscribing the same browser updates the row instead of piling up
    duplicates that would each deliver the same notice.

    Subscriptions expire and get revoked without telling us. The sender treats
    a 404/410 from the push service as "this is dead" and deletes the row.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='push_subscriptions')

    endpoint = models.URLField(max_length=500, unique=True)
    # Keys from the browser's PushSubscription.getKey() — needed to encrypt the
    # payload so the push service cannot read it.
    p256dh = models.CharField(max_length=200)
    auth = models.CharField(max_length=100)

    user_agent = models.CharField(max_length=300, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'push_subscriptions'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user']),
        ]

    def __str__(self):
        return f"Push subscription for {self.user.email}"
