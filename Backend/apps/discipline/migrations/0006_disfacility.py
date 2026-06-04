import uuid
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('discipline', '0005_seed_weekly_extracurricular'),
    ]

    operations = [
        migrations.CreateModel(
            name='DisFacility',
            fields=[
                ('id',            models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
                ('name',          models.CharField(max_length=100)),
                ('facility_type', models.CharField(max_length=20, choices=[
                    ('dormitory',   'Dormitory'),
                    ('dining_hall', 'Dining Hall'),
                    ('common_room', 'Common Room'),
                    ('medical',     'Medical Room'),
                    ('sports',      'Sports Facility'),
                    ('library',     'Library'),
                    ('other',       'Other'),
                ])),
                ('gender', models.CharField(max_length=10, choices=[
                    ('boys',  'Boys'),
                    ('girls', 'Girls'),
                    ('mixed', 'Mixed'),
                    ('na',    'Not Applicable'),
                ], default='na')),
                ('capacity',    models.PositiveIntegerField(null=True, blank=True)),
                ('description', models.TextField(blank=True)),
                ('is_active',   models.BooleanField(default=True)),
                ('created_at',  models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'db_table': 'dis_facilities',
                'ordering': ['facility_type', 'name'],
            },
        ),
    ]
