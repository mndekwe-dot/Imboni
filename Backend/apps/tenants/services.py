"""
Tenant provisioning service — the single code path for creating a school.

Both the `provision_school` management command and the self-serve signup API
(apps/tenants/onboarding.py) call `provision_tenant()` so there is exactly one
place that creates a schema, its domain and the seeded admin user.

NOTE: `Client.save()` runs the tenant's migrations synchronously (auto_create_
schema), which can take tens of seconds. Callers must account for that:

  * `provision_school` (management command) blocks, which is what you want at a
    terminal.
  * Self-serve signup does NOT call this from the request. `SchoolSignupView`
    returns 202 immediately and hands the work to `provision_school_task`, and
    the frontend polls `ProvisionStatusView` until the row goes ready/failed.

Anything new that provisions in response to a web request should follow the
signup pattern rather than calling this inline.
"""
import re

from django.contrib.auth import get_user_model
from django_tenants.utils import schema_context, get_public_schema_name

from .models import Client, Domain


class ProvisioningError(Exception):
    """Raised for any invalid/duplicate subdomain or failed provisioning."""


# How long a self-serve demo tenant lives before it stops on its own. Long
# enough to run a real term's worth of lessons past it and decide; short enough
# that an abandoned one clears itself out instead of sitting in the registry
# forever. Lives here rather than in onboarding.py so the signup view and the
# Celery task can both read it without importing each other.


DEMO_TRIAL_DAYS = 30

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
            'Subdomain must be 3-63 characters: lowercase letters, numbers and '
            'hyphens, starting with a letter and not ending with a hyphen.'
        )
    if subdomain in RESERVED_SUBDOMAINS or subdomain == get_public_schema_name():
        raise ProvisioningError(f'"{subdomain}" is reserved. Please choose another.')
    if Client.objects.filter(schema_name=subdomain).exists():
        raise ProvisioningError(f'The subdomain "{subdomain}" is already taken.')


def provision_tenant(*, name, subdomain, admin_email, admin_password=None,
                     admin_password_hash=None, admin_first_name='',
                     admin_last_name='', domain_base='localhost', plan='free',
                     on_trial=True, status='trial', is_demo=False,
                     demo_expires_on=None):
    """
    Create a school tenant end to end and return (client, domain_name).

    Steps: validate the subdomain, create the Client (which auto-creates the
    Postgres schema and runs the tenant migrations), register its primary
    domain, then seed an admin user inside the new schema.

    Pass either a raw ``admin_password`` (the CLI does) or an already-hashed
    ``admin_password_hash`` (the async signup task does, so plaintext never
    leaves the request that collected it). Pass NEITHER — as operator
    provisioning now does — and the admin is created unable to log in until an
    invitation link is opened and a password chosen. See `invitations.py`.

    ``is_demo`` marks a tenant created by unreviewed self-serve signup;
    ``demo_expires_on`` is the date it stops. A demo is not a school: it exists
    so a stranger can try the product without a real school being created on
    the strength of a filled-in form.
    """
    subdomain = normalize_subdomain(subdomain)
    validate_subdomain(subdomain)

    domain_name = f'{subdomain}.{domain_base}'

    # auto_create_schema=True -> saving creates the schema + runs tenant migrations.
    client = Client(schema_name=subdomain, name=name, on_trial=on_trial,
                    status=status, plan=plan, is_demo=is_demo,
                    demo_expires_on=demo_expires_on)
    client.save()

    Domain.objects.create(domain=domain_name, tenant=client, is_primary=True)

    _seed_admin(client, admin_email, admin_password=admin_password,
                admin_password_hash=admin_password_hash,
                first_name=admin_first_name, last_name=admin_last_name)

    _seed_structure(client)

    return client, domain_name


def _seed_structure(client):
    """
    Give the new school the default year levels and streams.

    Structure is now the authority for which years a school teaches, so a school
    with no rows would be one that teaches nothing — no class could be created
    and no pupil enrolled. Seeding the Rwandan government structure means a new
    school works untouched, and a school elsewhere edits it in Settings rather
    than building it from nothing.
    """
    from apps.dos.models import SchoolSection
    from apps.dos.structure import DEFAULT_STRUCTURE

    with schema_context(client.schema_name):
        if SchoolSection.objects.exists():
            return
        for section in DEFAULT_STRUCTURE:
            SchoolSection.objects.create(
                name=section['name'],
                years=section['years'],
                # Streams live on each year (A-Level combinations differ from
                # O-Level letters); the section-level list stays empty.
                streams=[],
            )


def _seed_admin(client, admin_email, admin_password=None, admin_password_hash=None,
                first_name='', last_name=''):
    """
    Create the school's first admin user inside its schema (idempotent).

    With no password and no hash, the account is created with an UNUSABLE
    password: it exists, it owns the school, and nobody can sign in as it until
    an invitation is accepted. That is the intended state for a school
    provisioned by an operator -- the credential is chosen by the school, and
    never travels through anyone else's hands.
    """
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
        if admin_password_hash:
            admin.password = admin_password_hash   # already hashed by make_password
        elif admin_password:
            admin.set_password(admin_password)
        else:
            # No credential exists yet, and none is invented here. An
            # invitation is what turns this account on.
            admin.set_unusable_password()
        admin.save()
