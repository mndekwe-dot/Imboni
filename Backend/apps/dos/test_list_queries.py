"""
Query counts for the lists whose size grows with the school.

Same idea as test_student_list_queries.py: a count does not flake, and it is the
thing that used to grow with the roster.

  * the teachers list      one query per teacher, for their subjects
  * teacher ratings chart  one query per teacher, for their average
  * class rank             one query per CLASSMATE; the class report-card download
                           calls it once per student, so a class of 40 cost ~1,600

Run with:
    python -m pytest apps/dos/test_list_queries.py -q
"""
import datetime
import itertools

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.authentication.factories import StudentFactory, UserFactory
from apps.dos.report_views import _get_rank
from apps.results.models import AcademicTerm, Result, Subject
from apps.teacher.models import Class, ClassAssignment, SubjectTeacherAssignment


@pytest.fixture
def term(db):
    return AcademicTerm.objects.create(
        name='Term 1 2025', term='term1', year=2025,
        start_date=datetime.date(2025, 1, 1), end_date=datetime.date(2025, 4, 1),
        is_current=True,
    )


@pytest.fixture
def klass(db):
    return Class.objects.create(name='S1A', grade='S1', section='A')


_codes = itertools.count(1000)


def _subject(n=None):
    """A new subject each call; `n` only names it. Codes are unique across the run."""
    k = next(_codes)
    return Subject.objects.create(name=f'Subject {n if n is not None else k}', code=f'SUB{k}')


def _teachers(n, term, klass, start=0):
    out = []
    for i in range(start, start + n):
        t = UserFactory(role='teacher')
        SubjectTeacherAssignment.objects.create(teacher=t, subject=_subject(i), class_obj=klass, term=term)
        out.append(t)
    return out


def count(fn):
    with CaptureQueriesContext(connection) as ctx:
        result = fn()
    return len(ctx), result


@pytest.mark.django_db
class TestTeachersList:
    def _list(self, client):
        res = client.get('/imboni/dos/teachers/')
        assert res.status_code == 200
        return res.data

    def test_query_count_does_not_grow_with_the_staff(self, make_authenticated_client, term, klass):
        client, _ = make_authenticated_client('dos')
        _teachers(3, term, klass)
        small, rows_small = count(lambda: self._list(client))
        _teachers(25, term, klass, start=3)
        large, rows_large = count(lambda: self._list(client))
        assert len(rows_small) == 3 and len(rows_large) == 28
        assert large == small, f'{small} queries for 3 teachers, {large} for 28'

    def test_each_teacher_still_gets_their_own_subjects_and_class_count(self, make_authenticated_client, term, klass):
        client, _ = make_authenticated_client('dos')
        a, b = _teachers(2, term, klass)
        other = Class.objects.create(name='S2A', grade='S2', section='A')
        SubjectTeacherAssignment.objects.create(teacher=a, subject=_subject(99), class_obj=other, term=term)

        rows = {str(r['teacher_id']): r for r in self._list(client)}
        assert sorted(rows[str(a.id)]['subjects']) == ['Subject 0', 'Subject 99']
        assert rows[str(a.id)]['class_count'] == 2
        assert rows[str(b.id)]['subjects'] == ['Subject 1']
        assert rows[str(b.id)]['class_count'] == 1

    def test_a_teacher_with_nothing_assigned_is_still_listed(self, make_authenticated_client, term):
        client, _ = make_authenticated_client('dos')
        t = UserFactory(role='teacher')
        rows = self._list(client)
        row = next(r for r in rows if str(r['teacher_id']) == str(t.id))
        assert row['subjects'] == [] and row['class_count'] == 0

    def test_assignments_from_another_term_do_not_leak_in(self, make_authenticated_client, term, klass):
        client, _ = make_authenticated_client('dos')
        old = AcademicTerm.objects.create(
            name='Term 3 2024', term='term3', year=2024,
            start_date=datetime.date(2024, 9, 1), end_date=datetime.date(2024, 12, 1), is_current=False)
        t = UserFactory(role='teacher')
        SubjectTeacherAssignment.objects.create(teacher=t, subject=_subject(7), class_obj=klass, term=old)
        row = next(r for r in self._list(client) if str(r['teacher_id']) == str(t.id))
        assert row['subjects'] == []


@pytest.mark.django_db
class TestTeacherRatings:
    def _ratings(self, client):
        res = client.get('/imboni/dos/teachers/performance-ratings/')
        assert res.status_code == 200
        return {r['label']: r['teacher_count'] for r in res.data}

    def _mark(self, teacher, term, score):
        s = StudentFactory()
        Result.objects.create(student=s, subject=_subject(),
                              term=term, teacher=teacher, exam_score=score, final_score=score,
                              grade='A', status='approved')

    def test_query_count_does_not_grow_with_the_staff(self, make_authenticated_client, term):
        client, _ = make_authenticated_client('dos')
        for t in [UserFactory(role='teacher') for _ in range(3)]:
            self._mark(t, term, 90)
        small, _r = count(lambda: self._ratings(client))
        for t in [UserFactory(role='teacher') for _ in range(20)]:
            self._mark(t, term, 90)
        large, _r = count(lambda: self._ratings(client))
        assert large == small, f'{small} queries for 3 teachers, {large} for 23'

    def test_teachers_land_in_the_right_bands(self, make_authenticated_client, term):
        client, _ = make_authenticated_client('dos')
        for score in (95, 88, 75, 60, 30):
            self._mark(UserFactory(role='teacher'), term, score)
        UserFactory(role='teacher')                       # no marks: not counted at all
        assert self._ratings(client) == {
            'Excellent': 2, 'Good': 1, 'Average': 1, 'Needs Improvement': 1,
        }

    def test_an_inactive_teacher_is_not_counted(self, make_authenticated_client, term):
        client, _ = make_authenticated_client('dos')
        gone = UserFactory(role='teacher', is_active=False)
        self._mark(gone, term, 95)
        assert sum(self._ratings(client).values()) == 0


@pytest.mark.django_db
class TestClassRank:
    def _class_of(self, scores, term, klass):
        students = []
        for score in scores:
            s = StudentFactory(grade='S1', section='A')
            ClassAssignment.objects.create(class_obj=klass, student=s, term=term)
            if score is not None:
                Result.objects.create(student=s, subject=_subject(), term=term,
                                      exam_score=score, final_score=score, grade='B', status='approved')
            students.append(s)
        return students

    def test_ranks_by_total_marks(self, term, klass):
        a, b, c = self._class_of([50, 90, 70], term, klass)
        assert _get_rank(b, term) == (1, 3)
        assert _get_rank(c, term) == (2, 3)
        assert _get_rank(a, term) == (3, 3)

    def test_a_classmate_with_no_marks_still_counts_in_the_class_size(self, term, klass):
        a, nothing = self._class_of([80, None], term, klass)
        assert _get_rank(a, term) == (1, 2)
        assert _get_rank(nothing, term) == (2, 2)

    def test_only_approved_marks_count(self, term, klass):
        a, b = self._class_of([60, 60], term, klass)
        Result.objects.filter(student=b).update(status='submitted', final_score=100)
        assert _get_rank(a, term)[0] == 1

    def test_a_student_in_no_class_has_no_rank(self, term, klass):
        loner = StudentFactory()
        assert _get_rank(loner, term) == (None, None)

    def test_query_count_does_not_grow_with_the_class(self, term, klass):
        small_class = self._class_of([10, 20, 30], term, klass)
        small, _r = count(lambda: _get_rank(small_class[0], term))

        big = Class.objects.create(name='S1B', grade='S1', section='B')
        big_class = self._class_of(list(range(5, 45)), term, big)       # 40 pupils
        large, _r = count(lambda: _get_rank(big_class[0], term))

        assert large == small, f'{small} queries for a class of 3, {large} for a class of 40'
        assert large <= 4
