import pytest
from rest_framework import status
from apps.authentication.factories import (
    UserFactory, StudentFactory, SubjectFactory, AcademicTermFactory,
)
from apps.notifications.models import Notification
from .models import Result


def make_draft_result(teacher, student=None, subject=None, term=None, **kwargs):
    student = student or StudentFactory()
    subject = subject or SubjectFactory()
    term = term or AcademicTermFactory()
    defaults = {
        'student': student,
        'subject': subject,
        'term': term,
        'teacher': teacher,
        'exam_score': 50,
        'final_score': 50,
        'grade': 'F',
        'status': 'draft',
    }
    defaults.update(kwargs)
    return Result.objects.create(**defaults)


@pytest.mark.django_db
class TestResultCreateUpdateView:
    def test_teacher_can_create_result(self, make_authenticated_client):
        client, teacher = make_authenticated_client('teacher')
        student = StudentFactory()
        subject = SubjectFactory()
        term = AcademicTermFactory()

        response = client.post('/imboni/results/', {
            'student': str(student.id),
            'subject': str(subject.id),
            'term': str(term.id),
            'exam_score': '65.00',
        })

        assert response.status_code == status.HTTP_201_CREATED
        assert Result.objects.count() == 1
        result = Result.objects.first()
        assert result.teacher == teacher
        assert result.status == 'draft'
        assert result.final_score == 65

    def test_non_teacher_cannot_create_result(self, make_authenticated_client):
        client, _user = make_authenticated_client('dos')
        student = StudentFactory()
        subject = SubjectFactory()
        term = AcademicTermFactory()

        response = client.post('/imboni/results/', {
            'student': str(student.id),
            'subject': str(subject.id),
            'term': str(term.id),
            'exam_score': '65.00',
        })

        assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
class TestResultSubmitView:
    def test_submit_draft_result_succeeds(self, make_authenticated_client):
        client, teacher = make_authenticated_client('teacher')
        result = make_draft_result(teacher)

        response = client.post(f'/imboni/results/{result.id}/submit/')

        assert response.status_code == status.HTTP_200_OK
        result.refresh_from_db()
        assert result.status == 'submitted'
        assert result.submitted_at is not None

    def test_submit_creates_notification_for_dos_users(self, make_authenticated_client):
        client, teacher = make_authenticated_client('teacher')
        dos_user = UserFactory(role='dos')
        result = make_draft_result(teacher)

        response = client.post(f'/imboni/results/{result.id}/submit/')

        assert response.status_code == status.HTTP_200_OK
        notifications = Notification.objects.filter(user=dos_user, type='results')
        assert notifications.count() == 1
        notification = notifications.first()
        assert result.student.full_name in notification.message
        assert result.subject.name in notification.message

    def test_cannot_submit_already_submitted_result(self, make_authenticated_client):
        client, teacher = make_authenticated_client('teacher')
        result = make_draft_result(teacher, status='submitted')

        response = client.post(f'/imboni/results/{result.id}/submit/')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        result.refresh_from_db()
        assert result.status == 'submitted'

    def test_cannot_submit_already_approved_result(self, make_authenticated_client):
        client, teacher = make_authenticated_client('teacher')
        result = make_draft_result(teacher, status='approved')

        response = client.post(f'/imboni/results/{result.id}/submit/')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        result.refresh_from_db()
        assert result.status == 'approved'

    def test_can_resubmit_rejected_result(self, make_authenticated_client):
        client, teacher = make_authenticated_client('teacher')
        result = make_draft_result(teacher, status='rejected')

        response = client.post(f'/imboni/results/{result.id}/submit/')

        assert response.status_code == status.HTTP_200_OK
        result.refresh_from_db()
        assert result.status == 'submitted'

    def test_teacher_cannot_submit_another_teachers_result(self, make_authenticated_client):
        owner_teacher = UserFactory(role='teacher')
        result = make_draft_result(owner_teacher)
        client, _other_teacher = make_authenticated_client('teacher')

        response = client.post(f'/imboni/results/{result.id}/submit/')

        assert response.status_code == status.HTTP_403_FORBIDDEN
        result.refresh_from_db()
        assert result.status == 'draft'

    def test_submit_nonexistent_result_returns_404(self, make_authenticated_client):
        client, _teacher = make_authenticated_client('teacher')
        import uuid
        response = client.post(f'/imboni/results/{uuid.uuid4()}/submit/')
        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
class TestResultBulkSubmitView:
    def test_bulk_submit_only_own_draft_results(self, make_authenticated_client):
        client, teacher = make_authenticated_client('teacher')
        other_teacher = UserFactory(role='teacher')

        mine_draft = make_draft_result(teacher)
        mine_approved = make_draft_result(teacher, status='approved')
        not_mine = make_draft_result(other_teacher)

        response = client.post('/imboni/results/bulk-submit/', {
            'ids': [str(mine_draft.id), str(mine_approved.id), str(not_mine.id)],
        }, format='json')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['submitted'] == 1
        mine_draft.refresh_from_db()
        mine_approved.refresh_from_db()
        not_mine.refresh_from_db()
        assert mine_draft.status == 'submitted'
        assert mine_approved.status == 'approved'
        assert not_mine.status == 'draft'

    def test_bulk_submit_no_ids_returns_400(self, make_authenticated_client):
        client, _teacher = make_authenticated_client('teacher')
        response = client.post('/imboni/results/bulk-submit/', {'ids': []})
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestStudentResultListView:
    def test_filters_by_term(self, make_authenticated_client):
        client, _user = make_authenticated_client('dos')
        student = StudentFactory()
        subject = SubjectFactory()
        term1 = AcademicTermFactory(term='term1', year=2024)
        term2 = AcademicTermFactory(term='term2', year=2024)
        Result.objects.create(
            student=student, subject=subject, term=term1,
            exam_score=70, final_score=70, grade='C', status='draft',
        )
        Result.objects.create(
            student=student, subject=subject, term=term2,
            exam_score=80, final_score=80, grade='B', status='draft',
        )

        response = client.get(f'/imboni/results/students/{student.id}/summative/?term_id={term1.id}')

        assert response.status_code == status.HTTP_200_OK
        results = response.data['results'] if isinstance(response.data, dict) else response.data
        assert len(results) == 1
        assert results[0]['final_score'] == 70


@pytest.mark.django_db
class TestAcademicTermViews:
    def test_list_terms_requires_authentication(self, api_client):
        response = api_client.get('/imboni/results/terms/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_current_term_returns_active_term(self, make_authenticated_client):
        client, _user = make_authenticated_client('teacher')
        AcademicTermFactory(term='term1', year=2024, is_current=False)
        current = AcademicTermFactory(term='term2', year=2024, is_current=True)

        response = client.get('/imboni/results/terms/current/')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['id'] == str(current.id)

    def test_current_term_returns_404_when_none_active(self, make_authenticated_client):
        client, _user = make_authenticated_client('teacher')
        AcademicTermFactory(term='term1', year=2024, is_current=False)

        response = client.get('/imboni/results/terms/current/')

        assert response.status_code == status.HTTP_404_NOT_FOUND
