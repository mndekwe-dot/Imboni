import uuid
from django.db import models
from django.conf import settings


class DisciplineStaff(models.Model):
    STAFF_TYPE_CHOICES = [
        ('matron', 'Matron'),
        ('patron', 'Patron'),
        ('head_matron', 'Head Matron'),
        ('director', 'Director of Discipline'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='discipline_staff_profile',
    )
    staff_type = models.CharField(max_length=20, choices=STAFF_TYPE_CHOICES)
    assigned_dormitory = models.CharField(max_length=100, blank=True)   # e.g. "Girls Dorm A"
    assigned_grade = models.CharField(max_length=10, blank=True)        # e.g. "S3" or "all"
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'discipline_staff'

    def __str__(self):
        return f"{self.user.get_full_name()} ({self.get_staff_type_display()})"


class StudentLeader(models.Model):
    ROLE_CHOICES = [
        ('head_boy', 'Head Boy'),
        ('head_girl', 'Head Girl'),
        ('deputy_head_boy', 'Deputy Head Boy'),
        ('deputy_head_girl', 'Deputy Head Girl'),
        ('prefect', 'Prefect'),
        ('house_captain', 'House Captain'),
        ('class_captain', 'Class Captain'),
        ('games_captain', 'Games Captain'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(
        'student.Student',
        on_delete=models.CASCADE,
        related_name='leadership_roles',
    )
    role = models.CharField(max_length=30, choices=ROLE_CHOICES)
    term = models.ForeignKey(
        'results.AcademicTerm',
        on_delete=models.CASCADE,
        related_name='student_leaders',
    )
    appointed_date = models.DateField()
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'student_leaders'
        unique_together = ('student', 'role', 'term')

    def __str__(self):
        return f"{self.student} — {self.get_role_display()}"


class BoardingStudent(models.Model):
    BOARDING_TYPE_CHOICES = [
        ('full_boarder', 'Full Boarder'),
        ('weekly_boarder', 'Weekly Boarder'),
        ('day_scholar', 'Day Scholar'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.OneToOneField(
        'student.Student',
        on_delete=models.CASCADE,
        related_name='boarding_info',
    )
    dormitory = models.CharField(max_length=100)
    room_number = models.CharField(max_length=20)
    bed_number = models.CharField(max_length=10, blank=True)
    boarding_type = models.CharField(
        max_length=20,
        choices=BOARDING_TYPE_CHOICES,
        default='full_boarder',
    )
    check_in_date = models.DateField()
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'boarding_students'

    def __str__(self):
        return f"{self.student} — {self.dormitory} Room {self.room_number}"


class DiningPlan(models.Model):
    PLAN_TYPE_CHOICES = [
        ('full_board', 'Full Board'),
        ('half_board', 'Half Board (Lunch Only)'),
        ('day_scholar', 'Day Scholar'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(
        'student.Student',
        on_delete=models.CASCADE,
        related_name='dining_plans',
    )
    term = models.ForeignKey(
        'results.AcademicTerm',
        on_delete=models.CASCADE,
        related_name='dining_plans',
    )
    plan_type = models.CharField(max_length=20, choices=PLAN_TYPE_CHOICES)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'dining_plans'
        unique_together = ('student', 'term')

    def __str__(self):
        return f"{self.student} — {self.get_plan_type_display()}"


class NightAttendance(models.Model):
    """Evening roll call — records which boarding students are present each night."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(
        BoardingStudent,
        on_delete=models.CASCADE,
        related_name='night_attendances',
    )
    date = models.DateField()
    is_present = models.BooleanField(default=True)
    notes = models.CharField(max_length=200, blank=True)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='night_checks_recorded',
    )
    recorded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'night_attendance'
        unique_together = ('student', 'date')

    def __str__(self):
        status = 'Present' if self.is_present else 'Absent'
        return f"{self.student} — {self.date} — {status}"
