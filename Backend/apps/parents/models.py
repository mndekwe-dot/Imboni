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
    # 10 chars to match Student.grade, which now holds the school's own year
    # code ('S1', 'P4') rather than a single digit. '' = all years.
    grade = models.CharField(max_length=10, blank=True)

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


class ParentLinkRequest(models.Model):
    """
    A parent asking to be connected to a student, pending school approval.

    "Link New Student" used to create the relationship outright, on nothing more
    than the student's display code. That code is not a secret — it is printed
    on ID cards and report cards and known to classmates — so anyone with a
    parent account could attach themselves to any child in the school and then
    legitimately read that child's grades, attendance, discipline record,
    medical documents and fees.

    The request is recorded here instead and grants nothing until a member of
    staff approves it. Approval is what creates the ParentStudentRelationship.
    """
    STATUS_PENDING = 'pending'
    STATUS_APPROVED = 'approved'
    STATUS_REJECTED = 'rejected'
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_APPROVED, 'Approved'),
        (STATUS_REJECTED, 'Rejected'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    parent = models.ForeignKey(User, on_delete=models.CASCADE,
                               related_name='link_requests')
    student = models.ForeignKey('student.Student', on_delete=models.CASCADE,
                                related_name='link_requests')
    relationship_type = models.CharField(
        max_length=20, choices=ParentStudentRelationship.RELATIONSHIP_TYPES)
    is_primary_contact = models.BooleanField(default=False)
    can_pickup = models.BooleanField(default=True)

    status = models.CharField(max_length=10, choices=STATUS_CHOICES,
                              default=STATUS_PENDING)
    decided_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True,
                                   blank=True, related_name='link_decisions')
    decided_at = models.DateTimeField(null=True, blank=True)
    decision_note = models.CharField(max_length=255, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'parent_link_requests'
        ordering = ['-created_at']
        constraints = [
            # One open request per pair, so a parent cannot flood the desk with
            # the same ask. Resolved rows stay for the audit trail.
            models.UniqueConstraint(
                fields=['parent', 'student'],
                condition=models.Q(status='pending'),
                name='uniq_pending_parent_link_request',
            ),
        ]
        indexes = [
            models.Index(fields=['status', 'created_at'],
                         name='linkreq_status_created_idx'),
        ]

    def __str__(self):
        return f'{self.parent_id} -> {self.student_id} ({self.status})'
