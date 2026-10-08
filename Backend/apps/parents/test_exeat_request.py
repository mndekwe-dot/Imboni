"""A parent asking for their boarder to be let out."""
from datetime import timedelta

import pytest
from django.utils import timezone
from django_tenants.utils import get_public_schema_name, schema_context

from apps.authentication.factories import (
    BoardingStudentFactory, ParentStudentRelationshipFactory, StudentFactory, UserFactory,
)
from apps.discipline.models import ExeatPass
from apps.notifications.models import Notification
from apps.tenants.models import Client

pytestmark = pytest.mark.django_db


def _body(**kw):
    now = timezone.now()
    return {'reason_type': 'medical', 'reason': 'Dentist appointment',
            'departure_at': (now + timedelta(days=1)).isoformat(),
            'expected_return_at': (now + timedelta(days=1, hours=6)).isoformat(), **kw}


@pytest.fixture
def family(api_client):
    parent = UserFactory(role='parent')
    boarder = BoardingStudentFactory().student
    ParentStudentRelationshipFactory(parent=parent, student=boarder)
    api_client.force_authenticate(parent)
    return parent, boarder


def test_a_request_reaches_the_register_already_agreed_by_the_parent(api_client, family):
    parent, boarder = family
    dis, matron = UserFactory(role='discipline'), UserFactory(role='matron')

    response = api_client.post(f'/imboni/parents/{boarder.id}/exeat/', _body(), format='json')

    assert response.status_code == 201
    exeat = ExeatPass.objects.get(student=boarder)
    assert exeat.status == 'requested' and exeat.parent_approval == 'approved'
    assert parent.get_full_name() in exeat.parent_note
    assert Notification.objects.filter(user__in=[dis, matron]).count() == 2


def test_the_office_still_has_to_approve_so_the_child_is_not_out_yet(api_client, family):
    _, boarder = family
    api_client.post(f'/imboni/parents/{boarder.id}/exeat/', _body(), format='json')
    assert ExeatPass.objects.get(student=boarder).status == 'requested'


def test_a_reason_is_required(api_client, family):
    _, boarder = family
    assert api_client.post(f'/imboni/parents/{boarder.id}/exeat/', _body(reason=' '), format='json').status_code == 400


def test_a_day_scholar_has_no_exeat(api_client):
    parent = UserFactory(role='parent')
    day = StudentFactory()
    ParentStudentRelationshipFactory(parent=parent, student=day)
    api_client.force_authenticate(parent)
    assert api_client.post(f'/imboni/parents/{day.id}/exeat/', _body(), format='json').status_code == 400


def test_a_parent_cannot_ask_for_someone_elses_child(api_client):
    api_client.force_authenticate(UserFactory(role='parent'))
    stranger = BoardingStudentFactory().student
    assert api_client.post(f'/imboni/parents/{stranger.id}/exeat/', _body(), format='json').status_code == 404
    assert not ExeatPass.objects.exists()


def test_the_parent_can_follow_the_request(api_client, family):
    _, boarder = family
    api_client.post(f'/imboni/parents/{boarder.id}/exeat/', _body(), format='json')
    rows = api_client.get(f'/imboni/parents/{boarder.id}/exeat/').data
    assert [r['status'] for r in rows] == ['requested']


def test_a_school_with_boarding_switched_off_has_no_such_thing(api_client, family):
    _, boarder = family
    with schema_context(get_public_schema_name()):
        Client.objects.filter(schema_name='test').update(disabled_modules=['boarding'])
    try:
        assert api_client.post(f'/imboni/parents/{boarder.id}/exeat/', _body(), format='json').status_code == 404
    finally:
        with schema_context(get_public_schema_name()):
            Client.objects.filter(schema_name='test').update(disabled_modules=[])
