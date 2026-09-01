"""
Store the SHA-256 of an invitation token instead of the token itself.

Existing links keep working: the old column held the raw token, so hashing it
in place produces exactly the value the new lookup will compute from the token
in someone's inbox. Nobody has to be re-invited.

After this runs the raw tokens are gone from the database, which is the point.
"""
import hashlib

from django.db import migrations, models


def hash_existing_tokens(apps, schema_editor):
    Invitation = apps.get_model('authentication', 'Invitation')
    for pk, token in Invitation.objects.values_list('pk', 'token').iterator():
        Invitation.objects.filter(pk=pk).update(
            token_hash=hashlib.sha256((token or '').encode('utf-8')).hexdigest()
        )


def restore_is_impossible(apps, schema_editor):
    # A hash cannot be turned back into a token. Reversing this migration leaves
    # the old column empty and every outstanding invitation has to be resent.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('authentication', '0009_alter_user_role'),
    ]

    operations = [
        migrations.AddField(
            model_name='invitation',
            name='token_hash',
            field=models.CharField(default='', max_length=64),
            preserve_default=False,
        ),
        migrations.RunPython(hash_existing_tokens, restore_is_impossible),
        migrations.AlterField(
            model_name='invitation',
            name='token_hash',
            field=models.CharField(max_length=64, unique=True),
        ),
        migrations.RemoveField(
            model_name='invitation',
            name='token',
        ),
    ]
