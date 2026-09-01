"""
Contract lifecycle enforcement (Phase 7.2).

Policy: a school does not go from working to locked out in one step.

    end_date passes        -> read-only. Everything is still readable and
                              exportable; nothing new can be saved.
    grace_days later       -> suspended. The contract is expired and the doors
                              are closed.

The middle step is the point. Switching a school off the morning after a
contract lapses stops a teacher taking a register, and the person who forgot to
countersign the renewal is not that teacher. Read-only applies the pressure
where it belongs -- the office -- without taking the timetable away from the
classroom, and it is reversible the moment somebody pays.

`enforce_contract_lifecycle()` is idempotent and safe to run daily (Celery beat)
or by hand (`manage.py enforce_contracts`). It only ever restricts -- it never
reactivates -- so a human decision is always needed to bring a school back.
"""
import logging
from datetime import timedelta

from django.utils import timezone
from django_tenants.utils import schema_context, get_public_schema_name

logger = logging.getLogger(__name__)


def _still_covered(Contract, client, exclude_id):
    """True if another active contract still covers this school (it renewed)."""
    return (Contract.objects.filter(client=client, status='active')
            .exclude(id=exclude_id).exists())


def enforce_contract_lifecycle():
    """
    Walk every school one step along the lifecycle. Returns counts.

    Three things happen here, in order of severity:
      * a contract past its end date but inside grace puts the school read-only;
      * a contract past end date + grace_days expires, and suspends the school;
      * an expired demo tenant is suspended outright.
    """
    from .models import Client, Contract
    from .platform_audit import record

    today = timezone.localdate()
    expired = suspended = restricted = demos_expired = 0

    with schema_context(get_public_schema_name()):
        overdue = (Contract.objects.filter(status='active', end_date__lt=today)
                   .select_related('client'))
        for contract in overdue:
            client = contract.client
            cutoff = contract.end_date + timedelta(days=contract.grace_days)

            if today <= cutoff:
                # Inside grace. Take the pen, not the building -- and only if
                # the school is otherwise in good standing, so this can never
                # quietly UN-suspend somebody.
                if (client is not None and client.status in ('active', 'trial', 'past_due')
                        and not _still_covered(Contract, client, contract.id)):
                    was = client.status
                    client.status = 'read_only'
                    client.save(update_fields=['status'])
                    restricted += 1
                    record('school.auto_restrict', client=client, target=client,
                           target_label=client.name,
                           changes={'status': [was, 'read_only'],
                                    'reason': f'contract {contract.id} past end date'})
                    logger.info('Restricted %s: contract %s in grace until %s',
                                client.schema_name, contract.id, cutoff)
                continue

            contract.status = 'expired'
            contract.save(update_fields=['status', 'updated_at'])
            expired += 1

            if client is None:
                continue
            # Don't suspend a school that renewed (has another still-active contract).
            if _still_covered(Contract, client, contract.id):
                continue
            if client.status != 'suspended':
                was = client.status
                client.status = 'suspended'
                client.save(update_fields=['status'])
                suspended += 1
                record('school.auto_suspend', client=client, target=client,
                       target_label=client.name,
                       changes={'status': [was, 'suspended'],
                                'reason': f'contract {contract.id} expired past grace'})
                logger.info('Suspended %s: contract %s expired past grace',
                            client.schema_name, contract.id)

        # Demo tenants stop on their own. A demo that outlives its date is a
        # school nobody reviewed, sitting in the registry forever.
        stale_demos = Client.objects.filter(is_demo=True,
                                            demo_expires_on__lt=today).exclude(status='suspended')
        for demo in stale_demos:
            was = demo.status
            demo.status = 'suspended'
            demo.save(update_fields=['status'])
            demos_expired += 1
            record('school.demo_expired', client=demo, target=demo,
                   target_label=demo.name,
                   changes={'status': [was, 'suspended'],
                            'demo_expires_on': str(demo.demo_expires_on)})
            logger.info('Expired demo tenant %s', demo.schema_name)

    return {'expired': expired, 'suspended': suspended,
            'restricted': restricted, 'demos_expired': demos_expired}
