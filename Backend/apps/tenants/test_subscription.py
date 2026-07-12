"""
Unit tests for the subscription enforcement decision logic.

These exercise the pure `subscription_decision` helper directly, so they need
NO database and NO live tenant — they run in milliseconds and cover every
branch of the "rent or buy" gate.

Run with:
    ../benv/Scripts/python -m pytest apps/tenants/tests_subscription.py -q
"""
from django_tenants.utils import get_public_schema_name

from apps.tenants.middleware import (
    ALLOW,
    BLOCK,
    WARN,
    subscription_decision,
)


PUBLIC = get_public_schema_name()
TENANT = 'greenwood'  # any non-public schema name


class TestSubscriptionDecision:
    def test_public_schema_always_allows(self):
        # The marketing / signup site has no subscription to enforce, even if a
        # bogus status somehow rode along.
        assert subscription_decision(PUBLIC, 'suspended', '/anything/') == ALLOW
        assert subscription_decision(PUBLIC, None, '/imboni/results/') == ALLOW

    def test_suspended_blocks_a_normal_path(self):
        assert subscription_decision(TENANT, 'suspended', '/imboni/results/') == BLOCK

    def test_suspended_allows_auth_prefix(self):
        # A suspended school must still be able to log in...
        assert subscription_decision(TENANT, 'suspended', '/imboni/auth/login/') == ALLOW

    def test_suspended_allows_billing_prefix(self):
        # ...and pay to reactivate.
        assert subscription_decision(
            TENANT, 'suspended', '/imboni/billing/checkout/'
        ) == ALLOW

    def test_past_due_warns(self):
        assert subscription_decision(TENANT, 'past_due', '/imboni/results/') == WARN

    def test_active_allows(self):
        assert subscription_decision(TENANT, 'active', '/imboni/results/') == ALLOW

    def test_trial_allows(self):
        assert subscription_decision(TENANT, 'trial', '/imboni/results/') == ALLOW

    def test_unknown_status_fails_open(self):
        # Defensive: a missing/garbage status should never lock a school out.
        assert subscription_decision(TENANT, None, '/imboni/results/') == ALLOW
        assert subscription_decision(TENANT, 'gremlin', '/imboni/results/') == ALLOW
