"""
Index the two hot read paths on Assessment, and make its natural key unique.

The uniqueness constraint is the point: `update_or_create` in
TeacherBulkSaveResultsView keys on (student, subject, term, title) and nothing
in the database enforced it, so two concurrent saves could both insert and the
class ended up with duplicate marks that were double-counted in every average
and pass rate derived from them.

Any duplicates that already exist have to go before the constraint can be added.
The newest row wins — a repeat entry is a teacher correcting or re-submitting,
so the last write is the one they meant.
"""
from django.db import migrations, models


def drop_duplicate_assessments(apps, schema_editor):
    Assessment = apps.get_model('results', 'Assessment')
    seen, doomed = set(), []
    # Newest first, so the first row seen for a key is the one to keep.
    for pk, student, subject, term, title in (
        Assessment.objects
        .order_by('-created_at')
        .values_list('pk', 'student_id', 'subject_id', 'term_id', 'title')
        .iterator()
    ):
        key = (student, subject, term, title)
        if key in seen:
            doomed.append(pk)
        else:
            seen.add(key)
    if doomed:
        Assessment.objects.filter(pk__in=doomed).delete()


def noop(apps, schema_editor):
    """Deleted duplicates cannot be recreated; reversing only drops the constraint."""


class Migration(migrations.Migration):

    dependencies = [
        ('results', '0008_backfill_term_order'),
        ('student', '0006_remove_assignmentsubmission_assignment_and_more'),
    ]

    operations = [
        migrations.RunPython(drop_duplicate_assessments, noop),
        migrations.AddIndex(
            model_name='assessment',
            index=models.Index(fields=['student', 'term'], name='assessment_student_term_idx'),
        ),
        migrations.AddIndex(
            model_name='assessment',
            index=models.Index(fields=['term', 'subject'], name='assessment_term_subject_idx'),
        ),
        migrations.AddConstraint(
            model_name='assessment',
            constraint=models.UniqueConstraint(fields=('student', 'subject', 'term', 'title'), name='uniq_assessment_student_subject_term_title'),
        ),
    ]
