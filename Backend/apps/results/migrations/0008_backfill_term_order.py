"""
Give every existing term its position in the academic year.

Ordering used to rely on the strings 'term1' < 'term2' < 'term3' sorting
lexicographically. That is true for those three exact values and for nothing
else: a school with 'autumn'/'spring'/'summer' would have been ordered
alphabetically, and 'term10' would have sorted before 'term2'.

`AcademicTerm.order` makes the sequence explicit. This fills it in for rows that
predate the field, so existing schools keep the order they already had.

Runs per tenant schema, because that is where academic terms live.

IDEMPOTENT: the value is derived from the term code every time, so a re-run
recomputes the same number.
"""
from django.db import migrations


def _order_from_config(SchoolSetting):
    """
    Map term code -> order using the school's own configuration.

    A school that has already defined its terms is the authority on their
    sequence; only fall back to guessing when it has not.
    """
    try:
        setting = SchoolSetting.objects.first()
    except Exception:
        return {}
    if setting is None:
        return {}

    mapping = {}
    for index, entry in enumerate(setting.terms or [], start=1):
        if not isinstance(entry, dict):
            continue
        code = str(entry.get('code') or '').strip()
        if not code:
            continue
        try:
            mapping[code] = int(entry.get('order') or index)
        except (TypeError, ValueError):
            mapping[code] = index
    return mapping


def _trailing_number(value):
    """'term1' -> 1, 'semester-2' -> 2. None when there is no number to read."""
    digits = ''
    for char in reversed(value):
        if char.isdigit():
            digits = char + digits
        else:
            break
    return int(digits) if digits else None


def forwards(apps, schema_editor):
    AcademicTerm = apps.get_model('results', 'AcademicTerm')
    SchoolSetting = apps.get_model('dos', 'SchoolSetting')

    configured = _order_from_config(SchoolSetting)

    # Grouped by year so the last-resort fallback numbers each year's terms
    # 1..n by start date rather than numbering them across the whole table.
    years = AcademicTerm.objects.values_list('year', flat=True).distinct()

    for year in years:
        terms = AcademicTerm.objects.filter(year=year).order_by('start_date', 'term')
        for position, term in enumerate(terms, start=1):
            code = (term.term or '').strip()
            order = configured.get(code) or _trailing_number(code) or position
            if term.order != order:
                term.order = order
                term.save(update_fields=['order'])


def backwards(apps, schema_editor):
    """
    Nothing to undo: `order` is dropped by the schema migration this depends on,
    and the `term` string it was derived from is untouched.
    """


class Migration(migrations.Migration):

    dependencies = [
        ('results', '0007_configurable_school_structure'),
        # SchoolSetting.terms must exist before it is read for the mapping.
        ('dos', '0008_configurable_school_structure'),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
