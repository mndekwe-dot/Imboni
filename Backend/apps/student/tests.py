import pytest
from datetime import date, timedelta
from rest_framework import status

from apps.authentication.factories import (
    UserFactory, StudentFactory, SubjectFactory, AcademicTermFactory,
)
from apps.student.models import Activity, ActivityEnrollment, Assignment


@pytest.mark.django_db
class TestStudentProfileView:
    def test_requires_authentication(self, api_client):
        response = api_client.get('/imboni/student/profile/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_non_student_role_forbidden(self, make_authenticated_client):
        client, _user = make_authenticated_client('teacher')
        response = client.get('/imboni/student/profile/')
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_student_without_profile_currently_errors(self, make_authenticated_client):
        # Was a 500 on every call: StudentProfileView.get() imported
        # apps.attendance.models.Attendance, which doesn't exist (only
        # AttendanceRecord/AttendanceSummary/TeacherAttendanceRecord do).
        # Fixed to use AttendanceRecord, scoped by the term's date range.
        client, _user = make_authenticated_client('student')
        response = client.get('/imboni/student/profile/')
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_student_sees_own_profile(self, api_client):
        student = StudentFactory(student_id='STU00100', grade='3', section='B')
        api_client.force_authenticate(student.user)

        response = api_client.get('/imboni/student/profile/')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['student_code'] == 'STU00100'
        assert response.data['grade'] == '3'
        assert response.data['section'] == 'B'


@pytest.mark.django_db
class TestStudentDashboardView:
    def test_requires_student_role(self, make_authenticated_client):
        client, _user = make_authenticated_client('parent')
        response = client.get('/imboni/student/dashboard/')
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_student_without_profile_gets_404(self, make_authenticated_client):
        client, _user = make_authenticated_client('student')
        response = client.get('/imboni/student/dashboard/')
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_returns_own_dashboard_data(self, api_client):
        student = StudentFactory()
        api_client.force_authenticate(student.user)

        response = api_client.get('/imboni/student/dashboard/')

        assert response.status_code == status.HTTP_200_OK
        assert 'stats' in response.data
        assert 'today_schedule' in response.data
        assert 'upcoming_assignments' in response.data
        assert 'recent_grades' in response.data


@pytest.mark.django_db
class TestStudentResultsView:
    def test_requires_student_role(self, make_authenticated_client):
        client, _user = make_authenticated_client('dos')
        response = client.get('/imboni/student/results/')
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_results_view_shows_own_approved_results_only(self, api_client):
        # Was a 500 on any approved Result: the serialization loop referenced
        # r.quiz_average/r.group_work, fields that don't exist on Result (it
        # has class_test_marks/class_test_maximum instead). Fixed, and now
        # data isolation can actually be exercised: "other"'s result must
        # never appear in "me"'s response.
        from apps.results.models import Result

        term = AcademicTermFactory(is_current=True)
        subject = SubjectFactory()

        me = StudentFactory()
        other = StudentFactory()

        Result.objects.create(
            student=me, subject=subject, term=term,
            exam_score=80, final_score=85, grade='B', status='approved',
        )
        Result.objects.create(
            student=other, subject=subject, term=term,
            exam_score=10, final_score=15, grade='F', status='approved',
        )

        api_client.force_authenticate(me.user)
        response = api_client.get('/imboni/student/results/')

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        subjects = response.data[0]['subjects']
        assert len(subjects) == 1
        assert subjects[0]['final_score'] == 85.0
        assert subjects[0]['grade'] == 'B'

    def test_only_approved_results_are_shown(self, api_client):
        from apps.results.models import Result

        term = AcademicTermFactory(is_current=True)
        subject = SubjectFactory()
        me = StudentFactory()

        Result.objects.create(
            student=me, subject=subject, term=term,
            exam_score=80, final_score=85, grade='B', status='draft',
        )

        api_client.force_authenticate(me.user)
        response = api_client.get('/imboni/student/results/')

        assert response.status_code == status.HTTP_200_OK
        assert response.data == []


@pytest.mark.django_db
class TestStudentAttendanceStatsView:
    def test_requires_student_role(self, make_authenticated_client):
        client, _user = make_authenticated_client('matron')
        response = client.get('/imboni/student/attendance/stats/')
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_only_aggregates_own_attendance(self, api_client):
        from apps.attendance.models import AttendanceSummary

        me = StudentFactory()
        other = StudentFactory()

        AttendanceSummary.objects.create(
            student=me, month=1, year=2026,
            total_days=20, present_days=18, absent_days=2,
        )
        AttendanceSummary.objects.create(
            student=other, month=1, year=2026,
            total_days=20, present_days=2, absent_days=18,
        )

        api_client.force_authenticate(me.user)
        response = api_client.get('/imboni/student/attendance/stats/')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['days_present'] == 18
        assert response.data['days_absent'] == 2
        assert response.data['overall_rate'] == 90.0


@pytest.mark.django_db
class TestStudentAttendanceCalendarView:
    def test_only_returns_own_attendance_records(self, api_client):
        from apps.attendance.models import AttendanceRecord

        me = StudentFactory()
        other = StudentFactory()
        today = date.today()

        AttendanceRecord.objects.create(student=me, date=today, status='present')
        AttendanceRecord.objects.create(student=other, date=today, status='absent')

        api_client.force_authenticate(me.user)
        response = api_client.get(
            f'/imboni/student/attendance/calendar/?month={today.month}&year={today.year}'
        )

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['records']) == 1
        assert response.data['records'][0]['status'] == 'present'


@pytest.mark.django_db
class TestStudentActivitiesView:
    def test_requires_student_role(self, make_authenticated_client):
        client, _user = make_authenticated_client('discipline')
        response = client.get('/imboni/student/activities/')
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_enrolled_and_available_split(self, api_client):
        student = StudentFactory()
        activity1 = Activity.objects.create(name='Chess Club', category='other', max_members=10)
        activity2 = Activity.objects.create(name='Drama', category='art', max_members=10)
        ActivityEnrollment.objects.create(activity=activity1, student=student, status='active')

        api_client.force_authenticate(student.user)
        response = api_client.get('/imboni/student/activities/')

        assert response.status_code == status.HTTP_200_OK
        enrolled_names = [a['name'] for a in response.data['enrolled']]
        available_names = [a['name'] for a in response.data['available']]
        assert 'Chess Club' in enrolled_names
        assert 'Drama' in available_names
        assert 'Drama' not in enrolled_names


@pytest.mark.django_db
class TestStudentActivityApplyView:
    def test_apply_creates_enrollment(self, api_client):
        student = StudentFactory()
        activity = Activity.objects.create(name='Robotics', category='science', max_members=5)

        api_client.force_authenticate(student.user)
        response = api_client.post(f'/imboni/student/activities/{activity.id}/apply/')

        assert response.status_code == status.HTTP_201_CREATED
        assert ActivityEnrollment.objects.filter(activity=activity, student=student).exists()

    def test_apply_rejects_when_full(self, api_client):
        student = StudentFactory()
        activity = Activity.objects.create(name='Robotics', category='science', max_members=1)
        filler = StudentFactory()
        ActivityEnrollment.objects.create(activity=activity, student=filler, status='active')

        api_client.force_authenticate(student.user)
        response = api_client.post(f'/imboni/student/activities/{activity.id}/apply/')

        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestStudentAssignmentSubmitView:
    def test_cannot_submit_twice(self, api_client):
        from apps.teacher.models import Class
        from apps.student.models import AssignmentSubmission

        term = AcademicTermFactory(is_current=True)
        subject = SubjectFactory()
        teacher = UserFactory(role='teacher')
        class_obj = Class.objects.create(name='S4A', grade='4', section='A')
        student = StudentFactory()

        assignment = Assignment.objects.create(
            title='Essay', subject=subject, class_obj=class_obj,
            teacher=teacher, term=term, due_date=date.today() + timedelta(days=7),
        )

        api_client.force_authenticate(student.user)
        first = api_client.post(f'/imboni/student/assignments/{assignment.id}/submit/', {'notes': 'done'})
        assert first.status_code == status.HTTP_201_CREATED

        second = api_client.post(f'/imboni/student/assignments/{assignment.id}/submit/', {'notes': 'done again'})
        assert second.status_code == status.HTTP_400_BAD_REQUEST
        assert AssignmentSubmission.objects.filter(assignment=assignment, student=student).count() == 1
