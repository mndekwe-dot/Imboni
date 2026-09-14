"""
python manage.py check_backup [--output-dir DIR] [--max-age-hours N]

Exit 0 when the newest database backup is at most N hours old (default
settings.BACKUP_MAX_AGE_HOURS, 24), exit 1 when it is older or missing.

Made to be run from outside Celery, because the case that matters most is the
worker being down — and then no Celery task can report that anything is wrong.
On the VPS:

    docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml \
        exec -T backend python manage.py check_backup
"""
from django.core.management.base import BaseCommand, CommandError

from apps.audit.backups import backup_freshness


class Command(BaseCommand):
    help = 'Fail unless the newest database backup is recent enough.'

    def add_arguments(self, parser):
        parser.add_argument('--output-dir', help='Directory the backups are in.')
        parser.add_argument(
            '--max-age-hours', type=int,
            help='Oldest acceptable backup, in hours (default settings.BACKUP_MAX_AGE_HOURS).',
        )

    def handle(self, *args, **options):
        status = backup_freshness(options['output_dir'], options['max_age_hours'])
        if not status['ok']:
            raise CommandError(status['detail'])
        self.stdout.write(self.style.SUCCESS(f"{status['detail']}: {status['path']}"))
