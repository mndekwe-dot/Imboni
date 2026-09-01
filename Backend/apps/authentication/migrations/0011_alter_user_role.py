# Adds the bursar role. Renumbered from 0010 when feat/finance-portal met
# feat/platform-hardening: both branched off 0009 and both called their
# migration 0010, which leaves the app with two leaves and no migration
# able to run. Re-parented onto the invitation change rather than papering
# over it with a merge migration -- the two edits are independent, so the
# order is arbitrary and a linear chain is the honest description.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('authentication', '0010_invitation_token_hash'),
    ]

    operations = [
        migrations.AlterField(
            model_name='user',
            name='role',
            field=models.CharField(choices=[('student', 'Student'), ('parent', 'Parent'), ('teacher', 'Teacher'), ('dos', 'Director of Studies'), ('matron', 'Matron'), ('discipline', 'Director of Discipline'), ('librarian', 'Librarian'), ('bursar', 'Bursar'), ('admin', 'Administrator')], max_length=10),
        ),
    ]
