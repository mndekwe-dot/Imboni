"""
Integration tests for plan-limit enforcement (apps/tenants/limits.py).

These run inside the 'test' tenant schema (see conftest.py). We flip the plan
per-test and, where we want to hit the cap cheaply, shrink PLAN_LIMITS via
monkeypatch instead of creating 50 real users.
"""
import uuid
from datetime import timedelta

import pytest
from django.db import connection
from django.urls import reverse
from django.utils import timezone

from apps.authentication.factories import UserFactory
from apps.authentication.models import Invitation
from apps.tenants import plans
from apps.tenants.limits import (
    usage_for, enforce_capacity, remaining_seats, capacity_snapshot,
    PlanLimitExceeded,
)

pytestmark = pytest.mark.django_db


def _set_plan(plan):
    """Point the active tenant at `plan` for direct (non-HTTP) assertions."""
    connection.tenant.plan = plan


def _invite(role='student', used=False, expired=False):
    return Invitation.objects.create(
        first_name='In', last_name='Vite', email=f'{uuid.uuid4().hex[:8]}@x.test',
        role=role, token=uuid.uuid4().hex, uid=uuid.uuid4().hex, is_used=used,
        expires_at=timezone.now() + timedelta(days=(-1 if expired else 7)),
    )


# ── Seat counting ────────────────────────────────────────────────────────────────

def test_student_usage_counts_active_users_plus_pending_invites():
    UserFactory(role='student')
    UserFactory(role='student')
    UserFactory(role='student', is_active=False)   # deactivated — not a live seat
    UserFactory(role='parent')                     # parents are free
    _invite(role='student')                        # pending — reserves a seat
    _invite(role='student', used=True)             # accepted — now a User, not double-counted
    _invite(role='student', expired=True)          # lapsed — frees the seat

    # 2 active students + 1 pending invite
    assert usage_for('students') == 3


def test_staff_usage_counts_staff_roles_only():
    UserFactory(role='teacher')
    UserFactory(role='dos')
    UserFactory(role='student')     # not staff
    _invite(role='matron')          # pending staff invite counts

    assert usage_for('staff') == 3


# ── Enforcement ──────────────────────────────────────────────────────────────────

def test_enforce_raises_when_full(monkeypatch):
    monkeypatch.setitem(plans.PLAN_LIMITS, 'free', {'students': 2, 'staff': 1})
    _set_plan('free')

    UserFactory(role='student')
    enforce_capacity('students')            # 1/2 used — fine

    UserFactory(role='student')
    with pytest.raises(PlanLimitExceeded):  # 2/2 used — full
        enforce_capacity('students')


def test_enforce_batch_add_respects_remaining(monkeypatch):
    monkeypatch.setitem(plans.PLAN_LIMITS, 'free', {'students': 5, 'staff': 1})
    _set_plan('free')
    UserFactory(role='student')             # 1 used, 4 left

    enforce_capacity('students', adding=4)  # exactly fills
    with pytest.raises(PlanLimitExceeded):
        enforce_capacity('students', adding=5)  # one too many


def test_enforce_is_noop_on_unlimited_plan():
    _set_plan('premium')
    for _ in range(5):
        UserFactory(role='student')
    enforce_capacity('students', adding=1000)   # must not raise


def test_remaining_seats(monkeypatch):
    monkeypatch.setitem(plans.PLAN_LIMITS, 'free', {'students': 3, 'staff': 1})
    _set_plan('free')
    UserFactory(role='student')
    assert remaining_seats('students') == 2

    _set_plan('premium')
    assert remaining_seats('students') is None


def test_capacity_snapshot_shape(monkeypatch):
    monkeypatch.setitem(plans.PLAN_LIMITS, 'free', {'students': 10, 'staff': 4})
    _set_plan('free')
    UserFactory(role='student')
    UserFactory(role='teacher')

    snap = capacity_snapshot()
    assert snap['plan'] == 'free'
    students = snap['resources']['students']
    assert students == {'used': 1, 'limit': 10, 'remaining': 9, 'unlimited': False}
    staff = snap['resources']['staff']
    assert staff['used'] == 1 and staff['limit'] == 4 and staff['unlimited'] is False


# ── End-to-end through the DOS "Add Student" endpoint ─────────────────────────────

def test_dos_add_student_blocked_at_plan_limit(api_client, monkeypatch):
    """A DOS on a full plan gets 402 from the real add-student endpoint.

    TenantMainMiddleware re-resolves the tenant from the DB on each request, and
    inside pytest's per-test transaction that fetch doesn't see an uncommitted
    plan change — so we pin the resolved plan at the enforcement seam instead
    (``limits.current_plan``), which is exactly what enforce_capacity consults.
    """
    monkeypatch.setitem(plans.PLAN_LIMITS, 'free', {'students': 1, 'staff': 50})
    monkeypatch.setattr('apps.tenants.limits.current_plan', lambda: 'free')

    UserFactory(role='student')             # fills the single free seat
    dos = UserFactory(role='dos')
    api_client.force_authenticate(dos)

    resp = api_client.post(reverse('dos-students'), {
        'first_name': 'New', 'last_name': 'Student',
        'email': 'newstudent@x.test', 'grade': '4', 'section': 'A',
        'enrollment_date': '2026-01-15', 'password': 'TestPass123!',
    }, format='json')

    assert resp.status_code == 402
    assert 'upgrade' in resp.json()['detail'].lower()
