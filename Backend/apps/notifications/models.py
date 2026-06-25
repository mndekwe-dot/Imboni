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
        indexes = [models.Index(fields=['user', 'is_read'])]

    def __str__(self):
        return f"{self.user.email} — {self.title}"
