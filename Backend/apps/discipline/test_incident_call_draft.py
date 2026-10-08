import pytest
from django.utils import timezone

from apps.authentication.factories import StudentFactory
from apps.matron.models import ParentCommunication

URL = '/imboni/discipline/reports/'


def _report(client, student, **kw):
    body = {'student_id': str(student.id), 'report_type': 'incident', 'title': 'Fight in dorm',
            'description': 'Two students fought.', 'date': str(timezone.localdate()), 'severity': 'serious'}
    body.update(kw)
    return client.post(URL, body, format='json')


@pytest.mark.django_db
class TestIncidentCallDraft:
    def test_a_serious_incident_puts_a_call_on_the_log(self, make_authenticated_client):
        client, _ = make_authenticated_client('discipline')
        student = StudentFactory()

        assert _report(client, student).status_code == 201

        call = ParentCommunication.objects.get(student=student)
        assert call.comm_type == 'call' and call.outcome == 'awaiting_reply'
        assert call.urgency == 'important' and call.follow_up_required
        assert 'Fight in dorm' in call.subject and 'Two students fought.' in call.notes

    def test_critical_is_urgent(self, make_authenticated_client):
        client, _ = make_authenticated_client('discipline')
        student = StudentFactory()
        _report(client, student, severity='critical')
        assert ParentCommunication.objects.get(student=student).urgency == 'urgent'

    def test_minor_incidents_and_positive_reports_do_not(self, make_authenticated_client):
        client, _ = make_authenticated_client('discipline')
        student = StudentFactory()
        _report(client, student, severity='minor')
        _report(client, student, report_type='positive', severity=None, title='Helped')
        assert not ParentCommunication.objects.filter(student=student).exists()

    def test_a_matron_report_gets_its_call_only_once_approved(self, make_authenticated_client, api_client):
        from apps.behavior.models import BehaviorReport
        client, dis = make_authenticated_client('discipline')
        student = StudentFactory()
        report = BehaviorReport.objects.create(
            student=student, report_type='incident', severity='serious', title='Theft', description='x',
            date=timezone.localdate(), status='pending_review',
        )
        assert not ParentCommunication.objects.filter(student=student).exists()

        client.post(f'{URL}{report.id}/review/', {'action': 'approve'}, format='json')
        client.post(f'{URL}{report.id}/review/', {'action': 'approve'}, format='json')   # a repeat is refused

        assert ParentCommunication.objects.filter(student=student).count() == 1
