"""
Tests for TOTP two-factor authentication: enrolment, the login challenge,
backup codes, and disabling.
"""
import pyotp
import pytest

from apps.audit.models import AuditEntry
from apps.authentication import twofactor
from apps.authentication.models import TwoFactorConfig
from apps.authentication.factories import UserFactory


def enrol(user):
    """Helper: fully enable 2FA for a user, returning (config, secret)."""
    config = twofactor.get_or_create_pending(user)
    twofactor.rotate_secret(config)
    twofactor.enable(config)
    return config, config.secret


@pytest.mark.django_db
class TestTwoFactorUnit:
    def test_verify_totp_accepts_current_code_rejects_wrong(self):
        config, secret = enrol(UserFactory(role='admin'))
        good = pyotp.TOTP(secret).now()
        assert twofactor.verify_totp(config, good) is True
        assert twofactor.verify_totp(config, '000000') is False
        assert twofactor.verify_totp(config, '') is False

    def test_backup_codes_are_hashed_single_use(self):
        config, _ = enrol(UserFactory(role='admin'))
        codes = twofactor.generate_backup_codes(config)
        assert len(codes) == twofactor.BACKUP_CODE_COUNT
        # Stored hashed, never plaintext.
        assert codes[0] not in config.backup_codes
        # First use works, second use of the same code fails (consumed).
        assert twofactor.verify_backup_code(config, codes[0]) is True
        assert twofactor.verify_backup_code(config, codes[0]) is False

    def test_challenge_roundtrip_and_tamper(self):
        user = UserFactory(role='admin')
        token = twofactor.make_challenge(user, 'admin')
        payload = twofactor.read_challenge(token)
        assert payload['uid'] == str(user.id)
        assert payload['portal'] == 'admin'
        assert twofactor.read_challenge(token + 'x') is None


@pytest.mark.django_db
class TestTwoFactorEnrollmentApi:
    def test_setup_then_verify_enables_and_returns_backup_codes(self, make_authenticated_client):
        client, user = make_authenticated_client('admin')

        setup = client.post('/imboni/auth/2fa/setup/')
        assert setup.status_code == 200
        assert setup.data['secret']
        assert setup.data['qr'].startswith('data:image/svg+xml')

        code = pyotp.TOTP(setup.data['secret']).now()
        verify = client.post('/imboni/auth/2fa/verify/', {'code': code}, format='json')
        assert verify.status_code == 200
        assert verify.data['enabled'] is True
        assert len(verify.data['backup_codes']) == twofactor.BACKUP_CODE_COUNT

        assert TwoFactorConfig.objects.get(user=user).is_enabled is True
        assert AuditEntry.objects.filter(action='user.2fa_enabled').exists()

    def test_verify_with_wrong_code_does_not_enable(self, make_authenticated_client):
        client, user = make_authenticated_client('admin')
        client.post('/imboni/auth/2fa/setup/')
        resp = client.post('/imboni/auth/2fa/verify/', {'code': '000000'}, format='json')
        assert resp.status_code == 400
        assert TwoFactorConfig.objects.get(user=user).is_enabled is False

    def test_status_reflects_state(self, make_authenticated_client):
        client, user = make_authenticated_client('admin')
        assert client.get('/imboni/auth/2fa/status/').data['enabled'] is False
        enrol(user)
        assert client.get('/imboni/auth/2fa/status/').data['enabled'] is True

    def test_disable_requires_correct_password(self, make_authenticated_client):
        client, user = make_authenticated_client('admin')
        user.set_password('RightPass123!')
        user.save()
        enrol(user)

        bad = client.post('/imboni/auth/2fa/disable/', {'password': 'wrong'}, format='json')
        assert bad.status_code == 400
        assert TwoFactorConfig.objects.filter(user=user).exists()

        ok = client.post('/imboni/auth/2fa/disable/', {'password': 'RightPass123!'}, format='json')
        assert ok.status_code == 200
        assert not TwoFactorConfig.objects.filter(user=user).exists()
        assert AuditEntry.objects.filter(action='user.2fa_disabled').exists()


@pytest.mark.django_db
class TestTwoFactorLoginFlow:
    def _make_login_user(self):
        user = UserFactory(role='admin', email='admin@imboni.test')
        user.set_password('AdminPass123!')
        user.save()
        return user

    def test_login_without_2fa_returns_tokens(self, api_client):
        self._make_login_user()
        resp = api_client.post('/imboni/auth/login/', {
            'email': 'admin@imboni.test', 'password': 'AdminPass123!', 'portal': 'admin',
        }, format='json')
        assert resp.status_code == 200
        assert 'access' in resp.data
        assert 'requires_2fa' not in resp.data

    def test_login_with_2fa_returns_challenge_not_tokens(self, api_client):
        user = self._make_login_user()
        enrol(user)
        resp = api_client.post('/imboni/auth/login/', {
            'email': 'admin@imboni.test', 'password': 'AdminPass123!', 'portal': 'admin',
        }, format='json')
        assert resp.status_code == 200
        assert resp.data.get('requires_2fa') is True
        assert resp.data['challenge']
        assert 'access' not in resp.data

    def test_second_step_with_valid_totp_issues_tokens(self, api_client):
        user = self._make_login_user()
        _, secret = enrol(user)
        challenge = api_client.post('/imboni/auth/login/', {
            'email': 'admin@imboni.test', 'password': 'AdminPass123!', 'portal': 'admin',
        }, format='json').data['challenge']

        resp = api_client.post('/imboni/auth/2fa/login/', {
            'challenge': challenge, 'code': pyotp.TOTP(secret).now(),
        }, format='json')
        assert resp.status_code == 200
        assert 'access' in resp.data
        assert resp.data['user']['email'] == 'admin@imboni.test'

    def test_second_step_with_backup_code_issues_tokens(self, api_client):
        user = self._make_login_user()
        config, _ = enrol(user)
        codes = twofactor.generate_backup_codes(config)
        challenge = api_client.post('/imboni/auth/login/', {
            'email': 'admin@imboni.test', 'password': 'AdminPass123!', 'portal': 'admin',
        }, format='json').data['challenge']

        resp = api_client.post('/imboni/auth/2fa/login/', {
            'challenge': challenge, 'code': codes[0],
        }, format='json')
        assert resp.status_code == 200
        assert 'access' in resp.data

    def test_second_step_with_wrong_code_is_rejected(self, api_client):
        user = self._make_login_user()
        enrol(user)
        challenge = api_client.post('/imboni/auth/login/', {
            'email': 'admin@imboni.test', 'password': 'AdminPass123!', 'portal': 'admin',
        }, format='json').data['challenge']

        resp = api_client.post('/imboni/auth/2fa/login/', {
            'challenge': challenge, 'code': '000000',
        }, format='json')
        assert resp.status_code == 401
        assert 'access' not in resp.data

    def test_second_step_rejects_bad_challenge(self, api_client):
        resp = api_client.post('/imboni/auth/2fa/login/', {
            'challenge': 'not-a-real-challenge', 'code': '123456',
        }, format='json')
        assert resp.status_code == 400
