"""
Celery tasks for compliance/ops concerns.
"""
from celery import shared_task


@shared_task
def backup_database_task():
    """
    Run the database backup on a schedule (see the beat entry in Imboni/celery.py).
    Delegates to the management command so the exact same code path is used
    whether a human runs it by hand or Celery fires it at 02:00.
    """
    from django.core.management import call_command
    call_command('backup_database')
