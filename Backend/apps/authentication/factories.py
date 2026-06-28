"""
Shared factory_boy factories for tests across every app.

Usage:
    from apps.authentication.factories import UserFactory, StudentFactory

    dos = UserFactory(role='dos')
    student = StudentFactory()              # auto-creates its own User(role='student')
    teacher = UserFactory(role='teacher')
"""
import factory
from factory.django import DjangoModelFactory
from django.contrib.auth.hashers import make_password
from apps.authentication.models import User
from apps.student.models import Student
from apps.discipline.models import DisciplineStaff, BoardingStudent
from apps.results.models import Subject, AcademicTerm


class UserFactory(DjangoModelFactory):
    class Meta:
        model = User
        django_get_or_create = ('email',)

    email = factory.Sequence(lambda n: f'user{n}@imboni.test')
    username = factory.LazyAttribute(lambda o: o.email)
    first_name = factory.Faker('first_name')
    last_name = factory.Faker('last_name')
    role = 'student'
    password = factory.LazyFunction(lambda: make_password('TestPass123!'))
    is_active = True


class StudentFactory(DjangoModelFactory):
    class Meta:
        model = Student

    user = factory.SubFactory(UserFactory, role='student')
    student_id = factory.Sequence(lambda n: f'STU{n:05d}')
    grade = '4'
    section = 'A'
    enrollment_date = factory.Faker('date_this_decade')


class DisciplineStaffFactory(DjangoModelFactory):
    class Meta:
        model = DisciplineStaff

    user = factory.SubFactory(UserFactory, role='discipline')
    staff_type = 'matron'
    assigned_dormitory = 'Test Dormitory'
    assigned_grade = 'all'
    is_active = True


class SubjectFactory(DjangoModelFactory):
    class Meta:
        model = Subject
        django_get_or_create = ('code',)

    name = factory.Sequence(lambda n: f'Subject {n}')
    code = factory.Sequence(lambda n: f'SUB{n:04d}')
    category = 'core'
    credit_hours = 1
    is_active = True


class AcademicTermFactory(DjangoModelFactory):
    class Meta:
        model = AcademicTerm
        django_get_or_create = ('term', 'year')

    name = factory.Sequence(lambda n: f'Term {n}')
    term = 'term1'
    year = factory.Sequence(lambda n: 2020 + n)
    start_date = '2024-01-01'
    end_date = '2024-04-01'
    is_current = False


class ParentStudentRelationshipFactory(DjangoModelFactory):
    class Meta:
        model = 'parents.ParentStudentRelationship'

    parent = factory.SubFactory(UserFactory, role='parent')
    student = factory.SubFactory(StudentFactory)
    relationship_type = 'mother'
    is_primary_contact = True
    can_pickup = True


class BoardingStudentFactory(DjangoModelFactory):
    class Meta:
        model = BoardingStudent

    student = factory.SubFactory(StudentFactory)
    dormitory = 'Test Dormitory'
    room_number = '101'
    bed_number = ''
    boarding_type = 'full_boarder'
    check_in_date = factory.Faker('date_this_decade')
    is_active = True
