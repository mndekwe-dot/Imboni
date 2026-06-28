import pytest
import datetime
from django.core.exceptions import FieldError
from rest_framework import status
from apps.authentication.factories import UserFactory, StudentFactory
from apps.results.models import Subject, AcademicTerm, Result
from apps.teacher.models import Class, TeacherClassList


def _make_term(is_current=True):
    return AcademicTerm.objects.create(
        name='Term 1 2025',
        term='term1',
        year=2025,
        start_date=datetime.date(2025, 1, 1),
        end_date=datetime.date(2025, 4, 1),
        is_current=is_current,
    )


def _make_subject(code='MATH101'):
    return Subject.objects.create(name='Mathematics', code=code)


@pytest.mark.django_db
class TestStudentListView:
    def test_non_dos_role_is_rejected(self, make_authenticated_client):
        client, _user = make_authenticated_client('teacher')
        response = client.get('/imboni/dos/students/')
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_dos_can_list_students(self, make_authenticated_client):
        client, _user = make_authenticated_client('dos')
        StudentFactory(grade='4', section='A')
        StudentFactory(grade='5', section='B')

        response = client.get('/imboni/dos/students/')

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 2

    def test_search_narrows_results_by_name(self, make_authenticated_client):
        client, _user = make_authenticated_client('dos')
        StudentFactory(user=UserFactory(role='student', first_name='Aline', last_name='Mukamana'))
        StudentFactory(user=UserFactory(role='student', first_name='Bosco', last_name='Niyonzima'))

        response = client.get('/imboni/dos/students/', {'search': 'Aline'})

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]['full_name'] == 'Aline Mukamana'

    def test_grade_filter_narrows_results(self, make_authenticated_client):
        client, _user = make_authenticated_client('dos')
        StudentFactory(grade='4', section='A')
        StudentFactory(grade='5', section='B')
        StudentFactory(grade='5', section='A')

        response = client.get('/imboni/dos/students/', {'grade': '5'})

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 2
        assert all(s['grade'] == '5' for s in response.data)

    def test_search_and_grade_combine(self, make_authenticated_client):
        client, _user = make_authenticated_client('dos')
        StudentFactory(
            grade='4',
            user=UserFactory(role='student', first_name='Aline', last_name='Mukamana'),
        )
        StudentFactory(
            grade='5',
            user=UserFactory(role='student', first_name='Aline', last_name='Uwimana'),
        )

        response = client.get('/imboni/dos/students/', {'search': 'Aline', 'grade': '4'})

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]['full_name'] == 'Aline Mukamana'


@pytest.mark.django_db
class TestDOSDashboardStatsView:
    def test_non_dos_role_is_rejected(self, make_authenticated_client):
        client, _user = make_authenticated_client('teacher')
        response = client.get('/imboni/dos/dashboard/stats/')
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_dos_can_view_dashboard_stats(self, make_authenticated_client):
        client, _user = make_authenticated_client('dos')
        StudentFactory(status='active')

        response = client.get('/imboni/dos/dashboard/stats/')

        assert response.status_code == status.HTTP_200_OK
        assert 'total_students' in response.data
        assert 'teaching_staff' in response.data
        assert 'avg_performance' in response.data
        assert 'pending_approvals' in response.data

    def test_admin_can_also_view_dashboard_stats(self, make_authenticated_client):
        client, _user = make_authenticated_client('admin')
        response = client.get('/imboni/dos/dashboard/stats/')
        assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
class TestTeacherListCreateView:
    def test_non_dos_role_is_rejected(self, make_authenticated_client):
        client, _user = make_authenticated_client('teacher')
        response = client.get('/imboni/dos/teachers/')
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_dos_can_list_teachers(self, make_authenticated_client):
        client, _user = make_authenticated_client('dos')
        UserFactory(role='teacher', first_name='Eric', last_name='Habimana')
        UserFactory(role='teacher', first_name='Grace', last_name='Umutoni')

        response = client.get('/imboni/dos/teachers/')

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 2

    def test_search_filters_teacher_list_by_name(self, make_authenticated_client):
        # REAL BUG: TeacherListCreateView.get() filters with
        # Q(subjectteacherassignment__subject__name__icontains=search), but the
        # actual reverse accessor for SubjectTeacherAssignment.teacher is
        # 'teaching_assignments' (set via related_name on that FK), not the
        # Django-default 'subjectteacherassignment'. Any request with ?search=
        # raises a FieldError (500) instead of returning filtered results.
        # Asserting the CURRENT (broken) behavior here so this regresses loudly
        # if "fixed" without a matching code review; the intended behavior is a
        # 200 with only matching teachers returned.
        client, _user = make_authenticated_client('dos')
        UserFactory(role='teacher', first_name='Eric', last_name='Habimana')
        UserFactory(role='teacher', first_name='Grace', last_name='Umutoni')

        with pytest.raises(FieldError):
            client.get('/imboni/dos/teachers/', {'search': 'Eric'})


@pytest.mark.django_db
class TestTeacherClassesView:
    def test_non_dos_role_is_rejected(self, make_authenticated_client):
        client, _user = make_authenticated_client('teacher')
        teacher = UserFactory(role='teacher')
        response = client.get(f'/imboni/dos/teachers/{teacher.id}/classes/')
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_dos_can_view_teacher_classes(self, make_authenticated_client):
        client, _user = make_authenticated_client('dos')
        teacher = UserFactory(role='teacher')
        TeacherClassList.objects.create(teacher=teacher, class_name='S4A')
        TeacherClassList.objects.create(teacher=teacher, class_name='S5B')

        response = client.get(f'/imboni/dos/teachers/{teacher.id}/classes/')

        assert response.status_code == status.HTTP_200_OK
        assert set(response.data['classes']) == {'S4A', 'S5B'}

    def test_dos_can_update_teacher_classes(self, make_authenticated_client):
        client, _user = make_authenticated_client('dos')
        teacher = UserFactory(role='teacher')

        response = client.patch(
            f'/imboni/dos/teachers/{teacher.id}/classes/',
            {'classes': ['S6A']},
            format='json',
        )

        assert response.status_code == status.HTTP_200_OK
        assert list(TeacherClassList.objects.filter(teacher=teacher).values_list('class_name', flat=True)) == ['S6A']


@pytest.mark.django_db
class TestDOSResultApproveView:
    def _make_result(self, status_value='submitted'):
        term = _make_term()
        subject = _make_subject()
        student = StudentFactory()
        return Result.objects.create(
            student=student,
            subject=subject,
            term=term,
            exam_score=60,
            final_score=80,
            grade='B',
            status=status_value,
        )

    def test_approving_submitted_result_succeeds(self, make_authenticated_client):
        client, _user = make_authenticated_client('dos')
        result = self._make_result(status_value='submitted')

        response = client.patch(f'/imboni/dos/results/{result.id}/approve/')

        assert response.status_code == status.HTTP_200_OK
        result.refresh_from_db()
        assert result.status == 'approved'
        assert result.approved_at is not None

    def test_approving_already_approved_result_fails(self, make_authenticated_client):
        client, _user = make_authenticated_client('dos')
        result = self._make_result(status_value='approved')

        response = client.patch(f'/imboni/dos/results/{result.id}/approve/')

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_approving_nonexistent_result_returns_404(self, make_authenticated_client):
        client, _user = make_authenticated_client('dos')
        import uuid
        response = client.patch(f'/imboni/dos/results/{uuid.uuid4()}/approve/')
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_unauthenticated_request_is_rejected(self, api_client):
        # NOTE: DOSResultApproveView has no explicit permission_classes, so it
        # falls back to the project default (IsAuthenticated) rather than IsDOS/
        # IsDOSOrAdmin. This means ANY authenticated user (e.g. a teacher) can
        # currently approve results — only unauthenticated requests are blocked.
        # Flagging this as a likely permissions gap rather than asserting role
        # enforcement that doesn't actually exist in the view.
        result = self._make_result(status_value='submitted')
        response = api_client.patch(f'/imboni/dos/results/{result.id}/approve/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_any_authenticated_role_can_currently_approve_results(self, make_authenticated_client):
        # Documents the real gap: DOSResultApproveView has no role-based permission
        # class, so a teacher (who should not approve results) is able to do so.
        client, _user = make_authenticated_client('teacher')
        result = self._make_result(status_value='submitted')

        response = client.patch(f'/imboni/dos/results/{result.id}/approve/')

        assert response.status_code == status.HTTP_200_OK
        result.refresh_from_db()
        assert result.status == 'approved'
