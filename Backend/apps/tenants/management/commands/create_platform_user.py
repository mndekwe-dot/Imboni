"""
Create (or update the password of) a platform operator.

Platform operators run Imboni across ALL schools (Phase 5). They live in the
public schema, so this command runs against the default (public) connection —
do NOT wrap it in tenant_command.

Usage:
    python manage.py create_platform_user --email you@imboni.com --password 'secret'
    python manage.py create_platform_user --email you@imboni.com   # prompts for password
"""
from getpass import getpass

from django.core.management.base import BaseCommand, CommandError

from apps.tenants.models import PlatformUser


class Command(BaseCommand):
    help = 'Create or update a platform operator (public-schema super-admin).'

    def add_arguments(self, parser):
        parser.add_argument('--email', required=True)
        parser.add_argument('--password', default=None,
                            help='If omitted, you will be prompted (input hidden).')
        parser.add_argument('--name', default='')

    def handle(self, *args, **options):
        email = options['email'].strip().lower()
        name = options['name']
        password = options['password']

        if not password:
            password = getpass('Password: ')
            if password != getpass('Password (again): '):
                raise CommandError('Passwords did not match.')
        if len(password) < 8:
            raise CommandError('Password must be at least 8 characters.')

        user, created = PlatformUser.objects.get_or_create(
            email=email, defaults={'name': name, 'is_active': True},
        )
        if name and not created:
            user.name = name
        user.set_password(password)
        user.is_active = True
        user.save()

        verb = 'Created' if created else 'Updated'
        self.stdout.write(self.style.SUCCESS(f'{verb} platform operator: {email}'))
