# classes/models.py
from django.db import models
from students.models import Student
from authentication.models import User
from results.models import Subject, AcademicTerm
import uuid

class Class(models.Model):
    """
    Class/Section (e.g., Grade 10A)
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    grade = models.CharField(max_length=2)
    section = models.CharField(max_length=1)
    
    class_teacher = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='managed_classes'
    )
    
    max_students = models.IntegerField(default=40)
    room_number = models.CharField(max_length=20, blank=True)
    
    is_active = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'classes'
        unique_together = ['grade', 'section']
        ordering = ['grade', 'section']
    
    def __str__(self):
        return f"Grade {self.grade}{self.section}"
    
    @property
    def student_count(self):
        return self.students.count()


class ClassAssignment(models.Model):
    """
    Assign students to classes
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    class_obj = models.ForeignKey(Class, on_delete=models.CASCADE, related_name='students')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='class_assignments')
    term = models.ForeignKey(AcademicTerm, on_delete=models.CASCADE)
    
    assigned_date = models.DateField(auto_now_add=True)
    
    class Meta:
        db_table = 'class_assignments'
        unique_together = ['class_obj', 'student', 'term']
    
    def __str__(self):
        return f"{self.student.full_name} in {self.class_obj.name}"


class SubjectTeacherAssignment(models.Model):
    """
    Assign teachers to subjects in classes
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    teacher = models.ForeignKey(User, on_delete=models.CASCADE, related_name='teaching_assignments')
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE)
    class_obj = models.ForeignKey(Class, on_delete=models.CASCADE, related_name='subject_assignments')
    term = models.ForeignKey(AcademicTerm, on_delete=models.CASCADE)

    class Meta:
        db_table = 'subject_teacher_assignments'
        unique_together = ['teacher', 'subject', 'class_obj', 'term']

    def __str__(self):
        return f"{self.teacher.full_name} teaches {self.subject.name} to {self.class_obj.name}"


class Timetable(models.Model):
    """
    Weekly timetable — one row = one period for a class on a specific day.
    Used by the Live Schedule section on the parent's My Children card.
    """
    DAY_CHOICES = [
        ('monday', 'Monday'),
        ('tuesday', 'Tuesday'),
        ('wednesday', 'Wednesday'),
        ('thursday', 'Thursday'),
        ('friday', 'Friday'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    class_obj = models.ForeignKey(Class, on_delete=models.CASCADE, related_name='timetable')
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE)
    teacher = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name='timetable_entries'
    )
    term = models.ForeignKey(AcademicTerm, on_delete=models.CASCADE)

    day = models.CharField(max_length=10, choices=DAY_CHOICES)
    start_time = models.TimeField()
    end_time = models.TimeField()
    room_number = models.CharField(max_length=20, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'timetable'
        unique_together = ['class_obj', 'day', 'start_time', 'term']
        ordering = ['day', 'start_time']

    def __str__(self):
        return f"{self.class_obj} — {self.subject.name} — {self.day} {self.start_time}"
