import uuid
from django.db import models
from django.conf import settings
from apps.authentication.models import User


class Student(models.Model):
    # Year level and stream are NOT enumerated here.
    #
    # They used to be ('1'-'6', "Secondary 1-6") and ('A','B','C'), which meant a
    # primary school could not enrol a pupil and no school could have a fourth
    # stream. Both now hold whatever the school configured for itself -- 'S1',
    # 'P4', 'Y9' -- validated against apps.dos.structure rather than a constant.
    #
    # Django's `choices` never enforced anything on save() anyway, so nothing is
    # lost by removing them; validation moved to where data enters (serializers
    # and views), which is stricter than before, not looser.

    STATUS_CHOICES = [
        ('active', 'Active'),
        ('suspended', 'Suspended'),
        ('inactive', 'Inactive'),
        ('graduated', 'Graduated'),
        ('transferred', 'Transferred'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='student_profile')
    student_id = models.CharField(max_length=20, unique=True)
    # 10 chars holds 'S1', 'P4', 'Grade 12'; the old 2/1 could not even hold the
    # A-Level stream codes ('MPG', 'PCB') this system already generates.
    grade = models.CharField(max_length=10)
    section = models.CharField(max_length=10)
    enrollment_date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')

    blood_group = models.CharField(max_length=5, blank=True)
    allergies = models.TextField(blank=True)
    medical_conditions = models.TextField(blank=True)

    current_gpa = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True)
    attendance_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=100.00)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'students'
        ordering = ['grade', 'section', 'user__last_name']
        indexes = [
            models.Index(fields=['student_id']),
            models.Index(fields=['grade', 'section']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f"{self.user.get_full_name()} - {self.student_id}"

    @property
    def full_name(self):
        return self.user.get_full_name()

    @property
    def grade_section(self):
        # No "Grade " prefix: the stored year code is now self-describing
        # ('S3', 'P3'), so prefixing produced "Grade S3A".
        return f"{self.grade}{self.section}"


class Fee(models.Model):
    CATEGORY_CHOICES = [
        ('tuition', 'Tuition Fees'),
        ('transport', 'Transport'),
        ('lunch', 'Lunch Program'),
        ('uniform', 'Uniform'),
        ('activity', 'Activity Fee'),
        ('other', 'Other'),
    ]

    STATUS_CHOICES = [
        ('cleared', 'Cleared'),
        ('due', 'Due'),
        ('overdue', 'Overdue'),
        ('partial', 'Partial'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='fees')
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    due_date = models.DateField()
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='due')
    paid_date = models.DateField(null=True, blank=True)
    term = models.ForeignKey(
        'results.AcademicTerm', on_delete=models.SET_NULL, null=True, blank=True
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'fees'
        ordering = ['due_date']

    def __str__(self):
        return f"{self.student.full_name}, {self.category} ({self.status})"


class StudentDocument(models.Model):
    DOCUMENT_TYPES = [
        ('newsletter', 'Newsletter'),
        ('consent', 'Consent Form'),
        ('report', 'Report'),
        ('certificate', 'Certificate'),
        ('other', 'Other'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='documents')
    title = models.CharField(max_length=200)
    document_type = models.CharField(max_length=20, choices=DOCUMENT_TYPES)
    file = models.FileField(upload_to='student_documents/')
    uploaded_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name='uploaded_documents'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'student_documents'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.student.full_name} ({self.title})"


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
    schedule = models.CharField(max_length=200, blank=True)
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
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='activity_enrollments')
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


