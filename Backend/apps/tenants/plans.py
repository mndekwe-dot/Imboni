"""
Plan limits (Phase 4) — the "how much can this plan hold" rules.

This module is deliberately pure: no Django, no database, no request. It only
knows how big each plan is and answers questions like "is a school on the free
plan allowed to add one more student?". The Django-aware side (counting the
actual roster in the tenant schema and raising HTTP errors) lives in
`apps/tenants/limits.py`, which builds on top of these functions — keeping the
policy easy to unit-test without a database (see `tests_plans.py`).

A limit of ``None`` means "unlimited".
"""

# Roles that consume a *staff* seat. Everything a school pays for a human to do
# administratively/academically counts here; students are counted separately.
# (Parents are free — they're the customer's customers, not seats.)
STAFF_ROLES = ('teacher', 'dos', 'matron', 'discipline', 'admin')

# The resources we meter, and the roles that back each one.
RESOURCE_ROLES = {
    'students': ('student',),
    'staff': STAFF_ROLES,
}

# Per-plan capacity. None = unlimited. Keep these in sync with the marketing
# copy / Stripe products; they are intentionally generous for a prototype.
PLAN_LIMITS = {
    'free':    {'students': 50,   'staff': 10},
    'basic':   {'students': 500,  'staff': 50},
    'premium': {'students': None, 'staff': None},
}

# Plan to fall back on when a tenant's plan string is unknown/missing. We pick
# the most restrictive real plan so a data glitch can never silently hand out
# unlimited capacity.
DEFAULT_PLAN = 'free'


def normalize_plan(plan):
    """Return a known plan key, falling back to DEFAULT_PLAN for anything odd."""
    return plan if plan in PLAN_LIMITS else DEFAULT_PLAN


def resource_for_role(role):
    """
    Which metered resource a user role consumes, or ``None`` if the role isn't
    metered (e.g. 'parent'). Lets invitation views gate by the role being invited.
    """
    for resource, roles in RESOURCE_ROLES.items():
        if role in roles:
            return resource
    return None


def limit_for(plan, resource):
    """
    The cap for ``resource`` ('students'/'staff') on ``plan``.

    Returns an int, or ``None`` for unlimited. Unknown resources are treated as
    unlimited (``None``) — we never invent a limit we weren't asked for.
    """
    return PLAN_LIMITS[normalize_plan(plan)].get(resource)


def is_unlimited(plan, resource):
    return limit_for(plan, resource) is None


def remaining(plan, resource, current):
    """
    Seats left for ``resource`` given ``current`` usage.

    Returns ``None`` when unlimited. Never returns a negative number — if a
    school is already over (e.g. after a downgrade) the answer is 0.
    """
    cap = limit_for(plan, resource)
    if cap is None:
        return None
    return max(cap - current, 0)


def within_limit(plan, resource, current, adding=1):
    """
    True if adding ``adding`` more of ``resource`` keeps ``current`` within the
    plan cap. Always True for unlimited plans/resources.
    """
    cap = limit_for(plan, resource)
    if cap is None:
        return True
    return current + adding <= cap
