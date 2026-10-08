"""
Fixtures shared by the assignment test modules.

They used to be imported from test_assignment_lifecycle.py into its companion
modules, which ruff reads as a name imported and then redefined by every test
that takes the fixture as an argument.
"""
import datetime

import pytest

from apps.authentication.factories import StudentFactory
from apps.results.models import AcademicTerm, Subject
from apps.teacher.models import Class, ClassAssignment


@pytest.fixture
def term():
    return AcademicTerm.objects.create(
        name='Term 1 2025', term='term1', year=2025,
        start_date=datetime.date(2025, 1, 1),
        end_date=datetime.date(2025, 4, 1), is_current=True,
    )


@pytest.fixture
def subject():
    return Subject.objects.create(name='Mathematics', code='MATH101')


@pytest.fixture
def klass():
    return Class.objects.create(name='S4A', grade='S4', section='A')


@pytest.fixture
def enrolled_student(klass, term):
    student = StudentFactory(grade='S4', section='A')
    ClassAssignment.objects.create(student=student, class_obj=klass, term=term)
    return student
