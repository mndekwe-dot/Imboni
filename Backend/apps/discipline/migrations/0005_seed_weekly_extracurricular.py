import uuid
from django.db import migrations

WEEKS = ['2026-W23', '2026-W24', '2026-W25']

# Each week uses the same base template but afterschool activities rotate
COMMON_ENTRIES = [
    # (slot_id, day, activity_type, subject, teacher, room, label)
    ('morning', 'Monday',    'boarding', 'Wake-up & Prep',    'All Matrons',               'Dormitories',    ''),
    ('morning', 'Tuesday',   'boarding', 'Wake-up & Prep',    'All Matrons',               'Dormitories',    ''),
    ('morning', 'Wednesday', 'boarding', 'Wake-up & Prep',    'All Matrons',               'Dormitories',    ''),
    ('morning', 'Thursday',  'boarding', 'Wake-up & Prep',    'All Matrons',               'Dormitories',    ''),
    ('morning', 'Friday',    'boarding', 'Wake-up & Prep',    'All Matrons',               'Dormitories',    ''),
    ('morning', 'Saturday',  'boarding', 'Wake-up & Prep',    'All Matrons',               'Dormitories',    ''),
    ('morning', 'Sunday',    'empty',    '',                  '',                          '',               'Rest Day'),

    ('assembly', 'Monday',    'social', 'Morning Assembly', 'Mr. Eric Mutabazi',  'Quadrangle', ''),
    ('assembly', 'Tuesday',   'social', 'Morning Assembly', 'Mr. Eric Mutabazi',  'Quadrangle', ''),
    ('assembly', 'Wednesday', 'social', 'Morning Assembly', 'Mr. Eric Mutabazi',  'Quadrangle', ''),
    ('assembly', 'Thursday',  'social', 'Morning Assembly', 'Mr. Eric Mutabazi',  'Quadrangle', ''),
    ('assembly', 'Friday',    'social', 'Morning Assembly', 'Mr. Eric Mutabazi',  'Quadrangle', ''),
    ('assembly', 'Saturday',  'empty',  '',                 '',                   '',           '—'),
    ('assembly', 'Sunday',    'empty',  '',                 '',                   '',           '—'),

    ('lunch', 'Monday',    'dining', 'Lunch Sitting', 'Duty Staff', 'Dining Hall', ''),
    ('lunch', 'Tuesday',   'dining', 'Lunch Sitting', 'Duty Staff', 'Dining Hall', ''),
    ('lunch', 'Wednesday', 'dining', 'Lunch Sitting', 'Duty Staff', 'Dining Hall', ''),
    ('lunch', 'Thursday',  'dining', 'Lunch Sitting', 'Duty Staff', 'Dining Hall', ''),
    ('lunch', 'Friday',    'dining', 'Lunch Sitting', 'Duty Staff', 'Dining Hall', ''),
    ('lunch', 'Saturday',  'dining', 'Lunch Sitting', 'Duty Staff', 'Dining Hall', ''),
    ('lunch', 'Sunday',    'dining', 'Lunch Sitting', 'Duty Staff', 'Dining Hall', ''),

    ('evening', 'Monday',    'academic', 'Evening Prep',      'House Staff',               'Dormitories',  ''),
    ('evening', 'Tuesday',   'sports',   'Football Training', 'Mr. Emmanuel Nshimiyimana', 'Sports Field', ''),
    ('evening', 'Wednesday', 'academic', 'Evening Prep',      'House Staff',               'Dormitories',  ''),
    ('evening', 'Thursday',  'sports',   'Basketball',        'Mr. Gaspard Nkurunziza',    'Court',        ''),
    ('evening', 'Friday',    'academic', 'Evening Prep',      'House Staff',               'Dormitories',  ''),
    ('evening', 'Saturday',  'arts',     'Drama Rehearsal',   'Ms. Sylvie Ingabire',       'School Hall',  ''),
    ('evening', 'Sunday',    'empty',    '',                  '',                          '',             'Free Time'),

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

# Afterschool activities vary per week so each week feels distinct
AFTERSCHOOL = {
    '2026-W23': [
        ('Monday',    'sports',   'Football Training', 'Mr. Emmanuel Nshimiyimana', 'Sports Field'),
        ('Tuesday',   'academic', 'Debate Club',       'Ms. Claudine Umutoni',      'Library'),
        ('Wednesday', 'sports',   'Basketball',        'Mr. Gaspard Nkurunziza',    'Court'),
        ('Thursday',  'academic', 'Science Club',      'Mr. Théophile Bizimana',    'Lab 2'),
        ('Friday',    'arts',     'Drama Club',        'Ms. Sylvie Ingabire',       'School Hall'),
        ('Saturday',  'sports',   'Athletics',         'Mr. Emmanuel Nshimiyimana', 'Track'),
        ('Sunday',    'social',   'Community Service', 'Mr. Janvier Ntakirutimana', 'Community Hall'),
    ],
    '2026-W24': [
        ('Monday',    'sports',   'Basketball',        'Mr. Gaspard Nkurunziza',    'Court'),
        ('Tuesday',   'arts',     'Music Club',        'Ms. Sylvie Ingabire',       'School Hall'),
        ('Wednesday', 'sports',   'Football Training', 'Mr. Emmanuel Nshimiyimana', 'Sports Field'),
        ('Thursday',  'academic', 'Debate Club',       'Ms. Claudine Umutoni',      'Library'),
        ('Friday',    'academic', 'Science Club',      'Mr. Théophile Bizimana',    'Lab 2'),
        ('Saturday',  'social',   'School Cleanup',    'Mr. Janvier Ntakirutimana', 'Grounds'),
        ('Sunday',    'sports',   'Athletics',         'Mr. Emmanuel Nshimiyimana', 'Track'),
    ],
    '2026-W25': [
        ('Monday',    'academic', 'Science Club',      'Mr. Théophile Bizimana',    'Lab 2'),
        ('Tuesday',   'sports',   'Football Training', 'Mr. Emmanuel Nshimiyimana', 'Sports Field'),
        ('Wednesday', 'arts',     'Drama Club',        'Ms. Sylvie Ingabire',       'School Hall'),
        ('Thursday',  'sports',   'Basketball',        'Mr. Gaspard Nkurunziza',    'Court'),
        ('Friday',    'social',   'Career Talk',       'Mr. Eric Mutabazi',         'Auditorium'),
        ('Saturday',  'sports',   'Cross Country',     'Mr. Emmanuel Nshimiyimana', 'School Grounds'),
        ('Sunday',    'academic', 'Library Study',     'Ms. Claudine Umutoni',      'Library'),
    ],
}


def seed_weekly(apps, schema_editor):
    ExtracurricularEntry = apps.get_model('discipline', 'ExtracurricularEntry')
    for week in WEEKS:
        for slot_id, day, activity_type, subject, teacher, room, label in COMMON_ENTRIES:
            ExtracurricularEntry.objects.get_or_create(
                week=week, slot_id=slot_id, day=day,
                defaults={
                    'activity_type': activity_type,
                    'subject':       subject,
                    'teacher':       teacher,
                    'room':          room,
                    'label':         label,
                },
            )
        for day, activity_type, subject, teacher, room in AFTERSCHOOL[week]:
            ExtracurricularEntry.objects.update_or_create(
                week=week, slot_id='afterschool', day=day,
                defaults={
                    'activity_type': activity_type,
                    'subject':       subject,
                    'teacher':       teacher,
                    'room':          room,
                    'label':         '',
                },
            )


class Migration(migrations.Migration):

    dependencies = [
        ('discipline', '0004_extracurricularentry'),
    ]

    operations = [
        migrations.RunPython(seed_weekly, migrations.RunPython.noop),
    ]
