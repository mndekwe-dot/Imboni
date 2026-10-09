"""
The DOS/Admin student list must cost the same number of queries whether the
school has 5 students or 1,500.

It used to run two extra queries PER STUDENT (their average mark and their
latest attendance month), so a school of 1,500 paid ~3,000 queries for one page
load. These tests count queries rather than time them, because a count does not
flake and it is the thing that grew with the roster.

Run with:
    python -m pytest apps/dos/test_student_list_queries.py -q
"""
import datetime

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.attendance.models import AttendanceSummary
from apps.authentication.factories import StudentFactory
from apps.results.models import AcademicTerm, Result, Subject


@pytest.fixture
def term(db):
    return AcademicTerm.objects.create(
        name='Term 1 2025', term='term1', year=2025,
        start_date=datetime.date(2025, 1, 1), end_date=datetime.date(2025, 4, 1),
        is_current=True,
    )


@pytest.fixture
def maths(db):
    return Subject.objects.create(name='Mathematics', code='MATH101')


def _students(n, term, subject):
    """n students, each with a mark and an attendance summary."""
    made = []
    for i in range(n):
        s = StudentFactory(grade='1', section='A')
        Result.objects.create(student=s, subject=subject, term=term,
                              exam_score=50, final_score=60 + i, grade='C', status='approved')
        AttendanceSummary.objects.create(student=s, month=2, year=2025, total_days=20,
                                         present_days=18, attendance_percentage=90)
        made.append(s)
    return made


def _queries_for_list(client):
    with CaptureQueriesContext(connection) as ctx:
        res = client.get('/imboni/dos/students/')
    assert res.status_code == 200
    return len(ctx), res.data


@pytest.mark.django_db
class TestStudentListQueries:
    def test_the_query_count_does_not_grow_with_the_roster(self, make_authenticated_client, term, maths):
        client, _ = make_authenticated_client('dos')

        _students(3, term, maths)
        small, rows_small = _queries_for_list(client)

        _students(20, term, maths)
        large, rows_large = _queries_for_list(client)

        assert len(rows_small) == 3 and len(rows_large) == 23
        assert large == small, (
            f'{small} queries for 3 students but {large} for 23: the list is '
            'querying once per student again.'
        )

    def test_it_is_a_small_constant(self, make_authenticated_client, term, maths):
        client, _ = make_authenticated_client('dos')
        _students(10, term, maths)
        count, _rows = _queries_for_list(client)
        # auth + term + students + marks + attendance + a little framework overhead
        assert count <= 12, f'{count} queries for a student list'

    def test_each_student_still_gets_their_own_average_and_attendance(self, make_authenticated_client, term, maths):
        """Bulk fetching must not mix students up."""
        client, _ = make_authenticated_client('dos')
        a, b = _students(2, term, maths)       # marks 60 and 61
        Result.objects.filter(student=a).update(final_score=40)
        Result.objects.filter(student=b).update(final_score=90)
        AttendanceSummary.objects.filter(student=a).update(attendance_percentage=75)
        AttendanceSummary.objects.filter(student=b).update(attendance_percentage=99)

        _count, rows = _queries_for_list(client)
        by_code = {r['student_code']: r for r in rows}

        assert by_code[a.student_id]['avg_performance'] == 40.0
        assert by_code[a.student_id]['attendance_rate'] == 75.0
        assert by_code[b.student_id]['avg_performance'] == 90.0
        assert by_code[b.student_id]['attendance_rate'] == 99.0

    def test_attendance_uses_the_latest_month(self, make_authenticated_client, term, maths):
        client, _ = make_authenticated_client('dos')
        (s,) = _students(1, term, maths)
        AttendanceSummary.objects.create(student=s, month=3, year=2025, total_days=20,
                                         present_days=10, attendance_percentage=50)
        _count, rows = _queries_for_list(client)
        assert rows[0]['attendance_rate'] == 50.0          # March, not February

    def test_a_student_with_no_marks_or_attendance_is_still_listed(self, make_authenticated_client, term):
        client, _ = make_authenticated_client('dos')
        StudentFactory(grade='1', section='A')
        _count, rows = _queries_for_list(client)
        assert rows[0]['avg_performance'] is None
        assert rows[0]['attendance_rate'] is None

    def test_works_with_no_current_term(self, make_authenticated_client, db):
        client, _ = make_authenticated_client('dos')
        StudentFactory(grade='1', section='A')
        _count, rows = _queries_for_list(client)
        assert rows[0]['avg_performance'] is None


@pytest.mark.django_db
class TestStudentListPagingAndSorting:
    """Additive: without ?page / ?page_size the response is the plain array it always was."""

    def _get(self, client, query=''):
        return client.get('/imboni/dos/students/' + query)

    def test_without_paging_parameters_it_is_still_a_plain_array(self, make_authenticated_client, term, maths):
        client, _ = make_authenticated_client('dos')
        _students(3, term, maths)
        res = self._get(client)
        assert isinstance(res.data, list) and len(res.data) == 3

    def test_a_page_comes_back_with_a_count_and_a_next_link(self, make_authenticated_client, term, maths):
        client, _ = make_authenticated_client('dos')
        _students(12, term, maths)
        res = self._get(client, '?page_size=5')
        assert res.status_code == 200
        assert res.data['count'] == 12
        assert len(res.data['results']) == 5
        assert res.data['next'] is not None and res.data['previous'] is None

    def test_pages_do_not_overlap_and_together_cover_everyone(self, make_authenticated_client, term, maths):
        client, _ = make_authenticated_client('dos')
        _students(12, term, maths)
        seen = []
        for page in (1, 2, 3):
            seen += [r['student_code'] for r in self._get(client, f'?page_size=5&page={page}').data['results']]
        assert len(seen) == 12 and len(set(seen)) == 12

    def test_a_page_costs_the_same_however_large_the_school(self, make_authenticated_client, term, maths):
        client, _ = make_authenticated_client('dos')
        _students(8, term, maths)
        with CaptureQueriesContext(connection) as small:
            self._get(client, '?page_size=5')
        _students(40, term, maths)
        with CaptureQueriesContext(connection) as large:
            self._get(client, '?page_size=5')
        assert len(large) == len(small)

    def test_page_size_is_capped(self, make_authenticated_client, term, maths):
        client, _ = make_authenticated_client('dos')
        _students(3, term, maths)
        assert self._get(client, '?page_size=100000').status_code == 200   # clamped, not an error

    def test_it_sorts_by_name_in_both_directions(self, make_authenticated_client, term):
        from apps.authentication.factories import UserFactory
        client, _ = make_authenticated_client('dos')
        for last in ('Mukamana', 'Abayo', 'Niyonzima'):
            StudentFactory(user=UserFactory(role='student', first_name='X', last_name=last), grade='1', section='A')
        asc = [r['full_name'] for r in self._get(client, '?ordering=name').data]
        desc = [r['full_name'] for r in self._get(client, '?ordering=-name').data]
        assert asc == sorted(asc, key=lambda n: n.split()[-1])
        assert desc == list(reversed(asc))

    @pytest.mark.parametrize('hostile', [
        'user__password', '-user__password', 'id;DROP TABLE student', '__class__', 'user__email', '',
    ])
    def test_an_unknown_ordering_is_ignored_not_trusted(self, make_authenticated_client, term, maths, hostile):
        """Sorting by an arbitrary column would let a caller probe it (a password
        hash, an email). Only the whitelisted names do anything."""
        client, _ = make_authenticated_client('dos')
        _students(3, term, maths)
        plain = [r['student_code'] for r in self._get(client).data]
        res = self._get(client, f'?ordering={hostile}')
        assert res.status_code == 200
        assert [r['student_code'] for r in res.data] == plain


@pytest.mark.django_db
class TestStudentListFilters:
    def test_section_filters_by_stream_in_any_case(self, make_authenticated_client, term):
        client, _ = make_authenticated_client('dos')
        for sec in ('A', 'A', 'B'):
            StudentFactory(grade='1', section=sec)
        assert len(client.get('/imboni/dos/students/?section=a').data) == 2
        assert len(client.get('/imboni/dos/students/?section=B').data) == 1
        assert len(client.get('/imboni/dos/students/?section=Z').data) == 0

    def test_filters_apply_before_paging_so_the_total_is_the_filtered_total(self, make_authenticated_client, term):
        client, _ = make_authenticated_client('dos')
        for _i in range(7):
            StudentFactory(grade='1', section='A')
        for _i in range(3):
            StudentFactory(grade='1', section='B')
        res = client.get('/imboni/dos/students/?section=A&page_size=5')
        assert res.data['count'] == 7 and len(res.data['results']) == 5

    def test_search_works_together_with_paging(self, make_authenticated_client, term):
        from apps.authentication.factories import UserFactory
        client, _ = make_authenticated_client('dos')
        for i in range(6):
            StudentFactory(user=UserFactory(role='student', first_name='Amina', last_name=f'Zed{i}'), grade='1', section='A')
        StudentFactory(user=UserFactory(role='student', first_name='Bosco', last_name='Other'), grade='1', section='A')
        res = client.get('/imboni/dos/students/?search=amina&page_size=4')
        assert res.data['count'] == 6 and len(res.data['results']) == 4
