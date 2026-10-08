import datetime

import pytest
from rest_framework import status

from apps.dos.models import TimetablePeriod
from apps.results.models import AcademicTerm, Subject
from apps.teacher.models import Class, Timetable

URL = '/imboni/dos/timetable/periods/'


def _lesson(start, end, day='monday'):
    term = AcademicTerm.objects.filter(is_current=True).first() or AcademicTerm.objects.create(
        name='Term 1', term='term1', year=2026, is_current=True,
        start_date=datetime.date(2026, 1, 1), end_date=datetime.date(2026, 4, 1))
    class_obj, _ = Class.objects.get_or_create(name='S1A', grade='S1', section='A')
    subject, _ = Subject.objects.get_or_create(code='MATH', defaults={'name': 'Mathematics'})
    Timetable.objects.create(class_obj=class_obj, subject=subject, term=term,
                             day=day, start_time=start, end_time=end)


@pytest.mark.django_db
class TestTheBellSchedule:
    def test_with_nothing_saved_the_rows_come_from_the_lessons(self, make_authenticated_client):
        client, _ = make_authenticated_client('dos')
        _lesson('07:30', '08:30')
        _lesson('08:30', '09:30', day='tuesday')
        _lesson('11:00', '12:00')

        data = client.get(URL).data

        assert data['source'] == 'lessons'
        assert [(p['start_time'], p['is_break']) for p in data['periods']] == [
            ('07:30', False), ('08:30', False), ('09:30', True), ('11:00', False)]

    def test_the_dos_saves_the_schedule_the_generator_uses(self, make_authenticated_client):
        client, _ = make_authenticated_client('dos')
        body = {'periods': [
            {'label': 'Period 2', 'start_time': '08:40', 'end_time': '09:20'},
            {'label': 'Period 1', 'start_time': '08:00', 'end_time': '08:40'},
            {'label': 'Break', 'start_time': '09:20', 'end_time': '09:40', 'is_break': True},
        ]}

        response = client.put(URL, body, format='json')

        assert response.status_code == status.HTTP_200_OK
        assert list(TimetablePeriod.objects.values_list('label', 'order', 'is_break')) == [
            ('Period 1', 1, False), ('Period 2', 2, False), ('Break', 3, True)]
        assert client.get(URL).data['source'] == 'school'

    def test_overlapping_or_backwards_periods_are_refused(self, make_authenticated_client):
        client, _ = make_authenticated_client('dos')
        overlap = {'periods': [
            {'label': 'A', 'start_time': '08:00', 'end_time': '09:00'},
            {'label': 'B', 'start_time': '08:30', 'end_time': '09:30'},
        ]}
        backwards = {'periods': [{'label': 'A', 'start_time': '09:00', 'end_time': '08:00'}]}
        assert client.put(URL, overlap, format='json').status_code == status.HTTP_400_BAD_REQUEST
        assert client.put(URL, backwards, format='json').status_code == status.HTTP_400_BAD_REQUEST
        assert not TimetablePeriod.objects.exists()

    def test_teachers_read_but_do_not_change_it(self, make_authenticated_client):
        client, _ = make_authenticated_client('teacher')
        assert client.get(URL).status_code == status.HTTP_200_OK
        assert client.put(URL, {'periods': []}, format='json').status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_the_discipline_day_view_lists_lessons(make_authenticated_client):
    client, _ = make_authenticated_client('discipline')
    _lesson('07:30', '08:30', day='monday')
    response = client.get('/imboni/discipline/timetable/', {'date': '2026-09-14'})  # a Monday
    assert response.status_code == status.HTTP_200_OK
    assert [p['subject'] for p in response.data['periods']] == ['Mathematics']


@pytest.mark.django_db
def test_editing_a_lesson_saves_its_room(make_authenticated_client):
    client, _ = make_authenticated_client('dos')
    _lesson('07:30', '08:30')
    lesson = Timetable.objects.get()

    response = client.patch(f'/imboni/dos/timetable/{lesson.id}/',
                            {'room': 'Lab 1', 'day': 'Tuesday', 'force': True}, format='json')

    assert response.status_code == status.HTTP_200_OK
    lesson.refresh_from_db()
    assert (lesson.room_number, lesson.day) == ('Lab 1', 'tuesday')
