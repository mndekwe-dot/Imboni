import datetime

import pytest
from rest_framework import status

from apps.dos.models import ExamSchedule, Room
from apps.results.models import AcademicTerm, Subject
from apps.teacher.models import Class

URL = '/imboni/dos/exam-schedule/'


@pytest.fixture
def setup(db):
    term = AcademicTerm.objects.create(
        name='Term 1 2026', term='term1', year=2026,
        start_date=datetime.date(2026, 1, 1), end_date=datetime.date(2026, 4, 1), is_current=True,
    )
    subject = Subject.objects.create(name='Mathematics', code='MATH101')
    cls = Class.objects.create(name='S4A', grade='S4', section='A')
    return term, subject, cls


def _body(term, subject, cls, **kw):
    body = {
        'title': 'Maths', 'subject_id': str(subject.id), 'term_id': str(term.id), 'class_id': str(cls.id),
        'exam_date': '2026-03-02', 'start_time': '09:00', 'end_time': '11:00', 'venue': 'Hall',
    }
    body.update(kw)
    return body


@pytest.mark.django_db
class TestExamConflictApi:
    def test_a_clashing_paper_is_refused_until_acknowledged(self, make_authenticated_client, setup):
        client, _ = make_authenticated_client('dos')
        term, subject, cls = setup
        assert client.post(URL, _body(term, subject, cls), format='json').status_code == status.HTTP_201_CREATED

        clash = client.post(URL, _body(term, subject, cls, title='Maths again', start_time='10:00', end_time='12:00'), format='json')
        assert clash.status_code == status.HTTP_409_CONFLICT
        assert {c['type'] for c in clash.data['conflicts']} == {'class', 'venue'}
        assert ExamSchedule.objects.count() == 1

        forced = client.post(URL, _body(term, subject, cls, title='Maths again', start_time='10:00', end_time='12:00',
                                        acknowledge_conflicts=True), format='json')
        assert forced.status_code == status.HTTP_201_CREATED

    def test_the_list_flags_existing_clashes(self, make_authenticated_client, setup):
        client, _ = make_authenticated_client('dos')
        term, subject, cls = setup
        for title in ('One', 'Two'):
            ExamSchedule.objects.create(
                title=title, subject=subject, class_obj=cls, term=term, exam_date=datetime.date(2026, 3, 2),
                start_time=datetime.time(9), end_time=datetime.time(11),
            )
        rows = client.get(URL).data
        assert all(any(c['type'] == 'class' for c in r['conflicts']) for r in rows)

    def test_moving_a_paper_onto_a_taken_slot_is_refused(self, make_authenticated_client, setup):
        client, _ = make_authenticated_client('dos')
        term, subject, cls = setup
        ExamSchedule.objects.create(title='A', subject=subject, class_obj=cls, term=term,
                                    exam_date=datetime.date(2026, 3, 2), start_time=datetime.time(9), end_time=datetime.time(11))
        other = ExamSchedule.objects.create(title='B', subject=subject, class_obj=cls, term=term,
                                            exam_date=datetime.date(2026, 3, 3), start_time=datetime.time(9), end_time=datetime.time(11))

        moved = client.patch(f'{URL}{other.id}/', {'exam_date': '2026-03-02'}, format='json')

        assert moved.status_code == status.HTTP_409_CONFLICT
        other.refresh_from_db()
        assert other.exam_date == datetime.date(2026, 3, 3)

    def test_a_room_that_is_too_small_is_reported(self, make_authenticated_client, setup):
        from apps.authentication.factories import StudentFactory
        from apps.teacher.models import ClassAssignment
        client, _ = make_authenticated_client('dos')
        term, subject, cls = setup
        Room.objects.create(name='Hall', capacity=1)
        for _ in range(2):
            ClassAssignment.objects.create(student=StudentFactory(), class_obj=cls, term=term)

        refused = client.post(URL, _body(term, subject, cls), format='json')

        assert refused.status_code == status.HTTP_409_CONFLICT
        cap = next(c for c in refused.data['conflicts'] if c['type'] == 'capacity')
        assert (cap['needed'], cap['seats']) == (2, 1)
