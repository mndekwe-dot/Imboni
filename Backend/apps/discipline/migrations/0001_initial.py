# Generated manually 2026-03-12

import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('parents', '0002_fee_studentdocument'),
        ('results', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='DisciplineStaff',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('staff_type', models.CharField(choices=[('matron', 'Matron'), ('patron', 'Patron'), ('head_matron', 'Head Matron'), ('director', 'Director of Discipline')], max_length=20)),
                ('assigned_dormitory', models.CharField(blank=True, max_length=100)),
                ('assigned_grade', models.CharField(blank=True, max_length=10)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='discipline_staff_profile', to=settings.AUTH_USER_MODEL)),
            ],
            options={'db_table': 'discipline_staff'},
        ),
        migrations.CreateModel(
            name='StudentLeader',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('role', models.CharField(choices=[('head_boy', 'Head Boy'), ('head_girl', 'Head Girl'), ('deputy_head_boy', 'Deputy Head Boy'), ('deputy_head_girl', 'Deputy Head Girl'), ('prefect', 'Prefect'), ('house_captain', 'House Captain'), ('class_captain', 'Class Captain'), ('games_captain', 'Games Captain')], max_length=30)),
                ('appointed_date', models.DateField()),
                ('is_active', models.BooleanField(default=True)),
                ('notes', models.TextField(blank=True)),
                ('student', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='leadership_roles', to='parents.student')),
                ('term', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='student_leaders', to='results.academicterm')),
            ],
            options={'db_table': 'student_leaders', 'unique_together': {('student', 'role', 'term')}},
        ),
        migrations.CreateModel(
            name='BoardingStudent',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('dormitory', models.CharField(max_length=100)),
                ('room_number', models.CharField(max_length=20)),
                ('bed_number', models.CharField(blank=True, max_length=10)),
                ('boarding_type', models.CharField(choices=[('full_boarder', 'Full Boarder'), ('weekly_boarder', 'Weekly Boarder'), ('day_scholar', 'Day Scholar')], default='full_boarder', max_length=20)),
                ('check_in_date', models.DateField()),
                ('is_active', models.BooleanField(default=True)),
                ('notes', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('student', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='boarding_info', to='parents.student')),
            ],
            options={'db_table': 'boarding_students'},
        ),
        migrations.CreateModel(
            name='DiningPlan',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('plan_type', models.CharField(choices=[('full_board', 'Full Board'), ('half_board', 'Half Board (Lunch Only)'), ('day_scholar', 'Day Scholar')], max_length=20)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('student', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='dining_plans', to='parents.student')),
                ('term', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='dining_plans', to='results.academicterm')),
            ],
            options={'db_table': 'dining_plans', 'unique_together': {('student', 'term')}},
        ),
    ]
