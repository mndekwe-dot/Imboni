"""
Is there a recent database backup?

The nightly dump can stop without anyone noticing: the worker dies, pg_dump
starts failing, the bind mount goes missing. Nothing on the site breaks, so the
first sign is the day a restore is needed. This answers the question from the
files themselves, so every place that asks gets the same answer:

- `manage.py check_backup`       exits 1 when stale (cron, a smoke script)
- `check_backup_freshness_task`  logs an error every hour it stays stale
- the platform console's Health page shows it as a component

"Recent" means the newest *.sql.gz is at most BACKUP_MAX_AGE_HOURS old.
"""
from datetime import datetime, timezone
from pathlib import Path

from django.conf import settings


def default_backup_dir():
    """Where backups land unless overridden — settings.BACKUP_DIR or <BASE_DIR>/backups."""
    return Path(getattr(settings, 'BACKUP_DIR', Path(settings.BASE_DIR) / 'backups'))


def latest_backup(directory):
    """The newest *.sql.gz in directory, or None when there is none."""
    directory = Path(directory)
    if not directory.is_dir():
        return None
    return max(directory.glob('*.sql.gz'), key=lambda p: p.stat().st_mtime, default=None)


def backup_freshness(directory=None, max_age_hours=None, now=None):
    """
    Report on the newest backup. Plain types only, so a Celery task can return it.

        {'ok': bool, 'path': str | None, 'age_hours': float | None,
         'max_age_hours': int, 'detail': str}
    """
    directory = Path(directory) if directory else default_backup_dir()
    if max_age_hours is None:
        max_age_hours = getattr(settings, 'BACKUP_MAX_AGE_HOURS', 24)
    now = now or datetime.now(timezone.utc)

    latest = latest_backup(directory)
    if latest is None:
        return {
            'ok': False, 'path': None, 'age_hours': None, 'max_age_hours': max_age_hours,
            'detail': f'No backup found in {directory}',
        }

    age_hours = (now.timestamp() - latest.stat().st_mtime) / 3600
    ok = age_hours <= max_age_hours
    detail = f'Last backup {age_hours:.1f} h ago'
    if not ok:
        detail += f' (limit {max_age_hours} h)'
    return {
        'ok': ok, 'path': str(latest), 'age_hours': round(age_hours, 2),
        'max_age_hours': max_age_hours, 'detail': detail,
    }
