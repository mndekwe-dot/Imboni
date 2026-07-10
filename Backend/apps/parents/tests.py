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


@pytest.mark.django_db
class TestConsentRequests:
    def _link(self, parent, student):
        from apps.parents.models import ParentStudentRelationship
        return ParentStudentRelationship.objects.create(
            parent=parent, student=student, relationship_type='mother',
        )

    def test_staff_create_notifies_targeted_parents_only(self, make_authenticated_client):
        from apps.authentication.factories import UserFactory, StudentFactory
        from apps.notifications.models import Notification

        client, _dis = make_authenticated_client('discipline')
        parent_s2 = UserFactory(role='parent')
        parent_s4 = UserFactory(role='parent')
        self._link(parent_s2, StudentFactory(grade='2'))
        self._link(parent_s4, StudentFactory(grade='4'))

        response = client.post('/imboni/consent-requests/', {
            'title': 'Museum Trip',
            'description': 'S2 trip to the Ethnographic Museum.',
            'event_date': '2026-08-01',
            'grade': '2',
        }, format='json')

        assert response.status_code == 201
        assert response.data['parents_notified'] == 1
        assert Notification.objects.filter(user=parent_s2).count() == 1
        assert Notification.objects.filter(user=parent_s4).count() == 0

    def test_parent_sees_requests_for_their_children_and_responds(self, make_authenticated_client):
        from apps.authentication.factories import UserFactory, StudentFactory
        from apps.parents.models import ConsentRequest, ConsentResponse

        client, parent = make_authenticated_client('parent')
        child = StudentFactory(grade='2')
        self._link(parent, child)
        req = ConsentRequest.objects.create(
            title='Museum Trip', description='...', event_date='2026-08-01', grade='2',
        )
        # A request for another grade must not appear
        ConsentRequest.objects.create(
            title='S6 Career Day', description='...', event_date='2026-08-02', grade='6',
        )

        listing = client.get('/imboni/parents/consent-requests/')
        assert listing.status_code == 200
        assert len(listing.data) == 1
        assert listing.data[0]['children'][0]['status'] is None

        respond = client.post(f'/imboni/parents/consent-requests/{req.id}/respond/', {
            'student_id': str(child.id), 'status': 'approved',
        }, format='json')
        assert respond.status_code == 200
        assert ConsentResponse.objects.get(request=req, student=child).status == 'approved'

        # Response now reflected in the listing
        listing = client.get('/imboni/parents/consent-requests/')
        assert listing.data[0]['children'][0]['status'] == 'approved'

    def test_parent_cannot_respond_for_someone_elses_child(self, make_authenticated_client):
        from apps.authentication.factories import StudentFactory
        from apps.parents.models import ConsentRequest

        client, _parent = make_authenticated_client('parent')
        other_child = StudentFactory(grade='2')
        req = ConsentRequest.objects.create(
            title='Trip', description='...', event_date='2026-08-01',
        )

        response = client.post(f'/imboni/parents/consent-requests/{req.id}/respond/', {
            'student_id': str(other_child.id), 'status': 'approved',
        }, format='json')

        assert response.status_code == 403

    def test_staff_listing_shows_tallies(self, make_authenticated_client):
        from apps.authentication.factories import UserFactory, StudentFactory
        from apps.parents.models import ConsentRequest, ConsentResponse

        client, _dis = make_authenticated_client('discipline')
        parent = UserFactory(role='parent')
        child = StudentFactory(grade='2')
        self._link(parent, child)
        req = ConsentRequest.objects.create(
            title='Trip', description='...', event_date='2026-08-01',
        )
        ConsentResponse.objects.create(request=req, student=child, parent=parent, status='approved')

        listing = client.get('/imboni/consent-requests/')
        assert listing.data[0]['approved'] == 1
        assert listing.data[0]['declined'] == 0


@pytest.mark.django_db
class TestWeeklyDigestCommand:
    def test_digest_sent_only_to_parents_with_activity(self):
        import datetime
        from io import StringIO
        from django.core.management import call_command
        from apps.authentication.factories import UserFactory, StudentFactory
        from apps.parents.models import ParentStudentRelationship
        from apps.attendance.models import AttendanceRecord
        from apps.notifications.models import Notification

        active_parent = UserFactory(role='parent')
        active_child = StudentFactory()
        ParentStudentRelationship.objects.create(
            parent=active_parent, student=active_child, relationship_type='mother')
        AttendanceRecord.objects.create(
            student=active_child, date=datetime.date.today(), status='absent')

        quiet_parent = UserFactory(role='parent')
        quiet_child = StudentFactory()
        ParentStudentRelationship.objects.create(
            parent=quiet_parent, student=quiet_child, relationship_type='father')

        out = StringIO()
        call_command('send_weekly_digest', '--no-email', stdout=out)

        assert Notification.objects.filter(user=active_parent, title='Your weekly summary').count() == 1
        assert Notification.objects.filter(user=quiet_parent).count() == 0
        assert '1 digest(s) sent' in out.getvalue()

    def test_dry_run_sends_nothing(self):
        import datetime
        from io import StringIO
        from django.core.management import call_command
        from apps.authentication.factories import UserFactory, StudentFactory
        from apps.parents.models import ParentStudentRelationship
        from apps.attendance.models import AttendanceRecord
        from apps.notifications.models import Notification

        parent = UserFactory(role='parent')
        child = StudentFactory()
        ParentStudentRelationship.objects.create(parent=parent, student=child, relationship_type='mother')
        AttendanceRecord.objects.create(student=child, date=datetime.date.today(), status='late')

        out = StringIO()
        call_command('send_weekly_digest', '--dry-run', stdout=out)

        assert Notification.objects.count() == 0
        assert 'would send to' in out.getvalue()
