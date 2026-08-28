"""
Who may read one student's attendance.

Both endpoints below took the student id from the URL and filtered on it with
nothing but `IsAuthenticated` in front, so any signed-in user could read any
child's attendance by changing the id in the path. These tests pin the rule
per role, in both directions — a guard that only ever gets tested for what it
blocks tends to end up blocking everyone.
"""

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.authentication.factories import (
    UserFactory, StudentFactory, SubjectFactory, AcademicTermFactory,
    ParentStudentRelationshipFactory,
)
from apps.teacher.models import Class, ClassAssignment, SubjectTeacherAssignment

pytestmark = pytest.mark.django_db


def as_user(user):
    """
    A client of its own per role.

    The shared `api_client` fixture hands back one instance, so authenticating
    as a second role inside a test silently logs the first one out — which
    would make an access test pass for the wrong reason.
    """
    client = APIClient()
    client.force_authenticate(user)
    return client


def stats_url(student):
    return reverse('attendance-stats', args=[student.id])


def calendar_url(student):
    return reverse('attendance-calendar', args=[student.id])


@pytest.fixture
def student():
    return StudentFactory()


@pytest.fixture
def other_student():
    return StudentFactory()


# --------------------------------------------------------------------------
# The bug: another family's child, by id
# --------------------------------------------------------------------------

def test_student_cannot_read_another_students_attendance(student, other_student):
    response = as_user(student.user).get(stats_url(other_student))
    assert response.status_code == 404


def test_student_cannot_read_another_students_calendar(student, other_student):
    response = as_user(student.user).get(calendar_url(other_student))
    assert response.status_code == 404


def test_parent_cannot_read_an_unrelated_childs_attendance(student, other_student):
    link = ParentStudentRelationshipFactory(student=student)
    response = as_user(link.parent).get(stats_url(other_student))
    assert response.status_code == 404


def test_parent_cannot_read_an_unrelated_childs_calendar(student, other_student):
    link = ParentStudentRelationshipFactory(student=student)
    response = as_user(link.parent).get(calendar_url(other_student))
    assert response.status_code == 404


def test_teacher_who_does_not_teach_the_student_is_refused(student):
    teacher = UserFactory(role='teacher')
    response = as_user(teacher).get(stats_url(student))
    assert response.status_code == 404


# --------------------------------------------------------------------------
# The other direction: everyone who legitimately needs this still gets it
# --------------------------------------------------------------------------

def test_student_reads_their_own_attendance(student):
    response = as_user(student.user).get(stats_url(student))
    assert response.status_code == 200


def test_student_reads_their_own_calendar(student):
    response = as_user(student.user).get(calendar_url(student))
    assert response.status_code == 200


def test_parent_reads_their_own_childs_attendance(student):
    link = ParentStudentRelationshipFactory(student=student)
    response = as_user(link.parent).get(stats_url(student))
    assert response.status_code == 200


def test_teacher_who_teaches_the_student_may_read_it(student):
    teacher = UserFactory(role='teacher')
    term = AcademicTermFactory()
    klass = Class.objects.create(name='S1 A', grade='S1', section='A')
    SubjectTeacherAssignment.objects.create(
        teacher=teacher, subject=SubjectFactory(), class_obj=klass, term=term,
    )
    ClassAssignment.objects.create(student=student, class_obj=klass, term=term)

    response = as_user(teacher).get(stats_url(student))
    assert response.status_code == 200


@pytest.mark.parametrize('role', ['admin', 'dos', 'discipline', 'matron'])
def test_school_wide_roles_may_read_any_student(role, student):
    """These four act on attendance across the school; scoping them per-student
    would break the job rather than protect anyone."""
    response = as_user(UserFactory(role=role)).get(stats_url(student))
    assert response.status_code == 200


def test_anonymous_is_refused(student):
    response = APIClient().get(stats_url(student))
    assert response.status_code in (401, 403)


def test_an_unknown_role_gets_nothing(student):
    """The check is closed by default, so a role added later fails shut."""
    stranger = UserFactory(role='teacher')
    stranger.role = 'auditor'          # not in USER_ROLES
    stranger.save(update_fields=['role'])
    response = as_user(stranger).get(stats_url(student))
    assert response.status_code == 404
