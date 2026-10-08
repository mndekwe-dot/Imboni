"""The administrator's view of the audit trail, and the actions that now feed it."""
from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from apps.audit.models import AuditEntry
from apps.audit.services import audit
from apps.authentication.factories import StudentFactory, UserFactory

pytestmark = pytest.mark.django_db


@pytest.fixture
def admin(make_authenticated_client):
    client, user = make_authenticated_client('admin')
    return client, user


def test_an_admin_reads_the_log_newest_first(admin):
    client, user = admin
    audit(user, 'invitation.sent', 'a@b.c', {'role': 'teacher'})
    audit(user, 'student.deleted', 'Amina (ADM1)')

    out = client.get('/imboni/audit/').data

    assert out['count'] == 2
    assert [r['action'] for r in out['results']] == ['student.deleted', 'invitation.sent']
    assert out['results'][1]['detail'] == {'role': 'teacher'}
    assert set(out['actions']) == {'invitation.sent', 'student.deleted'}


def test_it_filters_by_action_actor_text_and_day(admin):
    client, user = admin
    other = UserFactory(role='dos', first_name='Zed', last_name='Dos')
    audit(user, 'student.deleted', 'Amina (ADM1)')
    audit(other, 'result.approved', '12 results')
    old = audit(user, 'student.deleted', 'Old (ADM0)')
    AuditEntry.objects.filter(pk=old.pk).update(created_at=timezone.now() - timedelta(days=40))

    assert client.get('/imboni/audit/', {'action': 'result'}).data['count'] == 1
    assert client.get('/imboni/audit/', {'actor': 'zed'}).data['count'] == 1
    assert client.get('/imboni/audit/', {'q': 'Amina'}).data['count'] == 1
    since = (timezone.localdate() - timedelta(days=7)).isoformat()
    assert client.get('/imboni/audit/', {'from': since}).data['count'] == 2
    today = timezone.localdate().isoformat()
    assert client.get('/imboni/audit/', {'from': today, 'to': today}).data['count'] == 2


def test_it_can_be_downloaded(admin):
    client, user = admin
    audit(user, 'student.deleted', 'Amina (ADM1)')
    response = client.get('/imboni/audit/', {'format': 'csv'})
    assert response.status_code == 200 and 'student.deleted' in response.content.decode('utf-8-sig')


def test_nobody_but_the_administrator_can_read_it(make_authenticated_client):
    for role in ('teacher', 'dos', 'bursar', 'parent'):
        client, _ = make_authenticated_client(role)
        assert client.get('/imboni/audit/').status_code == 403


def test_there_is_no_way_to_write_it_over_http(admin):
    client, _ = admin
    assert client.post('/imboni/audit/', {'action': 'x'}, format='json').status_code == 405
    assert client.delete('/imboni/audit/').status_code == 405


def test_deleting_a_student_is_recorded_with_who_and_which(admin):
    client, user = admin
    student = StudentFactory()
    name = student.user.get_full_name()

    assert client.delete(f'/imboni/students/{student.id}/').status_code == 204

    entry = AuditEntry.objects.get(action='student.deleted')
    assert entry.actor == user and name in entry.target and student.student_id in entry.target


def test_a_fee_waiver_is_recorded(make_authenticated_client):
    from apps.finance import services  # noqa: F401
    from apps.student.models import Fee
    client, _bursar = make_authenticated_client('bursar')
    student = StudentFactory()
    fee = Fee.objects.create(student=student, category='tuition', amount=Decimal('100000'),
                             due_date=timezone.localdate())

    out = client.post('/imboni/finance/payments/record/', {
        'fee': str(fee.id), 'amount': '40000', 'method': 'waiver', 'notes': 'Bursary'}, format='json')

    assert out.status_code == 201
    entry = AuditEntry.objects.get(action='finance.waiver')
    assert student.student_id in entry.target
    assert entry.detail == {'amount': '40000', 'notes': 'Bursary'}


def test_an_ordinary_payment_is_not_a_waiver(make_authenticated_client):
    from apps.student.models import Fee
    client, _ = make_authenticated_client('bursar')
    fee = Fee.objects.create(student=StudentFactory(), category='tuition', amount=Decimal('100000'),
                             due_date=timezone.localdate())
    client.post('/imboni/finance/payments/record/', {'fee': str(fee.id), 'amount': '40000', 'method': 'cash'}, format='json')
    assert not AuditEntry.objects.filter(action='finance.waiver').exists()
