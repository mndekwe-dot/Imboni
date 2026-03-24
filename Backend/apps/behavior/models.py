from django.db import models
from apps.parents.models import Student
from apps.authentication.models import User
import uuid

class BehaviorReport(models.Model):
    """
    Student behavior incidents and achievements
    """
    REPORT_TYPE_CHOICES = [
        ('positive', 'Positive Report'),
        ('warning', 'Warning'),
        ('incident', 'Incident'),
        ('achievement', 'Achievement'),
    ]
    
    SEVERITY_CHOICES = [
        ('minor', 'Minor'),
        ('moderate', 'Moderate'),
        ('serious', 'Serious'),
        ('critical', 'Critical'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='behavior_reports')
    report_type = models.CharField(max_length=20, choices=REPORT_TYPE_CHOICES)
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES, null=True, blank=True)
    
    title = models.CharField(max_length=200)
    description = models.TextField()
    date = models.DateField()
    location = models.CharField(max_length=100, blank=True)
    
    # People involved
    reported_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='submitted_reports')
    witnesses = models.ManyToManyField(User, blank=True, related_name='witnessed_reports')
    
    # Actions taken
    action_taken = models.TextField(blank=True)
    follow_up_required = models.BooleanField(default=False)
    follow_up_date = models.DateField(null=True, blank=True)
    follow_up_completed = models.BooleanField(default=False)
    
    # Parent notification
    parents_notified = models.BooleanField(default=False)
    parent_notification_date = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'behavior_reports'
        ordering = ['-date', '-created_at']
        indexes = [
            models.Index(fields=['student', 'date']),
            models.Index(fields=['report_type']),
        ]
    
    def __str__(self):
        return f"{self.student.full_name} - {self.title} ({self.report_type})"


class ConductGrade(models.Model):
    """
    Term-based conduct grading
    """
    GRADE_CHOICES = [
        ('A', 'A - Excellent'),
        ('B', 'B - Good'),
        ('C', 'C - Satisfactory'),
        ('D', 'D - Needs Improvement'),
        ('F', 'F - Unsatisfactory'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='conduct_grades')
    term = models.ForeignKey('results.AcademicTerm', on_delete=models.CASCADE)
    
    grade = models.CharField(max_length=1, choices=GRADE_CHOICES)
    
    positive_count = models.IntegerField(default=0)
    warning_count = models.IntegerField(default=0)
    incident_count = models.IntegerField(default=0)
    achievement_count = models.IntegerField(default=0)
    
    comment = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'conduct_grades'
        unique_together = ['student', 'term']
        ordering = ['-term__year', '-term__term']
    
    def __str__(self):
        return f"{self.student.full_name} - {self.term.name} - {self.grade}"
    
    def calculate_grade(self):
        """Auto-calculate grade based on reports"""
        # Simple algorithm: positive points - negative points
        score = (self.positive_count + self.achievement_count) - (self.warning_count + (self.incident_count * 2))
        
        if score >= 10:
            self.grade = 'A'
        elif score >= 5:
            self.grade = 'B'
        elif score >= 0:
            self.grade = 'C'
        elif score >= -5:
            self.grade = 'D'
        else:
            self.grade = 'F'
