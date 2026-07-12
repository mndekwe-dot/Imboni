"""
Contract lifecycle enforcement (Phase 7.2).

Policy (chosen): warn as a contract nears its end date, and auto-suspend the
school `grace_days` AFTER the end date if the contract is still active and the
school isn't otherwise covered by another active contract.

`enforce_contract_lifecycle()` is idempotent and safe to run daily (Celery beat)
or by hand (`manage.py enforce_contracts`). It only ever suspends — it never
reactivates — so a human decision is always needed to bring a school back.
"""
import logging
from datetime import timedelta

from django.utils import timezone
from django_tenants.utils import schema_context, get_public_schema_name

logger = logging.getLogger(__name__)


def enforce_contract_lifecycle():
    """Expire past-grace contracts and suspend uncovered schools. Returns counts."""
    from .models import Contract

    today = timezone.localdate()
    expired = suspended = 0

    with schema_context(get_public_schema_name()):
        overdue = (Contract.objects.filter(status='active', end_date__lt=today)
                   .select_related('client'))
        for contract in overdue:
            cutoff = contract.end_date + timedelta(days=contract.grace_days)
            if today <= cutoff:
                continue  # still within the grace window — just "expiring", not enforced

            contract.status = 'expired'
            contract.save(update_fields=['status', 'updated_at'])
            expired += 1

            client = contract.client
            if client is None:
                continue
            # Don't suspend a school that renewed (has another still-active contract).
            still_covered = (Contract.objects.filter(client=client, status='active')
                             .exclude(id=contract.id).exists())
            if not still_covered and client.status != 'suspended':
                client.status = 'suspended'
                client.save(update_fields=['status'])
                suspended += 1
                logger.info('Suspended %s: contract %s expired past grace',
                            client.schema_name, contract.id)

    return {'expired': expired, 'suspended': suspended}
