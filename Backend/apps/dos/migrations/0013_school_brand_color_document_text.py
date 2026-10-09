from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('dos', '0012_school_contact_details'),
    ]

    operations = [
        migrations.AddField(
            model_name='schoolsetting',
            name='brand_color',
            field=models.CharField(blank=True, default='', max_length=7),
        ),
        migrations.AddField(
            model_name='schoolsetting',
            name='document_text',
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
