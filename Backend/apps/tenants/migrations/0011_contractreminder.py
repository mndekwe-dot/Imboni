from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('tenants', '0010_client_disabled_modules'),
    ]

    operations = [
        migrations.CreateModel(
            name='ContractReminder',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('days_before', models.PositiveSmallIntegerField()),
                ('sent_at', models.DateTimeField(auto_now_add=True)),
                ('delivered', models.BooleanField(default=True)),
                ('contract', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='reminders', to='tenants.contract')),
            ],
            options={
                'unique_together': {('contract', 'days_before')},
            },
        ),
    ]
