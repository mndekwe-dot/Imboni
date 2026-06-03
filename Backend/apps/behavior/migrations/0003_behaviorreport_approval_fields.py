from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('behavior', '0002_alter_behaviorreport_student_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='behaviorreport',
            name='status',
            field=models.CharField(
                max_length=20,
                choices=[
                    ('pending_review', 'Pending Review'),
                    ('approved',       'Approved'),
                    ('rejected',       'Rejected'),
                ],
                default='approved',
            ),
        ),
        migrations.AddField(
            model_name='behaviorreport',
            name='reviewed_by',
            field=models.ForeignKey(
                to=settings.AUTH_USER_MODEL,
                on_delete=django.db.models.deletion.SET_NULL,
                null=True, blank=True,
                related_name='reviewed_reports',
            ),
        ),
        migrations.AddField(
            model_name='behaviorreport',
            name='reviewed_at',
            field=models.DateTimeField(null=True, blank=True),
        ),
        migrations.AddField(
            model_name='behaviorreport',
            name='review_notes',
            field=models.TextField(blank=True),
        ),
    ]
