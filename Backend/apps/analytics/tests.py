import pytest
from rest_framework import status
from apps.authentication.factories import StudentFactory, SubjectFactory, AcademicTermFactory
from apps.results.models import Result
from apps.attendance.models import AttendanceSummary


@pytest.mark.django_db
class TestPerformanceOverviewView:
    def test_computes_school_average_and_pass_rate(self, make_authenticated_client):
        client, _user = make_authenticated_client('dos')
        term = AcademicTermFactory(is_current=True)
        subject = SubjectFactory()

        # 3 approved results: 80, 40, 60 -> avg = 60, passing (>=50): 80,60 = 2/3
        for score in (80, 40, 60):
            student = StudentFactory()
            Result.objects.create(
                student=student, subject=subject, term=term,
                exam_score=score, final_score=score, grade='C', status='approved',
            )
        # A draft result should be excluded from the calculation
        student_draft = StudentFactory()
        Result.objects.create(
            student=student_draft, subject=subject, term=term,
            exam_score=10, final_score=10, grade='F', status='draft',
        )

        response = client.get('/imboni/analytics/performance/overview/')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['total_results'] == 3
        assert response.data['school_average'] == 60.0
        assert response.data['pass_rate'] == round(2 / 3 * 100, 1)
        assert response.data['fail_rate'] == round(1 / 3 * 100, 1)

    def test_no_results_returns_zeroed_response(self, make_authenticated_client):
        client, _user = make_authenticated_client('dos')
        AcademicTermFactory(is_current=True)

        response = client.get('/imboni/analytics/performance/overview/')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['total_results'] == 0
        assert response.data['school_average'] == 0
        assert response.data['pass_rate'] == 0

    def test_no_current_term_returns_400(self, make_authenticated_client):
        client, _user = make_authenticated_client('dos')
        response = client.get('/imboni/analytics/performance/overview/')
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_non_dos_admin_forbidden(self, make_authenticated_client):
        client, _user = make_authenticated_client('teacher')
        AcademicTermFactory(is_current=True)
        response = client.get('/imboni/analytics/performance/overview/')
        assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
class TestPerformanceByGradeView:
    def test_averages_grouped_correctly_per_grade(self, make_authenticated_client):
        client, _user = make_authenticated_client('dos')
        term = AcademicTermFactory(is_current=True)
        subject = SubjectFactory()

        grade4_student1 = StudentFactory(grade='4')
        grade4_student2 = StudentFactory(grade='4')
        grade5_student1 = StudentFactory(grade='5')

        Result.objects.create(
            student=grade4_student1, subject=subject, term=term,
            exam_score=70, final_score=70, grade='C', status='approved',
        )
        Result.objects.create(
            student=grade4_student2, subject=subject, term=term,
            exam_score=90, final_score=90, grade='A', status='approved',
        )
        Result.objects.create(
            student=grade5_student1, subject=subject, term=term,
            exam_score=50, final_score=50, grade='D', status='approved',
        )

        response = client.get('/imboni/analytics/performance/by-grade/')

        assert response.status_code == status.HTTP_200_OK
        by_grade = {row['grade']: row for row in response.data}

        assert by_grade['4']['average_score'] == 80.0  # (70+90)/2
        assert by_grade['4']['student_count'] == 2
        assert by_grade['5']['average_score'] == 50.0
        assert by_grade['5']['student_count'] == 1

    def test_grade_with_no_approved_results_shows_zero_average(self, make_authenticated_client):
        client, _user = make_authenticated_client('dos')
        AcademicTermFactory(is_current=True)
        StudentFactory(grade='6')  # no results at all

        response = client.get('/imboni/analytics/performance/by-grade/')

        assert response.status_code == status.HTTP_200_OK
        by_grade = {row['grade']: row for row in response.data}
        assert by_grade['6']['average_score'] == 0
        assert by_grade['6']['student_count'] == 1


@pytest.mark.django_db
class TestAttendanceOverviewView:
    def test_computes_attendance_rate_from_summaries(self, make_authenticated_client):
        client, _user = make_authenticated_client('dos')
        student1 = StudentFactory()
        student2 = StudentFactory()

        AttendanceSummary.objects.create(
            student=student1, month=3, year=2026,
            total_days=20, present_days=18, absent_days=1, late_days=1, excused_days=0,
        )
        AttendanceSummary.objects.create(
            student=student2, month=3, year=2026,
            total_days=20, present_days=16, absent_days=3, late_days=0, excused_days=1,
        )
        # Different month — should not be counted
        AttendanceSummary.objects.create(
            student=student1, month=2, year=2026,
            total_days=20, present_days=5, absent_days=15, late_days=0, excused_days=0,
        )

        response = client.get('/imboni/analytics/attendance/overview/?month=3&year=2026')

        assert response.status_code == status.HTTP_200_OK
        # totals for march only: total=40, present=34, absent=4, late=1, excused=1
        assert response.data['total_days'] == 40
        assert response.data['present_days'] == 34
        assert response.data['absent_days'] == 4
        assert response.data['late_days'] == 1
        assert response.data['excused_days'] == 1
        assert response.data['attendance_rate'] == round(34 / 40 * 100, 1)

    def test_no_summaries_returns_zero_rate(self, make_authenticated_client):
        client, _user = make_authenticated_client('dos')
        response = client.get('/imboni/analytics/attendance/overview/?month=1&year=2099')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['total_days'] == 0
        assert response.data['attendance_rate'] == 0

    def test_non_dos_admin_forbidden(self, make_authenticated_client):
        client, _user = make_authenticated_client('teacher')
        response = client.get('/imboni/analytics/attendance/overview/')
        assert response.status_code == status.HTTP_403_FORBIDDEN
