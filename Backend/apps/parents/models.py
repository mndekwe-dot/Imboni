import uuid
from django.db import models
from apps.authentication.models import User


class ConsentRequest(models.Model):
    """
    A permission slip: staff request parental consent for an event (trip,
    activity, medical...). Targets one grade or the whole school.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=200)
    description = models.TextField()
    event_date = models.DateField()
    response_deadline = models.DateField(null=True, blank=True)
    grade = models.CharField(max_length=2, blank=True)   # '' = all grades

    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True,
                                   related_name='consent_requests_created')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'consent_requests'
        ordering = ['-created_at']

    def __str__(self):
        return self.title


class ConsentResponse(models.Model):
    """A parent's answer for one of their children."""
    STATUS_CHOICES = [
        ('approved', 'Approved'),
        ('declined', 'Declined'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    request = models.ForeignKey(ConsentRequest, on_delete=models.CASCADE, related_name='responses')
    student = models.ForeignKey('student.Student', on_delete=models.CASCADE, related_name='consent_responses')
    parent = models.ForeignKey(User, on_delete=models.CASCADE, related_name='consent_responses')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES)
    note = models.CharField(max_length=255, blank=True)
    responded_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'consent_responses'
        unique_together = ['request', 'student']

    def __str__(self):
        return f"{self.student.full_name}, {self.request.title}: {self.status}"


class ParentStudentRelationship(models.Model):
    RELATIONSHIP_TYPES = [
        ('mother', 'Mother'),
        ('father', 'Father'),
        ('guardian', 'Legal Guardian'),
        ('other', 'Other'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    parent = models.ForeignKey(User, on_delete=models.CASCADE, related_name='children')
    student = models.ForeignKey('student.Student', on_delete=models.CASCADE, related_name='parents')
    relationship_type = models.CharField(max_length=20, choices=RELATIONSHIP_TYPES)
    is_primary_contact = models.BooleanField(default=False)
    can_pickup = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'parent_student_relationships'
        unique_together = ['parent', 'student']

    def __str__(self):
        return f"{self.parent.get_full_name()} -> {self.student.full_name} ({self.relationship_type})"
