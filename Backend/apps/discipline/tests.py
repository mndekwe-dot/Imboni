import pytest
from rest_framework import status

from apps.authentication.factories import UserFactory, StudentFactory, BoardingStudentFactory
from apps.behavior.models import BehaviorReport


@pytest.mark.django_db
class TestDisciplineStudentListView:
    def test_requires_authentication(self, api_client):
        response = api_client.get('/imboni/discipline/students/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_teacher_cannot_access(self, make_authenticated_client):
        client, _user = make_authenticated_client('teacher')
        response = client.get('/imboni/discipline/students/')
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_student_cannot_access(self, make_authenticated_client):
        client, _user = make_authenticated_client('student')
        response = client.get('/imboni/discipline/students/')
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_discipline_role_can_access(self, make_authenticated_client):
        client, _user = make_authenticated_client('discipline')
        StudentFactory(student_id='STU00010')
        response = client.get('/imboni/discipline/students/')
        assert response.status_code == status.HTTP_200_OK

    def test_search_filters_by_name_and_student_id(self, make_authenticated_client):
        client, _user = make_authenticated_client('discipline')

        target = StudentFactory(student_id='STU00777')
        target.user.first_name = 'Zendaya'
        target.user.save()
        StudentFactory(student_id='STU00888')

        response = client.get('/imboni/discipline/students/?search=Zendaya')

        assert response.status_code == status.HTTP_200_OK
        names = [s['name'] for s in response.data]
        assert any('Zendaya' in n for n in names)
        assert len(response.data) == 1

    def test_grade_filter_narrows_results(self, make_authenticated_client):
        client, _user = make_authenticated_client('discipline')

        StudentFactory(student_id='STU00111', grade='S1')
        StudentFactory(student_id='STU00222', grade='S2')

        response = client.get('/imboni/discipline/students/?grade=S1')

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]['student_id'] == 'STU00111'

    def test_section_filter_narrows_results(self, make_authenticated_client):
        client, _user = make_authenticated_client('discipline')

        StudentFactory(student_id='STU00301', section='A')
        StudentFactory(student_id='STU00302', section='B')

        response = client.get('/imboni/discipline/students/?section=B')

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]['student_id'] == 'STU00302'

    def test_combined_grade_and_section_filter(self, make_authenticated_client):
        client, _user = make_authenticated_client('discipline')

        StudentFactory(student_id='STU00401', grade='S5', section='A')
        StudentFactory(student_id='STU00402', grade='S5', section='B')
        StudentFactory(student_id='STU00403', grade='S6', section='A')

        response = client.get('/imboni/discipline/students/?grade=S5&section=A')

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]['student_id'] == 'STU00401'


@pytest.mark.django_db
class TestDisciplineReportListView:
    def test_get_requires_discipline_role(self, make_authenticated_client):
        client, _user = make_authenticated_client('matron')
        response = client.get('/imboni/discipline/reports/')
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_post_allowed_for_matron(self, make_authenticated_client):
        client, _user = make_authenticated_client('matron')
        student = StudentFactory()

        response = client.post('/imboni/discipline/reports/', {
            'student_id': str(student.id),
            'report_type': 'incident',
            'title': 'Late to class',
            'description': 'Was late.',
            'date': '2026-01-10',
        })

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['status'] == 'pending_review'

    def test_post_from_discipline_is_auto_approved(self, make_authenticated_client):
        client, _user = make_authenticated_client('discipline')
        student = StudentFactory()

        response = client.post('/imboni/discipline/reports/', {
            'student_id': str(student.id),
            'report_type': 'incident',
            'title': 'Fighting',
            'description': 'Altercation in hallway.',
            'date': '2026-01-10',
        })

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['status'] == 'approved'

    def test_post_forbidden_for_teacher(self, make_authenticated_client):
        client, _user = make_authenticated_client('teacher')
        student = StudentFactory()

        response = client.post('/imboni/discipline/reports/', {
            'student_id': str(student.id),
            'report_type': 'incident',
            'title': 'X',
            'description': 'Y',
            'date': '2026-01-10',
        })

        assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
class TestBoardingStudentListView:
    def test_requires_discipline_role(self, make_authenticated_client):
        client, _user = make_authenticated_client('student')
        response = client.get('/imboni/discipline/boarding/')
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_dormitory_filter_narrows_results(self, make_authenticated_client):
        client, _user = make_authenticated_client('discipline')

        BoardingStudentFactory(dormitory='North Wing')
        BoardingStudentFactory(dormitory='South Wing')

        response = client.get('/imboni/discipline/boarding/?dormitory=North')

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]['dormitory'] == 'North Wing'

    def test_boarding_type_filter_narrows_results(self, make_authenticated_client):
        client, _user = make_authenticated_client('discipline')

        BoardingStudentFactory(boarding_type='full_boarder')
        BoardingStudentFactory(boarding_type='day_scholar')

        response = client.get('/imboni/discipline/boarding/?type=day_scholar')

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]['boarding_type'] == 'day_scholar'

    def test_create_boarding_record(self, make_authenticated_client):
        client, _user = make_authenticated_client('discipline')
        student = StudentFactory()

        response = client.post('/imboni/discipline/boarding/', {
            'student_id': str(student.id),
            'dormitory': 'East Wing',
            'room_number': '12',
            'boarding_type': 'full_boarder',
            'check_in_date': '2026-01-05',
        })

        assert response.status_code == status.HTTP_201_CREATED

    def test_duplicate_boarding_record_rejected(self, make_authenticated_client):
        client, _user = make_authenticated_client('discipline')
        boarding = BoardingStudentFactory()

        response = client.post('/imboni/discipline/boarding/', {
            'student_id': str(boarding.student.id),
            'dormitory': 'Another Wing',
            'room_number': '99',
            'boarding_type': 'full_boarder',
            'check_in_date': '2026-01-05',
        })

        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestDiningPlanListView:
    def test_requires_discipline_role(self, make_authenticated_client):
        client, _user = make_authenticated_client('parent')
        response = client.get('/imboni/discipline/dining/')
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_type_filter_narrows_results(self, make_authenticated_client):
        from apps.authentication.factories import AcademicTermFactory
        from apps.discipline.models import DiningPlan

        client, _user = make_authenticated_client('discipline')
        term = AcademicTermFactory(is_current=True)

        s1 = StudentFactory()
        s2 = StudentFactory()
        DiningPlan.objects.create(student=s1, term=term, plan_type='full_board')
        DiningPlan.objects.create(student=s2, term=term, plan_type='half_board')

        response = client.get('/imboni/discipline/dining/?type=half_board')

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]['plan_type'] == 'half_board'


@pytest.mark.django_db
class TestDisciplineStaffListView:
    def test_requires_discipline_role(self, make_authenticated_client):
        client, _user = make_authenticated_client('teacher')
        response = client.get('/imboni/discipline/staff/')
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_discipline_role_can_list_staff(self, make_authenticated_client):
        from apps.authentication.factories import DisciplineStaffFactory

        client, _user = make_authenticated_client('discipline')
        DisciplineStaffFactory()

        response = client.get('/imboni/discipline/staff/')

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1


@pytest.mark.django_db
class TestConductReportEscalation:
    def _file_report(self, client, student, n):
        return client.post('/imboni/discipline/reports/', {
            'student_id': str(student.id),
            'report_type': 'warning',
            'title': f'Report {n}',
            'description': 'Details.',
            'date': f'2025-02-0{n}',
        }, format='json')

    def _make_current_term(self):
        import datetime
        from apps.results.models import AcademicTerm
        return AcademicTerm.objects.create(
            name='Term 1 2025', term='term1', year=2025,
            start_date=datetime.date(2025, 1, 1),
            end_date=datetime.date(2025, 4, 1),
            is_current=True,
        )

    def test_third_approved_report_escalates_to_parents_and_staff(self, make_authenticated_client):
        from apps.parents.models import ParentStudentRelationship
        from apps.notifications.models import Notification

        client, dis_user = make_authenticated_client('discipline')
        self._make_current_term()
        student = StudentFactory()
        parent = UserFactory(role='parent')
        ParentStudentRelationship.objects.create(parent=parent, student=student, relationship_type='mother')

        for n in (1, 2):
            r = self._file_report(client, student, n)
            assert r.status_code == status.HTTP_201_CREATED
        assert Notification.objects.filter(user=parent, title='Parent meeting required').count() == 0

        # Third approved report crosses the threshold
        self._file_report(client, student, 3)
        assert Notification.objects.filter(user=parent, title='Parent meeting required').count() == 1
        assert Notification.objects.filter(user=dis_user, title__startswith='Escalation:').count() == 1

        # Fourth report does not re-fire the escalation
        self._file_report(client, student, 4)
        assert Notification.objects.filter(user=parent, title='Parent meeting required').count() == 1

    def test_positive_reports_do_not_count_toward_escalation(self, make_authenticated_client):
        from apps.parents.models import ParentStudentRelationship
        from apps.notifications.models import Notification

        client, _dis = make_authenticated_client('discipline')
        self._make_current_term()
        student = StudentFactory()
        parent = UserFactory(role='parent')
        ParentStudentRelationship.objects.create(parent=parent, student=student, relationship_type='father')

        for n in (1, 2, 3):
            client.post('/imboni/discipline/reports/', {
                'student_id': str(student.id),
                'report_type': 'positive',
                'title': f'Great work {n}',
                'description': 'Details.',
                'date': f'2025-02-0{n}',
            }, format='json')

        assert Notification.objects.filter(user=parent, title='Parent meeting required').count() == 0


@pytest.mark.django_db
class TestDormitoryOccupancy:
    def test_occupancy_counts_active_boarders_per_dormitory(self, make_authenticated_client):
        from apps.discipline.models import DisFacility, BoardingStudent
        import datetime

        client, _dis = make_authenticated_client('discipline')
        # Unique names — seed data may already contain real dorms like 'Bisoke'
        DisFacility.objects.create(name='Testdorm East', facility_type='dormitory', gender='boys', capacity=3)
        DisFacility.objects.create(name='Testdorm West', facility_type='dormitory', gender='girls', capacity=2)

        for i in range(2):
            BoardingStudent.objects.create(
                student=StudentFactory(), dormitory='testdorm east',   # case-insensitive match
                room_number=str(i + 1), check_in_date=datetime.date(2025, 1, 10),
            )
        # An inactive boarder must not count
        BoardingStudent.objects.create(
            student=StudentFactory(), dormitory='Testdorm East', room_number='9',
            check_in_date=datetime.date(2025, 1, 10), is_active=False,
        )
        # A boarder in an unknown dorm is reported as unassigned
        BoardingStudent.objects.create(
            student=StudentFactory(), dormitory='Old Wing', room_number='1',
            check_in_date=datetime.date(2025, 1, 10),
        )

        response = client.get('/imboni/discipline/facilities/occupancy/')

        assert response.status_code == status.HTTP_200_OK
        east = next(d for d in response.data['dormitories'] if d['name'] == 'Testdorm East')
        assert east['occupied'] == 2
        assert east['available'] == 1
        assert east['occupancy_pct'] == 66.7
        west = next(d for d in response.data['dormitories'] if d['name'] == 'Testdorm West')
        assert west['occupied'] == 0
        assert response.data['unassigned'] == 1
        assert response.data['total_boarders'] == 3

    def test_requires_discipline_role(self, make_authenticated_client):
        client, _user = make_authenticated_client('teacher')
        response = client.get('/imboni/discipline/facilities/occupancy/')
        assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
class TestParentCommunicationsMovedToDiscipline:
    """
    Contacting a family is the Discipline Master's call.

    The log used to live at /imboni/matron/parent-comms/ behind IsMatron, which
    put the decision to phone a parent in the dormitory rather than the office.
    These pin the authority where it now belongs, and pin the old door shut.
    """

    URL = '/imboni/discipline/parent-comms/'

    def test_requires_authentication(self, api_client):
        assert api_client.get(self.URL).status_code == status.HTTP_401_UNAUTHORIZED

    def test_the_matron_may_not_read_the_log(self, make_authenticated_client):
        client, _user = make_authenticated_client('matron')
        assert client.get(self.URL).status_code == status.HTTP_403_FORBIDDEN

    def test_the_matron_may_not_log_a_call(self, make_authenticated_client):
        client, _user = make_authenticated_client('matron')
        assert client.post(self.URL, {}).status_code == status.HTTP_403_FORBIDDEN

    def test_a_teacher_may_not_either(self, make_authenticated_client):
        client, _user = make_authenticated_client('teacher')
        assert client.get(self.URL).status_code == status.HTTP_403_FORBIDDEN

    def test_the_discipline_master_reads_the_log(self, make_authenticated_client):
        client, _user = make_authenticated_client('discipline')
        response = client.get(self.URL)
        assert response.status_code == status.HTTP_200_OK
        assert 'stats' in response.data
        assert 'log' in response.data

    def test_the_discipline_master_logs_a_call(self, make_authenticated_client):
        from apps.authentication.factories import StudentFactory

        client, user = make_authenticated_client('discipline')
        student = StudentFactory()

        response = client.post(self.URL, {
            'student_id': str(student.id),
            'parent_contact': 'Mrs Uwase (mother)',
            'comm_type': 'call',
            'subject': 'Absence on Monday',
            'notes': 'Explained the absence policy.',
            'outcome': 'completed',
        })

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['parent_contact'] == 'Mrs Uwase (mother)'

    def test_an_unknown_student_is_rejected_rather_than_5xx(self, make_authenticated_client):
        import uuid
        client, _user = make_authenticated_client('discipline')
        response = client.post(self.URL, {
            'student_id': str(uuid.uuid4()),
            'parent_contact': 'Someone',
            'comm_type': 'call',
        })
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_the_old_matron_route_is_gone(self, make_authenticated_client):
        """Removed, not merely hidden from the nav: the endpoint must not answer."""
        client, _user = make_authenticated_client('matron')
        assert client.get('/imboni/matron/parent-comms/').status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
class TestDisciplineStudentSearch:
    """
    The student picker types into this endpoint.

    It used to send ?q=, which this view never read — so every search returned
    the same first page of the roll and the picker looked broken to anyone who
    typed a name that was not near the top of the alphabet.
    """

    URL = '/imboni/discipline/students/'

    def test_search_actually_narrows_the_result(self, make_authenticated_client):
        from apps.authentication.factories import StudentFactory

        client, _user = make_authenticated_client('discipline')
        wanted = StudentFactory(user__first_name='Zuberi', user__last_name='Habimana')
        StudentFactory(user__first_name='Aline', user__last_name='Mukamana')
        StudentFactory(user__first_name='Bosco', user__last_name='Niyonzima')

        response = client.get(self.URL, {'search': 'Zuberi'})

        assert response.status_code == status.HTTP_200_OK
        names = [row['name'] for row in response.data]
        assert names == [wanted.user.get_full_name()]

    def test_search_matches_a_surname(self, make_authenticated_client):
        from apps.authentication.factories import StudentFactory

        client, _user = make_authenticated_client('discipline')
        StudentFactory(user__first_name='Aline', user__last_name='Mukamana')
        StudentFactory(user__first_name='Bosco', user__last_name='Niyonzima')

        response = client.get(self.URL, {'search': 'Mukamana'})
        assert [r['name'] for r in response.data] == ['Aline Mukamana']

    def test_search_matches_a_student_id(self, make_authenticated_client):
        from apps.authentication.factories import StudentFactory

        client, _user = make_authenticated_client('discipline')
        target = StudentFactory()
        StudentFactory()

        response = client.get(self.URL, {'search': target.student_id})
        assert [r['student_id'] for r in response.data] == [target.student_id]

    def test_a_student_matching_twice_is_returned_once(self, make_authenticated_client):
        """
        The old three-queryset union could join the same row in more than once
        when a term matched both names.
        """
        from apps.authentication.factories import StudentFactory

        client, _user = make_authenticated_client('discipline')
        StudentFactory(user__first_name='Mugisha', user__last_name='Mugisha')

        response = client.get(self.URL, {'search': 'Mugisha'})
        assert len(response.data) == 1

    def test_limit_is_honoured_and_capped(self, make_authenticated_client):
        from apps.authentication.factories import StudentFactory

        client, _user = make_authenticated_client('discipline')
        for _ in range(5):
            StudentFactory()

        assert len(client.get(self.URL, {'limit': 2}).data) == 2
        # No caller may ask for more than the server's ceiling.
        assert len(client.get(self.URL, {'limit': 99999}).data) <= 200

    def test_a_junk_limit_falls_back_rather_than_500s(self, make_authenticated_client):
        client, _user = make_authenticated_client('discipline')
        assert client.get(self.URL, {'limit': 'lots'}).status_code == status.HTTP_200_OK

    def test_the_row_still_carries_conduct_and_incident_counts(self, make_authenticated_client):
        """Those two fields moved from a per-student query into an annotation."""
        from apps.authentication.factories import StudentFactory

        client, _user = make_authenticated_client('discipline')
        StudentFactory()

        row = client.get(self.URL).data[0]
        assert 'conduct_grade' in row
        assert row['incident_count'] == 0
