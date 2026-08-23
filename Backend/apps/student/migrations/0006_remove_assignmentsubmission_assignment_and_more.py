"""
Drop the duplicate Assignment models from the student app.

Two pairs of these existed. apps.teacher.Assignment / AssignmentSubmission
(tables `teacher_assignments`, `quiz_submissions`) are what the teacher portal
writes when a teacher sets work, and what the student and parent portals now
read. This pair (tables `assignments`, `assignment_submissions`) had the same
names and a similar shape, and only the demo seeder ever wrote to it - so a
student's assignment list was populated by seed data while nothing a teacher
actually created could reach it.

DESTRUCTIVE: this drops both tables and everything in them. The seeder has been
repointed at the teacher models (see seed_all.py), so re-running it recreates
the demo homework in the right place. Any rows left in the old tables are demo
data from previous seed runs and are not referenced by any code path.
"""

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('student', '0005_year_codes_to_school_codes'),
    ]

    operations = [
        # The unique_together goes first. Autodetect emitted it between the two
        # RemoveFields, which fails: dropping `assignment` while a composite
        # constraint still names that column leaves Django looking up a field
        # the model no longer has (FieldDoesNotExist on migrate).
        migrations.AlterUniqueTogether(
            name='assignmentsubmission',
            unique_together=None,
        ),
        migrations.RemoveField(
            model_name='assignmentsubmission',
            name='assignment',
        ),
        migrations.RemoveField(
            model_name='assignmentsubmission',
            name='student',
        ),
        migrations.DeleteModel(
            name='Assignment',
        ),
        migrations.DeleteModel(
            name='AssignmentSubmission',
        ),
    ]
