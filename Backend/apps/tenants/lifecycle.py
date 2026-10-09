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


# ── Telling the school before it happens ──────────────────────────────────────

REMINDER_DAYS = (30, 15, 3)


def _tell_school_admins(client, contract, days_left):
    """Notify (in-app, and by email where they allow it) the school's administrators."""
    from apps.authentication.models import User
    from apps.notifications.services import notify_users

    when = f'{contract.end_date:%d %B %Y}'
    title = 'Your Imboni subscription is ending soon'
    message = (
        f'Your subscription ("{contract.title}") ends on {when}, in {days_left} day'
        f'{"" if days_left == 1 else "s"}. After that the school becomes read-only, '
        'and is suspended once the grace period passes. Please arrange the renewal '
        'with Imboni to avoid interruption.'
    )
    with schema_context(client.schema_name):
        admins = list(User.objects.filter(role='admin', is_active=True))
        return notify_users(admins, title, message, 'announcement', send_email=True)


def send_expiry_reminders(today=None):
    """
    Warn each school as its contract nears its end: at 30, 15 and 3 days.

    Idempotent: a reminder is recorded when sent, so running twice in a day does
    not repeat it. Resilient: if a day was missed (or a contract was only
    entered with ten days left) the closest reminder still goes out once, and
    the larger ones that are now meaningless are recorded as skipped rather than
    sent late. Returns ``{'sent': n, 'skipped': n}``.
    """
    from .models import Contract, ContractReminder

    today = today or timezone.localdate()
    sent = skipped = 0

    with schema_context(get_public_schema_name()):
        horizon = today + timedelta(days=max(REMINDER_DAYS))
        contracts = (Contract.objects
                     .filter(status='active', end_date__gte=today, end_date__lte=horizon)
                     .select_related('client'))
        for contract in contracts:
            days_left = (contract.end_date - today).days
            due = [d for d in REMINDER_DAYS if days_left <= d]
            if not due:
                continue
            closest = min(due)
            done = set(ContractReminder.objects.filter(contract=contract).values_list('days_before', flat=True))
            # Larger thresholds already passed: note them so they are never sent late.
            for d in due:
                if d != closest and d not in done:
                    ContractReminder.objects.create(contract=contract, days_before=d, delivered=False)
                    skipped += 1
            if closest in done or contract.client is None:
                continue
            _tell_school_admins(contract.client, contract, days_left)
            ContractReminder.objects.create(contract=contract, days_before=closest)
            sent += 1
            logger.info('Reminded %s: contract %s ends in %s days', contract.client.schema_name,
                        contract.id, days_left)
    return {'sent': sent, 'skipped': skipped}
