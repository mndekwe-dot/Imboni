"""
Celery tasks for compliance/ops concerns.
"""
import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task
def backup_database_task():
    """
    Run the database backup on a schedule (see the beat entry in Imboni/celery.py).
    Delegates to the management command so the exact same code path is used
    whether a human runs it by hand or Celery fires it at 02:00.
    """
    from django.core.management import call_command
    call_command('backup_database')


@shared_task
def check_backup_freshness_task():
    """
    Log an error while the newest backup is older than BACKUP_MAX_AGE_HOURS.

    Hourly, at half past, so the check never lands inside the 02:00 dump. An
    ERROR log reaches Sentry when SENTRY_DSN is set. This cannot notice the
    worker itself being down — `manage.py check_backup` from the host and the
    platform Health page cover that.
    """
    from .backups import backup_freshness
    status = backup_freshness()
    if not status['ok']:
        logger.error('Database backup is stale: %s', status['detail'])
    return status
