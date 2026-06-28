import pytest
from rest_framework import status
from apps.authentication.factories import UserFactory, StudentFactory, AcademicTermFactory
from .models import BehaviorReport, ConductGrade


@pytest.mark.django_db
class TestBehaviorReportModel:
    def test_create_basic_report(self):
        student = StudentFactory()
        reporter = UserFactory(role='discipline')
        report = BehaviorReport.objects.create(
            student=student,
            report_type='warning',
            severity='moderate',
            title='Late to class',
            description='Arrived 20 minutes late.',
            date='2026-03-01',
            reported_by=reporter,
        )
        assert report.report_type == 'warning'
        assert report.severity == 'moderate'
        assert report.status == 'approved'  # default

    def test_report_type_must_be_a_valid_choice(self):
        student = StudentFactory()
        report = BehaviorReport(
            student=student,
            report_type='not_a_real_type',
            title='Bad type',
            description='x',
            date='2026-03-01',
        )
        with pytest.raises(Exception):
            report.full_clean()

    def test_severity_must_be_a_valid_choice(self):
        student = StudentFactory()
        report = BehaviorReport(
            student=student,
            report_type='incident',
            severity='extreme',  # not a valid choice
            title='Bad severity',
            description='x',
            date='2026-03-01',
        )
        with pytest.raises(Exception):
            report.full_clean()


@pytest.mark.django_db
class TestConductGradeModel:
    def test_calculate_grade_excellent(self):
        student = StudentFactory()
        term = AcademicTermFactory()
        cg = ConductGrade(
            student=student, term=term,
            positive_count=8, achievement_count=4,
            warning_count=0, incident_count=0,
        )
        cg.calculate_grade()
        assert cg.grade == 'A'

    def test_calculate_grade_unsatisfactory(self):
        student = StudentFactory()
        term = AcademicTermFactory()
        cg = ConductGrade(
            student=student, term=term,
            positive_count=0, achievement_count=0,
            warning_count=2, incident_count=3,
        )
        cg.calculate_grade()
        # score = 0 - (2 + 6) = -8
        assert cg.grade == 'F'


@pytest.mark.django_db
class TestStudentBehaviorStatsView:
    def test_requires_discipline_or_matron_role(self, make_authenticated_client):
        client, _user = make_authenticated_client('teacher')
        student = StudentFactory()
        response = client.get(f'/imboni/behavior/students/{student.id}/stats/')
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_counts_reports_by_type(self, make_authenticated_client):
        client, _user = make_authenticated_client('discipline')
        student = StudentFactory()
        term = AcademicTermFactory(is_current=True, start_date='2026-01-01', end_date='2026-06-01')

        BehaviorReport.objects.create(
            student=student, report_type='positive', title='Good', description='x', date='2026-02-01',
        )
        BehaviorReport.objects.create(
            student=student, report_type='warning', title='Bad', description='x', date='2026-02-02',
        )
        BehaviorReport.objects.create(
            student=student, report_type='achievement', title='Great', description='x', date='2026-02-03',
        )
        # Outside the current term's date range — should not be counted
        BehaviorReport.objects.create(
            student=student, report_type='positive', title='Old', description='x', date='2025-01-01',
        )

        response = client.get(f'/imboni/behavior/students/{student.id}/stats/')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['positive_reports'] == 1
        assert response.data['warnings'] == 1
        assert response.data['achievements'] == 1

    def test_discipline_marks_deducted_only_counts_approved(self, make_authenticated_client):
        client, _user = make_authenticated_client('matron')
        student = StudentFactory()
        AcademicTermFactory(is_current=True, start_date='2026-01-01', end_date='2026-06-01')

        BehaviorReport.objects.create(
            student=student, report_type='incident', title='Approved incident',
            description='x', date='2026-02-01', marks_deducted=5, status='approved',
        )
        BehaviorReport.objects.create(
            student=student, report_type='incident', title='Pending incident',
            description='x', date='2026-02-02', marks_deducted=10, status='pending_review',
        )

        response = client.get(f'/imboni/behavior/students/{student.id}/stats/')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['marks_deducted'] == 5
        assert response.data['discipline_marks'] == 35


@pytest.mark.django_db
class TestStudentBehaviorReportsView:
    def test_requires_discipline_or_matron_role(self, make_authenticated_client):
        client, _user = make_authenticated_client('parent')
        student = StudentFactory()
        response = client.get(f'/imboni/behavior/students/{student.id}/reports/')
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_lists_reports_for_student(self, make_authenticated_client):
        client, _user = make_authenticated_client('discipline')
        student = StudentFactory()
        other_student = StudentFactory()
        BehaviorReport.objects.create(
            student=student, report_type='positive', title='Mine', description='x', date='2026-02-01',
        )
        BehaviorReport.objects.create(
            student=other_student, report_type='positive', title='Not mine', description='x', date='2026-02-01',
        )

        response = client.get(f'/imboni/behavior/students/{student.id}/reports/')

        assert response.status_code == status.HTTP_200_OK
        results = response.data['results'] if isinstance(response.data, dict) else response.data
        assert len(results) == 1
        assert results[0]['title'] == 'Mine'

    def test_filters_by_type_query_param(self, make_authenticated_client):
        client, _user = make_authenticated_client('discipline')
        student = StudentFactory()
        BehaviorReport.objects.create(
            student=student, report_type='positive', title='Positive one', description='x', date='2026-02-01',
        )
        BehaviorReport.objects.create(
            student=student, report_type='warning', title='Warning one', description='x', date='2026-02-02',
        )

        response = client.get(f'/imboni/behavior/students/{student.id}/reports/?type=warning')

        assert response.status_code == status.HTTP_200_OK
        results = response.data['results'] if isinstance(response.data, dict) else response.data
        assert len(results) == 1
        assert results[0]['title'] == 'Warning one'

    def test_badge_for_positive_report(self, make_authenticated_client):
        client, _user = make_authenticated_client('discipline')
        student = StudentFactory()
        BehaviorReport.objects.create(
            student=student, report_type='positive', title='Good', description='x', date='2026-02-01',
        )

        response = client.get(f'/imboni/behavior/students/{student.id}/reports/')
        results = response.data['results'] if isinstance(response.data, dict) else response.data
        assert results[0]['badge'] == 'Positive'

    def test_badge_for_warning_uses_severity(self, make_authenticated_client):
        client, _user = make_authenticated_client('discipline')
        student = StudentFactory()
        BehaviorReport.objects.create(
            student=student, report_type='warning', severity='minor',
            title='Minor warning', description='x', date='2026-02-01',
        )

        response = client.get(f'/imboni/behavior/students/{student.id}/reports/')
        results = response.data['results'] if isinstance(response.data, dict) else response.data
        assert results[0]['badge'] == 'Minor'
