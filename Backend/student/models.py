import uuid
from django.db import models
from django.conf import settings


class Activity(models.Model):
    CATEGORY_CHOICES = [
        ('sport', 'Sports'),
        ('music', 'Music'),
        ('art', 'Arts & Crafts'),
        ('debate', 'Debate & Public Speaking'),
        ('science', 'Science & Technology'),
        ('community', 'Community Service'),
        ('leadership', 'Leadership'),
        ('other', 'Other'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    schedule = models.CharField(max_length=200, blank=True)   # e.g. "Tuesdays & Thursdays, 3-5 PM"
    venue = models.CharField(max_length=100, blank=True)
    max_members = models.PositiveIntegerField(default=30)
    teacher_in_charge = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='activities_in_charge',
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'activities'
        ordering = ['name']

    def __str__(self):
        return self.name

    @property
    def enrolled_count(self):
        return self.enrollments.filter(status='active').count()


class ActivityEnrollment(models.Model):
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('withdrawn', 'Withdrawn'),
        ('pending', 'Pending Approval'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    activity = models.ForeignKey(Activity, on_delete=models.CASCADE, related_name='enrollments')
    student = models.ForeignKey('parents.Student', on_delete=models.CASCADE, related_name='activity_enrollments')
    enrolled_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')

    class Meta:
        db_table = 'activity_enrollments'
        unique_together = ('activity', 'student')

    def __str__(self):
        return f"{self.student} - {self.activity}"


class ActivityEvent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    activity = models.ForeignKey(Activity, on_delete=models.CASCADE, related_name='events')
    title = models.CharField(max_length=200)
    date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    venue = models.CharField(max_length=100, blank=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'activity_events'
        ordering = ['date', 'start_time']

    def __str__(self):
        return f"{self.title} ({self.date})"


class Assignment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    subject = models.ForeignKey('results.Subject', on_delete=models.CASCADE, related_name='assignments')
    class_obj = models.ForeignKey('teacher.Class', on_delete=models.CASCADE, related_name='assignments')
    teacher = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='created_assignments',
    )
    term = models.ForeignKey('results.AcademicTerm', on_delete=models.CASCADE, related_name='assignments')
    due_date = models.DateField()
    attachment = models.FileField(upload_to='assignments/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'assignments'
        ordering = ['due_date']

    def __str__(self):
        return f"{self.title} — {self.class_obj} ({self.due_date})"


class AssignmentSubmission(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('submitted', 'Submitted'),
        ('graded', 'Graded'),
        ('late', 'Late Submission'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    assignment = models.ForeignKey(Assignment, on_delete=models.CASCADE, related_name='submissions')
    student = models.ForeignKey('parents.Student', on_delete=models.CASCADE, related_name='assignment_submissions')
    submitted_at = models.DateTimeField(auto_now_add=True)
    file = models.FileField(upload_to='submissions/', blank=True, null=True)
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='submitted')
    grade = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    feedback = models.TextField(blank=True)

    class Meta:
        db_table = 'assignment_submissions'
        unique_together = ('assignment', 'student')

    def __str__(self):
        return f"{self.student} — {self.assignment.title}"
