from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('student', '0007_student_dietary_flags'),
    ]

    operations = [
        migrations.AddField(
            model_name='student',
            name='medical_flags',
            field=models.JSONField(blank=True, default=list),
        ),
    ]
