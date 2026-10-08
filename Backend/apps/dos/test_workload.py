from datetime import time

from .workload import double_bookings, load_level, weekly_capacity


def test_capacity_follows_the_schools_own_week():
    assert weekly_capacity(8, 'full_time') == 40
    assert weekly_capacity(8, 'part_time') == 20


def test_levels():
    assert load_level(0, 40) == 'none'
    assert load_level(5, 40) == 'light'
    assert load_level(24, 40) == 'normal'
    assert load_level(37, 40) == 'heavy'
    assert load_level(41, 40) == 'over'
    assert load_level(10, 0) == 'unknown'


def test_overlapping_lessons_for_different_classes_are_a_double_booking():
    lessons = [
        ('t1', 'monday', time(9), time(10), 'S1A'),
        ('t1', 'monday', time(9, 30), time(10, 30), 'S1B'),
        ('t1', 'tuesday', time(9), time(10), 'S1A'),
    ]
    assert double_bookings(lessons) == {'t1': 1}


def test_the_same_class_twice_is_one_lesson_and_back_to_back_is_fine():
    lessons = [
        ('t1', 'monday', time(9), time(10), 'S1A'),
        ('t1', 'monday', time(9), time(10), 'S1A'),
        ('t1', 'monday', time(10), time(11), 'S1B'),
    ]
    assert double_bookings(lessons) == {}


import datetime

import pytest

from apps.authentication.factories import UserFactory


@pytest.mark.django_db
def test_teacher_list_reports_load_against_the_schools_week(make_authenticated_client):
    from apps.dos.models import TimetablePeriod
    from apps.results.models import AcademicTerm, Subject
    from apps.teacher.models import Class, Timetable

    client, _ = make_authenticated_client('dos')
    term = AcademicTerm.objects.create(
        name='T1', term='term1', year=2026, start_date=datetime.date(2026, 1, 1),
        end_date=datetime.date(2026, 4, 1), is_current=True,
    )
    for n in range(4):
        TimetablePeriod.objects.create(order=n, start_time=time(8 + n), end_time=time(9 + n))
    subject = Subject.objects.create(name='Maths', code='M1')
    a = Class.objects.create(name='S1A', grade='S1', section='A')
    b = Class.objects.create(name='S1B', grade='S1', section='B')
    teacher = UserFactory(role='teacher', employment_type='full_time')
    for cls in (a, b):   # same hour, two classes: a double-booking
        Timetable.objects.create(class_obj=cls, subject=subject, teacher=teacher, term=term,
                                 day='monday', start_time=time(8), end_time=time(9))

    row = next(r for r in client.get('/imboni/dos/teachers/').data if str(r['teacher_id']) == str(teacher.id))

    assert row['periods_per_week'] == 2
    assert row['weekly_capacity'] == 20          # 4 periods x 5 days
    assert row['workload_level'] == 'light'
    assert row['double_booked'] == 1
