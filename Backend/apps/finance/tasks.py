import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task
def settle_online_payments_task():
    """Every few minutes: record the payments parents approved on their phones."""
    from django_tenants.utils import get_tenant_model, schema_context

    from . import momo, online_payments

    if not momo.configured():
        return 0
    total = 0
    for school in get_tenant_model().objects.exclude(schema_name='public'):
        with schema_context(school.schema_name):
            total += online_payments.refresh_all_pending()
    logger.info('Checked %s pending online payments', total)
    return total


@shared_task
def send_scheduled_fee_reminders_task():
    """Daily: remind owing families, in each school that switched this on and is due."""
    from apps.common.tenancy import run_in_every_school

    from .auto_reminders import send_scheduled_reminders

    return run_in_every_school(send_scheduled_reminders)
