"""
A support session: an operator looks at a school as its admin, and can change nothing.
"""
import pytest
from django_tenants.utils import get_public_schema_name, schema_context
from rest_framework.test import APIClient, APIRequestFactory, force_authenticate
from rest_framework_simplejwt.tokens import AccessToken

from apps.audit.models import AuditEntry
from apps.authentication.factories import UserFactory
from apps.tenants.models import Client, PlatformUser
from apps.tenants.support_session import SupportSessionError, open_support_session
from apps.tenants.views import SchoolViewSet

pytestmark = pytest.mark.django_db


def _operator(role=PlatformUser.ROLE_OPERATIONS):
    with schema_context(get_public_schema_name()):
        pu = PlatformUser.objects.filter(email=f'{role}-ss@imboni.com').first()
        if pu is None:
            pu = PlatformUser(email=f'{role}-ss@imboni.com', name='Op', role=role, mfa_enabled=True,
                              mfa_secret='JBSWY3DPEHPK3PXP')
            pu.set_password('PlatformPass123!')
            pu.save()
    return pu


@pytest.fixture
def school():
    with schema_context(get_public_schema_name()):
        return Client.objects.get(schema_name='test')


@pytest.fixture
def admin():
    return UserFactory(role='admin', email='head@school.rw')


def _client_with(token):
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
    return client


class TestTheToken:
    def test_it_looks_through_the_schools_administrator(self, school, admin):
        token, who, minutes = open_support_session(school, _operator(), 'Investigating a missing report')
        assert who == admin and minutes == 20
        assert AccessToken(token)['user_id'] == str(admin.id)

    def test_it_is_short_and_capped(self, school, admin):
        op = _operator()
        token, _, minutes = open_support_session(school, op, 'Investigating a missing report', minutes=500)
        assert minutes == 30
        lifetime = AccessToken(token)['exp'] - AccessToken(token)['iat']
        assert lifetime == 30 * 60
        assert open_support_session(school, op, 'Investigating a missing report', minutes=1)[2] == 5

    def test_a_reason_is_required(self, school, admin):
        with pytest.raises(SupportSessionError):
            open_support_session(school, _operator(), 'help')

    def test_a_school_with_no_administrator_cannot_be_looked_at(self, school):
        with pytest.raises(SupportSessionError):
            open_support_session(school, _operator(), 'Investigating a missing report')

    def test_the_school_can_see_that_and_why_imboni_looked(self, school, admin):
        open_support_session(school, _operator(), 'Investigating a missing report')
        entry = AuditEntry.objects.get(action='support.session_opened')
        assert 'Imboni support' in entry.actor_name and entry.detail['reason'] == 'Investigating a missing report'
        assert entry.detail['read_only'] is True


class TestReadOnly:
    def test_it_can_read_what_the_admin_can_read(self, school, admin):
        token, _, _ = open_support_session(school, _operator(), 'Investigating a missing report')
        assert _client_with(token).get('/imboni/school/modules/').status_code == 200

    def test_it_can_change_nothing(self, school, admin):
        token, _, _ = open_support_session(school, _operator(), 'Investigating a missing report')
        client = _client_with(token)
        for method in ('post', 'patch', 'put', 'delete'):
            response = getattr(client, method)('/imboni/account/profile/', {'first_name': 'Hacked'}, format='json')
            assert response.status_code == 403, method
            assert 'read-only' in str(response.data['detail']).lower()
        admin.refresh_from_db()
        assert admin.first_name != 'Hacked'

    def test_an_ordinary_login_is_not_affected(self, make_authenticated_client):
        client, _ = make_authenticated_client('admin')
        assert client.patch('/imboni/account/profile/', {'first_name': 'Fine'}, format='json').status_code == 200

    def test_it_is_refused_on_any_other_school(self, school, admin):
        token, _, _ = open_support_session(school, _operator(), 'Investigating a missing report')
        decoded = AccessToken(token)
        assert decoded['schema'] == school.schema_name   # the tenant-scoping claim still applies


class TestTheOperatorEndpoint:
    def _call(self, school, user, body):
        view = SchoolViewSet.as_view({'post': 'support_session'})
        request = APIRequestFactory().post(f'/imboni/platform/schools/{school.pk}/support-session/', body, format='json')
        force_authenticate(request, user=user)
        with schema_context(get_public_schema_name()):
            return view(request, pk=school.pk)

    def test_it_returns_a_url_with_the_token_in_the_fragment(self, school, admin):
        response = self._call(school, _operator(), {'reason': 'Investigating a missing report'})
        assert response.status_code == 200
        base, fragment = response.data['url'].split('#', 1)
        assert base.endswith('/support-session') and fragment.startswith('token=')   # never in the query string

    def test_the_reason_is_recorded_on_the_platform_log_too(self, school, admin):
        from apps.tenants.models import PlatformAuditLog
        self._call(school, _operator(), {'reason': 'Investigating a missing report'})
        with schema_context(get_public_schema_name()):
            row = PlatformAuditLog.objects.filter(action='school.support_session').first()
        assert row is not None and 'Investigating' in str(row.changes)

    def test_a_missing_reason_is_a_400(self, school, admin):
        assert self._call(school, _operator(), {}).status_code == 400

    def test_only_the_operations_desk_may_open_one(self, school, admin):
        response = self._call(school, _operator(PlatformUser.ROLE_SUPPORT), {'reason': 'Investigating a missing report'})
        assert response.status_code == 403
        assert not AuditEntry.objects.filter(action='support.session_opened').exists()

    def test_a_school_user_cannot_ask_for_one(self, school, admin):
        response = self._call(school, UserFactory(role='admin', is_staff=True), {'reason': 'Investigating a missing report'})
        assert response.status_code == 403
