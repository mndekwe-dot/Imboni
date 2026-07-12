"""
Unit tests for the pure plan-limit policy (apps/tenants/plans.py).

No database, no Django — just the arithmetic of "does one more fit".
"""
from apps.tenants import plans


class TestLimitFor:
    def test_free_plan_caps(self):
        assert plans.limit_for('free', 'students') == 50
        assert plans.limit_for('free', 'staff') == 10

    def test_premium_is_unlimited(self):
        assert plans.limit_for('premium', 'students') is None
        assert plans.limit_for('premium', 'staff') is None
        assert plans.is_unlimited('premium', 'students') is True

    def test_unknown_plan_falls_back_to_free(self):
        # A garbage plan string must never hand out unlimited capacity.
        assert plans.limit_for('enterprise-typo', 'students') == 50

    def test_unknown_resource_is_unlimited(self):
        assert plans.limit_for('free', 'parents') is None


class TestRemaining:
    def test_counts_down(self):
        assert plans.remaining('free', 'students', 10) == 40

    def test_never_negative_after_downgrade(self):
        assert plans.remaining('free', 'students', 999) == 0

    def test_unlimited_returns_none(self):
        assert plans.remaining('premium', 'students', 10) is None


class TestWithinLimit:
    def test_allows_up_to_cap(self):
        assert plans.within_limit('free', 'students', current=49, adding=1) is True

    def test_blocks_past_cap(self):
        assert plans.within_limit('free', 'students', current=50, adding=1) is False

    def test_batch_that_would_overflow_is_blocked(self):
        assert plans.within_limit('free', 'students', current=48, adding=5) is False

    def test_unlimited_always_true(self):
        assert plans.within_limit('premium', 'students', current=10_000, adding=500) is True


class TestResourceForRole:
    def test_student_role(self):
        assert plans.resource_for_role('student') == 'students'

    def test_staff_roles(self):
        for role in ('teacher', 'dos', 'matron', 'discipline', 'admin'):
            assert plans.resource_for_role(role) == 'staff'

    def test_parent_is_not_metered(self):
        assert plans.resource_for_role('parent') is None
