"""
Create (or update the password of) a platform operator.

Platform operators run Imboni across ALL schools (Phase 5). They live in the
public schema, so this command runs against the default (public) connection —
do NOT wrap it in tenant_command.

Operators come in three roles -- support, commercial and operations -- and this
command defaults to `support`, the weakest. Granting more is deliberate:

    python manage.py create_platform_user --email you@imboni.com --role operations

An operations operator must enrol a second factor before any of its powers
work. That is not something this command can do for them; they sign in and set
it up under Operators in the console.

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
        parser.add_argument('--role', default=PlatformUser.ROLE_SUPPORT,
                            choices=[r for r, _ in PlatformUser.ROLE_CHOICES],
                            help='support (default), commercial, or operations.')

    def handle(self, *args, **options):
        email = options['email'].strip().lower()
        name = options['name']
        role = options['role']
        password = options['password']

        if not password:
            password = getpass('Password: ')
            if password != getpass('Password (again): '):
                raise CommandError('Passwords did not match.')
        if len(password) < 8:
            raise CommandError('Password must be at least 8 characters.')

        user, created = PlatformUser.objects.get_or_create(
            email=email, defaults={'name': name, 'is_active': True, 'role': role},
        )
        if name and not created:
            user.name = name
        # An existing operator only changes role if you actually asked for one,
        # so re-running this to reset a password cannot silently demote anybody.
        if created or role != PlatformUser.ROLE_SUPPORT:
            user.role = role
        user.set_password(password)
        user.is_active = True
        user.save()

        verb = 'Created' if created else 'Updated'
        self.stdout.write(self.style.SUCCESS(
            f'{verb} platform operator: {email} ({user.role})'))
        if user.role == PlatformUser.ROLE_OPERATIONS and not user.mfa_enabled:
            self.stdout.write(self.style.WARNING(
                '  Operations powers stay closed until they enrol a second '
                'factor, under Operators in the console.'))
