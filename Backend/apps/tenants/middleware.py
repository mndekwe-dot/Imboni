"""
Subscription enforcement middleware — the "rent or buy" gate (Phase 3).

`django_tenants.middleware.main.TenantMainMiddleware` runs first and resolves
the incoming subdomain to a Postgres schema, populating `connection.tenant`
(the `apps.tenants.models.Client` row) and `connection.schema_name`. THIS
middleware runs immediately after it and decides, based on the tenant's billing
`status`, whether the request is allowed through.

Design notes:
  * The decision itself is factored into a pure helper — `subscription_decision`
    — so it can be unit-tested without a database or a live tenant (see
    `tests_subscription.py`).
  * The middleware is deliberately defensive: anything it can't make sense of
    (no tenant, unknown status) falls through to "allow" rather than locking a
    school out by accident.
"""
from django.db import connection
from django.http import JsonResponse
from django_tenants.utils import get_public_schema_name


# Path prefixes that stay reachable even when a school is `suspended`, so an
# unpaid school can still authenticate and settle its bill. Keep this list
# small and easy to edit. Prefixes are matched against `request.path`.
#
#   /imboni/auth/     -> login, token refresh, password reset, 2FA, etc.
#                        (see apps/authentication/urls.py — all under auth/)
#   /imboni/billing/  -> reserved for the Stripe billing endpoints added in
#                        Phase 3 (checkout session, customer portal, webhook).
ALWAYS_ALLOWED_PREFIXES = (
    '/imboni/auth/',
    '/imboni/billing/',
    '/django-admin/',   # Django admin — staff must always be able to intervene.
)

# Paths that must keep WORKING while a school is read-only, even though they are
# writes. A restricted school is one we are pressuring to pay, not one we are
# trying to trap: it has to be able to settle up, ask for help, and take its
# data with it.
#
#   /imboni/support/  -> raise a ticket ("why are we restricted?")
#   /imboni/export/   -> download your own records
RESTRICTED_WRITE_ALLOWED_PREFIXES = ALWAYS_ALLOWED_PREFIXES + (
    '/imboni/support/',
    '/imboni/export/',
)

# HTTP methods that only read. Everything else changes something.
SAFE_METHODS = frozenset({'GET', 'HEAD', 'OPTIONS'})

# Decision outcomes returned by the pure helper.
ALLOW = 'allow'      # let the request through untouched
BLOCK = 'block'      # reject with HTTP 402 Payment Required
WARN = 'warn'        # let it through, but flag the response so the UI can nag
READ_ONLY = 'read_only'   # reads pass, writes are refused with 402


def subscription_decision(schema_name, status, path, method='GET'):
    """
    Pure decision function — no DB, no request object, trivially testable.

    Args:
        schema_name: the resolved schema (`connection.schema_name`).
        status: the tenant's billing status ('trial'/'active'/'past_due'/
            'read_only'/'suspended'), or None if unknown.
        path: the request path, e.g. '/imboni/results/'.
        method: the HTTP method. Only `read_only` cares, but it must be
            passed for that state to mean anything.

    Returns one of ALLOW / BLOCK / WARN / READ_ONLY.
    """
    # The public (marketing / signup) schema has no subscription to enforce.
    if schema_name == get_public_schema_name():
        return ALLOW

    # A suspended school is blocked everywhere EXCEPT the always-allowed
    # prefixes, so it can still log in and pay to reactivate.
    if status == 'suspended':
        if path.startswith(ALWAYS_ALLOWED_PREFIXES):
            return ALLOW
        return BLOCK

    # Read-only: the whole school still opens and every record is still
    # readable. Writes are refused, apart from the ones that let a school pay,
    # ask why, or export what is theirs.
    if status == 'read_only':
        if (method or 'GET').upper() in SAFE_METHODS:
            return READ_ONLY
        if path.startswith(RESTRICTED_WRITE_ALLOWED_PREFIXES):
            return ALLOW
        return BLOCK

    # Past due: still usable, but we tag the response so the frontend can show
    # a "your payment is overdue" banner and prompt them before suspension.
    if status == 'past_due':
        return WARN

    # 'trial', 'active', unknown/None status — allow normally. We fail open on
    # purpose: a data glitch should never lock a paying school out.
    return ALLOW


class SubscriptionStatusMiddleware:
    """
    New-style callable middleware. Must be listed AFTER
    `django_tenants.middleware.main.TenantMainMiddleware` in `MIDDLEWARE`
    so that `connection.tenant` / `connection.schema_name` are populated.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # `schema_name` is always set by TenantMainMiddleware; default to the
        # public schema name if, defensively, it somehow isn't.
        schema_name = getattr(connection, 'schema_name', get_public_schema_name())

        # `connection.tenant` may be absent in edge cases (e.g. a request that
        # bypassed the tenant middleware). If so, fail open — allow it through.
        tenant = getattr(connection, 'tenant', None)
        status = getattr(tenant, 'status', None) if tenant is not None else None

        decision = subscription_decision(schema_name, status, request.path,
                                         request.method)

        if decision == BLOCK:
            restricted = status == 'read_only'
            return JsonResponse(
                {
                    'detail': (
                        'This school is read-only while its account is settled. '
                        'You can still open and export everything, but new '
                        'entries cannot be saved until it is reactivated.'
                        if restricted else
                        'This school account is suspended for non-payment. '
                        'Please log in and settle the outstanding balance to '
                        'restore access.'
                    ),
                    'code': 'subscription_read_only' if restricted
                            else 'subscription_suspended',
                },
                status=402,  # 402 Payment Required
            )

        response = self.get_response(request)

        # One header, whatever the state, so the frontend has a single thing to
        # read rather than a special case per status.
        if decision == WARN:
            response['X-Subscription-Status'] = 'past_due'
        elif decision == READ_ONLY:
            response['X-Subscription-Status'] = 'read_only'

        return response
