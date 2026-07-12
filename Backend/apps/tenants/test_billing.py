"""
Unit tests for the Stripe status mapping. Pure (no DB, no Stripe) — the live
status-flip -> middleware enforcement path is exercised end-to-end via the
dev-mode webhook (see MULTI_TENANCY_GUIDE.md).
"""
from apps.tenants.billing import map_subscription_status


class TestMapSubscriptionStatus:
    def test_active_and_trialing_grant_access(self):
        assert map_subscription_status('active') == 'active'
        assert map_subscription_status('trialing') == 'active'

    def test_past_due_and_incomplete_are_past_due(self):
        assert map_subscription_status('past_due') == 'past_due'
        assert map_subscription_status('incomplete') == 'past_due'

    def test_canceled_unpaid_expired_suspend(self):
        assert map_subscription_status('canceled') == 'suspended'
        assert map_subscription_status('unpaid') == 'suspended'
        assert map_subscription_status('incomplete_expired') == 'suspended'

    def test_unknown_status_defaults_to_past_due(self):
        assert map_subscription_status('something_new') == 'past_due'
        assert map_subscription_status('') == 'past_due'
