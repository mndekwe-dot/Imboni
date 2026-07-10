"""
Celery application for Imboni.

Run (from the Backend/ directory, with Redis running):
    celery -A Imboni worker -l info --pool=solo    # worker (--pool=solo on Windows)
    celery -A Imboni beat -l info                  # scheduler for periodic tasks

See Guides/Backend/CELERY_GUIDE.md for the full setup.
"""
import os

from celery import Celery
from celery.schedules import crontab

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Imboni.settings')

app = Celery('Imboni')

# All CELERY_* settings live in Django settings.py
app.config_from_object('django.conf:settings', namespace='CELERY')

# Find tasks.py in every installed app
app.autodiscover_tasks()

# ── Periodic schedule ──────────────────────────────────────────────────────────
# Times are in CELERY_TIMEZONE (Africa/Kigali, from settings).
app.conf.beat_schedule = {
    # Every day at 18:00 — remind students about assignments due tomorrow
    'send-due-date-reminders': {
        'task': 'apps.teacher.tasks.send_due_date_reminders_task',
        'schedule': crontab(hour=18, minute=0),
    },
    # Every Friday at 17:00 — email parents their children's weekly summary
    'send-weekly-digest': {
        'task': 'apps.parents.tasks.send_weekly_digest_task',
        'schedule': crontab(day_of_week='friday', hour=17, minute=0),
    },
    # Every day at 02:00 — compressed off-hours database backup (+ prune old ones)
    'backup-database': {
        'task': 'apps.audit.tasks.backup_database_task',
        'schedule': crontab(hour=2, minute=0),
    },
}
