import pytest
from rest_framework import status
from apps.authentication.factories import UserFactory, StudentFactory
from apps.notifications.models import Notification
from .models import AttendanceRecord, AttendanceSummary, TeacherAttendanceRecord


@pytest.mark.django_db
class TestBulkMarkAttendanceView:
    def test_teacher_can_bulk_mark_attendance(self, make_authenticated_client):
        client, teacher = make_authenticated_client('teacher')
        student1 = StudentFactory()
        student2 = StudentFactory()

        response = client.post('/imboni/attendance/bulk-mark/', {
            'date': '2026-03-24',
            'records': [
                {'student_id': str(student1.id), 'status': 'present'},
                {'student_id': str(student2.id), 'status': 'absent'},
            ],
        }, format='json')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['created'] == 2
        assert response.data['updated'] == 0
        assert AttendanceRecord.objects.count() == 2
        record1 = AttendanceRecord.objects.get(student=student1)
        assert record1.status == 'present'
        assert record1.marked_by == teacher

    def test_bulk_mark_updates_existing_record(self, make_authenticated_client):
        client, teacher = make_authenticated_client('teacher')
        student = StudentFactory()
        AttendanceRecord.objects.create(student=student, date='2026-03-24', status='present')

        response = client.post('/imboni/attendance/bulk-mark/', {
            'date': '2026-03-24',
            'records': [{'student_id': str(student.id), 'status': 'absent'}],
        }, format='json')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['created'] == 0
        assert response.data['updated'] == 1
        record = AttendanceRecord.objects.get(student=student)
        assert record.status == 'absent'

    def test_non_teacher_non_dos_cannot_bulk_mark(self, make_authenticated_client):
        client, _user = make_authenticated_client('parent')
        student = StudentFactory()

        response = client.post('/imboni/attendance/bulk-mark/', {
            'date': '2026-03-24',
            'records': [{'student_id': str(student.id), 'status': 'present'}],
        }, format='json')

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_unauthenticated_cannot_bulk_mark(self, api_client):
        response = api_client.post('/imboni/attendance/bulk-mark/', {
            'date': '2026-03-24',
            'records': [],
        }, format='json')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_invalid_payload_returns_400(self, make_authenticated_client):
        client, _teacher = make_authenticated_client('teacher')
        response = client.post('/imboni/attendance/bulk-mark/', {
            'date': '2026-03-24',
            'records': [{'student_id': 'not-a-uuid', 'status': 'present'}],
        }, format='json')
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestMarkTeacherAttendanceView:
    def test_dos_can_mark_teacher_attendance(self, make_authenticated_client):
        client, _dos = make_authenticated_client('dos')
        teacher = UserFactory(role='teacher')

        response = client.post('/imboni/attendance/teacher/mark/', {
            'date': '2026-03-10',
            'records': [{'teacher_id': str(teacher.id), 'status': 'present'}],
        }, format='json')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['saved'] == 1
        record = TeacherAttendanceRecord.objects.get(teacher=teacher)
        assert record.status == 'present'

    def test_marking_teacher_absent_creates_dos_notification(self, make_authenticated_client):
        client, dos = make_authenticated_client('dos')
        other_dos = UserFactory(role='dos')
        teacher = UserFactory(role='teacher', first_name='Jane', last_name='Doe')

        response = client.post('/imboni/attendance/teacher/mark/', {
            'date': '2026-03-10',
            'records': [{'teacher_id': str(teacher.id), 'status': 'absent'}],
        }, format='json')

        assert response.status_code == status.HTTP_200_OK
        record = TeacherAttendanceRecord.objects.get(teacher=teacher)
        assert record.status == 'absent'

        # Notifications should be created for ALL dos users (including the actor)
        notifications = Notification.objects.filter(type='staff')
        assert notifications.count() == 2
        dos_recipients = set(notifications.values_list('user_id', flat=True))
        assert dos_recipients == {dos.id, other_dos.id}
        assert 'Jane Doe' in notifications.first().message

    def test_marking_teacher_present_does_not_create_notification(self, make_authenticated_client):
        client, _dos = make_authenticated_client('dos')
        teacher = UserFactory(role='teacher')

        response = client.post('/imboni/attendance/teacher/mark/', {
            'date': '2026-03-10',
            'records': [{'teacher_id': str(teacher.id), 'status': 'present'}],
        }, format='json')

        assert response.status_code == status.HTTP_200_OK
        assert Notification.objects.filter(type='staff').count() == 0

    def test_non_dos_cannot_mark_teacher_attendance(self, make_authenticated_client):
        client, _user = make_authenticated_client('teacher')
        teacher = UserFactory(role='teacher')

        response = client.post('/imboni/attendance/teacher/mark/', {
            'date': '2026-03-10',
            'records': [{'teacher_id': str(teacher.id), 'status': 'absent'}],
        }, format='json')

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_invalid_date_returns_400(self, make_authenticated_client):
        client, _dos = make_authenticated_client('dos')
        response = client.post('/imboni/attendance/teacher/mark/', {
            'date': 'not-a-date',
            'records': [],
        }, format='json')
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_empty_records_returns_400(self, make_authenticated_client):
        client, _dos = make_authenticated_client('dos')
        response = client.post('/imboni/attendance/teacher/mark/', {
            'date': '2026-03-10',
            'records': [],
        }, format='json')
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestClassAttendanceView:
    def test_filters_by_grade_and_section(self, make_authenticated_client):
        client, _teacher = make_authenticated_client('teacher')
        student_a = StudentFactory(grade='3', section='A')
        student_b = StudentFactory(grade='3', section='B')
        AttendanceRecord.objects.create(student=student_a, date='2026-03-24', status='present')
        AttendanceRecord.objects.create(student=student_b, date='2026-03-24', status='absent')

        response = client.get('/imboni/attendance/class/?grade=3&section=A&date=2026-03-24')

        assert response.status_code == status.HTTP_200_OK
        results = response.data['results'] if isinstance(response.data, dict) else response.data
        assert len(results) == 1
        assert results[0]['status'] == 'present'

    def test_non_teacher_non_dos_forbidden(self, make_authenticated_client):
        client, _user = make_authenticated_client('student')
        response = client.get('/imboni/attendance/class/?date=2026-03-24')
        assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
class TestStudentAttendanceStatsView:
    def test_computes_overall_rate_from_summaries(self, make_authenticated_client):
        client, _user = make_authenticated_client('dos')
        student = StudentFactory()
        AttendanceSummary.objects.create(
            student=student, month=1, year=2026,
            total_days=20, present_days=18, absent_days=2, late_days=1, excused_days=1,
        )
        AttendanceSummary.objects.create(
            student=student, month=2, year=2026,
            total_days=20, present_days=20, absent_days=0, late_days=0, excused_days=0,
        )

        response = client.get(f'/imboni/attendance/students/{student.id}/stats/')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['days_present'] == 38
        assert response.data['days_absent'] == 2
        assert response.data['excused_absences'] == 1
        assert response.data['late_arrivals'] == 1
        # 38/40 * 100 = 95.0
        assert response.data['overall_rate'] == 95.0
        assert response.data['attendance_label'] == 'Excellent attendance'

    def test_no_summaries_returns_zero_rate(self, make_authenticated_client):
        client, _user = make_authenticated_client('dos')
        student = StudentFactory()
        response = client.get(f'/imboni/attendance/students/{student.id}/stats/')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['overall_rate'] == 0
        assert response.data['days_present'] == 0

    def test_unauthenticated_request_rejected(self, api_client):
        student = StudentFactory()
        response = api_client.get(f'/imboni/attendance/students/{student.id}/stats/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
