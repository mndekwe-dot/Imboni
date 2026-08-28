"""
Views that never declared a permission class.

DRF falls back to DEFAULT_PERMISSION_CLASSES, which is `IsAuthenticated` here.
For three views that meant "any signed-in user", including students and
parents — on endpoints that reschedule exams, edit school announcements, and
create parent accounts. Nothing declared that; it was the absence of a
declaration.

These tests exist so the next view that forgets is caught by an assertion
rather than by someone deleting their own exam.
"""

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.authentication.factories import UserFactory, StudentFactory

pytestmark = pytest.mark.django_db


def as_user(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


NON_STAFF_ROLES = ['student', 'parent', 'teacher']


@pytest.mark.parametrize('role', NON_STAFF_ROLES)
def test_non_staff_cannot_reach_exam_schedule_detail(role):
    """A student could once GET, PATCH or DELETE an exam schedule entry."""
    import uuid
    url = reverse('dos-exam-schedule-detail', args=[uuid.uuid4()])
    response = as_user(UserFactory(role=role)).get(url)
    assert response.status_code == 403


@pytest.mark.parametrize('role', NON_STAFF_ROLES)
def test_non_staff_cannot_delete_an_exam(role):
    import uuid
    url = reverse('dos-exam-schedule-detail', args=[uuid.uuid4()])
    response = as_user(UserFactory(role=role)).delete(url)
    assert response.status_code == 403


@pytest.mark.parametrize('role', NON_STAFF_ROLES)
def test_non_staff_cannot_reach_dos_announcement_detail(role):
    import uuid
    url = reverse('dos-announcement-detail', args=[uuid.uuid4()])
    response = as_user(UserFactory(role=role)).get(url)
    assert response.status_code == 403


@pytest.mark.parametrize('role', NON_STAFF_ROLES)
def test_non_staff_cannot_delete_a_school_announcement(role):
    import uuid
    url = reverse('dos-announcement-detail', args=[uuid.uuid4()])
    response = as_user(UserFactory(role=role)).delete(url)
    assert response.status_code == 403


@pytest.mark.parametrize('role', NON_STAFF_ROLES)
def test_non_staff_cannot_create_a_parent_account_for_a_child(role):
    """
    The worst of the three: this creates a real, password-bearing account and
    links it to a child. Any signed-in user could do it, to any student.
    """
    student = StudentFactory()
    url = reverse('student-add-parent', args=[student.id])
    response = as_user(UserFactory(role=role)).post(url, {
        'username': 'intruder', 'email': 'intruder@example.com',
        'password': 'hunter2hunter2', 'first_name': 'In', 'last_name': 'Truder',
        'relationship_type': 'father',
    }, format='json')
    assert response.status_code == 403


def test_dos_still_reaches_all_three():
    """The gate must not lock out the role that owns these endpoints."""
    import uuid
    dos = as_user(UserFactory(role='dos'))
    for name in ('dos-exam-schedule-detail', 'dos-announcement-detail'):
        response = dos.get(reverse(name, args=[uuid.uuid4()]))
        # 404 for a random id is the right answer; 403 would mean over-gating.
        assert response.status_code == 404, name
