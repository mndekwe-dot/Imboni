from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tenants', '0009_stripeevent_platformuser_mfa_last_step'),
    ]

    operations = [
        migrations.AddField(
            model_name='client',
            name='disabled_modules',
            field=models.JSONField(blank=True, default=list),
        ),
    ]
