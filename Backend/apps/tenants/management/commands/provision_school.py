"""
python manage.py provision_school --name "Springfield High" --subdomain springfield \
    --admin-email admin@springfield.edu [--admin-password ...] [--domain-base localhost]

Provision a new tenant (school) end to end:

  1. Create the ``Client`` row. Because ``Client.auto_create_schema`` is True,
     saving it creates the tenant's dedicated Postgres schema and runs the
     tenant migrations into it.
  2. Register the tenant's ``Domain`` (e.g. springfield.localhost) so the
     middleware can route requests to the right schema.
  3. Seed an admin user inside the tenant schema so someone can log in.

The command is idempotent: if a client already exists for the given subdomain
it prints a warning and exits without touching anything, and the admin user is
only created if one with that email doesn't already exist.
"""
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django_tenants.utils import schema_context

from apps.tenants.models import Client, Domain


class Command(BaseCommand):
    help = 'Provision a new school tenant: schema, domain and seed admin user.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--name', required=True,
            help='Human-readable school name, e.g. "Springfield High".',
        )
        parser.add_argument(
            '--subdomain', required=True,
            help='Used as the Postgres schema_name and the subdomain label, e.g. "springfield".',
        )
        parser.add_argument(
            '--admin-email', required=True,
            help='Email address for the seeded tenant admin user.',
        )
        parser.add_argument(
            '--admin-password', default='changeme123',
            help='Password for the seeded admin (default: changeme123 — change it after first login).',
        )
        parser.add_argument(
            '--domain-base', default='localhost',
            help='Base domain the subdomain is attached to (default: localhost).',
        )

    def handle(self, *args, **options):
        name = options['name']
        subdomain = options['subdomain']
        admin_email = options['admin_email']
        admin_password = options['admin_password']
        domain_base = options['domain_base']

        # Idempotency: don't try to re-provision an existing tenant.
        if Client.objects.filter(schema_name=subdomain).exists():
            self.stdout.write(self.style.WARNING(
                f'A client with schema_name "{subdomain}" already exists — nothing to do.'
            ))
            return

        domain_name = f'{subdomain}.{domain_base}'

        try:
            # Saving triggers schema creation + tenant migrations (auto_create_schema).
            client = Client(
                schema_name=subdomain,
                name=name,
                on_trial=True,
                status='trial',
            )
            client.save()

            Domain.objects.create(
                domain=domain_name,
                tenant=client,
                is_primary=True,
            )

            admin_email_display = self._seed_admin(client, admin_email, admin_password)
        except Exception as exc:  # noqa: BLE001 — surface a helpful message for any failure.
            raise CommandError(f'Provisioning "{subdomain}" failed: {exc}')

        self.stdout.write(self.style.SUCCESS('School provisioned successfully.'))
        self.stdout.write(self.style.SUCCESS(f'  Schema name : {client.schema_name}'))
        self.stdout.write(self.style.SUCCESS(f'  Domain URL  : http://{domain_name}/'))
        self.stdout.write(self.style.SUCCESS(f'  Admin login : {admin_email_display}'))

    # ── helpers ────────────────────────────────────────────────────────────────

    def _seed_admin(self, client, admin_email, admin_password):
        """Create the admin user inside the tenant schema. Returns the login email."""
        User = get_user_model()

        with schema_context(client.schema_name):
            if User.objects.filter(email__iexact=admin_email).exists():
                self.stdout.write(self.style.WARNING(
                    f'An admin user with email "{admin_email}" already exists in this schema — skipping.'
                ))
                return admin_email

            username = admin_email.split('@', 1)[0]
            admin = User(
                username=username,
                email=admin_email,
                role='admin',
                is_staff=True,
                is_superuser=True,
            )
            admin.set_password(admin_password)
            admin.save()

        return admin_email
