"""
Celery tasks for tenant provisioning.

Self-serve signup dispatches `provision_school_task` so the HTTP request returns
immediately (202) instead of blocking on the tenant's migrations. The task runs
in the worker, always in the public schema (where the Client/Domain/TenantProvision
tables live), and updates the TenantProvision row the frontend polls.
"""
import logging

from celery import shared_task
from django_tenants.utils import schema_context, get_public_schema_name

logger = logging.getLogger(__name__)


@shared_task
def provision_school_task(provision_id, admin_password_hash, domain_base, scheme):
    from .models import TenantProvision
    from .services import provision_tenant, ProvisioningError

    with schema_context(get_public_schema_name()):
        try:
            rec = TenantProvision.objects.get(id=provision_id)
        except TenantProvision.DoesNotExist:
            logger.error('provision_school_task: no TenantProvision %s', provision_id)
            return

        try:
            client, domain_name = provision_tenant(
                name=rec.school_name,
                subdomain=rec.subdomain,
                admin_email=rec.admin_email,
                admin_password_hash=admin_password_hash,
                admin_first_name=rec.admin_first_name,
                admin_last_name=rec.admin_last_name,
                domain_base=domain_base,
            )
        except ProvisioningError as exc:
            rec.status = 'failed'
            rec.detail = str(exc)
            rec.save(update_fields=['status', 'detail', 'updated_at'])
            return
        except Exception:  # noqa: BLE001
            logger.exception('Provisioning failed for %r', rec.subdomain)
            rec.status = 'failed'
            rec.detail = 'Provisioning failed. Please try again.'
            rec.save(update_fields=['status', 'detail', 'updated_at'])
            return

        rec.status = 'ready'
        rec.url = f'{scheme}://{domain_name}/'
        rec.save(update_fields=['status', 'url', 'updated_at'])

        _send_welcome_email(rec.admin_email, rec.school_name, rec.url)


def _send_welcome_email(admin_email, school_name, url):
    """Best-effort welcome email — never let a mail failure fail the task."""
    from django.core.mail import send_mail
    try:
        send_mail(
            subject=f'Welcome to Imboni: {school_name} is ready',
            message=(
                f'Your school "{school_name}" has been created.\n\n'
                f'Sign in at: {url}\n\n'
                'Use the email and password you chose during signup.'
            ),
            from_email=None,   # uses DEFAULT_FROM_EMAIL
            recipient_list=[admin_email],
            fail_silently=True,
        )
    except Exception:
        logger.warning('Welcome email failed for %s', admin_email, exc_info=True)


@shared_task
def find_my_school_task(email, scheme='https'):
    """
    Look up which schools an email belongs to and post the links.

    Runs in the worker rather than the request specifically so the HTTP
    response cannot leak the answer through its timing -- see the enumeration
    note in discovery.py. Nothing is returned to the caller either way.
    """
    from .discovery import find_schools_for_email, send_school_reminder

    schools = find_schools_for_email(email)
    if not schools:
        # Deliberately no email and no error: a "we couldn't find you" message
        # would confirm the address is not enrolled.
        logger.info('find_my_school: no match')
        return {'matched': 0}

    send_school_reminder(email, schools, scheme=scheme)
    logger.info('find_my_school: reminded %d school(s)', len(schools))
    return {'matched': len(schools)}


@shared_task
def enforce_contract_lifecycle_task():
    """Daily (Celery beat): expire past-grace contracts and suspend uncovered schools."""
    from .lifecycle import enforce_contract_lifecycle
    result = enforce_contract_lifecycle()
    logger.info('Contract lifecycle: %s', result)
    return result
