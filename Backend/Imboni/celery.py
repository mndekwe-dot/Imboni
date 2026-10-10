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

# ── Carry the school with each task ────────────────────────────────────────────
# A task queued from a request runs later in a worker that starts on the public
# schema. Stamp the school onto the message when it is queued and switch to it
# when the task starts, or tenant-table tasks (push, bulk notify, reminders)
# fail with "relation does not exist". See apps/common/tenancy.py.
from celery.signals import before_task_publish, task_postrun, task_prerun  # noqa: E402


@before_task_publish.connect
def _stamp_school(headers=None, **kwargs):
    from apps.common.tenancy import stamp_schema
    stamp_schema(headers)


@task_prerun.connect
def _enter_school(task_id=None, task=None, **kwargs):
    from apps.common.tenancy import enter_schema
    enter_schema(task_id, getattr(task, 'request', None))


@task_postrun.connect
def _leave_school(task_id=None, **kwargs):
    from apps.common.tenancy import leave_schema
    leave_schema(task_id)

# ── Periodic schedule ──────────────────────────────────────────────────────────
# Times are in CELERY_TIMEZONE (Africa/Kigali, from settings).
app.conf.beat_schedule = {
    # Every day at 18:00 — remind students about assignments due tomorrow
    'send-due-date-reminders': {
        'task': 'apps.teacher.tasks.send_due_date_reminders_task',
        'schedule': crontab(hour=18, minute=0),
    },
    # Every day at 00:30 — close assignments past their due date that were set
    # not to accept late work. Just after midnight so an assignment due today
    # stays open for the whole of today.
    'close-overdue-assignments': {
        'task': 'apps.teacher.tasks.close_overdue_assignments_task',
        'schedule': crontab(hour=0, minute=30),
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
    # Every hour at :30 — log an error while the newest backup is over 24 h old.
    # Half past, so it never runs while the 02:00 dump is still being written.
    'check-backup-freshness': {
        'task': 'apps.audit.tasks.check_backup_freshness_task',
        'schedule': crontab(minute=30),
    },
    # Every 5 minutes: record fees parents approved on their phones and then closed the page on
    'settle-online-payments': {
        'task': 'apps.finance.tasks.settle_online_payments_task',
        'schedule': crontab(minute='*/5'),
    },
    # Every day at 09:00 — remind owing families, in schools that switched it on
    'send-scheduled-fee-reminders': {
        'task': 'apps.finance.tasks.send_scheduled_fee_reminders_task',
        'schedule': crontab(hour=9, minute=0),
    },
    # Every day at 08:00 — tell schools their subscription ends in 30, 15 or 3 days
    'send-contract-expiry-reminders': {
        'task': 'apps.tenants.tasks.send_contract_expiry_reminders_task',
        'schedule': crontab(hour=8, minute=0),
    },
    # Every day at 03:00 — expire past-grace contracts + auto-suspend uncovered schools
    'enforce-contract-lifecycle': {
        'task': 'apps.tenants.tasks.enforce_contract_lifecycle_task',
        'schedule': crontab(hour=3, minute=0),
    },
}
