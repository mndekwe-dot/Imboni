"""
Tests for the endpoints that let a school describe its own structure.

The school-config PUT used to delete every section and then validate each one as
it went, so a bad section halfway down left the school with a truncated
structure and no way back. It also had no idea whether anyone was still standing
in the years it was removing.
"""
import datetime

import pytest
from rest_framework import status

from apps.dos.models import SchoolSection, SchoolSetting
from apps.results.models import AcademicTerm
from apps.teacher.models import Class

URL = '/imboni/dos/school-config/'
SETTINGS_URL = '/imboni/dos/school-settings/'

PRIMARY = [{
    'name': 'Primary',
    'years': [
        {'name': 'P1', 'streams': ['Red', 'Blue']},
        {'name': 'P2', 'streams': ['Red', 'Blue']},
    ],
}]


@pytest.mark.django_db
class TestSchoolConfigPut:
    def test_a_school_can_replace_its_structure_with_its_own(self, make_authenticated_client):
        """The whole point: a primary school describing itself."""
        client, _ = make_authenticated_client('dos')

        response = client.put(URL, PRIMARY, format='json')

        assert response.status_code == status.HTTP_200_OK
        assert SchoolSection.objects.count() == 1
        section = SchoolSection.objects.get()
        assert section.name == 'Primary'
        assert [y['name'] for y in section.years] == ['P1', 'P2']

    def test_a_malformed_section_leaves_the_existing_structure_untouched(
        self, make_authenticated_client
    ):
        """
        This is the regression that matters. The old code deleted first, so a
        payload whose second section was invalid destroyed the first one too.
        """
        client, _ = make_authenticated_client('dos')
        client.put(URL, PRIMARY, format='json')

        bad = [
            {'name': 'Lower', 'years': [{'name': 'P1'}]},
            {'name': '', 'years': [{'name': 'P2'}]},      # no name
        ]
        response = client.put(URL, bad, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert SchoolSection.objects.count() == 1
        assert SchoolSection.objects.get().name == 'Primary'

    def test_a_year_that_classes_still_use_cannot_be_removed(self, make_authenticated_client):
        client, _ = make_authenticated_client('dos')
        client.put(URL, PRIMARY, format='json')
        Class.objects.create(name='P2Red', grade='P2', section='Red')

        without_p2 = [{'name': 'Primary', 'years': [{'name': 'P1', 'streams': ['Red']}]}]
        response = client.put(URL, without_p2, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'P2' in response.data['error']
        assert SchoolSection.objects.get().years[1]['name'] == 'P2'

    def test_a_non_list_payload_is_rejected(self, make_authenticated_client):
        client, _ = make_authenticated_client('dos')
        response = client.put(URL, {'name': 'Primary'}, format='json')
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_a_duplicated_year_is_rejected(self, make_authenticated_client):
        client, _ = make_authenticated_client('dos')
        response = client.put(URL, [
            {'name': 'Lower', 'years': [{'name': 'P1'}]},
            {'name': 'Upper', 'years': [{'name': 'P1'}]},
        ], format='json')
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_a_teacher_cannot_change_the_structure(self, make_authenticated_client):
        client, _ = make_authenticated_client('teacher')
        response = client.put(URL, PRIMARY, format='json')
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_removing_an_unused_year_needs_confirming(self, make_authenticated_client):
        """
        The settings screen PUTs the whole structure, so a stray click removes a
        year as quietly as adding one creates it. Unused or not, a removal has
        to be said out loud.
        """
        client, _ = make_authenticated_client('dos')
        client.put(URL, PRIMARY, format='json')

        without_p2 = [{'name': 'Primary', 'years': [{'name': 'P1', 'streams': ['Red', 'Blue']}]}]
        response = client.put(URL, without_p2, format='json')

        assert response.status_code == status.HTTP_409_CONFLICT
        assert response.data['confirm_required'] is True
        assert response.data['removals'] == ['the year P2']
        # Nothing changed while the question was outstanding.
        assert [y['name'] for y in SchoolSection.objects.get().years] == ['P1', 'P2']

    def test_a_confirmed_removal_goes_through(self, make_authenticated_client):
        client, _ = make_authenticated_client('dos')
        client.put(URL, PRIMARY, format='json')

        without_p2 = [{'name': 'Primary', 'years': [{'name': 'P1', 'streams': ['Red', 'Blue']}]}]
        response = client.put(URL + '?confirm=1', without_p2, format='json')

        assert response.status_code == status.HTTP_200_OK
        assert [y['name'] for y in SchoolSection.objects.get().years] == ['P1']

    def test_adding_a_year_needs_no_confirmation(self, make_authenticated_client):
        """Only removals are dangerous; adding must stay a single click."""
        client, _ = make_authenticated_client('dos')
        client.put(URL, PRIMARY, format='json')

        with_p3 = [{'name': 'Primary', 'years': [
            {'name': 'P1', 'streams': ['Red', 'Blue']},
            {'name': 'P2', 'streams': ['Red', 'Blue']},
            {'name': 'P3', 'streams': ['Red']},
        ]}]
        response = client.put(URL, with_p3, format='json')

        assert response.status_code == status.HTTP_200_OK

    def test_removing_an_unused_stream_needs_confirming(self, make_authenticated_client):
        client, _ = make_authenticated_client('dos')
        client.put(URL, PRIMARY, format='json')

        no_blue = [{'name': 'Primary', 'years': [
            {'name': 'P1', 'streams': ['Red']},
            {'name': 'P2', 'streams': ['Red', 'Blue']},
        ]}]
        response = client.put(URL, no_blue, format='json')

        assert response.status_code == status.HTTP_409_CONFLICT
        assert response.data['removals'] == ['stream Blue in P1']

    def test_a_stream_that_classes_use_cannot_be_removed_even_confirmed(
        self, make_authenticated_client
    ):
        """
        The gap the year check alone left open: drop stream Red from P1 while
        keeping P1, and class P1Red is stranded. Unlike an unused removal, no
        confirmation can force this one.
        """
        client, _ = make_authenticated_client('dos')
        client.put(URL, PRIMARY, format='json')
        Class.objects.create(name='P1Red', grade='P1', section='Red')

        no_red = [{'name': 'Primary', 'years': [
            {'name': 'P1', 'streams': ['Blue']},
            {'name': 'P2', 'streams': ['Red', 'Blue']},
        ]}]
        response = client.put(URL + '?confirm=1', no_red, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'Red in P1' in response.data['error']

    def test_a_year_in_use_cannot_be_removed_even_confirmed(self, make_authenticated_client):
        client, _ = make_authenticated_client('dos')
        client.put(URL, PRIMARY, format='json')
        Class.objects.create(name='P2Red', grade='P2', section='Red')

        without_p2 = [{'name': 'Primary', 'years': [{'name': 'P1', 'streams': ['Red']}]}]
        response = client.put(URL + '?confirm=1', without_p2, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_years_in_use_reports_years_that_have_records(self, make_authenticated_client):
        """What the orphan check above is built on."""
        from apps.dos import structure

        client, _ = make_authenticated_client('dos')
        client.put(URL, PRIMARY, format='json')
        Class.objects.create(name='P2Red', grade='P2', section='Red')
        assert 'P2' in structure.years_in_use()


@pytest.mark.django_db
class TestSchoolTermsSetting:
    def test_a_school_can_define_two_semesters(self, make_authenticated_client):
        client, _ = make_authenticated_client('dos')

        response = client.patch(SETTINGS_URL, {'terms': [
            {'code': 'fall', 'label': 'Fall Semester', 'order': 1},
            {'code': 'spring', 'label': 'Spring Semester', 'order': 2},
        ]}, format='json')

        assert response.status_code == status.HTTP_200_OK
        assert [t['code'] for t in SchoolSetting.get_setting().terms] == ['fall', 'spring']

    def test_terms_sharing_a_position_are_rejected(self, make_authenticated_client):
        """`order` is what everything sorts by, so a tie is ambiguous."""
        client, _ = make_authenticated_client('dos')

        response = client.patch(SETTINGS_URL, {'terms': [
            {'code': 'fall', 'label': 'Fall', 'order': 1},
            {'code': 'spring', 'label': 'Spring', 'order': 1},
        ]}, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_a_term_without_a_code_is_rejected(self, make_authenticated_client):
        client, _ = make_authenticated_client('dos')
        response = client.patch(SETTINGS_URL, {'terms': [{'label': 'Fall', 'order': 1}]},
                                format='json')
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_a_term_the_school_has_recorded_cannot_be_dropped(self, make_authenticated_client):
        """
        Results, attendance, timetables and conduct all hang off AcademicTerm,
        so removing a term already in use would strand every record filed
        under it.
        """
        client, _ = make_authenticated_client('dos')
        AcademicTerm.objects.create(
            name='Term 2 2026', term='term2', year=2026, order=2,
            start_date=datetime.date(2026, 4, 1),
            end_date=datetime.date(2026, 7, 1), is_current=True,
        )

        response = client.patch(SETTINGS_URL, {'terms': [
            {'code': 'term1', 'label': 'Term 1', 'order': 1},
            {'code': 'term3', 'label': 'Term 3', 'order': 2},
        ]}, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'term2' in str(response.data)

    def test_a_term_in_use_can_still_be_relabelled(self, make_authenticated_client):
        """Renaming is the safe operation: the label is what reports show."""
        client, _ = make_authenticated_client('dos')
        AcademicTerm.objects.create(
            name='Term 1 2026', term='term1', year=2026, order=1,
            start_date=datetime.date(2026, 1, 1),
            end_date=datetime.date(2026, 4, 1), is_current=True,
        )

        response = client.patch(SETTINGS_URL, {'terms': [
            {'code': 'term1', 'label': 'Autumn', 'order': 1},
            {'code': 'term2', 'label': 'Spring', 'order': 2},
            {'code': 'term3', 'label': 'Summer', 'order': 3},
        ]}, format='json')

        assert response.status_code == status.HTTP_200_OK
        assert SchoolSetting.get_setting().terms[0]['label'] == 'Autumn'

    def test_an_empty_term_list_is_rejected(self, make_authenticated_client):
        """A school with no terms could not record a single result."""
        client, _ = make_authenticated_client('dos')
        response = client.patch(SETTINGS_URL, {'terms': []}, format='json')
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestTermRollover:
    """
    Rollover used to hard-code `if grade == '6': graduate else int(grade) + 1`
    and a term1/2/3 whitelist. Both are now read from the school.
    """

    def _current_term(self):
        return AcademicTerm.objects.create(
            name='Term 3 2026', term='term3', year=2026, order=3,
            start_date=datetime.date(2026, 9, 1),
            end_date=datetime.date(2026, 12, 1), is_current=True,
        )

    def _configure_primary(self, client):
        client.put(URL, [{
            'name': 'Primary',
            'years': [{'name': f'P{n}', 'streams': ['Red']} for n in range(1, 7)],
        }], format='json')

    def test_a_primary_school_promotes_p3_to_p4_and_graduates_p6(
        self, make_authenticated_client
    ):
        from apps.authentication.factories import StudentFactory

        client, _ = make_authenticated_client('admin')
        self._configure_primary(client)
        self._current_term()

        mover = StudentFactory(grade='P3', section='Red')
        leaver = StudentFactory(grade='P6', section='Red')

        response = client.post('/imboni/dos/term-rollover/', {
            'term': 'term1', 'year': 2027, 'name': 'Term 1 2027',
            'start_date': '2027-01-05', 'end_date': '2027-04-02', 'dry_run': False,
        }, format='json')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['mode'] == 'promotion'

        mover.refresh_from_db()
        leaver.refresh_from_db()
        assert mover.grade == 'P4'
        assert leaver.status == 'graduated'

    def test_a_term_the_school_does_not_run_is_rejected(self, make_authenticated_client):
        client, _ = make_authenticated_client('admin')
        self._current_term()

        response = client.post('/imboni/dos/term-rollover/', {
            'term': 'quarter4', 'year': 2027, 'name': 'Q4',
            'start_date': '2027-01-05', 'end_date': '2027-04-02',
        }, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'term1' in response.data['error']

    def test_the_new_term_records_its_position(self, make_authenticated_client):
        client, _ = make_authenticated_client('admin')
        self._current_term()

        client.post('/imboni/dos/term-rollover/', {
            'term': 'term1', 'year': 2027, 'name': 'Term 1 2027',
            'start_date': '2027-01-05', 'end_date': '2027-04-02', 'dry_run': False,
        }, format='json')

        assert AcademicTerm.objects.get(term='term1', year=2027).order == 1

    def test_a_dry_run_changes_nothing(self, make_authenticated_client):
        from apps.authentication.factories import StudentFactory

        client, _ = make_authenticated_client('admin')
        self._configure_primary(client)
        self._current_term()
        student = StudentFactory(grade='P3', section='Red')

        response = client.post('/imboni/dos/term-rollover/', {
            'term': 'term1', 'year': 2027, 'name': 'Term 1 2027',
            'start_date': '2027-01-05', 'end_date': '2027-04-02', 'dry_run': True,
        }, format='json')

        assert response.data['students_promoted'] == 1
        student.refresh_from_db()
        assert student.grade == 'P3'
        assert not AcademicTerm.objects.filter(year=2027).exists()


@pytest.mark.django_db
class TestStudentYearValidation:
    def test_enrolling_into_a_year_the_school_does_not_teach_is_rejected(
        self, make_authenticated_client
    ):
        client, _ = make_authenticated_client('dos')
        client.put(URL, PRIMARY, format='json')

        response = client.post('/imboni/dos/students/', {
            'first_name': 'Aline', 'last_name': 'Mukamana',
            'email': 'aline@example.test', 'grade': 'S3', 'section': 'A',
            'enrollment_date': '2026-01-10', 'password': 'Imboni@2026',
        }, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_enrolling_into_a_configured_year_succeeds(self, make_authenticated_client):
        """The case that was impossible: a pupil in P1."""
        client, _ = make_authenticated_client('dos')
        client.put(URL, PRIMARY, format='json')

        response = client.post('/imboni/dos/students/', {
            'first_name': 'Aline', 'last_name': 'Mukamana',
            'email': 'aline@example.test', 'grade': 'P1', 'section': 'Red',
            'enrollment_date': '2026-01-10', 'password': 'Imboni@2026',
        }, format='json')

        assert response.status_code in (status.HTTP_200_OK, status.HTTP_201_CREATED)

    def test_a_stream_from_another_year_is_rejected(self, make_authenticated_client):
        client, _ = make_authenticated_client('dos')
        client.put(URL, [
            {'name': 'O-Level', 'years': [{'name': 'S1', 'streams': ['A', 'B']}]},
            {'name': 'A-Level', 'years': [{'name': 'S4', 'streams': ['MPG']}]},
        ], format='json')

        response = client.post('/imboni/dos/students/', {
            'first_name': 'Aline', 'last_name': 'Mukamana',
            'email': 'aline@example.test', 'grade': 'S1', 'section': 'MPG',
            'enrollment_date': '2026-01-10', 'password': 'Imboni@2026',
        }, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
