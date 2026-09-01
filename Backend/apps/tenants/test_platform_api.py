"""
Tests for the platform super-admin API (Phase 5): apps.tenants.

Covers the ClientSerializer contract, PlatformUser auth (login + JWT), and the
SchoolViewSet suspend/reactivate transitions behind the IsPlatformAdmin gate.

Schema plumbing: the Client registry AND PlatformUser live in the PUBLIC schema,
but the suite pins every test to the `test` tenant schema (conftest). So we
create/drive the registry inside `schema_context(public)` via the helpers below.
"""
from django_tenants.utils import schema_context, get_public_schema_name
import pytest
from rest_framework import status
from rest_framework.test import APIRequestFactory, force_authenticate
from rest_framework_simplejwt.tokens import RefreshToken

from apps.authentication.factories import UserFactory
from apps.tenants.models import Client, PlatformUser
from apps.tenants.serializers import ClientSerializer
from apps.tenants.views import SchoolViewSet
from apps.tenants.platform_auth import (
    PlatformLoginView, PlatformJWTAuthentication, IsPlatformAdmin, issue_tokens,
)

pytestmark = pytest.mark.django_db


def _public():
    return schema_context(get_public_schema_name())


def make_school(name='Springfield High', schema_name='springfield', **kwargs):
    """Create a Client registry row in the public schema (no real Postgres schema)."""
    school = Client(name=name, schema_name=schema_name,
                    status=kwargs.pop('status', 'active'), **kwargs)
    school.auto_create_schema = False
    with _public():
        school.save()
    return school


def platform_admin(email='ops@imboni.com', password='PlatformPass123!',
                   role=PlatformUser.ROLE_OPERATIONS, mfa=True):
    """
    A platform operator (public-schema PlatformUser).

    Operations with MFA enrolled by default, which is what "a platform admin"
    meant when these tests were written -- before the role split there was only
    one kind, and it could do everything. Role separation is covered by
    test_platform_hardening.py; these tests are about the school lifecycle.
    """
    with _public():
        pu = PlatformUser(email=email, name='Ops', role=role, mfa_enabled=mfa,
                          mfa_secret='JBSWY3DPEHPK3PXP' if mfa else '')
        pu.set_password(password)
        pu.save()
    return pu


def _refresh_public(school):
    with _public():
        school.refresh_from_db()


# ── PlatformUser model ────────────────────────────────────────────────────────

class TestPlatformUser:
    def test_password_is_hashed_and_checkable(self):
        with _public():
            pu = PlatformUser(email='a@b.com')
            pu.set_password('Secret123!')
            assert pu.password != 'Secret123!'          # stored hashed
            assert pu.check_password('Secret123!') is True
            assert pu.check_password('wrong') is False


# ── Serializer contract ───────────────────────────────────────────────────────

class TestClientSerializer:
    def test_exposes_expected_fields(self):
        school = make_school(plan='premium', status='active', on_trial=False)
        data = ClientSerializer(school).data

        assert set(data.keys()) == {
            'id', 'name', 'schema_name', 'primary_domain', 'plan', 'status',
            'paid_until', 'on_trial', 'created_on', 'usage',
            'is_demo', 'demo_expires_on',
        }
        assert data['name'] == 'Springfield High'
        assert data['plan'] == 'premium'
        # usage is always present with both metered resources (None if unreadable).
        assert set(data['usage'].keys()) == {'students', 'staff'}

    def test_schema_name_is_read_only_after_creation(self):
        school = make_school(schema_name='springfield')
        serializer = ClientSerializer(school, data={'name': 'Renamed', 'schema_name': 'hacked'}, partial=True)
        assert serializer.is_valid(), serializer.errors
        assert 'schema_name' not in serializer.validated_data
        assert serializer.validated_data['name'] == 'Renamed'


# ── Platform login + JWT ──────────────────────────────────────────────────────

class TestPlatformLogin:
    def setup_method(self):
        self.factory = APIRequestFactory()

    def _login(self, email, password):
        request = self.factory.post('/imboni/platform/auth/login/',
                                    {'email': email, 'password': password}, format='json')
        with _public():
            return PlatformLoginView.as_view()(request)

    def test_valid_credentials_return_tokens(self):
        pu = platform_admin(password='Secret123!', mfa=False)
        resp = self._login(pu.email, 'Secret123!')
        assert resp.status_code == 200
        assert 'access' in resp.data and 'refresh' in resp.data
        assert resp.data['user']['email'] == pu.email
        assert resp.data['user']['role'] == pu.role

    def test_a_password_alone_is_not_enough_for_an_mfa_account(self):
        """
        The password step yields a challenge, not a token.

        This is the whole point of the second factor: a stolen password must
        not reach an API that can suspend a school.
        """
        pu = platform_admin(password='Secret123!', mfa=True)
        resp = self._login(pu.email, 'Secret123!')
        assert resp.status_code == 200
        assert resp.data['mfa_required'] is True
        assert 'access' not in resp.data
        assert resp.data['challenge']

    def test_the_challenge_plus_a_valid_code_completes_the_login(self):
        import pyotp
        from apps.tenants.platform_auth import PlatformMfaVerifyView

        pu = platform_admin(password='Secret123!', mfa=True)
        challenge = self._login(pu.email, 'Secret123!').data['challenge']

        req = self.factory.post('/x/', {'challenge': challenge,
                                        'code': pyotp.TOTP(pu.mfa_secret).now()},
                                format='json')
        with _public():
            resp = PlatformMfaVerifyView.as_view()(req)
        assert resp.status_code == 200
        assert 'access' in resp.data

    def test_a_wrong_code_does_not_complete_the_login(self):
        from apps.tenants.platform_auth import PlatformMfaVerifyView

        pu = platform_admin(password='Secret123!', mfa=True)
        challenge = self._login(pu.email, 'Secret123!').data['challenge']

        req = self.factory.post('/x/', {'challenge': challenge, 'code': '000000'},
                                format='json')
        with _public():
            resp = PlatformMfaVerifyView.as_view()(req)
        assert resp.status_code == 401
        assert 'access' not in resp.data

    def test_wrong_password_is_401(self):
        pu = platform_admin(password='Secret123!')
        resp = self._login(pu.email, 'nope')
        assert resp.status_code == 401

    def test_unknown_email_is_401(self):
        resp = self._login('ghost@imboni.com', 'whatever')
        assert resp.status_code == 401

    def test_issued_token_authenticates(self):
        pu = platform_admin()
        tokens = issue_tokens(pu)
        request = self.factory.get('/imboni/platform/schools/',
                                   HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
        with _public():
            result = PlatformJWTAuthentication().authenticate(request)
        assert result is not None
        user, _token = result
        assert user.id == pu.id

    def test_non_platform_token_is_rejected(self):
        # A token WITHOUT the platform claim (e.g. a school-user token shape)
        # must not authenticate against the platform API.
        plain = RefreshToken().access_token
        request = self.factory.get('/imboni/platform/schools/',
                                   HTTP_AUTHORIZATION=f"Bearer {plain}")
        with _public():
            assert PlatformJWTAuthentication().authenticate(request) is None


# ── suspend / reactivate + permission gate ────────────────────────────────────

class TestSuspendReactivate:
    def setup_method(self):
        self.factory = APIRequestFactory()

    def _call(self, action_name, school, user):
        view = SchoolViewSet.as_view({'post': action_name})
        request = self.factory.post(f'/imboni/platform/schools/{school.pk}/{action_name}/')
        force_authenticate(request, user=user)
        with _public():
            return view(request, pk=school.pk)

    def test_platform_admin_can_suspend(self):
        school = make_school(status='active')
        resp = self._call('suspend', school, platform_admin())
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data['status'] == 'suspended'
        _refresh_public(school)
        assert school.status == 'suspended'

    def test_platform_admin_can_reactivate(self):
        school = make_school(status='suspended')
        resp = self._call('reactivate', school, platform_admin())
        assert resp.status_code == status.HTTP_200_OK
        _refresh_public(school)
        assert school.status == 'active'


class TestPlatformAdminOnly:
    def setup_method(self):
        self.factory = APIRequestFactory()

    def test_anonymous_is_rejected_from_list(self):
        make_school()
        view = SchoolViewSet.as_view({'get': 'list'})
        request = self.factory.get('/imboni/platform/schools/')
        with _public():
            resp = view(request)
        assert resp.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)

    def test_school_user_is_rejected(self):
        # A per-school user (even an admin-role one) is NOT a platform operator.
        make_school()
        school_admin = UserFactory(role='admin', is_staff=True)
        view = SchoolViewSet.as_view({'get': 'list'})
        request = self.factory.get('/imboni/platform/schools/')
        force_authenticate(request, user=school_admin)
        with _public():
            resp = view(request)
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_school_user_cannot_suspend(self):
        school = make_school(status='active')
        school_admin = UserFactory(role='admin', is_staff=True)
        view = SchoolViewSet.as_view({'post': 'suspend'})
        request = self.factory.post(f'/imboni/platform/schools/{school.pk}/suspend/')
        force_authenticate(request, user=school_admin)
        with _public():
            resp = view(request, pk=school.pk)
        assert resp.status_code == status.HTTP_403_FORBIDDEN
        _refresh_public(school)
        assert school.status == 'active'   # unchanged

    def test_platform_admin_can_list(self):
        make_school()
        view = SchoolViewSet.as_view({'get': 'list'})
        request = self.factory.get('/imboni/platform/schools/')
        force_authenticate(request, user=platform_admin())
        with _public():
            resp = view(request)
        assert resp.status_code == status.HTTP_200_OK
        assert isinstance(IsPlatformAdmin().has_permission(request, view), bool)
