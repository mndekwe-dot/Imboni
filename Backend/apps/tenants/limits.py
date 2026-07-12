"""
Plan-limit enforcement (Phase 4) — the Django-aware half of plan gating.

`apps/tenants/plans.py` holds the pure policy (how big each plan is). This module
connects that policy to reality: it counts the current roster *inside the active
tenant schema*, decides whether one more student/staff member fits, and raises an
HTTP 402 when it doesn't. Views call `enforce_capacity(...)` right before they
create people; the frontend reads `capacity_snapshot()` (surfaced via the billing
status endpoint) to draw usage meters.

A "seat" is counted as: active users of the resource's role(s) **plus** invitations
that have been sent but not yet accepted. Counting pending invitations stops a
school on the free plan from blowing past its cap by mass-inviting first and
letting everyone register later.
"""
from django.db import connection
from django.utils import timezone
from rest_framework.exceptions import APIException

from .plans import (
    RESOURCE_ROLES, limit_for, is_unlimited, remaining, within_limit,
)


class PlanLimitExceeded(APIException):
    """
    Raised when an action would push a school past its plan's capacity.

    402 Payment Required mirrors the SubscriptionStatusMiddleware "you need to
    pay" semantics — here the fix is to upgrade the plan rather than settle an
    overdue bill, and the message says so.
    """
    status_code = 402
    default_code = 'plan_limit_reached'
    default_detail = 'Your plan limit has been reached. Upgrade your plan to add more.'


def current_plan():
    """The active tenant's plan string, defaulting to 'free' if unavailable."""
    tenant = getattr(connection, 'tenant', None)
    return getattr(tenant, 'plan', 'free') if tenant is not None else 'free'


def _roles_for(resource):
    try:
        return RESOURCE_ROLES[resource]
    except KeyError:  # pragma: no cover - guards against a typo'd resource name
        raise ValueError(f'Unknown metered resource: {resource!r}')


def usage_for(resource):
    """
    Current seat usage for ``resource`` in the active tenant schema:
    active users of the backing role(s) + still-pending invitations for them.
    """
    # Imported lazily: authentication is a TENANT app and importing its models at
    # module load time would couple this shared-ish helper to app-loading order.
    from apps.authentication.models import User, Invitation

    roles = _roles_for(resource)
    active_users = User.objects.filter(role__in=roles, is_active=True).count()
    pending_invites = Invitation.objects.filter(
        role__in=roles, is_used=False, expires_at__gt=timezone.now(),
    ).count()
    return active_users + pending_invites


def enforce_capacity(resource, adding=1):
    """
    Raise `PlanLimitExceeded` if adding ``adding`` more of ``resource`` would
    exceed the current plan's cap. No-op on unlimited plans/resources.

    Call this in a view *before* creating the user(s)/invitation(s).
    """
    plan = current_plan()
    if is_unlimited(plan, resource):
        return
    current = usage_for(resource)
    if within_limit(plan, resource, current, adding):
        return

    cap = limit_for(plan, resource)
    left = remaining(plan, resource, current)
    noun = 'student' if resource == 'students' else 'staff member'
    if adding == 1:
        detail = (
            f'Your "{plan}" plan allows up to {cap} {noun}s and you have {current}. '
            f'Upgrade your plan to add another {noun}.'
        )
    else:
        detail = (
            f'Your "{plan}" plan allows up to {cap} {noun}s ({left} seat(s) left) '
            f'but this action would add {adding}. Upgrade your plan or reduce the batch.'
        )
    raise PlanLimitExceeded(detail)


def remaining_seats(resource):
    """
    Seats left for ``resource`` right now, or ``None`` if unlimited.

    Bulk endpoints call this once and then decrement a local counter as they
    create rows, so they respect the cap exactly without a COUNT query per row.
    """
    plan = current_plan()
    if is_unlimited(plan, resource):
        return None
    return remaining(plan, resource, usage_for(resource))


def resource_snapshot(resource):
    """{used, limit, remaining, unlimited} for one resource — used by the UI."""
    plan = current_plan()
    used = usage_for(resource)
    cap = limit_for(plan, resource)
    return {
        'used': used,
        'limit': cap,                 # None => unlimited
        'remaining': remaining(plan, resource, used),
        'unlimited': cap is None,
    }


def capacity_snapshot():
    """
    Full usage picture for the active tenant, e.g.::

        {'plan': 'free',
         'resources': {'students': {...}, 'staff': {...}}}
    """
    return {
        'plan': current_plan(),
        'resources': {res: resource_snapshot(res) for res in RESOURCE_ROLES},
    }
