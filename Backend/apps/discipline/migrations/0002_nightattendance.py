# Generated manually 2026-03-12

import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('discipline', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='NightAttendance',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('date', models.DateField()),
                ('is_present', models.BooleanField(default=True)),
                ('notes', models.CharField(blank=True, max_length=200)),
                ('recorded_at', models.DateTimeField(auto_now_add=True)),
                ('student', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='night_attendances', to='discipline.boardingstudent')),
                ('recorded_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='night_checks_recorded', to=settings.AUTH_USER_MODEL)),
            ],
            options={'db_table': 'night_attendance', 'unique_together': {('student', 'date')}},
        ),
    ]
