import pytest
from rest_framework import status

from apps.audit.models import AuditEntry
from apps.audit.services import audit
from apps.authentication.factories import UserFactory


@pytest.mark.django_db
class TestAuditService:
    def test_audit_records_actor_snapshot(self):
        user = UserFactory(role='admin', first_name='Grace', last_name='M')
        entry = audit(user, 'invitation.sent', target='new@school.rw', detail={'role': 'teacher'})

        assert entry is not None
        assert entry.actor == user
        assert entry.actor_name == 'Grace M'
        assert entry.actor_role == 'admin'
        assert entry.detail == {'role': 'teacher'}

    def test_audit_never_raises(self):
        # A None actor (system action) must not crash
        entry = audit(None, 'system.cleanup', target='x')
        assert entry is not None
        assert entry.actor is None


@pytest.mark.django_db
class TestAuditLogListView:
    def test_only_admin_can_read_the_log(self, make_authenticated_client):
        client, _user = make_authenticated_client('dos')
        response = client.get('/imboni/admin/audit/')
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_admin_sees_entries_newest_first_with_filters(self, make_authenticated_client):
        client, admin = make_authenticated_client('admin')
        audit(admin, 'invitation.sent', target='a@school.rw')
        audit(admin, 'result.approved', target='John Doe — Maths')

        response = client.get('/imboni/admin/audit/')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['total'] == 2
        assert response.data['results'][0]['action'] == 'result.approved'

        filtered = client.get('/imboni/admin/audit/', {'action': 'invitation'})
        assert filtered.data['total'] == 1
        assert filtered.data['results'][0]['target'] == 'a@school.rw'

        searched = client.get('/imboni/admin/audit/', {'q': 'John'})
        assert searched.data['total'] == 1

    def test_sensitive_actions_write_audit_entries(self, make_authenticated_client):
        client, _admin = make_authenticated_client('admin')

        client.post('/imboni/auth/invite/', {
            'first_name': 'New', 'last_name': 'Teacher',
            'role': 'teacher', 'email': 'new.teacher@school.rw',
        }, format='json')

        assert AuditEntry.objects.filter(action='invitation.sent',
                                         target='new.teacher@school.rw').exists()
