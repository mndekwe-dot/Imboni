from django.db import migrations

WEEKDAY_ROWS = [
    ('05:30', 'Wake-up',    False, '', 'other',      'Wake Up',                'All Students',       'Dormitories'),
    ('05:45', 'Prep',       False, '', 'lang',       'Morning Prep & Showers', 'Matron supervision', 'Rooms 1–10 first'),
    ('06:45', 'Breakfast',  False, '', 'science',    'Breakfast',              'All Students',       'Dining Hall'),
    ('07:15', 'Assembly',   False, '', 'english',    'Morning Assembly',       'All students',       'Main Hall'),
    ('07:30', 'Lessons',    False, '', 'math',       'Lessons Begin',          'All classrooms',     'As per class TT'),
    ('13:00', 'Lunch',      True,  'Lunch Break — Dining Hall — 1 hour', '', '', '', ''),
    ('14:00', 'Afternoon',  False, '', 'math',       'Afternoon Lessons',      'All classrooms',     'As per class TT'),
    ('16:30', 'Games',      False, '', 'humanities', 'Games & Clubs',          'Sports Master',      'Grounds / Halls'),
    ('18:00', 'Supper',     False, '', 'science',    'Supper',                 'All Students',       'Dining Hall'),
    ('19:00', 'Prep',       False, '', 'english',    'Evening Prep',           'Supervised study',   'Classrooms / Library'),
    ('21:00', 'Dorm',       False, '', 'lang',       'Return to Dorm',         'Matron supervision', 'All dormitories'),
    ('21:30', 'Lights Out', True,  'Lights Out — Juniors (S1–S2) · 22:00 Seniors (S3–S6) · 22:15 Curfew Roll Call', '', '', '', ''),
]

WEEKEND_ROWS = [
    ('06:30', 'Wake-up',
     ('other', 'Wake Up', 'All Students', 'Dormitories'),
     ('other', 'Wake Up', 'All Students', 'Dormitories')),
    ('07:00', 'Breakfast',
     ('science', 'Breakfast', 'All Students', 'Dining Hall'),
     ('science', 'Breakfast', 'All Students', 'Dining Hall')),
    ('08:00', 'Duties',
     ('lang', 'Dorm Cleaning & Duties', 'Matron supervision', 'All areas'),
     ('english', 'Chapel / Church Service', 'Chaplain', 'Chapel')),
    ('10:00', 'Activity',
     ('humanities', 'Sports & Recreation', 'Sports Master', 'Grounds'),
     ('humanities', 'Free Time / Visiting', 'Matron on duty', 'Designated areas')),
    ('13:00', 'Lunch',
     ('science', 'Lunch', 'All Students', 'Dining Hall'),
     ('science', 'Lunch', 'All Students', 'Dining Hall')),
    ('14:00', 'Afternoon',
     ('humanities', 'Club Activities', 'Club patrons', 'Various venues'),
     ('math', 'Prep / Study', 'Self-directed', 'Library / Dorms')),
    ('18:00', 'Supper',
     ('science', 'Supper', 'All Students', 'Dining Hall'),
     ('science', 'Supper', 'All Students', 'Dining Hall')),
]

WEEKEND_BREAK = ('21:00', 'Lights Out', 'Return to Dorm · Lights Out 21:30 (all) · Roll Call 21:45')

CHANGES = [
    ('Wed Mar 11 — Games moved from 16:30 to 17:00 (field maintenance)', 'new', '2026-03-08'),
    ('Sat Mar 14 — Visiting hours extended to 16:00 (parent day)', 'new', '2026-03-08'),
    ('Week 8 — Evening prep extended to 21:30 (exam preparation period)', 'applied', '2026-03-01'),
]


def seed(apps, schema_editor):
    BoardingScheduleSlot = apps.get_model('matron', 'BoardingScheduleSlot')
    BoardingScheduleChange = apps.get_model('matron', 'BoardingScheduleChange')

    for i, (time, label, is_break, break_text, cell_class, subject, supervisor, room) in enumerate(WEEKDAY_ROWS):
        BoardingScheduleSlot.objects.create(
            day_type='weekday', order=i, time=time, label=label,
            is_break=is_break, break_text=break_text,
            cell_class=cell_class, subject=subject, supervisor=supervisor, room=room,
        )

    for i, (time, label, sat, sun) in enumerate(WEEKEND_ROWS):
        BoardingScheduleSlot.objects.create(
            day_type='saturday', order=i, time=time, label=label,
            cell_class=sat[0], subject=sat[1], supervisor=sat[2], room=sat[3],
        )
        BoardingScheduleSlot.objects.create(
            day_type='sunday', order=i, time=time, label=label,
            cell_class=sun[0], subject=sun[1], supervisor=sun[2], room=sun[3],
        )

    brk_time, brk_label, brk_text = WEEKEND_BREAK
    next_order = len(WEEKEND_ROWS)
    BoardingScheduleSlot.objects.create(
        day_type='saturday', order=next_order, time=brk_time, label=brk_label,
        is_break=True, break_text=brk_text,
    )
    BoardingScheduleSlot.objects.create(
        day_type='sunday', order=next_order, time=brk_time, label=brk_label,
        is_break=True, break_text=brk_text,
    )

    for description, status, change_date in CHANGES:
        BoardingScheduleChange.objects.create(description=description, status=status, change_date=change_date)


def unseed(apps, schema_editor):
    BoardingScheduleSlot = apps.get_model('matron', 'BoardingScheduleSlot')
    BoardingScheduleChange = apps.get_model('matron', 'BoardingScheduleChange')
    BoardingScheduleSlot.objects.all().delete()
    BoardingScheduleChange.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ('matron', '0002_initial'),
    ]

    operations = [
        migrations.RunPython(seed, unseed),
    ]
