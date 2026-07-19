import uuid
from django.db import models
from apps.student.models import Student
from apps.authentication.models import User

# Matron app mostly reuses models from discipline, behavior, parents, and teacher apps.
# These models cover the matron-specific domains that don't exist elsewhere:
# sick bay / health visits, parent communication logs, and the boarding house routine.

TOTAL_SICKBAY_BEDS = 6


class HealthRecord(models.Model):
    VISIT_TYPE_CHOICES = [
        ('sickbay_admission', 'Sick Bay Admission'),
        ('routine_checkup',   'Routine Check-up'),
        ('medication',        'Medication Dispensed'),
        ('follow_up',         'Follow-up Visit'),
        ('injury',            'Injury'),
        ('discharge',         'Discharge'),
    ]

    CONDITION_TAG_CHOICES = [
        ('illness',  'Illness'),
        ('injury',   'Injury'),
        ('checkup',  'Check-up'),
        ('followup', 'Follow-up'),
    ]

    STATUS_CHOICES = [
        ('in_sick_bay',  'In Sick Bay'),
        ('observation',  'Observation'),
        ('cleared',      'Cleared'),
    ]

    NOTIFY_PARENT_CHOICES = [
        ('none', 'No'),
        ('sms',  'Yes (SMS)'),
        ('call', 'Yes (Call Parent)'),
        ('both', 'Yes (Both)'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='health_records')

    visit_type = models.CharField(max_length=20, choices=VISIT_TYPE_CHOICES)
    condition_tag = models.CharField(max_length=10, choices=CONDITION_TAG_CHOICES)
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='in_sick_bay')

    visit_datetime = models.DateTimeField()
    temperature_c = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
    complaint = models.CharField(max_length=255)
    action_taken = models.TextField(blank=True)

    admitted = models.BooleanField(default=False)
    bed_number = models.PositiveSmallIntegerField(null=True, blank=True)
    discharged_at = models.DateTimeField(null=True, blank=True)

    notify_parent = models.CharField(max_length=10, choices=NOTIFY_PARENT_CHOICES, default='none')

    recorded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='health_records_logged')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'matron_health_records'
        ordering = ['-visit_datetime']
        indexes = [
            # Sick-bay dashboards filter by status (in_sick_bay/observation/cleared)
            # on every load; without this it's a full scan of the health table.
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f"{self.student.full_name}, {self.visit_type} ({self.status})"


class MedicationSchedule(models.Model):
    """
    A standing prescription: which student gets which medicine at which
    times of day, between start and end dates. The daily checklist is
    generated from active schedules.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='medication_schedules')

    medicine_name = models.CharField(max_length=150)
    dosage = models.CharField(max_length=100)                 # e.g. "500mg", "2 tablets"
    times = models.JSONField(default=list)                    # ["08:00", "13:00", "20:00"]
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)        # null = until stopped
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True,
                                   related_name='medication_schedules_created')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'matron_medication_schedules'
        ordering = ['student__user__last_name', 'medicine_name']

    def __str__(self):
        return f"{self.student.full_name}, {self.medicine_name} ({self.dosage})"


class MedicationLog(models.Model):
    """One dose actually administered (ticks an item on the daily checklist)."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    schedule = models.ForeignKey(MedicationSchedule, on_delete=models.CASCADE, related_name='logs')
    date = models.DateField()
    time = models.CharField(max_length=5)                     # the scheduled slot, e.g. "08:00"
    given_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True,
                                 related_name='medication_doses_given')
    given_at = models.DateTimeField(auto_now_add=True)
    notes = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = 'matron_medication_logs'
        unique_together = ['schedule', 'date', 'time']
        ordering = ['-date', 'time']

    def __str__(self):
        return f"{self.schedule.medicine_name} ({self.date} {self.time})"


class ParentCommunication(models.Model):
    TYPE_CHOICES = [
        ('call',  'Phone Call'),
        ('sms',   'SMS / WhatsApp'),
        ('email', 'Email'),
        ('visit', 'In-Person Visit'),
        ('letter', 'Letter'),
    ]

    OUTCOME_CHOICES = [
        ('completed',       'Completed (parent informed)'),
        ('no_answer',       'No Answer (will retry)'),
        ('message_left',    'Message Left'),
        ('awaiting_reply',  'Awaiting Parent Reply'),
        ('sms_sent',        'SMS Sent'),
        ('email_sent',      'Email Sent'),
    ]

    URGENCY_CHOICES = [
        ('routine',   'Routine'),
        ('important', 'Important'),
        ('urgent',    'Urgent'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='parent_communications')

    parent_contact = models.CharField(max_length=150)
    comm_type = models.CharField(max_length=10, choices=TYPE_CHOICES)
    contacted_at = models.DateTimeField()
    subject = models.CharField(max_length=200)
    notes = models.TextField(blank=True)
    outcome = models.CharField(max_length=20, choices=OUTCOME_CHOICES)
    urgency = models.CharField(max_length=10, choices=URGENCY_CHOICES, default='routine')

    follow_up_required = models.BooleanField(default=False)
    follow_up_date = models.DateField(null=True, blank=True)

    recorded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='parent_comms_logged')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'matron_parent_communications'
        ordering = ['-contacted_at']

    def __str__(self):
        return f"{self.student.full_name} ({self.subject})"


class BoardingScheduleSlot(models.Model):
    """A single row in the standing boarding-house weekly routine."""
    DAY_TYPE_CHOICES = [
        ('weekday',  'Monday - Friday'),
        ('saturday', 'Saturday'),
        ('sunday',   'Sunday'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    day_type = models.CharField(max_length=10, choices=DAY_TYPE_CHOICES)
    order = models.PositiveSmallIntegerField()
    time = models.CharField(max_length=10)
    label = models.CharField(max_length=50)

    is_break = models.BooleanField(default=False)
    break_text = models.CharField(max_length=200, blank=True)

    cell_class = models.CharField(max_length=20, blank=True)
    subject = models.CharField(max_length=100, blank=True)
    supervisor = models.CharField(max_length=100, blank=True)
    room = models.CharField(max_length=100, blank=True)

    class Meta:
        db_table = 'matron_boarding_schedule_slots'
        ordering = ['day_type', 'order']

    def __str__(self):
        return f"{self.day_type} {self.time} ({self.label})"


class BoardingScheduleChange(models.Model):
    STATUS_CHOICES = [
        ('new',     'New'),
        ('applied', 'Applied'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    description = models.CharField(max_length=255)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='new')
    changed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='boarding_schedule_changes')
    change_date = models.DateField()

    class Meta:
        db_table = 'matron_boarding_schedule_changes'
        ordering = ['-change_date']

    def __str__(self):
        return self.description
