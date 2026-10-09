"""
Sign-in rate limits: what each one stops, and what it must NOT stop.

Rates are switched off under the test settings so unrelated tests can sign in
freely, so each test here turns the one it is about back on.

Run with:
    python -m pytest apps/authentication/test_login_throttle.py -q
"""
import pytest
from django.core.cache import cache
from rest_framework.settings import api_settings
from rest_framework.test import APIClient
from rest_framework.throttling import SimpleRateThrottle

from apps.authentication.factories import UserFactory

LOGIN = '/imboni/auth/login/'
GOOD = 'TestPass123!'
REAL = '203.0.113.9'          # the address nginx saw


@pytest.fixture(autouse=True)
def _fresh(settings):
    cache.clear()
    settings.REST_FRAMEWORK = {**settings.REST_FRAMEWORK, 'NUM_PROXIES': 1}
    api_settings.reload()
    yield
    cache.clear()
    api_settings.reload()


@pytest.fixture
def rates(monkeypatch):
    def set_rates(**kw):
        for scope, rate in kw.items():
            monkeypatch.setitem(SimpleRateThrottle.THROTTLE_RATES, scope, rate)
    return set_rates


def attempt(email, password='wrong-password', ip=REAL, forged=None):
    xff = f'{forged}, {ip}' if forged else ip
    return APIClient().post(LOGIN, {'email': email, 'password': password},
                            format='json', HTTP_X_FORWARDED_FOR=xff)


@pytest.mark.django_db
class TestPerAccountLimit:
    def test_guessing_at_one_account_is_stopped(self, rates):
        rates(login='1000/min', login_account='3/hour')
        UserFactory(email='teacher@school.test', role='teacher')
        codes = [attempt('teacher@school.test').status_code for _ in range(5)]
        assert codes[:3] == [401, 401, 401]
        assert codes[3:] == [429, 429]

    def test_the_real_password_is_also_refused_once_limited(self, rates):
        """Otherwise the limit would only slow down the wrong guesses, not the right one."""
        rates(login='1000/min', login_account='2/hour')
        UserFactory(email='t@school.test', role='teacher')
        attempt('t@school.test'); attempt('t@school.test')
        assert attempt('t@school.test', GOOD).status_code == 429

    def test_a_whole_classroom_on_one_address_is_not_locked_out(self, rates):
        """The case the old 5-a-minute per-address limit got wrong."""
        rates(login='1000/min', login_account='3/hour')
        for i in range(30):
            UserFactory(email=f'pupil{i}@school.test', role='student')
        results = [attempt(f'pupil{i}@school.test', GOOD).status_code for i in range(30)]
        assert 429 not in results
        assert results.count(200) == 30

    def test_the_account_is_matched_ignoring_case_and_spaces(self, rates):
        rates(login='1000/min', login_account='2/hour')
        UserFactory(email='teacher@school.test', role='teacher')
        attempt('teacher@school.test'); attempt('  TEACHER@school.test ')
        assert attempt('Teacher@School.test').status_code == 429

    def test_an_attacker_cannot_lock_the_real_user_out_from_another_address(self, rates):
        """Counted per (address, account): hammering someone's email from your
        own machine must not stop them signing in from theirs."""
        rates(login='1000/min', login_account='3/hour')
        UserFactory(email='victim@school.test', role='teacher')
        for _ in range(6):
            attempt('victim@school.test', ip='198.51.100.66')          # the attacker
        assert attempt('victim@school.test', GOOD, ip=REAL).status_code == 200

    def test_forging_the_forwarded_header_does_not_buy_more_tries(self, rates):
        rates(login='1000/min', login_account='3/hour')
        UserFactory(email='teacher@school.test', role='teacher')
        codes = [attempt('teacher@school.test', forged=f'10.0.0.{n}').status_code for n in range(6)]
        assert codes[3:] == [429, 429, 429]


@pytest.mark.django_db
class TestPerAddressLimit:
    def test_a_flood_from_one_address_is_stopped_whatever_accounts_it_tries(self, rates):
        rates(login='4/min', login_account='1000/hour')
        codes = [attempt(f'nobody{i}@school.test').status_code for i in range(7)]
        assert codes[4:] == [429, 429, 429]

    def test_a_different_address_is_unaffected(self, rates):
        rates(login='3/min', login_account='1000/hour')
        for i in range(5):
            attempt(f'nobody{i}@school.test', ip='198.51.100.1')
        assert attempt('x@school.test', ip='198.51.100.2').status_code != 429

    def test_forging_the_forwarded_header_does_not_dodge_the_flood_limit(self, rates):
        rates(login='4/min', login_account='1000/hour')
        codes = [attempt('a@school.test', forged=f'10.1.1.{n}').status_code for n in range(8)]
        assert codes[4:] == [429, 429, 429, 429]


class TestSettings:
    def test_the_shipped_rates_are_what_the_design_says(self):
        """Read the source, not the test settings (which switch rates off)."""
        import pathlib, re
        src = (pathlib.Path(__file__).resolve().parents[2] / 'Imboni' / 'settings.py').read_text(encoding='utf-8')
        assert re.search(r"'login':\s+None if TESTING else '60/min'", src)
        assert re.search(r"'login_account':\s+None if TESTING else '10/hour'", src)
