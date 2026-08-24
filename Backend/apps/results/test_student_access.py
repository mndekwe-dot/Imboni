"""
Academic records are student-scoped, and the id comes from the URL.

`IsParentOrTeacherOrDOS` proves *a* parent is asking. It cannot prove it is
this child's parent, because a permission class never sees the id in the path.
All three views below filtered on `kwargs['student_pk']` alone, so any parent
could read any other family's marks and any teacher any student's, by changing
one id.
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

# One client per role: the shared fixture returns a single instance, so
# authenticating twice in a test silently logs the first user out.
def as_user(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


ROUTES = ['student-assessments', 'student-summative', 'student-reviews']


@pytest.fixture
def student():
    return StudentFactory()


@pytest.fixture
def other_student():
    return StudentFactory()


def teaches(teacher, student):
    """Put `teacher` in front of `student` for the current term."""
    term = AcademicTermFactory()
    klass = Class.objects.create(name='S2 B', grade='S2', section='B')
    SubjectTeacherAssignment.objects.create(
        teacher=teacher, subject=SubjectFactory(), class_obj=klass, term=term,
    )
    ClassAssignment.objects.create(student=student, class_obj=klass, term=term)


@pytest.mark.parametrize('route', ROUTES)
def test_parent_cannot_read_another_familys_child(route, student, other_student):
    link = ParentStudentRelationshipFactory(student=student)
    response = as_user(link.parent).get(reverse(route, args=[other_student.id]))
    assert response.status_code == 404


@pytest.mark.parametrize('route', ROUTES)
def test_parent_reads_their_own_child(route, student):
    link = ParentStudentRelationshipFactory(student=student)
    response = as_user(link.parent).get(reverse(route, args=[student.id]))
    assert response.status_code == 200


@pytest.mark.parametrize('route', ROUTES)
def test_teacher_who_does_not_teach_the_student_is_refused(route, student):
    teacher = UserFactory(role='teacher')
    response = as_user(teacher).get(reverse(route, args=[student.id]))
    assert response.status_code == 404


@pytest.mark.parametrize('route', ROUTES)
def test_teacher_who_teaches_the_student_may_read(route, student):
    teacher = UserFactory(role='teacher')
    teaches(teacher, student)
    response = as_user(teacher).get(reverse(route, args=[student.id]))
    assert response.status_code == 200


@pytest.mark.parametrize('route', ROUTES)
def test_dos_reads_any_student(route, student):
    response = as_user(UserFactory(role='dos')).get(reverse(route, args=[student.id]))
    assert response.status_code == 200
