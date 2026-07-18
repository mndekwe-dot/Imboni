import uuid
from django.db import models
from django.conf import settings


class ExamSchedule(models.Model):
    EXAM_TYPE_CHOICES = [
        ('midterm', 'Mid-Term Exam'),
        ('final', 'Final Exam'),
        ('quiz', 'Quiz'),
        ('mock', 'Mock Exam'),
        ('other', 'Other'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=200)
    subject = models.ForeignKey('results.Subject', on_delete=models.CASCADE, related_name='exam_schedules')
    class_obj = models.ForeignKey('teacher.Class', on_delete=models.CASCADE, null=True, blank=True, related_name='exam_schedules')
    term = models.ForeignKey('results.AcademicTerm', on_delete=models.CASCADE, related_name='exam_schedules')
    exam_date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    venue = models.CharField(max_length=100, blank=True)
    exam_type = models.CharField(max_length=20, choices=EXAM_TYPE_CHOICES, default='midterm')
    invigilator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='invigilated_exams',
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'exam_schedules'
        ordering = ['exam_date', 'start_time']

    def __str__(self):
        return f"{self.title} ({self.exam_date})"

class SchoolSection(models.Model):
    """
    Stores school structure — sections, years and streams.
    e.g. O-Level with years S1-S3 and streams A, B, C
    DOS can edit this from DosSettings page.
    """
    id=models.URLField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=50)
    years = models.JSONField(default=list)  # List of years (e.g. S1, S2, S3)
    streams = models.JSONField(default=list)  # List of streams (e.g. A, B, C)
    is_active = models.BooleanField(default=True)
    academic_term = models.CharField(max_length=20, blank=True)  # e.g. Term 1, Term 2, Term 3  
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'school_sections'
        ordering = ['name']

    def __str__(self):
        return self.name
    
class Room(models.Model):
    """
    Physical rooms and venues in the school.
    DOS manages these from School Config.
    Used as dropdown options when building the timetable.
    """
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name       = models.CharField(max_length=100, unique=True)
    is_active  = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'rooms'
        ordering = ['name']

    def __str__(self):
        return self.name


class TimetablePeriod(models.Model):
    """One period in the school's daily bell schedule (shared by all classes).

    The timetable auto-generator places lessons into the cartesian product of
    school days x these (non-break) periods. Breaks are stored so the grid the
    DOS sees matches reality, but they are not schedulable slots.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.PositiveSmallIntegerField(help_text="Sort order within the day")
    label = models.CharField(max_length=50, blank=True)  # e.g. "Period 1", "Break"
    start_time = models.TimeField()
    end_time = models.TimeField()
    is_break = models.BooleanField(default=False)  # break/lunch — not schedulable
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'timetable_periods'
        ordering = ['order']

    def __str__(self):
        return self.label or f"Period {self.order} ({self.start_time}-{self.end_time})"


DUTY_DAY_CHOICES = [
    ('monday', 'Monday'), ('tuesday', 'Tuesday'), ('wednesday', 'Wednesday'),
    ('thursday', 'Thursday'), ('friday', 'Friday'),
    ('saturday', 'Saturday'), ('sunday', 'Sunday'),
]


class DutyPost(models.Model):
    """A recurring staff supervision duty (assembly, break, prep, dorm check).

    A post is a *template*: it describes one duty and how many staff it needs.
    The roster generator repeats every active post across the days it is asked
    to cover, so a school configures "Break Supervision, 10:00-10:30, 2 staff"
    once rather than once per weekday.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    order = models.PositiveSmallIntegerField(default=0, help_text="Display/rotation order")
    start_time = models.TimeField()
    end_time = models.TimeField()
    staff_required = models.PositiveSmallIntegerField(default=1)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'duty_posts'
        ordering = ['order', 'start_time']

    def __str__(self):
        return f"{self.name} ({self.start_time}-{self.end_time})"


class DutyAssignment(models.Model):
    """One staff member on one duty post for one day of a term's roster."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    post = models.ForeignKey(DutyPost, on_delete=models.CASCADE, related_name='assignments')
    term = models.ForeignKey('results.AcademicTerm', on_delete=models.CASCADE,
                             related_name='duty_assignments')
    day = models.CharField(max_length=10, choices=DUTY_DAY_CHOICES)
    staff = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='duty_assignments',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'duty_assignments'
        ordering = ['day', 'post__order']
        # One person cannot hold the same post twice on the same day.
        unique_together = ['post', 'term', 'day', 'staff']

    def __str__(self):
        return f"{self.staff} — {self.post.name} ({self.day})"


class SchoolSetting(models.Model):
    timezone = models.CharField(max_length=50 ,default='Africa/Kigali')
    school_name = models.CharField(max_length=100,blank=True,default='')

    class Meta:
        db_table= 'school_setting'

    @classmethod
    def get_setting(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj
    
    def __str__(self):
        return f"School Setting (timezone: {self.timezone})"
            