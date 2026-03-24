# Generated manually 2026-03-12

import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('results', '0001_initial'),
        ('teacher', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='ExamSchedule',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('title', models.CharField(max_length=200)),
                ('exam_date', models.DateField()),
                ('start_time', models.TimeField()),
                ('end_time', models.TimeField()),
                ('venue', models.CharField(blank=True, max_length=100)),
                ('exam_type', models.CharField(choices=[('midterm', 'Mid-Term Exam'), ('final', 'Final Exam'), ('quiz', 'Quiz'), ('mock', 'Mock Exam'), ('other', 'Other')], default='midterm', max_length=20)),
                ('notes', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('subject', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='exam_schedules', to='results.subject')),
                ('class_obj', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='exam_schedules', to='teacher.class')),
                ('term', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='exam_schedules', to='results.academicterm')),
                ('invigilator', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='invigilated_exams', to=settings.AUTH_USER_MODEL)),
            ],
            options={'db_table': 'exam_schedules', 'ordering': ['exam_date', 'start_time']},
        ),
    ]
