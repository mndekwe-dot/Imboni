# students/models.py
from django.db import models
from authentication.models import User, UserPreferences
import uuid

class Student(models.Model):
    GRADE_CHOICES = [
        ('1', 'Secondary 1'),
        ('2', 'Secondary 2'),
        ('3', 'Secondary 3'),
        ('4', 'Secondary 4'),
        ('5', 'Secondary 5'),
        ('6', 'Secondary 6'),
    ]
    
    SECTION_CHOICES = [
        ('A', 'Section A'),
        ('B', 'Section B'),
        ('C', 'Section C'),
    ]
    
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('inactive', 'Inactive'),
        ('graduated', 'Graduated'),
        ('transferred', 'Transferred'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='student_profile')
    student_id = models.CharField(max_length=20, unique=True)
    grade = models.CharField(max_length=2, choices=GRADE_CHOICES)
    section = models.CharField(max_length=1, choices=SECTION_CHOICES)
    enrollment_date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    
    # Additional info
    blood_group = models.CharField(max_length=5, blank=True)
    allergies = models.TextField(blank=True)
    medical_conditions = models.TextField(blank=True)
    
    # Academic
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
        return f"Grade {self.grade}{self.section}"
    

class Fee(models.Model):
    """
    Per-student fee record — e.g. Tuition: Cleared, Transport: Due 10/04.
    Shown on the parent's My Children card.
    """
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
        return f"{self.student.full_name} — {self.category} ({self.status})"


class StudentDocument(models.Model):
    """
    Documents attached to a student — e.g. Newsletter_Feb.pdf, Sports_Consent.pdf.
    Shown on the parent's My Children card.
    """
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
        return f"{self.student.full_name} — {self.title}"


class ParentStudentRelationship(models.Model):
    """
    Links parents to their children (students)
    """
    RELATIONSHIP_TYPES = [
        ('mother', 'Mother'),
        ('father', 'Father'),
        ('guardian', 'Legal Guardian'),
        ('other', 'Other'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    parent = models.ForeignKey(User, on_delete=models.CASCADE, related_name='children')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='parents')
    relationship_type = models.CharField(max_length=20, choices=RELATIONSHIP_TYPES)
    is_primary_contact = models.BooleanField(default=False)
    can_pickup = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'parent_student_relationships'
        unique_together = ['parent', 'student']
    
    def __str__(self):
        return f"{self.parent.get_full_name()} -> {self.student.full_name} ({self.relationship_type})"
