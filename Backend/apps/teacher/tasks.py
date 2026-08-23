"""
Celery tasks for the teacher app. The due-date reminder runs nightly via
Celery beat (see Imboni/celery.py) — no cron entry needed.
"""
from io import StringIO

from celery import shared_task


@shared_task
def send_due_date_reminders_task(days=1):
    """Notify students about unsubmitted assignments due in `days` days."""
    from django.core.management import call_command

    out = StringIO()
    call_command('send_due_date_reminders', days=days, stdout=out)
    return out.getvalue().strip()


@shared_task
def close_overdue_assignments_task(grace=0):
    """Close assignments past their due date that refuse late work."""
    from django.core.management import call_command

    out = StringIO()
    call_command('close_overdue_assignments', grace=grace, stdout=out)
    return out.getvalue().strip()
