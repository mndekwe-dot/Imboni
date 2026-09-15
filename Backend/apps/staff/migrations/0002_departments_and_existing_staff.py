"""
Seed the departments a school starts with, and put every existing staff account
on the register, in the department its role implies.
"""
from django.db import migrations

DEPARTMENTS = [
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
ROLE_DEPARTMENT = {
    'teacher': 'academic', 'dos': 'academic', 'admin': 'administration', 'bursar': 'finance',
    'matron': 'boarding', 'discipline': 'discipline', 'librarian': 'library',
}
ROLE_TITLES = {
    'teacher': 'Teacher', 'dos': 'Director of Studies', 'admin': 'Head teacher',
    'bursar': 'Bursar', 'matron': 'Matron', 'discipline': 'Director of Discipline',
    'librarian': 'Librarian',
}


def forwards(apps, schema_editor):
    Department = apps.get_model('staff', 'Department')
    StaffMember = apps.get_model('staff', 'StaffMember')
    User = apps.get_model('authentication', 'User')

    by_code = {}
    for order, (code, name) in enumerate(DEPARTMENTS, start=1):
        by_code[code], _ = Department.objects.get_or_create(
            code=code, defaults={'name': name, 'sort_order': order * 10})

    for user in User.objects.filter(role__in=list(ROLE_DEPARTMENT), is_superuser=False):
        if StaffMember.objects.filter(user=user).exists():
            continue
        StaffMember.objects.create(
            user=user, first_name=user.first_name or user.username, last_name=user.last_name,
            email=user.email, phone=user.phone_number, job_title=ROLE_TITLES[user.role],
            department=by_code[ROLE_DEPARTMENT[user.role]],
            employment_type=user.employment_type if user.employment_type in ('full_time', 'part_time') else 'full_time')


class Migration(migrations.Migration):

    dependencies = [
        ('staff', '0001_initial'),
        ('authentication', '0011_alter_user_role'),
    ]

    operations = [
        migrations.RunPython(forwards, migrations.RunPython.noop),
    ]
