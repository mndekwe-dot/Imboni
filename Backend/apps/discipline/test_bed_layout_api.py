import datetime

import pytest

from apps.authentication.factories import StudentFactory
from apps.discipline.models import BoardingStudent, Dormitory, DormRoom


@pytest.mark.django_db
def test_floor_plan_shows_occupied_free_and_closed_rooms(make_authenticated_client):
    client, _ = make_authenticated_client('discipline')
    dorm = Dormitory.objects.create(name='Kivu', gender='male')
    DormRoom.objects.create(dormitory=dorm, room_number='1', bed_capacity=3)
    DormRoom.objects.create(dormitory=dorm, room_number='2', bed_capacity=2, is_active=False)
    student = StudentFactory()
    BoardingStudent.objects.create(student=student, dormitory='Kivu', room_number='1', bed_number='2',
                                   check_in_date=datetime.date.today())

    data = client.get('/imboni/discipline/housing/beds/').data

    kivu = next(d for d in data if d['name'] == 'Kivu')
    room1, room2 = kivu['rooms']
    assert [b['occupant'] for b in room1['beds']] == [None, student.user.get_full_name(), None]
    assert room1['free'] == 2 and room1['closed'] is False
    assert room2['closed'] is True
    assert kivu['occupied'] == 1 and kivu['capacity'] == 3          # a closed room's beds are not counted


@pytest.mark.django_db
def test_teachers_cannot_see_it(make_authenticated_client):
    client, _ = make_authenticated_client('teacher')
    assert client.get('/imboni/discipline/housing/beds/').status_code == 403
