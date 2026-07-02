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

        StudentFactory(student_id='STU00111', grade='1')
        StudentFactory(student_id='STU00222', grade='2')

        response = client.get('/imboni/discipline/students/?grade=1')

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

        StudentFactory(student_id='STU00401', grade='5', section='A')
        StudentFactory(student_id='STU00402', grade='5', section='B')
        StudentFactory(student_id='STU00403', grade='6', section='A')

        response = client.get('/imboni/discipline/students/?grade=5&section=A')

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
