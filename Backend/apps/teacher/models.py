# classes/models.py
from django.db import models
from apps.student.models import Student
from apps.authentication.models import User
from apps.results.models import Subject, AcademicTerm
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


class Task(models.Model):
    """Teacher to-do tasks shown in the Pending Tasks panel."""
    PRIORITY_CHOICES = [
        ('high',   'High'),
        ('medium', 'Medium'),
        ('low',    'Low'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    teacher = models.ForeignKey(User, on_delete=models.CASCADE, related_name='tasks')
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='medium')
    due_date = models.DateField(null=True, blank=True)
    is_completed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'teacher_tasks'
        ordering = ['is_completed', 'due_date', '-priority']

    def __str__(self):
        return f"{self.teacher.get_full_name()} — {self.title}"


class Reminder(models.Model):
    """Quick personal reminders shown in the Quick Reminders widget (CRUD)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    teacher = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reminders')
    content = models.TextField()
    is_completed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'teacher_reminders'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.teacher.get_full_name()} — {self.content[:50]}"

class TeacherClassList(models.Model):
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    teacher    = models.ForeignKey(User, on_delete=models.CASCADE, related_name='assigned_classes')
    class_name = models.CharField(max_length=20)

    class Meta:
        db_table        = 'teacher_class_list'
        unique_together = ['teacher', 'class_name']


class Assignment(models.Model):
    """Teacher-created assignments and quizzes published to a class."""
    STATUS_CHOICES = [
        ('draft',  'Draft'),
        ('active', 'Active'),
        ('closed', 'Closed'),
    ]
    MODE_CHOICES = [
        ('paper',  'Paper'),
        ('online', 'Online'),
    ]

    id                  = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    teacher             = models.ForeignKey(User, on_delete=models.CASCADE, related_name='assignments_given')
    class_obj           = models.ForeignKey('Class', on_delete=models.CASCADE, related_name='class_assignments')
    subject             = models.ForeignKey('results.Subject', on_delete=models.PROTECT)
    title               = models.CharField(max_length=200)
    instructions        = models.TextField(blank=True)
    mode                = models.CharField(max_length=10, choices=MODE_CHOICES, default='paper')
    status              = models.CharField(max_length=10, choices=STATUS_CHOICES, default='draft')
    due_date            = models.DateField()
    max_score           = models.IntegerField()
    questions           = models.JSONField(default=list, blank=True)
    time_limit_minutes  = models.IntegerField(null=True, blank=True)
    shuffle_questions   = models.BooleanField(default=False)
    created_at          = models.DateTimeField(auto_now_add=True)
    published_at        = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'teacher_assignments'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} — {self.class_obj.name}"


class AssignmentSubmission(models.Model):
    """A student's answers for an online quiz assignment."""
    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    assignment   = models.ForeignKey(Assignment, on_delete=models.CASCADE, related_name='submissions')
    student      = models.ForeignKey('student.Student', on_delete=models.SET_NULL,
                                     null=True, blank=True, related_name='quiz_submissions')
    student_name = models.CharField(max_length=200, blank=True)
    student_code = models.CharField(max_length=50, blank=True)
    # [{question_id, answer, is_correct, points_earned, max_points}]
    answers      = models.JSONField(default=list)
    score        = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    max_score    = models.IntegerField(default=0)
    percentage   = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    is_graded    = models.BooleanField(default=False)
    is_late      = models.BooleanField(default=False)
    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table        = 'quiz_submissions'
        ordering        = ['-submitted_at']
        unique_together = ['assignment', 'student']

    def __str__(self):
        return f"{self.student_name or 'Unknown'} — {self.assignment.title}"


class QuestionBank(models.Model):
    """Reusable questions saved by a teacher for future quizzes."""
    QUESTION_TYPES = [
        ('mcq',          'Multiple Choice'),
        ('true_false',   'True / False'),
        ('short_answer', 'Short Answer'),
        ('fill_blank',   'Fill in the Blank'),
    ]

    id             = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    teacher        = models.ForeignKey(User, on_delete=models.CASCADE, related_name='question_bank')
    subject        = models.ForeignKey('results.Subject', on_delete=models.SET_NULL,
                                       null=True, blank=True)
    question_type  = models.CharField(max_length=20, choices=QUESTION_TYPES, default='mcq')
    text           = models.TextField()
    options        = models.JSONField(default=list)
    correct_answer = models.JSONField(null=True, blank=True)
    explanation    = models.TextField(blank=True)
    points         = models.IntegerField(default=1)
    image          = models.TextField(blank=True)   # base64 data URI
    tags           = models.CharField(max_length=200, blank=True)
    created_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'question_bank'
        ordering = ['-created_at']

    def __str__(self):
        return self.text[:80]

