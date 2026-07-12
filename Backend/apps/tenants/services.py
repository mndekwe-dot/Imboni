"""
Tenant provisioning service — the single code path for creating a school.

Both the `provision_school` management command and the self-serve signup API
(apps/tenants/onboarding.py) call `provision_tenant()` so there is exactly one
place that creates a schema, its domain and the seeded admin user.

NOTE: `Client.save()` runs the tenant's migrations synchronously (auto_create_
schema), which can take tens of seconds. That is fine for the CLI and acceptable
for a prototype signup, but at scale provisioning should move to a Celery task
so the HTTP request returns immediately (see MULTI_TENANCY_GUIDE.md).
"""
import re

from django.contrib.auth import get_user_model
from django_tenants.utils import schema_context, get_public_schema_name

from .models import Client, Domain


class ProvisioningError(Exception):
    """Raised for any invalid/duplicate subdomain or failed provisioning."""


# Subdomains that must never become a tenant (collide with infra/routing).
RESERVED_SUBDOMAINS = {
    'public', 'www', 'admin', 'api', 'app', 'apps', 'static', 'media', 'assets',
    'backend', 'web', 'mail', 'smtp', 'ftp', 'imboni', 'platform', 'dashboard',
    'billing', 'signup', 'login', 'auth', 'test', 'localhost', 'status', 'help',
}

# 3–63 chars, starts with a letter, lowercase alphanumeric + hyphens, no trailing
# hyphen. Also the shape Postgres/DNS are happy with for a schema/subdomain.
SUBDOMAIN_RE = re.compile(r'^[a-z][a-z0-9-]{1,61}[a-z0-9]$')


def normalize_subdomain(value):
    return (value or '').strip().lower()


def validate_subdomain(subdomain):
    """Raise ProvisioningError if malformed, reserved, or already taken."""
    if not SUBDOMAIN_RE.match(subdomain):
        raise ProvisioningError(
            'Subdomain must be 3–63 characters: lowercase letters, numbers and '
            'hyphens, starting with a letter and not ending with a hyphen.'
        )
    if subdomain in RESERVED_SUBDOMAINS or subdomain == get_public_schema_name():
        raise ProvisioningError(f'"{subdomain}" is reserved — please choose another.')
    if Client.objects.filter(schema_name=subdomain).exists():
        raise ProvisioningError(f'The subdomain "{subdomain}" is already taken.')


def provision_tenant(*, name, subdomain, admin_email, admin_password,
                     admin_first_name='', admin_last_name='',
                     domain_base='localhost', plan='free', on_trial=True,
                     status='trial'):
    """
    Create a school tenant end to end and return (client, domain_name).

    Steps: validate the subdomain, create the Client (which auto-creates the
    Postgres schema and runs the tenant migrations), register its primary
    domain, then seed an admin user inside the new schema.
    """
    subdomain = normalize_subdomain(subdomain)
    validate_subdomain(subdomain)

    domain_name = f'{subdomain}.{domain_base}'

    # auto_create_schema=True -> saving creates the schema + runs tenant migrations.
    client = Client(schema_name=subdomain, name=name, on_trial=on_trial,
                    status=status, plan=plan)
    client.save()

    Domain.objects.create(domain=domain_name, tenant=client, is_primary=True)

    _seed_admin(client, admin_email, admin_password,
                first_name=admin_first_name, last_name=admin_last_name)

    return client, domain_name


def _seed_admin(client, admin_email, admin_password, first_name='', last_name=''):
    """Create the school's first admin user inside its schema (idempotent)."""
    User = get_user_model()
    with schema_context(client.schema_name):
        if User.objects.filter(email__iexact=admin_email).exists():
            return
        username = admin_email.split('@', 1)[0]
        admin = User(
            username=username,
            email=admin_email,
            first_name=first_name or '',
            last_name=last_name or '',
            role='admin',
            is_staff=True,
            is_superuser=True,
        )
        admin.set_password(admin_password)
        admin.save()
