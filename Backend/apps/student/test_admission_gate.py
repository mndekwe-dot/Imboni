"""
The admission gate: hold new students until the bursar confirms their deposit.

The important property is that it does NOTHING unless a school switches it on,
so the first tests pin the default.

Run with:
    python -m pytest apps/student/test_admission_gate.py -q
"""
import datetime
from decimal import Decimal

import pytest
from django.core.cache import cache
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework.test import APIClient

from apps.authentication import invites
from apps.authentication.factories import StudentFactory, UserFactory
from apps.authentication.models import Invitation
from apps.dos.models import SchoolSetting
from apps.finance.models import FeePayment
from apps.results.models import AcademicTerm
from apps.student.admission import PENDING, confirm_enrolment, holds_new_students
from apps.student.models import Fee, Student
from apps.teacher.models import Class, ClassAssignment

REGISTER = '/imboni/auth/register/complete/'
QUEUE = '/imboni/finance/admissions/'


@pytest.fixture(autouse=True)
def _fresh():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def term(db):
    return AcademicTerm.objects.create(
        name='Term 1 2025', term='term1', year=2025,
        start_date=datetime.date(2025, 1, 1), end_date=datetime.date(2025, 4, 1), is_current=True)


@pytest.fixture
def klass(db):
    return Class.objects.create(name='S1A', grade='S1', section='A')


def hold(on=True):
    s = SchoolSetting.get_setting()
    s.hold_enrolment_until_deposit = on
    s.save()


def register_student(klass, who='newbie'):
    """Complete a student invitation the way a family does, via the real endpoint."""
    inviter = UserFactory(role='admin')
    raw = invites.new_token()
    inv = Invitation.objects.create(
        first_name=who.title(), last_name='Pupil', role='student', email=f'{who}@example.test',
        class_obj=klass, invited_by=inviter, expires_at=invites.default_expiry(),
        token_hash=invites.hash_token(raw), uid='')
    inv.uid = urlsafe_base64_encode(force_bytes(inv.pk))
    inv.save(update_fields=['uid'])
    res = APIClient().post(REGISTER, {
        'uid': inv.uid, 'token': raw, 'username': who, 'password': 'Sup3r-secret!',
        'confirm_password': 'Sup3r-secret!'}, format='json')
    assert res.status_code in (200, 201), res.data
    return Student.objects.get(user__username=who)


def placed(student):
    return ClassAssignment.objects.filter(student=student).exists()


@pytest.mark.django_db
class TestDefaultBehaviourIsUnchanged:
    def test_the_gate_is_off_by_default(self):
        assert holds_new_students() is False

    def test_a_new_student_is_active_and_placed_as_always(self, term, klass):
        student = register_student(klass)
        assert student.status == 'active'
        assert placed(student)


@pytest.mark.django_db
class TestWhenTheSchoolSwitchesItOn:
    def test_a_new_student_is_held_and_not_placed(self, term, klass):
        hold()
        student = register_student(klass)
        assert student.status == PENDING
        assert not placed(student), 'a held student must not reach a class register'

    def test_a_held_student_is_not_on_the_teachers_register(self, make_authenticated_client, term, klass):
        hold()
        student = register_student(klass)
        assert student.id not in set(
            ClassAssignment.objects.filter(class_obj=klass, term=term).values_list('student_id', flat=True))

    def test_turning_it_off_again_goes_back_to_normal(self, term, klass):
        hold()
        hold(False)
        assert register_student(klass, 'later').status == 'active'

    def test_the_setting_can_be_read_and_changed_through_the_api(self, make_authenticated_client):
        client, _ = make_authenticated_client('dos')
        res = client.patch('/imboni/dos/school-settings/', {'hold_enrolment_until_deposit': True}, format='json')
        assert res.status_code == 200
        assert client.get('/imboni/dos/school-settings/').data['hold_enrolment_until_deposit'] is True


@pytest.mark.django_db
class TestTheQueue:
    def _pending(self, owed=None, paid=None, grade='S1', section='A'):
        s = StudentFactory(status=PENDING, grade=grade, section=section)
        if owed:
            fee = Fee.objects.create(student=s, category='tuition', amount=Decimal(owed),
                                     due_date=datetime.date(2025, 3, 1))
            if paid:
                FeePayment.objects.create(fee=fee, amount=Decimal(paid), receipt_no=f'R{s.pk.hex[:6]}')
        return s

    def test_lists_only_students_being_held_with_what_they_owe(self, make_authenticated_client):
        client, _ = make_authenticated_client('bursar')
        held = self._pending(owed='300000', paid='100000')
        StudentFactory(status='active')
        res = client.get(QUEUE)
        assert res.status_code == 200
        assert res.data['count'] == 1
        row = res.data['results'][0]
        assert row['student_code'] == held.student_id
        assert (row['charged'], row['paid'], row['owed']) == (300000.0, 100000.0, 200000.0)

    def test_empty_for_a_school_that_never_holds_anyone(self, make_authenticated_client):
        client, _ = make_authenticated_client('bursar')
        assert client.get(QUEUE).data == {'count': 0, 'results': []}

    def test_the_queue_costs_the_same_however_long_it_is(self, make_authenticated_client):
        from django.db import connection
        from django.test.utils import CaptureQueriesContext
        client, _ = make_authenticated_client('bursar')
        self._pending(owed='10')
        with CaptureQueriesContext(connection) as small:
            client.get(QUEUE)
        for _i in range(15):
            self._pending(owed='10')
        with CaptureQueriesContext(connection) as large:
            client.get(QUEUE)
        assert len(large) == len(small)

    @pytest.mark.parametrize('role', ['bursar', 'admin'])
    def test_the_bursar_and_admin_may_use_it(self, make_authenticated_client, role):
        client, _ = make_authenticated_client(role)
        assert client.get(QUEUE).status_code == 200

    @pytest.mark.parametrize('role', ['teacher', 'student', 'parent', 'discipline'])
    def test_no_one_else_may(self, make_authenticated_client, role):
        client, _ = make_authenticated_client(role)
        assert client.get(QUEUE).status_code == 403


@pytest.mark.django_db
class TestConfirming:
    def test_confirming_activates_and_places_in_the_matching_class(self, make_authenticated_client, term, klass):
        client, _ = make_authenticated_client('bursar')
        student = StudentFactory(status=PENDING, grade='S1', section='A')

        res = client.post(f'{QUEUE}{student.id}/confirm/')

        assert res.status_code == 200
        assert res.data['status'] == 'active'
        assert res.data['placed'] is True and res.data['class_name'] == 'S1A'
        student.refresh_from_db()
        assert student.status == 'active' and placed(student)

    def test_a_student_with_no_matching_class_is_still_activated_and_it_says_so(
            self, make_authenticated_client, term):
        client, _ = make_authenticated_client('bursar')
        student = StudentFactory(status=PENDING, grade='S9', section='Z')
        res = client.post(f'{QUEUE}{student.id}/confirm/')
        assert res.status_code == 200
        assert res.data['placed'] is False and res.data['class_name'] is None
        student.refresh_from_db()
        assert student.status == 'active' and not placed(student)

    def test_confirming_twice_is_refused(self, make_authenticated_client, term, klass):
        client, _ = make_authenticated_client('bursar')
        student = StudentFactory(status=PENDING, grade='S1', section='A')
        assert client.post(f'{QUEUE}{student.id}/confirm/').status_code == 200
        assert client.post(f'{QUEUE}{student.id}/confirm/').status_code == 409

    @pytest.mark.parametrize('status', ['suspended', 'transferred', 'graduated', 'inactive', 'active'])
    def test_it_cannot_reactivate_anyone_who_was_not_being_held(self, make_authenticated_client, term, status):
        """A suspended or transferred student must not be brought back by this."""
        client, _ = make_authenticated_client('bursar')
        student = StudentFactory(status=status)
        assert client.post(f'{QUEUE}{student.id}/confirm/').status_code == 409
        student.refresh_from_db()
        assert student.status == status

    def test_an_unknown_student_is_a_404(self, make_authenticated_client):
        client, _ = make_authenticated_client('bursar')
        assert client.post(f'{QUEUE}00000000-0000-0000-0000-000000000000/confirm/').status_code == 404

    @pytest.mark.parametrize('role', ['teacher', 'student', 'parent', 'dos'])
    def test_only_the_bursar_and_admin_may_confirm(self, make_authenticated_client, term, role):
        client, _ = make_authenticated_client(role)
        student = StudentFactory(status=PENDING)
        assert client.post(f'{QUEUE}{student.id}/confirm/').status_code == 403
        student.refresh_from_db()
        assert student.status == PENDING

    def test_confirming_twice_does_not_double_place(self, term, klass):
        student = StudentFactory(status=PENDING, grade='S1', section='A')
        confirm_enrolment(student)
        confirm_enrolment(student)
        assert ClassAssignment.objects.filter(student=student).count() == 1
