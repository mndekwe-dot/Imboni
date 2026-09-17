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
class TestAuditLogLivesInDjangoAdmin:
    def test_the_api_route_is_gone(self, make_authenticated_client):
        client, _admin = make_authenticated_client('admin')
        assert client.get('/imboni/admin/audit/').status_code == status.HTTP_404_NOT_FOUND

    def test_admin_registration_is_read_only(self, rf):
        from django.contrib import admin as django_admin
        model_admin = django_admin.site._registry[AuditEntry]
        request = rf.get('/')
        assert not model_admin.has_add_permission(request)
        assert not model_admin.has_change_permission(request)
        assert not model_admin.has_delete_permission(request)


@pytest.mark.django_db
class TestSensitiveActions:
    def test_sensitive_actions_write_audit_entries(self, make_authenticated_client):
        client, _admin = make_authenticated_client('admin')

        client.post('/imboni/auth/invite/', {
            'first_name': 'New', 'last_name': 'Teacher',
            'role': 'teacher', 'email': 'new.teacher@school.rw',
        }, format='json')

        assert AuditEntry.objects.filter(action='invitation.sent',
                                         target='new.teacher@school.rw').exists()
