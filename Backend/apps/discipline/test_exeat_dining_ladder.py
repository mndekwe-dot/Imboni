from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework import status

from apps.authentication.factories import StudentFactory
from apps.behavior.models import BehaviorReport
from apps.discipline.ladder import step_for
from apps.discipline.models import DiningPlan, ExeatPass


def _pass(student, **kw):
    now = timezone.now()
    defaults = dict(departure_at=now + timedelta(hours=2), expected_return_at=now + timedelta(days=2))
    return ExeatPass.objects.create(student=student, **{**defaults, **kw})


@pytest.mark.django_db
class TestExeatRegister:
    URL = '/imboni/discipline/exeat/'

    def test_teacher_cannot_use_the_register(self, make_authenticated_client):
        client, _ = make_authenticated_client('teacher')
        assert client.get(self.URL).status_code == status.HTTP_403_FORBIDDEN

    def test_return_must_come_after_departure(self, make_authenticated_client):
        client, _ = make_authenticated_client('discipline')
        student = StudentFactory()
        now = timezone.now()
        response = client.post(self.URL, {
            'student': str(student.id), 'reason_type': 'medical',
            'departure_at': now.isoformat(), 'expected_return_at': (now - timedelta(hours=1)).isoformat(),
        }, format='json')
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_full_lifecycle_in_order(self, make_authenticated_client):
        client, user = make_authenticated_client('discipline')
        exeat = _pass(StudentFactory())
        url = f'{self.URL}{exeat.id}/'

        # A pass cannot be approved, or used, before the parent has agreed.
        assert client.patch(url, {'action': 'approve'}, format='json').status_code == 400
        assert client.patch(url, {'action': 'depart'}, format='json').status_code == 400

        assert client.patch(url, {'action': 'parent_approved', 'note': 'Phoned mother'}, format='json').status_code == 200
        assert client.patch(url, {'action': 'approve'}, format='json').data['status'] == 'approved'

        out = client.patch(url, {'action': 'depart'}, format='json')
        assert out.data['status'] == 'out'
        assert out.data['gate_verified_by_name'] == user.get_full_name()

        back = client.patch(url, {'action': 'return'}, format='json')
        assert back.data['status'] == 'returned'
        assert back.data['actual_return_at'] is not None

    def test_a_declined_parent_closes_the_pass(self, make_authenticated_client):
        client, _ = make_authenticated_client('discipline')
        exeat = _pass(StudentFactory())
        response = client.patch(f'{self.URL}{exeat.id}/', {'action': 'parent_declined'}, format='json')
        assert response.data['status'] == 'declined'
        again = client.patch(f'{self.URL}{exeat.id}/', {'action': 'parent_approved'}, format='json')
        assert again.status_code == 400

    def test_overdue_means_out_and_past_the_expected_return(self):
        student = StudentFactory()
        late = _pass(student, status='out', expected_return_at=timezone.now() - timedelta(hours=3))
        fine = _pass(student, status='out')
        assert late.is_overdue and not fine.is_overdue


@pytest.mark.django_db
class TestDietaryFlags:
    def test_flags_are_saved_on_the_student_and_unknown_codes_dropped(self, make_authenticated_client):
        from apps.results.models import AcademicTerm
        client, _ = make_authenticated_client('discipline')
        student = StudentFactory()
        term = AcademicTerm.objects.create(
            name='Term 1', year=2026, order=1, is_current=True,
            start_date=timezone.localdate() - timedelta(days=30), end_date=timezone.localdate() + timedelta(days=30),
        )
        plan = DiningPlan.objects.create(student=student, term=term, plan_type='full_board')

        response = client.patch(
            f'/imboni/discipline/dining/{plan.id}/',
            {'dietary_flags': ['diabetic', 'made_up', 'peanut_allergy'], 'allergies': 'Peanuts'},
            format='json',
        )

        assert response.status_code == 200
        assert response.data['dietary_flags'] == ['peanut_allergy', 'diabetic']
        student.refresh_from_db()
        assert student.allergies == 'Peanuts'


class TestLadder:
    def test_steps(self):
        assert step_for(0) is None
        assert step_for(9) is None
        assert step_for(10) == 'detention'
        assert step_for(25) == 'parent_summons'
        assert step_for(40) == 'suspension_warning'

    @pytest.mark.django_db
    def test_student_list_reports_marks_and_step(self, make_authenticated_client):
        client, user = make_authenticated_client('discipline')
        student = StudentFactory()
        for marks in (8, 7):
            BehaviorReport.objects.create(
                student=student, report_type='incident', title='x', description='x',
                date=timezone.localdate(), reported_by=user, marks_deducted=marks, status='approved',
            )
        BehaviorReport.objects.create(
            student=student, report_type='incident', title='pending', description='x',
            date=timezone.localdate(), reported_by=user, marks_deducted=20, status='pending_review',
        )

        row = next(r for r in client.get('/imboni/discipline/students/').data if r['id'] == str(student.id))

        assert row['marks_deducted'] == 15
        assert row['ladder_step'] == 'detention'

    @pytest.mark.django_db
    def test_ladder_endpoint(self, make_authenticated_client):
        client, _ = make_authenticated_client('discipline')
        data = client.get('/imboni/discipline/ladder/').data
        assert [s['code'] for s in data['steps']] == ['detention', 'parent_summons', 'suspension_warning']


@pytest.mark.django_db
class TestAttendanceReconciliation:
    def test_students_signed_out_that_day_are_reported_as_away(self):
        from apps.discipline.exeat_service import students_away
        today = timezone.localdate()
        out = StudentFactory()
        approved_only = StudentFactory()      # never actually left
        returned_before = StudentFactory()
        now = timezone.now()
        _pass(out, status='out', departure_at=now - timedelta(hours=5), expected_return_at=now + timedelta(days=1))
        _pass(approved_only, status='approved', departure_at=now - timedelta(hours=5), expected_return_at=now + timedelta(days=1))
        _pass(returned_before, status='returned', departure_at=now - timedelta(days=5), expected_return_at=now - timedelta(days=3),
              actual_return_at=now - timedelta(days=3))

        away = students_away([out.id, approved_only.id, returned_before.id], today)

        assert away == {out.id}
