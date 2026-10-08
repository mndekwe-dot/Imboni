"""Sending fee reminders to every family over a threshold, in one go."""
from decimal import Decimal

import pytest
from django.utils import timezone

from apps.authentication.factories import ParentStudentRelationshipFactory, StudentFactory, UserFactory
from apps.finance import services
from apps.notifications.models import Notification
from apps.student.models import Fee

pytestmark = pytest.mark.django_db

URL = '/imboni/finance/reminders/send/'


def owing(term, paid, amount='100000'):
    """A student with a bill of ``amount``, of which ``paid`` is settled, and a parent."""
    student = StudentFactory()
    fee = Fee.objects.create(student=student, term=term, category='tuition',
                             amount=Decimal(amount), due_date=timezone.localdate())
    if paid:
        services.record_payment(fee, str(paid), method='cash')
    parent = UserFactory(role='parent')
    ParentStudentRelationshipFactory(parent=parent, student=student)
    return student, parent


@pytest.fixture
def bursar(api_client):
    api_client.force_authenticate(UserFactory(role='bursar'))
    return api_client


def test_only_families_owing_at_least_the_share_are_reminded(bursar, term):
    _, deep = owing(term, 20000)        # still owes 80%
    _, shallow = owing(term, 80000)     # owes 20%
    _, settled = owing(term, 100000)    # owes nothing

    out = bursar.post(URL, {'min_percent': 50}, format='json').data

    assert out['families'] == 1 and out['sent'] == 1
    assert Notification.objects.filter(user=deep).count() == 1
    assert not Notification.objects.filter(user__in=[shallow, settled]).exists()


def test_a_dry_run_sends_nothing_but_shows_what_would_go(bursar, term):
    student, parent = owing(term, 0)

    out = bursar.post(URL, {'dry_run': True, 'message': 'Hello {student_name}, owing {balance}'}, format='json').data

    assert out['families'] == 1 and out['sent'] == 0
    assert out['sample'] == f'Hello {student.full_name}, owing 100,000'
    assert not Notification.objects.filter(user=parent).exists()


def test_placeholders_are_filled_per_student(bursar, term):
    student, parent = owing(term, 0)

    bursar.post(URL, {'message': '{student_name} / {student_code} / {balance}'}, format='json')

    msg = Notification.objects.get(user=parent).message
    assert msg == f'{student.full_name} / {student.student_id} / 100,000'


def test_a_minimum_amount_leaves_out_small_debts(bursar, term):
    owing(term, 0, amount='3000')
    _, big = owing(term, 0, amount='90000')

    out = bursar.post(URL, {'min_percent': 0, 'min_amount': 50000}, format='json').data

    assert out['families'] == 1
    assert Notification.objects.filter(user=big).count() == 1


def test_a_family_with_no_linked_parent_is_counted_as_unreachable(bursar, term):
    student = StudentFactory()
    Fee.objects.create(student=student, term=term, category='tuition',
                       amount=Decimal('50000'), due_date=timezone.localdate())

    out = bursar.post(URL, {}, format='json').data

    assert out['families'] == 1 and out['sent'] == 0 and out['unreachable'] == 1


def test_a_broken_template_is_refused(bursar, term):
    owing(term, 0)
    assert bursar.post(URL, {'message': 'Owing {balance'}, format='json').status_code == 400


def test_bad_thresholds_are_refused(bursar, term):
    assert bursar.post(URL, {'min_percent': 150}, format='json').status_code == 400
    assert bursar.post(URL, {'min_percent': 'lots'}, format='json').status_code == 400


def test_only_the_bursar_can_send(api_client, term):
    api_client.force_authenticate(UserFactory(role='teacher'))
    assert api_client.post(URL, {}, format='json').status_code == 403
