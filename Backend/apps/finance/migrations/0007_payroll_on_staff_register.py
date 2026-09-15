"""
Payroll pays workers on the staff register rather than login accounts.

Every existing salary and payslip is moved onto the register entry of the
account it pointed at (0002 in the staff app made one for each staff account),
and each payslip gets the job title and department it was paid under.
"""
import django.db.models.deletion
from django.db import migrations, models


def _member(apps, user_id):
    StaffMember = apps.get_model('staff', 'StaffMember')
    User = apps.get_model('authentication', 'User')
    member = StaffMember.objects.filter(user_id=user_id).select_related('department').first()
    if member:
        return member
    # A salary for an account whose role is no longer staff: still somebody paid.
    user = User.objects.get(pk=user_id)
    return StaffMember.objects.create(
        user=user, first_name=user.first_name or user.username, last_name=user.last_name,
        email=user.email, phone=user.phone_number, is_active=user.is_active)


def forwards(apps, schema_editor):
    StaffSalary = apps.get_model('finance', 'StaffSalary')
    Payslip = apps.get_model('finance', 'Payslip')
    for salary in StaffSalary.objects.all():
        salary.member = _member(apps, salary.staff_id)
        salary.save(update_fields=['member'])
    for payslip in Payslip.objects.all():
        member = _member(apps, payslip.staff_id)
        payslip.member = member
        payslip.job_title = member.job_title
        payslip.department = member.department.name if member.department_id else ''
        payslip.save(update_fields=['member', 'job_title', 'department'])


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0006_default_income_and_expense_categories'),
        ('staff', '0002_departments_and_existing_staff'),
    ]

    operations = [
        migrations.AddField(
            model_name='staffsalary',
            name='member',
            field=models.OneToOneField(null=True, on_delete=django.db.models.deletion.CASCADE,
                                       related_name='+', to='staff.staffmember'),
        ),
        migrations.AddField(
            model_name='payslip',
            name='member',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.PROTECT,
                                    related_name='+', to='staff.staffmember'),
        ),
        migrations.AddField(
            model_name='payslip',
            name='job_title',
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name='payslip',
            name='department',
            field=models.CharField(blank=True, max_length=80),
        ),
        migrations.RunPython(forwards, migrations.RunPython.noop),
        migrations.RemoveConstraint(model_name='payslip', name='finance_payslip_once_per_run'),
        migrations.RemoveField(model_name='staffsalary', name='staff'),
        migrations.RemoveField(model_name='payslip', name='staff'),
        migrations.RenameField(model_name='staffsalary', old_name='member', new_name='staff'),
        migrations.RenameField(model_name='payslip', old_name='member', new_name='staff'),
        migrations.AlterField(
            model_name='staffsalary',
            name='staff',
            field=models.OneToOneField(on_delete=django.db.models.deletion.CASCADE,
                                       related_name='salary', to='staff.staffmember'),
        ),
        migrations.AlterField(
            model_name='payslip',
            name='staff',
            field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT,
                                    related_name='payslips', to='staff.staffmember'),
        ),
        migrations.AddConstraint(
            model_name='payslip',
            constraint=models.UniqueConstraint(fields=('run', 'staff'),
                                               name='finance_payslip_once_per_run'),
        ),
    ]
