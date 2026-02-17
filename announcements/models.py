from django.db import models
from authentication.models import User
import uuid

class Announcement(models.Model):
    """
    School announcements
    """
    CATEGORY_CHOICES = [
        ('urgent', 'Urgent'),
        ('academic', 'Academic'),
        ('event', 'Event'),
        ('general', 'General'),
    ]
    
    TARGET_AUDIENCE_CHOICES = [
        ('all', 'All Users'),
        ('teachers', 'Teachers Only'),
        ('parents', 'Parents Only'),
        ('students', 'Students Only'),
        ('grade_specific', 'Specific Grade'),
    ]
    
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('published', 'Published'),
        ('archived', 'Archived'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=200)
    content = models.TextField()
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    
    target_audience = models.CharField(max_length=20, choices=TARGET_AUDIENCE_CHOICES)
    target_grade = models.CharField(max_length=2, blank=True)  # If grade_specific
    
    author = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='announcements')
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    published_at = models.DateTimeField(null=True, blank=True)
    
    # Optional expiry
    expires_at = models.DateTimeField(null=True, blank=True)
    
    # Attachments
    attachment = models.FileField(upload_to='announcements/', null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'announcements'
        ordering = ['-published_at', '-created_at']
        indexes = [
            models.Index(fields=['status', 'target_audience']),
            models.Index(fields=['category']),
        ]
    
    def __str__(self):
        return f"{self.title} ({self.category})"


class AnnouncementRead(models.Model):
    """
    Track who has read announcements
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    announcement = models.ForeignKey(Announcement, on_delete=models.CASCADE, related_name='read_receipts')
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    read_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'announcement_reads'
        unique_together = ['announcement', 'user']
    
    def __str__(self):
        return f"{self.user.username} read {self.announcement.title}"
