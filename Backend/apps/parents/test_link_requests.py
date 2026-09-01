"""
Linking a parent to a child now needs the school's approval.

A student's display code identifies a child; it does not authorise access to
one. Before this, entering a code created the relationship outright.
"""
import pytest
from rest_framework.test import APIClient

from apps.authentication.factories import StudentFactory, UserFactory
from apps.parents.models import ParentLinkRequest, ParentStudentRelationship


@pytest.fixture
def student(db):
    return StudentFactory(student_id='STD2024001')


@pytest.fixture
def parent_client(db):
    parent = UserFactory(role='parent')
    client = APIClient()
    client.force_authenticate(parent)
    return client, parent


@pytest.mark.django_db
def test_linking_creates_a_request_not_a_relationship(parent_client, student):
    client, parent = parent_client

    resp = client.post('/imboni/account/family/link/', {
        'student_code': 'STD2024001',
        'relationship_type': 'mother',
    }, format='json')

    assert resp.status_code == 202, resp.data
    assert resp.data['status'] == ParentLinkRequest.STATUS_PENDING
    assert ParentLinkRequest.objects.filter(
        parent=parent, student=student,
        status=ParentLinkRequest.STATUS_PENDING).exists()
    # Nothing readable yet — this is the whole point.
    assert not ParentStudentRelationship.objects.filter(
        parent=parent, student=student).exists()


@pytest.mark.django_db
def test_a_pending_request_grants_no_access_to_the_child(parent_client, student):
    client, _ = parent_client
    client.post('/imboni/account/family/link/', {
        'student_code': 'STD2024001', 'relationship_type': 'mother',
    }, format='json')

    for path in (f'/imboni/parents/{student.pk}/fees/',
                 f'/imboni/parents/{student.pk}/documents/'):
        resp = client.get(path)
        assert resp.status_code == 404, f'{path} leaked with only a pending request'


@pytest.mark.django_db
def test_repeated_requests_do_not_pile_up(parent_client, student):
    client, parent = parent_client
    body = {'student_code': 'STD2024001', 'relationship_type': 'mother'}
    client.post('/imboni/account/family/link/', body, format='json')
    client.post('/imboni/account/family/link/', body, format='json')

    assert ParentLinkRequest.objects.filter(parent=parent, student=student).count() == 1


@pytest.mark.django_db
def test_staff_approval_creates_the_relationship(parent_client, student, admin_user):
    client, parent = parent_client
    client.post('/imboni/account/family/link/', {
        'student_code': 'STD2024001', 'relationship_type': 'mother',
    }, format='json')
    req = ParentLinkRequest.objects.get(parent=parent, student=student)

    staff = APIClient()
    staff.force_authenticate(admin_user)

    listing = staff.get('/imboni/parents/link-requests/')
    assert listing.status_code == 200
    assert any(str(r['id']) == str(req.pk) for r in listing.data['results'])

    decided = staff.post(f'/imboni/parents/link-requests/{req.pk}/decide/',
                         {'decision': 'approve'}, format='json')
    assert decided.status_code == 200, decided.data

    req.refresh_from_db()
    assert req.status == ParentLinkRequest.STATUS_APPROVED
    assert req.decided_by == admin_user
    assert ParentStudentRelationship.objects.filter(
        parent=parent, student=student).exists()

    # And now the child's record opens.
    assert client.get(f'/imboni/parents/{student.pk}/fees/').status_code == 200


@pytest.mark.django_db
def test_rejection_grants_nothing(parent_client, student, admin_user):
    client, parent = parent_client
    client.post('/imboni/account/family/link/', {
        'student_code': 'STD2024001', 'relationship_type': 'guardian',
    }, format='json')
    req = ParentLinkRequest.objects.get(parent=parent, student=student)

    staff = APIClient()
    staff.force_authenticate(admin_user)
    resp = staff.post(f'/imboni/parents/link-requests/{req.pk}/decide/',
                      {'decision': 'reject', 'note': 'not on file'}, format='json')
    assert resp.status_code == 200

    req.refresh_from_db()
    assert req.status == ParentLinkRequest.STATUS_REJECTED
    assert not ParentStudentRelationship.objects.filter(
        parent=parent, student=student).exists()


@pytest.mark.django_db
def test_a_parent_cannot_approve_their_own_request(parent_client, student):
    client, parent = parent_client
    client.post('/imboni/account/family/link/', {
        'student_code': 'STD2024001', 'relationship_type': 'mother',
    }, format='json')
    req = ParentLinkRequest.objects.get(parent=parent, student=student)

    resp = client.post(f'/imboni/parents/link-requests/{req.pk}/decide/',
                       {'decision': 'approve'}, format='json')
    assert resp.status_code == 403, resp.data
    assert not ParentStudentRelationship.objects.filter(
        parent=parent, student=student).exists()


@pytest.mark.django_db
def test_the_queue_is_staff_only(parent_client):
    client, _ = parent_client
    assert client.get('/imboni/parents/link-requests/').status_code == 403


@pytest.mark.django_db
def test_deciding_twice_is_refused(parent_client, student, admin_user):
    client, parent = parent_client
    client.post('/imboni/account/family/link/', {
        'student_code': 'STD2024001', 'relationship_type': 'mother',
    }, format='json')
    req = ParentLinkRequest.objects.get(parent=parent, student=student)

    staff = APIClient()
    staff.force_authenticate(admin_user)
    url = f'/imboni/parents/link-requests/{req.pk}/decide/'
    assert staff.post(url, {'decision': 'approve'}, format='json').status_code == 200
    assert staff.post(url, {'decision': 'approve'}, format='json').status_code == 404
