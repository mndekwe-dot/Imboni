"""The health alerts staff must see at a glance."""
import pytest

from apps.authentication.factories import BoardingStudentFactory
from apps.student.medical import MEDICAL_FLAGS, clean_flags

pytestmark = pytest.mark.django_db


def test_unknown_codes_are_dropped_and_the_rest_come_back_in_a_fixed_order():
    assert clean_flags(['epilepsy', 'made_up', 'asthma', 'asthma']) == ['asthma', 'epilepsy']
    assert clean_flags(None) == []
    assert set(clean_flags(MEDICAL_FLAGS)) == set(MEDICAL_FLAGS)


def test_the_matron_sets_alerts_and_they_show_on_the_roll_and_the_detail(make_authenticated_client):
    client, _ = make_authenticated_client('matron')
    boarder = BoardingStudentFactory()

    out = client.patch(f'/imboni/matron/students/{boarder.id}/medical/',
                       {'medical_flags': ['epilepsy', 'bogus', 'asthma'], 'allergies': 'Penicillin'}, format='json')

    assert out.status_code == 200
    assert out.data['medical_flags'] == ['asthma', 'epilepsy']
    roll = {r['id']: r for r in client.get('/imboni/matron/students/').data}
    assert roll[str(boarder.id)]['medical_flags'] == ['asthma', 'epilepsy']
    detail = client.get(f'/imboni/matron/students/{boarder.id}/').data
    assert detail['medical_flags'] == ['asthma', 'epilepsy'] and detail['allergies'] == 'Penicillin'


def test_leaving_the_flags_out_does_not_clear_them(make_authenticated_client):
    client, _ = make_authenticated_client('matron')
    boarder = BoardingStudentFactory()
    client.patch(f'/imboni/matron/students/{boarder.id}/medical/', {'medical_flags': ['asthma']}, format='json')

    client.patch(f'/imboni/matron/students/{boarder.id}/medical/', {'allergies': 'Nuts'}, format='json')

    boarder.student.refresh_from_db()
    assert boarder.student.medical_flags == ['asthma'] and boarder.student.allergies == 'Nuts'


def test_the_kitchen_list_carries_them_too(make_authenticated_client):
    from datetime import timedelta
    from django.utils import timezone
    from apps.discipline.models import DiningPlan
    from apps.results.models import AcademicTerm
    client, _ = make_authenticated_client('discipline')
    boarder = BoardingStudentFactory()
    boarder.student.medical_flags = ['diabetes_insulin']
    boarder.student.save()
    term = AcademicTerm.objects.create(name='T1', year=2026, order=1, is_current=True,
                                       start_date=timezone.localdate() - timedelta(days=5),
                                       end_date=timezone.localdate() + timedelta(days=50))
    DiningPlan.objects.create(student=boarder.student, term=term, plan_type='full_board')

    rows = client.get('/imboni/discipline/dining/').data
    rows = rows['results'] if isinstance(rows, dict) else rows

    assert rows[0]['medical_flags'] == ['diabetes_insulin']


def test_a_teacher_cannot_set_them(make_authenticated_client):
    client, _ = make_authenticated_client('teacher')
    boarder = BoardingStudentFactory()
    assert client.patch(f'/imboni/matron/students/{boarder.id}/medical/', {'medical_flags': ['asthma']},
                        format='json').status_code == 403
