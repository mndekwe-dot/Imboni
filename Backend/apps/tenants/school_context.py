"""
One answer to "what is going on at this school?".

Most operator questions — a ticket, a renewal call, a suspension decision — need
the same handful of facts: what plan, how full, is it paid, who is signed in,
what has it already asked us. Those facts lived in five places, so the first
move on every ticket was a hunt.

This builds that picture once. `platform_ops.SupportTicketViewSet.context` and
`views.SchoolViewSet.overview` both use it, so a ticket and a school page can
never disagree about the same school.

Reads only. Nothing here writes, and nothing here decides anything.
"""
import logging

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from django_tenants.utils import schema_context

from .limits import usage_for
from .models import Contract, Payment, SchoolInvitation, SupportTicket
from .plans import RESOURCE_ROLES, limit_for, remaining

logger = logging.getLogger(__name__)


def _capacity(client):
    """
    Seats used against seats allowed, for the school being looked at.

    Deliberately NOT `limits.capacity_snapshot()`. That helper reads the plan
    from `connection.tenant`, and `schema_context` switches the SCHEMA without
    switching the tenant object -- so called from an operator request it would
    count this school's users against the PUBLIC tenant's plan and report
    limits belonging to nobody. The plan comes off the Client row instead.
    """
    snapshot = {}
    for resource in RESOURCE_ROLES:
        used = usage_for(resource)
        cap = limit_for(client.plan, resource)
        snapshot[resource] = {
            'used': used,
            'limit': cap,                 # None => unlimited
            'remaining': remaining(client.plan, resource, used),
            'unlimited': cap is None,
        }
    return {'plan': client.plan, 'resources': snapshot}


def _inside(client):
    """
    Facts that only exist inside the school's own schema.

    Wrapped defensively: a school whose schema is mid-provision, or has been
    dropped by hand, must not take down the operator's screen. An operator
    looking at a broken school is exactly when they most need the page to load.

    The `atomic()` is load-bearing, not decoration. Postgres aborts the WHOLE
    transaction on a failed statement, so catching the error is not enough --
    without a savepoint to roll back to, every later query in the same request
    dies with "current transaction is aborted", and this defensive except
    clause would have turned one unreadable school into a 500 for the page.
    """
    User = get_user_model()
    try:
        with transaction.atomic(), schema_context(client.schema_name):
            capacity = _capacity(client)
            staff = User.objects.exclude(role='student').exclude(role='parent')
            last_login = (staff.exclude(last_login=None)
                          .order_by('-last_login').values_list('last_login', flat=True)
                          .first())
            admin = staff.filter(role='admin').order_by('date_joined').first()
            return {
                'capacity': capacity,
                'last_staff_login': last_login,
                'admin_email': getattr(admin, 'email', ''),
                # An admin who has never set a password has not accepted the
                # invitation. That single fact explains most "we can't get in"
                # tickets from a brand new school.
                'admin_can_sign_in': bool(admin and admin.has_usable_password()),
                'reachable': True,
            }
    except Exception:
        logger.exception('school_context: could not read schema %s', client.schema_name)
        return {'capacity': None, 'last_staff_login': None, 'admin_email': '',
                'admin_can_sign_in': None, 'reachable': False}


def school_context(client, schema_name=''):
    """
    The operator's one-screen answer for a school.

    `client` may be None — a ticket can outlive the school it came from, and a
    deleted school should show as a missing school rather than a 500.
    """
    if client is None:
        return {'school': None, 'schema_name': schema_name, 'reachable': False}

    inside = _inside(client)
    today = timezone.localdate()

    contracts = list(Contract.objects.filter(client=client).order_by('-start_date')[:5])
    active = next((c for c in contracts if c.status == 'active'), None)
    last_payment = Payment.objects.filter(client=client).order_by('-received_at').first()
    invitation = SchoolInvitation.objects.filter(client=client).first()
    open_tickets = SupportTicket.objects.filter(
        schema_name=client.schema_name).exclude(status__in=['resolved', 'closed']).count()

    return {
        'school': {
            'id': client.pk,
            'name': client.name,
            'schema_name': client.schema_name,
            'plan': client.plan,
            'status': client.status,
            'is_demo': client.is_demo,
            'demo_expires_on': client.demo_expires_on,
            'created_on': client.created_on,
            'paid_until': client.paid_until,
        },
        'capacity': inside['capacity'],
        'reachable': inside['reachable'],
        'admin_email': inside['admin_email'],
        'admin_can_sign_in': inside['admin_can_sign_in'],
        'last_staff_login': inside['last_staff_login'],
        'contract': None if active is None else {
            'id': active.pk,
            'title': active.title,
            'status': active.status,
            'end_date': active.end_date,
            'days_remaining': active.days_remaining,
            'is_expiring_soon': active.is_expiring_soon,
            'amount': active.amount,
            'currency': active.currency,
        },
        # A school with no active contract is the one an operator most needs
        # flagged, so say it plainly rather than leaving `contract: null` to be
        # interpreted.
        'uncovered': active is None,
        'last_payment': None if last_payment is None else {
            'amount': last_payment.amount,
            'currency': last_payment.currency,
            'received_at': last_payment.received_at,
            'days_ago': (today - timezone.localtime(last_payment.received_at).date()).days,
        },
        'invitation': None if invitation is None else {
            'email': invitation.email,
            'state': invitation.state,
            'sent_at': invitation.sent_at,
            'accepted_at': invitation.accepted_at,
            'expires_at': invitation.expires_at,
            'delivery_error': invitation.delivery_error,
        },
        'open_tickets': open_tickets,
    }
