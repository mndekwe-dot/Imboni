"""
The marks-progress grid and the reminder.

Run with:
    python -m pytest apps/dos/test_marks_progress.py -q
"""
import datetime
import itertools

import pytest
from django.core.cache import cache
from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.authentication.factories import StudentFactory, UserFactory
from apps.notifications.models import Notification
from apps.results.models import AcademicTerm, Result, Subject
from apps.teacher.models import Class, ClassAssignment, SubjectTeacherAssignment

PROGRESS = '/imboni/dos/results/progress/'
REMIND = '/imboni/dos/results/remind/'
_n = itertools.count(1)


@pytest.fixture(autouse=True)
def _fresh_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def term(db):
    return AcademicTerm.objects.create(
        name='Term 1 2025', term='term1', year=2025,
        start_date=datetime.date(2025, 1, 1), end_date=datetime.date(2025, 4, 1), is_current=True)


def make_class(term, size=3, name=None):
    k = next(_n)
    c = Class.objects.create(name=name or f'S{k}A', grade=f'S{k}', section='A')
    students = []
    for _ in range(size):
        s = StudentFactory(grade=c.grade, section='A')
        ClassAssignment.objects.create(class_obj=c, student=s, term=term)
        students.append(s)
    return c, students


def teach(term, klass, name):
    """A teacher assigned to teach a new subject in the class."""
    k = next(_n)
    teacher = UserFactory(role='teacher', first_name=name, last_name='Teacher')
    subject = Subject.objects.create(name=name, code=f'SUBJ{k}')
    SubjectTeacherAssignment.objects.create(teacher=teacher, subject=subject, class_obj=klass, term=term)
    return teacher, subject


def mark(student, subject, term, status, teacher=None, score=60):
    return Result.objects.create(student=student, subject=subject, term=term, teacher=teacher,
                                 exam_score=score, final_score=score, grade='C', status=status)


def cell(data, klass, subject):
    return next(c for c in data['cells'] if c['class_id'] == str(klass.id) and c['subject_id'] == str(subject.id))


@pytest.mark.django_db
class TestProgressGrid:
    def _get(self, client):
        res = client.get(PROGRESS)
        assert res.status_code == 200
        return res.data

    def test_each_cell_says_how_far_that_teacher_has_got(self, make_authenticated_client, term):
        client, _ = make_authenticated_client('dos')
        klass, kids = make_class(term, 3)
        t_done, maths = teach(term, klass, 'Maths')
        t_part, english = teach(term, klass, 'English')
        t_none, science = teach(term, klass, 'Science')
        t_wait, history = teach(term, klass, 'History')

        for s in kids:
            mark(s, maths, term, 'approved', t_done)
            mark(s, history, term, 'submitted', t_wait)
        mark(kids[0], english, term, 'submitted', t_part)
        mark(kids[1], english, term, 'submitted', t_part)            # 2 of 3

        data = self._get(client)
        assert cell(data, klass, maths)['state'] == 'approved'
        assert cell(data, klass, history)['state'] == 'submitted'    # all in, waiting for approval
        assert cell(data, klass, english)['state'] == 'partial'
        assert cell(data, klass, science)['state'] == 'missing'
        assert data['summary'] == {'approved': 1, 'submitted': 1, 'partial': 1, 'missing': 1, 'empty': 0}

    def test_drafts_are_entered_but_not_handed_in(self, make_authenticated_client, term):
        client, _ = make_authenticated_client('dos')
        klass, kids = make_class(term, 2)
        teacher, subject = teach(term, klass, 'Maths')
        for s in kids:
            mark(s, subject, term, 'draft', teacher)
        c = cell(self._get(client), klass, subject)
        assert c['entered'] == 2 and c['state'] == 'partial'

    def test_a_rejected_mark_sends_the_cell_back_to_the_teacher(self, make_authenticated_client, term):
        client, _ = make_authenticated_client('dos')
        klass, kids = make_class(term, 2)
        teacher, subject = teach(term, klass, 'Maths')
        mark(kids[0], subject, term, 'approved', teacher)
        mark(kids[1], subject, term, 'rejected', teacher)
        assert cell(self._get(client), klass, subject)['state'] == 'partial'

    def test_classes_do_not_borrow_each_others_marks(self, make_authenticated_client, term):
        client, _ = make_authenticated_client('dos')
        a, kids_a = make_class(term, 2)
        b, _kids_b = make_class(term, 2)
        ta, subj = teach(term, a, 'Maths')
        SubjectTeacherAssignment.objects.create(teacher=ta, subject=subj, class_obj=b, term=term)
        for s in kids_a:
            mark(s, subj, term, 'approved', ta)
        data = self._get(client)
        assert cell(data, a, subj)['state'] == 'approved'
        assert cell(data, b, subj)['state'] == 'missing'

    def test_only_this_terms_marks_count(self, make_authenticated_client, term):
        client, _ = make_authenticated_client('dos')
        klass, kids = make_class(term, 1)
        teacher, subject = teach(term, klass, 'Maths')
        old = AcademicTerm.objects.create(
            name='Term 3 2024', term='term3', year=2024,
            start_date=datetime.date(2024, 9, 1), end_date=datetime.date(2024, 12, 1), is_current=False)
        mark(kids[0], subject, old, 'approved', teacher)
        assert cell(self._get(client), klass, subject)['state'] == 'missing'

    def test_the_cell_names_the_teacher_and_counts(self, make_authenticated_client, term):
        client, _ = make_authenticated_client('dos')
        klass, kids = make_class(term, 4)
        teacher, subject = teach(term, klass, 'Maths')
        mark(kids[0], subject, term, 'approved', teacher)
        mark(kids[1], subject, term, 'submitted', teacher)
        c = cell(self._get(client), klass, subject)
        assert c['teacher_name'] == 'Maths Teacher'
        assert (c['total'], c['entered'], c['submitted'], c['approved']) == (4, 2, 1, 1)

    def test_the_grid_lists_its_classes_and_subjects(self, make_authenticated_client, term):
        client, _ = make_authenticated_client('dos')
        klass, _kids = make_class(term, 1, name='S1A')
        _t, subject = teach(term, klass, 'Maths')
        data = self._get(client)
        assert [c['name'] for c in data['classes']] == ['S1A']
        assert [s['name'] for s in data['subjects']] == ['Maths']
        assert data['term']['name'] == 'Term 1 2025'

    def test_an_empty_class_is_not_reported_as_missing_work(self, make_authenticated_client, term):
        client, _ = make_authenticated_client('dos')
        klass, _kids = make_class(term, 0)
        _t, subject = teach(term, klass, 'Maths')
        assert cell(self._get(client), klass, subject)['state'] == 'empty'

    def test_no_current_term_is_a_clear_404(self, make_authenticated_client, db):
        client, _ = make_authenticated_client('dos')
        assert client.get(PROGRESS).status_code == 404

    def test_a_teacher_may_not_see_it(self, make_authenticated_client, term):
        client, _ = make_authenticated_client('teacher')
        assert client.get(PROGRESS).status_code == 403

    def test_signing_in_is_required(self, api_client, term):
        assert api_client.get(PROGRESS).status_code in (401, 403)

    def test_the_query_count_does_not_grow_with_the_school(self, make_authenticated_client, term):
        client, _ = make_authenticated_client('dos')
        k, kids = make_class(term, 3)
        t, s = teach(term, k, 'Maths')
        mark(kids[0], s, term, 'submitted', t)
        with CaptureQueriesContext(connection) as small:
            self._get(client)
        for _i in range(10):
            k2, kids2 = make_class(term, 3)
            t2, s2 = teach(term, k2, f'Sub{_i}')
            mark(kids2[0], s2, term, 'submitted', t2)
        with CaptureQueriesContext(connection) as large:
            self._get(client)
        assert len(large) == len(small), f'{len(small)} queries for 1 class, {len(large)} for 11'


@pytest.mark.django_db
class TestRemind:
    def test_reminds_teachers_with_open_marks_and_only_them(self, make_authenticated_client, term):
        client, _ = make_authenticated_client('dos')
        klass, kids = make_class(term, 2)
        late, maths = teach(term, klass, 'Maths')
        done, english = teach(term, klass, 'English')
        for s in kids:
            mark(s, english, term, 'approved', done)

        res = client.post(REMIND, {}, format='json')

        assert res.status_code == 200
        assert res.data['notified'] == 1
        assert Notification.objects.filter(user=late).count() == 1
        assert Notification.objects.filter(user=done).count() == 0

    def test_the_message_says_what_is_open(self, make_authenticated_client, term):
        client, _ = make_authenticated_client('dos')
        klass, _kids = make_class(term, 2, name='S3B')
        late, _s = teach(term, klass, 'Maths')
        client.post(REMIND, {}, format='json')
        note = Notification.objects.get(user=late)
        assert 'S3B Maths' in note.message
        assert note.path == '/teacher/results'

    def test_one_reminder_per_teacher_however_many_cells_are_open(self, make_authenticated_client, term):
        client, _ = make_authenticated_client('dos')
        klass, _kids = make_class(term, 2)
        late = UserFactory(role='teacher')
        for name in ('Maths', 'Physics', 'Biology'):
            subject = Subject.objects.create(name=name, code=f'SC{next(_n)}')
            SubjectTeacherAssignment.objects.create(teacher=late, subject=subject, class_obj=klass, term=term)
        client.post(REMIND, {}, format='json')
        assert Notification.objects.filter(user=late).count() == 1
        msg = Notification.objects.get(user=late).message
        assert all(n in msg for n in ('Maths', 'Physics', 'Biology'))

    def test_pressing_it_again_does_not_nag(self, make_authenticated_client, term):
        client, _ = make_authenticated_client('dos')
        klass, _kids = make_class(term, 2)
        late, _s = teach(term, klass, 'Maths')
        first = client.post(REMIND, {}, format='json')
        second = client.post(REMIND, {}, format='json')
        assert first.data['notified'] == 1
        assert second.data['notified'] == 0 and second.data['skipped_recent'] == 1
        assert Notification.objects.filter(user=late).count() == 1

    def test_it_can_be_narrowed_to_one_class(self, make_authenticated_client, term):
        client, _ = make_authenticated_client('dos')
        a, _ka = make_class(term, 2)
        b, _kb = make_class(term, 2)
        ta, _sa = teach(term, a, 'Maths')
        tb, _sb = teach(term, b, 'English')
        res = client.post(REMIND, {'class_id': str(a.id)}, format='json')
        assert res.data['notified'] == 1
        assert Notification.objects.filter(user=ta).count() == 1
        assert Notification.objects.filter(user=tb).count() == 0

    def test_nobody_is_bothered_when_everything_is_in(self, make_authenticated_client, term):
        client, _ = make_authenticated_client('dos')
        klass, kids = make_class(term, 1)
        t, subject = teach(term, klass, 'Maths')
        mark(kids[0], subject, term, 'approved', t)
        res = client.post(REMIND, {}, format='json')
        assert res.data == {'notified': 0, 'skipped_recent': 0, 'open': 0}
        assert Notification.objects.count() == 0

    def test_a_submitted_cell_is_not_chased(self, make_authenticated_client, term):
        """Handed in and waiting on the DOS is not the teacher's to fix."""
        client, _ = make_authenticated_client('dos')
        klass, kids = make_class(term, 1)
        t, subject = teach(term, klass, 'Maths')
        mark(kids[0], subject, term, 'submitted', t)
        assert client.post(REMIND, {}, format='json').data['notified'] == 0

    def test_a_teacher_may_not_send_reminders(self, make_authenticated_client, term):
        client, _ = make_authenticated_client('teacher')
        assert client.post(REMIND, {}, format='json').status_code == 403
