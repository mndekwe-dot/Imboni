import pytest
from rest_framework import status

from apps.authentication.factories import (
    UserFactory, StudentFactory, ParentStudentRelationshipFactory, AcademicTermFactory,
)
from apps.parents.models import ParentStudentRelationship
from apps.student.models import Fee, StudentDocument
from apps.attendance.models import AttendanceRecord


@pytest.mark.django_db
class TestMyChildrenView:
    def test_requires_authentication(self, api_client):
        response = api_client.get('/imboni/parents/my-children/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_non_parent_role_forbidden(self, make_authenticated_client):
        client, _user = make_authenticated_client('student')
        response = client.get('/imboni/parents/my-children/')
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_parent_only_sees_their_own_children(self, api_client):
        parent_a = UserFactory(role='parent')
        parent_b = UserFactory(role='parent')

        child_of_a = StudentFactory(student_id='STU00001')
        child_of_b = StudentFactory(student_id='STU00002')

        ParentStudentRelationshipFactory(parent=parent_a, student=child_of_a)
        ParentStudentRelationshipFactory(parent=parent_b, student=child_of_b)

        api_client.force_authenticate(parent_a)
        response = api_client.get('/imboni/parents/my-children/')

        assert response.status_code == status.HTTP_200_OK
        codes = [c['student_code'] for c in response.data]
        assert child_of_a.student_id in codes
        assert child_of_b.student_id not in codes
        assert len(response.data) == 1


@pytest.mark.django_db
class TestStudentDashboardViewSecurity:
    """
    StudentDashboardView (GET /imboni/parents/<pk>/dashboard/) takes the student
    pk directly from the URL — must verify the requesting parent actually has a
    ParentStudentRelationship to that student before returning anything.
    """

    def test_parent_cannot_view_dashboard_of_unrelated_student(self, api_client):
        parent_a = UserFactory(role='parent')
        unrelated_child = StudentFactory()
        # parent_a has no relationship at all to unrelated_child

        api_client.force_authenticate(parent_a)
        response = api_client.get(f'/imboni/parents/{unrelated_child.id}/dashboard/')

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_parent_can_view_dashboard_of_their_own_child(self, api_client):
        parent = UserFactory(role='parent')
        child = StudentFactory()
        ParentStudentRelationshipFactory(parent=parent, student=child)

        api_client.force_authenticate(parent)
        response = api_client.get(f'/imboni/parents/{child.id}/dashboard/')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['student_id'] == child.id


@pytest.mark.django_db
class TestStudentCardViewSecurity:
    def test_parent_cannot_view_card_of_unrelated_student(self, api_client):
        parent_a = UserFactory(role='parent')
        unrelated_child = StudentFactory()

        api_client.force_authenticate(parent_a)
        response = api_client.get(f'/imboni/parents/{unrelated_child.id}/card/')

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_parent_can_view_card_of_their_own_child(self, api_client):
        parent = UserFactory(role='parent')
        child = StudentFactory()
        ParentStudentRelationshipFactory(parent=parent, student=child)

        api_client.force_authenticate(parent)
        response = api_client.get(f'/imboni/parents/{child.id}/card/')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['id'] == str(child.id)


@pytest.mark.django_db
class TestStudentFeeListViewSecurity:
    def test_parent_cannot_list_fees_of_unrelated_student(self, api_client):
        parent_a = UserFactory(role='parent')
        unrelated_child = StudentFactory()
        Fee.objects.create(
            student=unrelated_child, category='tuition', amount=500,
            due_date='2026-01-01', status='due',
        )

        api_client.force_authenticate(parent_a)
        response = api_client.get(f'/imboni/parents/{unrelated_child.id}/fees/')

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_parent_can_list_fees_of_their_own_child(self, api_client):
        parent = UserFactory(role='parent')
        child = StudentFactory()
        ParentStudentRelationshipFactory(parent=parent, student=child)
        Fee.objects.create(
            student=child, category='tuition', amount=500,
            due_date='2026-01-01', status='due',
        )

        api_client.force_authenticate(parent)
        response = api_client.get(f'/imboni/parents/{child.id}/fees/')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 1


@pytest.mark.django_db
class TestStudentDocumentListViewSecurity:
    def test_parent_cannot_list_documents_of_unrelated_student(self, api_client):
        from django.core.files.uploadedfile import SimpleUploadedFile

        parent_a = UserFactory(role='parent')
        unrelated_child = StudentFactory()
        StudentDocument.objects.create(
            student=unrelated_child,
            title='Report Card',
            document_type='report',
            file=SimpleUploadedFile('report.pdf', b'dummy-content'),
        )

        api_client.force_authenticate(parent_a)
        response = api_client.get(f'/imboni/parents/{unrelated_child.id}/documents/')

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_parent_can_list_documents_of_their_own_child(self, api_client):
        from django.core.files.uploadedfile import SimpleUploadedFile

        parent = UserFactory(role='parent')
        child = StudentFactory()
        ParentStudentRelationshipFactory(parent=parent, student=child)
        StudentDocument.objects.create(
            student=child,
            title='Report Card',
            document_type='report',
            file=SimpleUploadedFile('report.pdf', b'dummy-content'),
        )

        api_client.force_authenticate(parent)
        response = api_client.get(f'/imboni/parents/{child.id}/documents/')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 1


@pytest.mark.django_db
class TestParentDashboardStatsView:
    """
    GET /imboni/parents/dashboard/stats/?student_id=<uuid>
    Previously had three bugs: no permission_classes at all, an import of a
    model that doesn't exist (apps.parents.models.Fee — Fee actually lives in
    apps.student.models), and apps.attendance.models.Attendance (doesn't exist
    — AttendanceRecord does, and has no `term` FK so must be date-range scoped).
    """

    def test_requires_authentication(self, api_client):
        response = api_client.get('/imboni/parents/dashboard/stats/?student_id=anything')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_non_parent_role_forbidden(self, make_authenticated_client):
        client, _user = make_authenticated_client('teacher')
        response = client.get('/imboni/parents/dashboard/stats/?student_id=anything')
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_missing_student_id_rejected(self, api_client):
        parent = UserFactory(role='parent')
        api_client.force_authenticate(parent)
        response = api_client.get('/imboni/parents/dashboard/stats/')
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_parent_cannot_view_stats_of_unrelated_student(self, api_client):
        parent = UserFactory(role='parent')
        unrelated_child = StudentFactory()

        api_client.force_authenticate(parent)
        response = api_client.get(f'/imboni/parents/dashboard/stats/?student_id={unrelated_child.id}')

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_parent_sees_correct_stats_for_their_own_child(self, api_client):
        parent = UserFactory(role='parent')
        child = StudentFactory()
        ParentStudentRelationshipFactory(parent=parent, student=child)
        from datetime import date
        term = AcademicTermFactory(is_current=True, start_date=date(2024, 1, 1), end_date=date(2024, 4, 1))
        AttendanceRecord.objects.create(student=child, date=date(2024, 1, 1), status='present')
        AttendanceRecord.objects.create(student=child, date=date(2024, 1, 2), status='absent')
        Fee.objects.create(student=child, category='tuition', amount=300, due_date='2026-01-01', status='due')

        api_client.force_authenticate(parent)
        response = api_client.get(f'/imboni/parents/dashboard/stats/?student_id={child.id}')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['attendance_rate'] == 50.0
        assert response.data['fee_balance'] == 300.0


@pytest.mark.django_db
class TestLinkStudentView:
    def test_parent_can_link_a_student_by_code(self, api_client):
        parent = UserFactory(role='parent')
        student = StudentFactory(student_id='STD2024001')

        api_client.force_authenticate(parent)
        response = api_client.post('/imboni/account/family/link/', {
            'student_code': 'STD2024001',
            'relationship_type': 'mother',
            'is_primary_contact': True,
            'can_pickup': True,
        })

        assert response.status_code == status.HTTP_201_CREATED
        assert ParentStudentRelationship.objects.filter(parent=parent, student=student).exists()

    def test_cannot_link_same_student_twice(self, api_client):
        parent = UserFactory(role='parent')
        student = StudentFactory(student_id='STD2024002')
        ParentStudentRelationshipFactory(parent=parent, student=student)

        api_client.force_authenticate(parent)
        response = api_client.post('/imboni/account/family/link/', {
            'student_code': 'STD2024002',
            'relationship_type': 'father',
            'is_primary_contact': False,
            'can_pickup': True,
        })

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_unknown_student_code_rejected(self, api_client):
        parent = UserFactory(role='parent')
        api_client.force_authenticate(parent)

        response = api_client.post('/imboni/account/family/link/', {
            'student_code': 'DOES-NOT-EXIST',
            'relationship_type': 'mother',
        })

        assert response.status_code == status.HTTP_400_BAD_REQUEST
