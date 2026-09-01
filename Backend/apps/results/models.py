from django.db import models
from apps.student.models import Student
from apps.authentication.models import User
from rest_framework.permissions import IsAuthenticated
from apps.authentication.permissions import IsAdminRole
import uuid

class Subject(models.Model):
    """
    Academic subjects/courses
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name         = models.CharField(max_length=100)
    code         = models.CharField(max_length=20, unique=True)
    category     = models.CharField(max_length=100, blank=True, default='')
    description  = models.TextField(blank=True)
    credit_hours = models.IntegerField(default=1)
    # Exam-scheduler weight (1-10). Heavier subjects are placed first when the
    # window is tight, prefer earlier (morning) slots, and get rest gaps
    # between other heavy exams of the same class. 5 = neutral.
    exam_weight = models.PositiveSmallIntegerField(default=5)
    # Timetable-generator weight (1-10). Heavier subjects spread their weekly
    # periods more strictly across different days and get first pick of slots
    # (so they tend to land in earlier periods). 5 = neutral.
    timetable_weight = models.PositiveSmallIntegerField(default=5)
    is_active    = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'subjects'
        ordering = ['name']
    
    def __str__(self):
        return f"{self.name} ({self.code})"


class AcademicTerm(models.Model):
    """
    Academic terms/semesters
    """
    # Terms are NOT enumerated. Three terms is the Rwandan structure, not a
    # universal one -- semester systems have two and quarter systems four. A
    # school's terms come from SchoolSetting.terms; the default is still the
    # familiar term1/term2/term3, so nothing changes for existing schools.
    #
    # `order` below is what makes sequence explicit. Ordering used to rely on
    # 'term1' < 'term2' < 'term3' sorting lexicographically, which is true only
    # for those exact strings and silently wrong for anything else.
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=50)
    term = models.CharField(max_length=20)
    year = models.IntegerField()
    # Position within the academic year, 1-based. Sorting by this instead of by
    # the `term` string is what lets a school name its terms anything it likes
    # ('autumn', 'semester-1') without breaking chronological ordering.
    order = models.PositiveSmallIntegerField(default=1)
    start_date = models.DateField()
    end_date = models.DateField()
    is_current = models.BooleanField(default=False)

    class Meta:
        db_table = 'academic_terms'
        ordering = ['-year', '-order']
        unique_together = ['term', 'year']
    
    def __str__(self):
        return f"{self.name} ({self.year})"


class Result(models.Model):
    """
    Student exam/assessment results
    """
    GRADE_CHOICES = [
        ('A', 'A - Excellent (90-100)'),
        ('B', 'B - Good (80-89)'),
        ('C', 'C - Satisfactory (70-79)'),
        ('D', 'D - Pass (60-69)'),
        ('F', 'F - Fail (<60)'),
    ]
    
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('submitted', 'Submitted'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='results')
    subject = models.ForeignKey(Subject, on_delete=models.PROTECT)
    term = models.ForeignKey(AcademicTerm, on_delete=models.CASCADE)
    teacher = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='submitted_results')
    
    # Scores
    class_test_marks   = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    class_test_maximum = models.DecimalField(max_digits=5, decimal_places=2, default=30)
    exam_score         = models.DecimalField(max_digits=5, decimal_places=2)
    exam_maximum       = models.DecimalField(max_digits=5, decimal_places=2, default=70)
    final_score        = models.DecimalField(max_digits=5, decimal_places=2)
    total_maximum      = models.DecimalField(max_digits=5, decimal_places=2, default=100)
    grade              = models.CharField(max_length=2, choices=GRADE_CHOICES)
    
    # Comments
    teacher_comment = models.TextField(blank=True)
    dos_comment = models.TextField(blank=True)
    
    # Approval workflow
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    submitted_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_results')
    approved_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'results'
        unique_together = ['student', 'subject', 'term']
        # -term__order, not -term__term: sorting by the term string only ever
        # worked because the strings happened to be term1/term2/term3.
        ordering = ['-term__year', '-term__order', 'student']
        indexes = [
            models.Index(fields=['student', 'term']),
            models.Index(fields=['status']),
        ]
    
    def __str__(self):
        return f"{self.student.full_name} - {self.subject.name} - {self.grade}"
    
    def calculate_final_score(self):
        ct = float(self.class_test_marks or 0)
        ex = float(self.exam_score or 0)
        self.final_score = ct + ex
    
    def calculate_grade(self):
        """Calculate letter grade from final score"""
        score = float(self.final_score)
        if score >= 90:
            self.grade = 'A'
        elif score >= 80:
            self.grade = 'B'
        elif score >= 70:
            self.grade = 'C'
        elif score >= 60:
            self.grade = 'D'
        else:
            self.grade = 'F'
    
    def save(self, *args, **kwargs):
        if not self.final_score:
            self.calculate_final_score()
        if not self.grade:
            self.calculate_grade()
        super().save(*args, **kwargs)


class Assessment(models.Model):
    """
    Individual assessments (quizzes, homework, projects)
    """
    ASSESSMENT_TYPES = [
        ('quiz', 'Quiz'),
        ('homework', 'Homework'),
        ('project', 'Project'),
        ('presentation', 'Presentation'),
        ('lab', 'Lab Work'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='assessments')
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE)
    term = models.ForeignKey(AcademicTerm, on_delete=models.CASCADE)
    
    title = models.CharField(max_length=200)
    assessment_type = models.CharField(max_length=20, choices=ASSESSMENT_TYPES)
    date = models.DateField()
    
    max_score = models.DecimalField(max_digits=5, decimal_places=2)
    score_obtained = models.DecimalField(max_digits=5, decimal_places=2)
    percentage = models.DecimalField(max_digits=5, decimal_places=2)
    
    teacher_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'assessments'
        ordering = ['-date']
        constraints = [
            # This is exactly the key TeacherBulkSaveResultsView passes to
            # update_or_create. Without it two concurrent submissions — a
            # double-clicked Save, or two teachers on the same class — both miss
            # the SELECT and both INSERT, and the class ends up with duplicate
            # marks that are silently double-counted in every average, pass rate
            # and GPA derived from them.
            models.UniqueConstraint(
                fields=['student', 'subject', 'term', 'title'],
                name='uniq_assessment_student_subject_term_title',
            ),
        ]
        indexes = [
            # The two shapes every read uses: one student's record, and a whole
            # class/subject for a term. Both were sequential scans.
            models.Index(fields=['student', 'term'], name='assessment_student_term_idx'),
            models.Index(fields=['term', 'subject'], name='assessment_term_subject_idx'),
        ]

    def __str__(self):
        return f"{self.student.full_name} - {self.title}"
    
    def save(self, *args, **kwargs):
        if self.max_score > 0:
            self.percentage = (self.score_obtained / self.max_score) * 100
        super().save(*args, **kwargs)
