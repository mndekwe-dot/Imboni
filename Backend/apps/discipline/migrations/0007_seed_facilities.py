import uuid
from django.db import migrations


FACILITIES = [
    # (name, facility_type, gender, capacity, description)

    # ── Dormitories ───────────────────────────────────────────────────────────
    ('Bisoke',    'dormitory', 'girls', 60,  'Girls dormitory — S1–S3 wing'),
    ('Karisimbi', 'dormitory', 'girls', 50,  'Girls dormitory — S4–S6 wing'),
    ('Muhabura',  'dormitory', 'boys',  60,  'Boys dormitory — junior wing'),
    ('Sabyinyo',  'dormitory', 'boys',  55,  'Boys dormitory — senior wing'),

    # ── Dining Halls ──────────────────────────────────────────────────────────
    ('Main Dining Hall',   'dining_hall', 'na', 300, 'Primary dining facility for all students'),
    ('Junior Dining Hall', 'dining_hall', 'na', 150, 'Secondary dining area — overflow and junior classes'),

    # ── Common Rooms ──────────────────────────────────────────────────────────
    ('Student Common Room', 'common_room', 'mixed', 80, 'Shared common room for recreation and socialising'),

    # ── Medical ───────────────────────────────────────────────────────────────
    ('Medical Bay', 'medical', 'na', 10, 'School health facility managed by the matron'),

    # ── Sports ────────────────────────────────────────────────────────────────
    ('Sports Ground',    'sports', 'mixed', 200, 'Multi-purpose outdoor sports field'),
    ('Basketball Court', 'sports', 'mixed', 60,  'Outdoor basketball court'),

    # ── Library ───────────────────────────────────────────────────────────────
    ('School Library', 'library', 'mixed', 100, 'Main library — open weekdays until 6 PM'),
]


def seed_facilities(apps, schema_editor):
    DisFacility = apps.get_model('discipline', 'DisFacility')
    for name, ftype, gender, capacity, description in FACILITIES:
        DisFacility.objects.get_or_create(
            name=name,
            facility_type=ftype,
            defaults={
                'gender': gender,
                'capacity': capacity,
                'description': description,
                'is_active': True,
            },
        )


class Migration(migrations.Migration):

    dependencies = [
        ('discipline', '0006_disfacility'),
    ]

    operations = [
        migrations.RunPython(seed_facilities, migrations.RunPython.noop),
    ]
