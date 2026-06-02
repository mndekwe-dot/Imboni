import uuid
from django.db import migrations, models


INITIAL_ENTRIES = [
    # (slot_id, day, activity_type, subject, teacher, room, label)
    ('morning', 'Monday',    'boarding', 'Wake-up & Prep',    'All Matrons',               'Dormitories',     ''),
    ('morning', 'Tuesday',   'boarding', 'Wake-up & Prep',    'All Matrons',               'Dormitories',     ''),
    ('morning', 'Wednesday', 'boarding', 'Wake-up & Prep',    'All Matrons',               'Dormitories',     ''),
    ('morning', 'Thursday',  'boarding', 'Wake-up & Prep',    'All Matrons',               'Dormitories',     ''),
    ('morning', 'Friday',    'boarding', 'Wake-up & Prep',    'All Matrons',               'Dormitories',     ''),
    ('morning', 'Saturday',  'boarding', 'Wake-up & Prep',    'All Matrons',               'Dormitories',     ''),
    ('morning', 'Sunday',    'empty',    '',                  '',                           '',               'Rest Day'),

    ('assembly', 'Monday',    'social',  'Morning Assembly',  'Mr. Eric Mutabazi',         'Quadrangle',      ''),
    ('assembly', 'Tuesday',   'social',  'Morning Assembly',  'Mr. Eric Mutabazi',         'Quadrangle',      ''),
    ('assembly', 'Wednesday', 'social',  'Morning Assembly',  'Mr. Eric Mutabazi',         'Quadrangle',      ''),
    ('assembly', 'Thursday',  'social',  'Morning Assembly',  'Mr. Eric Mutabazi',         'Quadrangle',      ''),
    ('assembly', 'Friday',    'social',  'Morning Assembly',  'Mr. Eric Mutabazi',         'Quadrangle',      ''),
    ('assembly', 'Saturday',  'empty',   '',                  '',                           '',               '—'),
    ('assembly', 'Sunday',    'empty',   '',                  '',                           '',               '—'),

    ('lunch', 'Monday',    'dining', 'Lunch Sitting', 'Duty Staff', 'Dining Hall', ''),
    ('lunch', 'Tuesday',   'dining', 'Lunch Sitting', 'Duty Staff', 'Dining Hall', ''),
    ('lunch', 'Wednesday', 'dining', 'Lunch Sitting', 'Duty Staff', 'Dining Hall', ''),
    ('lunch', 'Thursday',  'dining', 'Lunch Sitting', 'Duty Staff', 'Dining Hall', ''),
    ('lunch', 'Friday',    'dining', 'Lunch Sitting', 'Duty Staff', 'Dining Hall', ''),
    ('lunch', 'Saturday',  'dining', 'Lunch Sitting', 'Duty Staff', 'Dining Hall', ''),
    ('lunch', 'Sunday',    'dining', 'Lunch Sitting', 'Duty Staff', 'Dining Hall', ''),

    ('afterschool', 'Monday',    'sports',   'Football Training', 'Mr. Emmanuel Nshimiyimana', 'Sports Field',    ''),
    ('afterschool', 'Tuesday',   'academic', 'Debate Club',       'Ms. Claudine Umutoni',      'Library',         ''),
    ('afterschool', 'Wednesday', 'sports',   'Basketball',        'Mr. Gaspard Nkurunziza',    'Court',           ''),
    ('afterschool', 'Thursday',  'academic', 'Science Club',      'Mr. Théophile Bizimana', 'Lab 2',         ''),
    ('afterschool', 'Friday',    'arts',     'Drama Club',        'Ms. Sylvie Ingabire',       'School Hall',     ''),
    ('afterschool', 'Saturday',  'sports',   'Athletics',         'Mr. Emmanuel Nshimiyimana', 'Track',           ''),
    ('afterschool', 'Sunday',    'social',   'Community Service', 'Mr. Janvier Ntakirutimana', 'Community Hall',  ''),

    ('evening', 'Monday',    'academic', 'Evening Prep',      'House Staff',               'Dormitories',     ''),
    ('evening', 'Tuesday',   'sports',   'Football Training', 'Mr. Emmanuel Nshimiyimana', 'Sports Field',    ''),
    ('evening', 'Wednesday', 'academic', 'Evening Prep',      'House Staff',               'Dormitories',     ''),
    ('evening', 'Thursday',  'sports',   'Basketball',        'Mr. Gaspard Nkurunziza',    'Court',           ''),
    ('evening', 'Friday',    'academic', 'Evening Prep',      'House Staff',               'Dormitories',     ''),
    ('evening', 'Saturday',  'arts',     'Drama Rehearsal',   'Ms. Sylvie Ingabire',       'School Hall',     ''),
    ('evening', 'Sunday',    'empty',    '',                  '',                           '',               'Free Time'),

    ('dinner', 'Monday',    'dining', 'Dinner Sitting', 'Duty Staff', 'Dining Hall', ''),
    ('dinner', 'Tuesday',   'dining', 'Dinner Sitting', 'Duty Staff', 'Dining Hall', ''),
    ('dinner', 'Wednesday', 'dining', 'Dinner Sitting', 'Duty Staff', 'Dining Hall', ''),
    ('dinner', 'Thursday',  'dining', 'Dinner Sitting', 'Duty Staff', 'Dining Hall', ''),
    ('dinner', 'Friday',    'dining', 'Dinner Sitting', 'Duty Staff', 'Dining Hall', ''),
    ('dinner', 'Saturday',  'dining', 'Dinner Sitting', 'Duty Staff', 'Dining Hall', ''),
    ('dinner', 'Sunday',    'dining', 'Dinner Sitting', 'Duty Staff', 'Dining Hall', ''),

    ('lightsout', 'Monday',    'boarding', 'Curfew / Rounds', 'All Dormitory Staff', 'All Dormitories', ''),
    ('lightsout', 'Tuesday',   'boarding', 'Curfew / Rounds', 'All Dormitory Staff', 'All Dormitories', ''),
    ('lightsout', 'Wednesday', 'boarding', 'Curfew / Rounds', 'All Dormitory Staff', 'All Dormitories', ''),
    ('lightsout', 'Thursday',  'boarding', 'Curfew / Rounds', 'All Dormitory Staff', 'All Dormitories', ''),
    ('lightsout', 'Friday',    'boarding', 'Curfew / Rounds', 'All Dormitory Staff', 'All Dormitories', ''),
    ('lightsout', 'Saturday',  'boarding', 'Curfew / Rounds', 'All Dormitory Staff', 'All Dormitories', ''),
    ('lightsout', 'Sunday',    'boarding', 'Curfew / Rounds', 'All Dormitory Staff', 'All Dormitories', ''),
]


def seed_extracurricular(apps, schema_editor):
    ExtracurricularEntry = apps.get_model('discipline', 'ExtracurricularEntry')
    for slot_id, day, activity_type, subject, teacher, room, label in INITIAL_ENTRIES:
        ExtracurricularEntry.objects.get_or_create(
            week='default', slot_id=slot_id, day=day,
            defaults={
                'activity_type': activity_type,
                'subject':       subject,
                'teacher':       teacher,
                'room':          room,
                'label':         label,
            },
        )


class Migration(migrations.Migration):

    dependencies = [
        ('discipline', '0003_alter_boardingstudent_student_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='ExtracurricularEntry',
            fields=[
                ('id',            models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
                ('week',          models.CharField(default='default', max_length=20)),
                ('slot_id',       models.CharField(max_length=50)),
                ('day',           models.CharField(max_length=20)),
                ('activity_type', models.CharField(
                    choices=[('sports','Sports'),('academic','Academic'),('arts','Arts'),
                             ('boarding','Boarding'),('dining','Dining'),('social','Social'),('empty','Empty')],
                    default='social', max_length=20,
                )),
                ('subject',    models.CharField(blank=True, max_length=200)),
                ('teacher',    models.CharField(blank=True, max_length=200)),
                ('room',       models.CharField(blank=True, max_length=200)),
                ('label',      models.CharField(blank=True, max_length=100)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'db_table': 'extracurricular_entries',
                'unique_together': {('week', 'slot_id', 'day')},
            },
        ),
        migrations.RunPython(seed_extracurricular, migrations.RunPython.noop),
    ]
