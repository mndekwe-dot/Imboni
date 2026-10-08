"""Telling a school its subscription is about to end: 30, 15 and 3 days out."""
from datetime import timedelta

import pytest
from django.utils import timezone
from django_tenants.utils import get_public_schema_name, schema_context

from apps.authentication.factories import UserFactory
from apps.notifications.models import Notification
from apps.tenants.lifecycle import send_expiry_reminders
from apps.tenants.models import Client, Contract, ContractReminder

pytestmark = pytest.mark.django_db


def _contract(days_left, status='active'):
    with schema_context(get_public_schema_name()):
        client = Client.objects.get(schema_name='test')
        return Contract.objects.create(
            client=client, title='Annual plan', status=status,
            start_date=timezone.localdate() - timedelta(days=300),
            end_date=timezone.localdate() + timedelta(days=days_left))


def _count(*users):
    return Notification.objects.filter(user__in=users).count()


def test_a_school_is_told_at_each_threshold_and_only_once(db):
    admin = UserFactory(role='admin')
    contract = _contract(30)

    assert send_expiry_reminders()['sent'] == 1
    assert _count(admin) == 1
    assert 'ends on' in Notification.objects.get(user=admin).message

    assert send_expiry_reminders()['sent'] == 0          # the same day again: silent
    assert _count(admin) == 1

    with schema_context(get_public_schema_name()):
        Contract.objects.filter(pk=contract.pk).update(end_date=timezone.localdate() + timedelta(days=15))
    assert send_expiry_reminders()['sent'] == 1
    with schema_context(get_public_schema_name()):
        Contract.objects.filter(pk=contract.pk).update(end_date=timezone.localdate() + timedelta(days=3))
    assert send_expiry_reminders()['sent'] == 1
    assert _count(admin) == 3


def test_between_thresholds_nothing_goes_out(db):
    admin = UserFactory(role='admin')
    _contract(45)
    _contract(20)
    # 20 days left is inside the 30-day window, so that one is due; 45 is not.
    assert send_expiry_reminders()['sent'] == 1
    assert _count(admin) == 1


def test_a_missed_day_still_sends_the_closest_reminder_once_not_a_backlog(db):
    admin = UserFactory(role='admin')
    contract = _contract(2)        # first seen with two days left: 30, 15 and 3 are all behind it

    out = send_expiry_reminders()

    assert out == {'sent': 1, 'skipped': 2}
    assert _count(admin) == 1
    assert set(ContractReminder.objects.filter(contract=contract).values_list('days_before', flat=True)) == {30, 15, 3}
    assert send_expiry_reminders() == {'sent': 0, 'skipped': 0}


def test_only_active_contracts_and_only_administrators(db):
    admin, teacher = UserFactory(role='admin'), UserFactory(role='teacher')
    _contract(10, status='terminated')
    _contract(10, status='draft')
    assert send_expiry_reminders()['sent'] == 0

    _contract(10)
    send_expiry_reminders()
    assert _count(admin) == 1 and _count(teacher) == 0


def test_an_expired_contract_is_not_reminded_about(db):
    admin = UserFactory(role='admin')
    _contract(-2)
    assert send_expiry_reminders()['sent'] == 0
    assert _count(admin) == 0
