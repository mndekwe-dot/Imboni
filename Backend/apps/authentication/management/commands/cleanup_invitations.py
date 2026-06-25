"""
python manage.py cleanup_invitations

Deletes expired, never-used invitations so the Invitations list doesn't
accumulate dead rows forever. An invitation is safe to delete once it has
expired (expires_at in the past) and was never used to complete registration
(is_used=False) — used invitations are kept as a historical record.

Run with --dry-run to see what would be deleted without actually deleting it.
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.authentication.models import Invitation


class Command(BaseCommand):
    help = 'Delete expired, unused invitations.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show how many invitations would be deleted, without deleting them.',
        )

    def handle(self, *args, **options):
        expired_unused = Invitation.objects.filter(
            is_used=False,
            expires_at__lt=timezone.now(),
        )
        count = expired_unused.count()

        if options['dry_run']:
            self.stdout.write(f'Would delete {count} expired, unused invitation(s).')
            return

        expired_unused.delete()
        self.stdout.write(self.style.SUCCESS(f'Deleted {count} expired, unused invitation(s).'))
