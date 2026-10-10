"""Fee reminders on a schedule: opt-in, spaced out, and never SMS."""
from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from apps.authentication.factories import ParentStudentRelationshipFactory, StudentFactory, UserFactory
from apps.dos.models import SchoolSetting
from apps.finance import auto_reminders, services
from apps.notifications.models import Notification
from apps.student.models import Fee

pytestmark = pytest.mark.django_db

URL = '/imboni/finance/reminders/auto/'


def owing(term, paid, amount='100000', with_parent=True):
    student = StudentFactory()
    fee = Fee.objects.create(student=student, term=term, category='tuition',
                             amount=Decimal(amount), due_date=timezone.localdate())
    if paid:
        services.record_payment(fee, str(paid), method='cash')
    parent = None
    if with_parent:
        parent = UserFactory(role='parent')
        ParentStudentRelationshipFactory(parent=parent, student=student)
    return student, parent


@pytest.fixture
def on(db):
    s = SchoolSetting.get_setting()
    s.auto_fee_reminders = True
    s.save()
    return s


def test_nothing_is_sent_while_the_school_has_not_switched_it_on(term):
    _, parent = owing(term, 0)

    out = auto_reminders.send_scheduled_reminders()

    assert out['skipped'] == 'off'
    assert not Notification.objects.filter(user=parent).exists()


def test_owing_families_are_reminded_and_settled_ones_are_not(term, on):
    _, owes = owing(term, 20000)
    _, settled = owing(term, 100000)

    out = auto_reminders.send_scheduled_reminders()

    assert out['sent'] == 1 and out['families'] == 1
    assert Notification.objects.filter(user=owes, title='Fees reminder').count() == 1
    assert not Notification.objects.filter(user=settled).exists()


def test_the_threshold_is_the_schools_own(term, on):
    on.fee_reminder_min_percent = 70
    on.save()
    _, deep = owing(term, 10000)       # owes 90%
    _, shallow = owing(term, 60000)    # owes 40%

    auto_reminders.send_scheduled_reminders()

    assert Notification.objects.filter(user=deep).exists()
    assert not Notification.objects.filter(user=shallow).exists()


def test_it_waits_out_the_interval_before_sending_again(term, on):
    _, parent = owing(term, 0)
    now = timezone.now()

    first = auto_reminders.send_scheduled_reminders(now=now)
    again = auto_reminders.send_scheduled_reminders(now=now + timedelta(days=3))
    later = auto_reminders.send_scheduled_reminders(now=now + timedelta(days=15))

    assert first['sent'] == 1
    assert again['skipped'] == 'not due'
    assert later['sent'] == 1
    assert Notification.objects.filter(user=parent).count() == 2


def test_a_family_with_no_linked_parent_is_counted_as_unreachable(term, on):
    owing(term, 0, with_parent=False)

    out = auto_reminders.send_scheduled_reminders()

    assert out['families'] == 1 and out['sent'] == 0 and out['unreachable'] == 1


def test_it_never_sends_an_sms(term, on, monkeypatch):
    owing(term, 0)
    sent = []
    monkeypatch.setattr('apps.notifications.services._schedule_sms',
                        lambda *a, **k: sent.append(a))

    auto_reminders.send_scheduled_reminders()

    assert sent == []


class TestSettingEndpoint:
    @pytest.fixture
    def bursar(self, api_client):
        api_client.force_authenticate(UserFactory(role='bursar'))
        return api_client

    def test_reads_the_defaults(self, bursar):
        data = bursar.get(URL).data
        assert data['enabled'] is False and data['min_percent'] == 50 and data['every_days'] == 14

    def test_switches_it_on_and_sets_the_spacing(self, bursar):
        r = bursar.patch(URL, {'enabled': True, 'min_percent': 30, 'every_days': 7}, format='json')
        assert r.status_code == 200
        s = SchoolSetting.get_setting()
        assert (s.auto_fee_reminders, s.fee_reminder_min_percent, s.fee_reminder_every_days) == (True, 30, 7)

    @pytest.mark.parametrize('body', [
        {'min_percent': 101}, {'min_percent': 'lots'}, {'every_days': 0}, {'every_days': 400}, {'enabled': 'yes'},
    ])
    def test_rejects_nonsense(self, bursar, body):
        assert bursar.patch(URL, body, format='json').status_code == 400

    def test_a_teacher_cannot_change_it(self, api_client):
        api_client.force_authenticate(UserFactory(role='teacher'))
        assert api_client.patch(URL, {'enabled': True}, format='json').status_code in (401, 403)
