import uuid
from django.db import migrations


SECTIONS = [
    # (name, gender, description, dorm_names)
    ('Boys Section',  'boys',  'Dormitory section for male students',   ['Muhabura', 'Sabyinyo']),
    ('Girls Section', 'girls', 'Dormitory section for female students', ['Bisoke', 'Karisimbi']),
]


def seed_sections(apps, schema_editor):
    DisFacilitySection = apps.get_model('discipline', 'DisFacilitySection')
    DisFacility        = apps.get_model('discipline', 'DisFacility')

    for name, gender, description, dorm_names in SECTIONS:
        sec, _ = DisFacilitySection.objects.get_or_create(
            name=name,
            defaults={'gender': gender, 'description': description},
        )
        DisFacility.objects.filter(
            facility_type='dormitory',
            name__in=dorm_names,
        ).update(section=sec)


class Migration(migrations.Migration):

    dependencies = [
        ('discipline', '0008_disfacilitysection'),
    ]

    operations = [
        migrations.RunPython(seed_sections, migrations.RunPython.noop),
    ]
