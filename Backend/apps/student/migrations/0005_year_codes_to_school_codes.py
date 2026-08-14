"""
Rewrite bare numeric year levels into the school's own codes.

Before this, `Student.grade` held '1'-'6' while the school's configuration
(`SchoolSection.years`) held 'S1'-'S6'. Code bridged the two by adding or
stripping an 'S' at the seam, which quietly corrupted any year name that did not
start with 'S' or was longer than one character after the prefix.

This makes the stored value the school's own code, so there is one encoding and
nothing to parse. '3' becomes 'S3' for a Rwandan school and 'P3' for a primary
school that has configured itself that way.

Runs per tenant schema, because that is where pupil data lives.

IDEMPOTENT: only values that are entirely digits are touched, so a value that is
already a code ('S3', 'P3') is left alone and a re-run is a no-op.
"""
from django.db import migrations


def _prefix_from_config(SchoolSection):
    """
    Work out the school's own prefix from its configured years.

    A school whose config says 'P1'/'P2' should have its pupils rewritten to
    'P3', not 'S3'. Falls back to 'S' -- the Rwandan default and the only value
    the old code ever produced.
    """
    try:
        rows = SchoolSection.objects.all()
    except Exception:
        return 'S'

    for row in rows:
        for entry in (row.years or []):
            name = entry.get('name') if isinstance(entry, dict) else entry
            name = str(name or '').strip()
            # 'S1' -> 'S', 'P10' -> 'P'. Anything without a leading letter tells
            # us nothing, so keep looking.
            if len(name) >= 2 and name[0].isalpha() and name[1:].isdigit():
                return name[0]
    return 'S'


def forwards(apps, schema_editor):
    Student = apps.get_model('student', 'Student')
    Class = apps.get_model('teacher', 'Class')
    ConsentRequest = apps.get_model('parents', 'ConsentRequest')
    SchoolSection = apps.get_model('dos', 'SchoolSection')

    prefix = _prefix_from_config(SchoolSection)

    for model, field in ((Student, 'grade'), (Class, 'grade'), (ConsentRequest, 'grade')):
        for row in model.objects.all():
            value = (getattr(row, field) or '').strip()
            if value.isdigit():
                setattr(row, field, f'{prefix}{value}')
                row.save(update_fields=[field])


def backwards(apps, schema_editor):
    """
    Strip the prefix back off, so the migration is reversible.

    Only touches values shaped like <letter><digits>; anything a school has since
    configured for itself ('Reception', 'Year 12') has no numeric form to go back
    to and is left as it is.
    """
    Student = apps.get_model('student', 'Student')
    Class = apps.get_model('teacher', 'Class')
    ConsentRequest = apps.get_model('parents', 'ConsentRequest')

    for model, field in ((Student, 'grade'), (Class, 'grade'), (ConsentRequest, 'grade')):
        for row in model.objects.all():
            value = (getattr(row, field) or '').strip()
            if len(value) >= 2 and value[0].isalpha() and value[1:].isdigit():
                setattr(row, field, value[1:])
                row.save(update_fields=[field])


class Migration(migrations.Migration):

    dependencies = [
        ('student', '0004_configurable_school_structure'),
        # The columns must be widened before longer values are written into them,
        # and the config table must exist before it is read.
        ('teacher', '0009_configurable_school_structure'),
        ('parents', '0006_configurable_school_structure'),
        ('dos', '0008_configurable_school_structure'),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
