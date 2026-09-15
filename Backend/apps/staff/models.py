"""
Everyone the school employs, and the department each of them works in.

A login is not a job. The User table holds the people who sign in to Imboni;
a school also pays cooks, guards, cleaners, drivers and a nurse, none of whom
ever will. Payroll used to hang off User, so those workers could not be paid
through it at all, and the department on the admin's staff form was thrown
away because nothing stored it. The register is the list of workers; an
account, where there is one, is linked to it.
"""
import uuid

from django.conf import settings
from django.db import models


class Department(models.Model):
    """A part of the school a worker belongs to: Academic, Kitchen, Security."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # What the built-in departments are translated by; a school's own are named.
    code        = models.SlugField(max_length=30, unique=True)
    name        = models.CharField(max_length=80)
    description = models.CharField(max_length=255, blank=True)
    head        = models.ForeignKey('StaffMember', on_delete=models.SET_NULL, null=True,
                                    blank=True, related_name='heads')
    is_active   = models.BooleanField(default=True)
    sort_order  = models.PositiveSmallIntegerField(default=100)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'staff_departments'
        ordering = ['sort_order', 'name']

    def __str__(self):
        return self.name


# The departments a school starts with. A school renames, adds and retires its own.
DEFAULT_DEPARTMENTS = [
    ('academic', 'Academic'),
    ('administration', 'Administration'),
    ('finance', 'Finance'),
    ('boarding', 'Boarding & welfare'),
    ('discipline', 'Discipline'),
    ('library', 'Library'),
    ('health', 'Health'),
    ('kitchen', 'Kitchen & catering'),
    ('security', 'Security'),
    ('maintenance', 'Maintenance & grounds'),
    ('cleaning', 'Cleaning'),
    ('transport', 'Transport'),
]

# Where an account's role places a new worker until somebody says otherwise.
ROLE_DEPARTMENT = {
    'teacher': 'academic',
    'dos': 'academic',
    'admin': 'administration',
    'bursar': 'finance',
    'matron': 'boarding',
    'discipline': 'discipline',
    'librarian': 'library',
}

# The roles that are staff. Students and parents have accounts but no job.
STAFF_ROLES = tuple(ROLE_DEPARTMENT)


class StaffMember(models.Model):
    EMPLOYMENT_CHOICES = [
        ('full_time', 'Full-time'),
        ('part_time', 'Part-time'),
        ('contract', 'Contract'),
        ('casual', 'Casual'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # The login, when this worker has one. Names and contact details then come
    # from the account, so the two cannot drift apart.
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                null=True, blank=True, related_name='staff_record')
    first_name  = models.CharField(max_length=150)
    last_name   = models.CharField(max_length=150, blank=True)
    staff_no    = models.CharField(max_length=30, blank=True)
    job_title   = models.CharField(max_length=100, blank=True)
    department  = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True,
                                    blank=True, related_name='members')
    employment_type = models.CharField(max_length=10, choices=EMPLOYMENT_CHOICES,
                                       default='full_time')
    phone       = models.CharField(max_length=20, blank=True)
    email       = models.EmailField(blank=True)
    national_id = models.CharField(max_length=30, blank=True)
    start_date  = models.DateField(null=True, blank=True)
    end_date    = models.DateField(null=True, blank=True)
    is_active   = models.BooleanField(default=True)
    note        = models.CharField(max_length=255, blank=True)
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'staff_members'
        ordering = ['last_name', 'first_name']
        constraints = [
            # Blank is allowed many times; a number the school issues is issued once.
            models.UniqueConstraint(fields=['staff_no'], condition=~models.Q(staff_no=''),
                                    name='staff_member_number_once'),
        ]

    def __str__(self):
        return self.full_name

    @property
    def full_name(self):
        return f'{self.first_name} {self.last_name}'.strip()
