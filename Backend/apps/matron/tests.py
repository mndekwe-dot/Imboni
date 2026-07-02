import pytest
from rest_framework import status

from apps.authentication.factories import StudentFactory, BoardingStudentFactory
from apps.matron.models import HealthRecord, TOTAL_SICKBAY_BEDS


@pytest.mark.django_db
class TestMatronHealthViewBedAssignment:
    def test_requires_authentication(self, api_client):
        response = api_client.get('/imboni/matron/health/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_non_matron_role_forbidden(self, make_authenticated_client):
        client, _user = make_authenticated_client('teacher')
        response = client.post('/imboni/matron/health/', {})
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_admitting_patient_assigns_bed_number(self, make_authenticated_client):
        client, _user = make_authenticated_client('matron')
        student = StudentFactory()

        response = client.post('/imboni/matron/health/', {
            'student_id': str(student.id),
            'visit_type': 'sickbay_admission',
            'condition_tag': 'illness',
            'complaint': 'Fever',
            'admitted': True,
        })

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['admitted'] is True
        assert response.data['bed_number'] in range(1, TOTAL_SICKBAY_BEDS + 1)
        assert response.data['status'] == 'in_sick_bay'

    def test_each_admission_gets_a_distinct_bed(self, make_authenticated_client):
        client, _user = make_authenticated_client('matron')
        bed_numbers = set()

        for _ in range(TOTAL_SICKBAY_BEDS):
            student = StudentFactory()
            response = client.post('/imboni/matron/health/', {
                'student_id': str(student.id),
                'visit_type': 'sickbay_admission',
                'condition_tag': 'illness',
                'complaint': 'Fever',
                'admitted': True,
            })
            assert response.status_code == status.HTTP_201_CREATED
            bed_numbers.add(response.data['bed_number'])

        assert bed_numbers == set(range(1, TOTAL_SICKBAY_BEDS + 1))

    def test_admitting_beyond_capacity_is_rejected_not_crashed(self, make_authenticated_client):
        client, _user = make_authenticated_client('matron')

        # Fill all beds
        for _ in range(TOTAL_SICKBAY_BEDS):
            student = StudentFactory()
            response = client.post('/imboni/matron/health/', {
                'student_id': str(student.id),
                'visit_type': 'sickbay_admission',
                'condition_tag': 'illness',
                'complaint': 'Fever',
                'admitted': True,
            })
            assert response.status_code == status.HTTP_201_CREATED

        # One more patient should be rejected cleanly, not crash or overflow.
        overflow_student = StudentFactory()
        response = client.post('/imboni/matron/health/', {
            'student_id': str(overflow_student.id),
            'visit_type': 'sickbay_admission',
            'condition_tag': 'illness',
            'complaint': 'Headache',
            'admitted': True,
        })

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'error' in response.data
        assert HealthRecord.objects.filter(student=overflow_student).count() == 0

    def test_non_admitted_visit_does_not_consume_a_bed(self, make_authenticated_client):
        client, _user = make_authenticated_client('matron')
        student = StudentFactory()

        response = client.post('/imboni/matron/health/', {
            'student_id': str(student.id),
            'visit_type': 'routine_checkup',
            'condition_tag': 'checkup',
            'complaint': 'General check',
            'admitted': False,
        }, format='json')

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['bed_number'] is None
        assert response.data['status'] == 'cleared'

    def test_admitted_false_as_form_string_is_correctly_interpreted(self, make_authenticated_client):
        # Was a real bug: when 'admitted' arrived as the form-encoded string
        # 'False' (any real <form> POST or non-JSON client), bool('False')
        # evaluates to True in Python — any non-empty string is truthy. Fixed
        # by explicitly checking string values against false-like tokens.
        client, _user = make_authenticated_client('matron')
        student = StudentFactory()

        response = client.post('/imboni/matron/health/', {
            'student_id': str(student.id),
            'visit_type': 'routine_checkup',
            'condition_tag': 'checkup',
            'complaint': 'General check',
            'admitted': False,
        })  # default multipart/form encoding -> 'admitted' becomes the string 'False'

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['admitted'] is False
        assert response.data['bed_number'] is None


@pytest.mark.django_db
class TestMatronHealthRecordDetailViewDischarge:
    def test_discharge_frees_the_bed_for_reuse(self, make_authenticated_client):
        client, _user = make_authenticated_client('matron')
        student = StudentFactory()

        admit_response = client.post('/imboni/matron/health/', {
            'student_id': str(student.id),
            'visit_type': 'sickbay_admission',
            'condition_tag': 'illness',
            'complaint': 'Fever',
            'admitted': True,
        })
        record_id = admit_response.data['id']
        bed_number = admit_response.data['bed_number']

        discharge_response = client.patch(f'/imboni/matron/health/{record_id}/', {
            'status': 'cleared',
        })

        assert discharge_response.status_code == status.HTTP_200_OK
        assert discharge_response.data['status'] == 'cleared'
        assert discharge_response.data['bed_number'] is None

        record = HealthRecord.objects.get(pk=record_id)
        assert record.admitted is False
        assert record.bed_number is None
        assert record.discharged_at is not None

        # The freed bed should now be reusable by a new admission.
        new_student = StudentFactory()
        new_admit = client.post('/imboni/matron/health/', {
            'student_id': str(new_student.id),
            'visit_type': 'sickbay_admission',
            'condition_tag': 'illness',
            'complaint': 'Cold',
            'admitted': True,
        })
        assert new_admit.status_code == status.HTTP_201_CREATED
        assert new_admit.data['bed_number'] == bed_number

    def test_discharging_fills_capacity_again_after_being_full(self, make_authenticated_client):
        client, _user = make_authenticated_client('matron')

        first_record_id = None
        for i in range(TOTAL_SICKBAY_BEDS):
            student = StudentFactory()
            response = client.post('/imboni/matron/health/', {
                'student_id': str(student.id),
                'visit_type': 'sickbay_admission',
                'condition_tag': 'illness',
                'complaint': 'Fever',
                'admitted': True,
            })
            if i == 0:
                first_record_id = response.data['id']

        # Confirm full
        overflow_student = StudentFactory()
        full_response = client.post('/imboni/matron/health/', {
            'student_id': str(overflow_student.id),
            'visit_type': 'sickbay_admission',
            'condition_tag': 'illness',
            'complaint': 'Headache',
            'admitted': True,
        })
        assert full_response.status_code == status.HTTP_400_BAD_REQUEST

        # Discharge one patient
        client.patch(f'/imboni/matron/health/{first_record_id}/', {'status': 'cleared'})

        # Now a new admission should succeed again
        retry_response = client.post('/imboni/matron/health/', {
            'student_id': str(overflow_student.id),
            'visit_type': 'sickbay_admission',
            'condition_tag': 'illness',
            'complaint': 'Headache',
            'admitted': True,
        })
        assert retry_response.status_code == status.HTTP_201_CREATED


@pytest.mark.django_db
class TestMatronStudentListView:
    def test_requires_matron_role(self, make_authenticated_client):
        client, _user = make_authenticated_client('discipline')
        response = client.get('/imboni/matron/students/')
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_search_filters_by_name(self, make_authenticated_client):
        client, _user = make_authenticated_client('matron')

        target = BoardingStudentFactory()
        target.student.user.first_name = 'Uniquename'
        target.student.user.save()
        BoardingStudentFactory()

        response = client.get('/imboni/matron/students/?search=Uniquename')

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1

    def test_search_filters_by_student_id(self, make_authenticated_client):
        client, _user = make_authenticated_client('matron')

        target_student = StudentFactory(student_id='STU09999')
        BoardingStudentFactory(student=target_student)
        BoardingStudentFactory()

        response = client.get('/imboni/matron/students/?search=STU09999')

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]['student_code'] == 'STU09999'


@pytest.mark.django_db
class TestMatronBoardingScheduleView:
    def test_requires_matron_role(self, make_authenticated_client):
        client, _user = make_authenticated_client('student')
        response = client.get('/imboni/matron/boarding-schedule/')
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_read_only_returns_expected_shape(self, make_authenticated_client):
        client, _user = make_authenticated_client('matron')

        response = client.get('/imboni/matron/boarding-schedule/')

        assert response.status_code == status.HTTP_200_OK
        assert 'weekday_rows' in response.data
        assert 'weekend_rows' in response.data
        assert 'changes' in response.data
        assert 'stats' in response.data
        assert response.data['stats']['days_in_schedule'] == 7

    def test_post_not_allowed(self, make_authenticated_client):
        client, _user = make_authenticated_client('matron')

        response = client.post('/imboni/matron/boarding-schedule/', {})

        assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED


@pytest.mark.django_db
class TestMatronIncidentParentNotification:
    def _post_incident(self, client, student, severity):
        return client.post('/imboni/matron/incidents/', {
            'student_id': str(student.id),
            'title': 'Dormitory altercation',
            'report_type': 'incident',
            'severity': severity,
            'description': 'Details here.',
            'date': '2025-02-03',
        }, format='json')

    def test_serious_incident_notifies_parents_and_flags_report(self, make_authenticated_client):
        from apps.authentication.factories import UserFactory
        from apps.parents.models import ParentStudentRelationship
        from apps.notifications.models import Notification
        from apps.behavior.models import BehaviorReport

        client, _matron = make_authenticated_client('matron')
        student = StudentFactory()
        parent = UserFactory(role='parent')
        ParentStudentRelationship.objects.create(parent=parent, student=student, relationship_type='father')

        response = self._post_incident(client, student, 'serious')

        assert response.status_code == status.HTTP_201_CREATED
        assert Notification.objects.filter(user=parent).count() == 1
        report = BehaviorReport.objects.get(pk=response.data['id'])
        assert report.parents_notified is True
        assert report.parent_notification_date is not None

    def test_minor_incident_does_not_notify_parents(self, make_authenticated_client):
        from apps.authentication.factories import UserFactory
        from apps.parents.models import ParentStudentRelationship
        from apps.notifications.models import Notification

        client, _matron = make_authenticated_client('matron')
        student = StudentFactory()
        parent = UserFactory(role='parent')
        ParentStudentRelationship.objects.create(parent=parent, student=student, relationship_type='mother')

        response = self._post_incident(client, student, 'minor')

        assert response.status_code == status.HTTP_201_CREATED
        assert Notification.objects.filter(user=parent).count() == 0


@pytest.mark.django_db
class TestMedicationSchedule:
    def _create_schedule(self, client, student, times=None):
        return client.post('/imboni/matron/medications/', {
            'student_id': str(student.id),
            'medicine_name': 'Amoxicillin',
            'dosage': '500mg',
            'times': times or ['08:00', '20:00'],
            'start_date': '2020-01-01',
        }, format='json')

    def test_create_and_list_schedules(self, make_authenticated_client):
        client, _matron = make_authenticated_client('matron')
        student = StudentFactory()

        response = self._create_schedule(client, student)
        assert response.status_code == status.HTTP_201_CREATED

        listing = client.get('/imboni/matron/medications/')
        assert len(listing.data) == 1
        assert listing.data[0]['medicine_name'] == 'Amoxicillin'
        assert listing.data[0]['times'] == ['08:00', '20:00']

    def test_times_are_required(self, make_authenticated_client):
        client, _matron = make_authenticated_client('matron')
        student = StudentFactory()

        response = client.post('/imboni/matron/medications/', {
            'student_id': str(student.id),
            'medicine_name': 'X', 'dosage': '1', 'times': [],
            'start_date': '2020-01-01',
        }, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_today_checklist_and_administering(self, make_authenticated_client):
        client, _matron = make_authenticated_client('matron')
        student = StudentFactory()
        created = self._create_schedule(client, student)
        schedule_id = created.data['id']

        today = client.get('/imboni/matron/medications/today/')
        assert today.status_code == status.HTTP_200_OK
        assert today.data['total'] == 2
        assert today.data['given'] == 0

        given = client.post(f'/imboni/matron/medications/{schedule_id}/administer/', {
            'time': '08:00',
        }, format='json')
        assert given.status_code == status.HTTP_201_CREATED

        # Same dose again is idempotent
        again = client.post(f'/imboni/matron/medications/{schedule_id}/administer/', {
            'time': '08:00',
        }, format='json')
        assert again.status_code == status.HTTP_200_OK
        assert again.data['already_recorded'] is True

        today = client.get('/imboni/matron/medications/today/')
        assert today.data['given'] == 1
        item = next(i for i in today.data['items'] if i['time'] == '08:00')
        assert item['given'] is True

    def test_administering_an_unscheduled_time_is_rejected(self, make_authenticated_client):
        client, _matron = make_authenticated_client('matron')
        student = StudentFactory()
        created = self._create_schedule(client, student)

        response = client.post(f"/imboni/matron/medications/{created.data['id']}/administer/", {
            'time': '11:11',
        }, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_delete_deactivates_and_removes_from_checklist(self, make_authenticated_client):
        client, _matron = make_authenticated_client('matron')
        student = StudentFactory()
        created = self._create_schedule(client, student)

        client.delete(f"/imboni/matron/medications/{created.data['id']}/")

        assert client.get('/imboni/matron/medications/').data == []
        assert client.get('/imboni/matron/medications/today/').data['total'] == 0
