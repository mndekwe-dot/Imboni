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
    # Widened from 2/1: the school's own codes go here ('S1', 'P4'), and the
    # A-Level stream codes this system already generates ('MPG', 'PCB') never
    # fitted in a single character.
    grade = models.CharField(max_length=10)
    section = models.CharField(max_length=10)
    
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
        # Prefer the class's own name; the year code is self-describing, so no
        # "Grade " prefix (which used to render "Grade S3A").
        return (self.name or '').strip() or f"{self.grade}{self.section}"
    
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
    # How many weekly timetable periods this subject needs for this class.
    # Consumed by the timetable auto-generator; 0 = don't schedule automatically.
    periods_per_week = models.PositiveSmallIntegerField(default=0)

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
        return f"{self.class_obj}, {self.subject.name} ({self.day} {self.start_time})"


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
        return f"{self.teacher.get_full_name()} ({self.title})"


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
        return f"{self.teacher.get_full_name()} ({self.content[:50]})"

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

    # A worksheet, reading or past paper handed out with the assignment. Set
    # work often IS a document; without this a teacher had to paste everything
    # into the instructions box or send it another way entirely.
    attachment          = models.FileField(upload_to='assignment-materials/',
                                           blank=True, null=True)

    # Whether work is still taken after the due date. Submissions used to be
    # accepted indefinitely and merely flagged late, with no way to say
    # otherwise.
    accept_late_submissions = models.BooleanField(default=True)

    # Online quizzes only. More than one attempt is a deliberate choice by the
    # teacher (a practice quiz), not the default - the review screen shows the
    # correct answers, so an unlimited retake is a free full mark.
    max_attempts        = models.PositiveSmallIntegerField(default=1)

    # Marks reach the student the moment they are entered unless a teacher
    # chooses to hold the whole class back until they are all done.
    release_marks_immediately = models.BooleanField(default=True)

    # The noticeboard post made when this was published. Kept so that deleting
    # or re-publishing an assignment can clean up after itself instead of
    # leaving "New Assignment: X" pointing at nothing.
    announcement        = models.ForeignKey(
        'announcements.Announcement', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='+',
    )

    class Meta:
        db_table = 'teacher_assignments'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} ({self.class_obj.name})"


class AssignmentSubmission(models.Model):
    """
    One student's response to one assignment, in either mode.

    Online quizzes fill `answers`, `score` and `percentage` automatically when
    the student submits. Paper assignments have no answers to store: the
    student may hand in a file through the portal, and the teacher enters the
    score later from the grading sheet.
    """
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
    # Paper mode only: what the student handed in, and anything they said with
    # it. An online quiz carries its work in `answers` instead.
    file         = models.FileField(upload_to='assignments/', blank=True, null=True)
    notes        = models.TextField(blank=True)
    # The teacher's comment on the work, written when marking. Kept separate
    # from `notes`, which belongs to the student: the two were conflated, so
    # the "teacher feedback" panel in the student portal was echoing the
    # student's own submission note back at them.
    feedback     = models.TextField(blank=True)

    # Online quizzes: when the paper was opened, and how long it was held. The
    # time limit used to be a browser countdown and nothing more - closing the
    # tab or posting straight to the API ignored it completely.
    started_at   = models.DateTimeField(null=True, blank=True)
    time_spent_seconds = models.PositiveIntegerField(default=0)
    attempt_count = models.PositiveSmallIntegerField(default=1)

    # When the mark was made visible to the student and their parents. Null
    # means marked but held back - see Assignment.release_marks_immediately.
    released_at  = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table        = 'quiz_submissions'
        ordering        = ['-submitted_at']
        unique_together = ['assignment', 'student']

    @property
    def is_submitted(self):
        """
        Whether the student has actually handed anything in.

        There is exactly one kind of row that is not a submission: one created
        by opening an online quiz, which records when the clock started and
        nothing else. It is recognisable by having a start time but no answers
        and no mark.

        Everything else counts - including a paper hand-in with no file and no
        note attached, which is still a hand-in.
        """
        opened_but_not_sat = bool(self.started_at) and not self.answers and not self.is_graded
        return not opened_but_not_sat

    @property
    def status(self):
        """
        What the student sees. Graded outranks late: once a mark exists, that
        is the news, and the lateness is already reflected in it.
        """
        if not self.is_submitted:
            return 'pending'
        if self.is_graded and self.released_at:
            return 'graded'
        # Marked but held back reads as submitted: the student has handed in
        # and is waiting, which is exactly what they should be told.
        return 'late' if self.is_late else 'submitted'

    def __str__(self):
        return f"{self.student_name or 'Unknown'} ({self.assignment.title})"


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
    # Shared questions are visible (read-only) to every teacher
    is_shared      = models.BooleanField(default=False)
    created_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'question_bank'
        ordering = ['-created_at']

    def __str__(self):
        return self.text[:80]

