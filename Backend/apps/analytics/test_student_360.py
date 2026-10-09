import datetime

import pytest
from django.utils import timezone

from apps.attendance.models import AttendanceRecord
from apps.authentication.factories import StudentFactory
from apps.behavior.models import BehaviorReport
from apps.results.models import AcademicTerm, Result, Subject


@pytest.fixture
def term(db):
    today = timezone.localdate()
    return AcademicTerm.objects.create(
        name='Term 2', term='term2', year=today.year, is_current=True,
        start_date=today - datetime.timedelta(days=40), end_date=today + datetime.timedelta(days=40),
    )


def url(student):
    return f'/imboni/analytics/student/{student.id}/360/'


@pytest.mark.django_db
class TestStudent360:
    def test_teachers_and_students_cannot_open_it(self, make_authenticated_client, term):
        student = StudentFactory()
        for role in ('teacher', 'student', 'parent'):
            client, _ = make_authenticated_client(role)
            assert client.get(url(student)).status_code == 403

    def test_both_offices_can_open_it(self, make_authenticated_client, term):
        student = StudentFactory()
        for role in ('dos', 'discipline'):
            client, _ = make_authenticated_client(role)
            assert client.get(url(student)).status_code == 200

    def test_puts_marks_attendance_and_demerits_side_by_side(self, make_authenticated_client, term):
        client, user = make_authenticated_client('dos')
        student = StudentFactory()
        maths = Subject.objects.create(name='Maths', code='M1')
        physics = Subject.objects.create(name='Physics', code='P1')
        for subject, score in ((maths, 80), (physics, 40)):
            Result.objects.create(student=student, subject=subject, term=term, exam_score=score, final_score=score,
                                  grade='B', status='approved')
        Result.objects.create(student=student, subject=Subject.objects.create(name='Art', code='A1'), term=term,
                              exam_score=5, final_score=5, grade='F', status='draft')   # not approved: ignored

        today = timezone.localdate()
        for offset, status_ in enumerate(['present', 'present', 'absent', 'late', 'excused']):
            AttendanceRecord.objects.create(student=student, date=today - datetime.timedelta(days=offset + 1), status=status_)

        BehaviorReport.objects.create(student=student, report_type='incident', title='Fight', description='x',
                                      date=today, reported_by=user, marks_deducted=12, status='approved')

        data = client.get(url(student)).data

        assert data['academics']['average'] == 60.0
        assert data['academics']['subjects_failing'] == 1
        assert len(data['academics']['subjects']) == 2
        # 4 counted days (excused left out): 3 attended, 1 absent.
        assert data['attendance'] == {'rate': 75.0, 'days_absent': 1, 'days_recorded': 4}
        assert data['discipline']['marks_deducted'] == 12
        assert data['discipline']['ladder_step'] == 'detention'
        assert data['discipline']['recent'][0]['title'] == 'Fight'

    def test_a_student_with_no_records_gets_empty_halves_not_an_error(self, make_authenticated_client, term):
        client, _ = make_authenticated_client('discipline')
        data = client.get(url(StudentFactory())).data
        assert data['academics']['average'] is None
        assert data['attendance']['rate'] is None
        assert data['discipline']['marks_deducted'] == 0
        assert data['exeat'] is None

    def test_unknown_student_is_404(self, make_authenticated_client, term):
        import uuid
        client, _ = make_authenticated_client('dos')
        assert client.get(f'/imboni/analytics/student/{uuid.uuid4()}/360/').status_code == 404
