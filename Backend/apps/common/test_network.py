"""
Who a request is "from", and why a forged X-Forwarded-For must not change it.

These pin the property that makes every rate limit in the app mean something:
an attacker cannot get a new identity by lying in a header.

Run with:
    python -m pytest apps/common/test_network.py -q
"""
from types import SimpleNamespace

import pytest
from rest_framework.settings import api_settings
from rest_framework.test import APIRequestFactory
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from apps.common.network import client_ip

REAL = '203.0.113.9'     # the address nginx actually saw


def req(xff=None, peer='172.18.0.2'):
    meta = {'REMOTE_ADDR': peer}
    if xff is not None:
        meta['HTTP_X_FORWARDED_FOR'] = xff
    return SimpleNamespace(META=meta)


@pytest.fixture
def one_proxy(settings):
    """Production shape: exactly one trusted proxy (nginx)."""
    settings.REST_FRAMEWORK = {**settings.REST_FRAMEWORK, 'NUM_PROXIES': 1}
    api_settings.reload()
    yield
    api_settings.reload()


@pytest.mark.usefixtures('one_proxy')
class TestClientIp:
    def test_uses_the_address_our_proxy_added(self):
        assert client_ip(req(f'{REAL}')) == REAL

    def test_a_forged_prefix_does_not_change_who_the_client_is(self):
        """The whole point: nginx appends the real peer, so the LAST entry is
        trustworthy and anything before it is the client's own claim."""
        honest = client_ip(req(f'{REAL}'))
        forged = client_ip(req(f'1.2.3.4, {REAL}'))
        forged_again = client_ip(req(f'9.9.9.9, 8.8.8.8, {REAL}'))
        assert honest == forged == forged_again == REAL

    def test_falls_back_to_the_peer_when_there_is_no_header(self):
        assert client_ip(req(None, peer='10.0.0.7')) == '10.0.0.7'

    def test_a_garbage_header_is_not_an_address(self):
        """Audit rows store this in an IP column; junk must not reach it."""
        assert client_ip(req('not-an-ip', peer='10.0.0.7')) == '10.0.0.7'
        assert client_ip(req('<script>alert(1)</script>', peer='10.0.0.7')) == '10.0.0.7'

    def test_ipv6_is_normalised(self):
        assert client_ip(req('2001:DB8:0:0:0:0:0:1')) == '2001:db8::1'

    def test_no_request_is_no_address(self):
        assert client_ip(None) is None

    def test_an_empty_header_falls_back(self):
        assert client_ip(req('  ,  ', peer='10.0.0.7')) == '10.0.0.7'


class TestWithMoreProxies:
    def test_two_proxies_means_the_second_from_the_right(self, settings):
        settings.REST_FRAMEWORK = {**settings.REST_FRAMEWORK, 'NUM_PROXIES': 2}
        api_settings.reload()
        try:
            # client, then the CDN's view of the client, then nginx's view of the CDN
            assert client_ip(req(f'6.6.6.6, {REAL}, 198.51.100.1')) == REAL
        finally:
            api_settings.reload()

    def test_zero_proxies_trusts_no_header_at_all(self, settings):
        settings.REST_FRAMEWORK = {**settings.REST_FRAMEWORK, 'NUM_PROXIES': 0}
        api_settings.reload()
        try:
            assert client_ip(req('1.2.3.4', peer='10.0.0.7')) == '10.0.0.7'
        finally:
            api_settings.reload()


class TestThrottleIdentity:
    """The throttle must agree with client_ip: same real client, same bucket."""

    def _ident(self, xff):
        request = APIView().initialize_request(
            APIRequestFactory().get('/', HTTP_X_FORWARDED_FOR=xff, REMOTE_ADDR='172.18.0.2'))
        return AnonRateThrottle().get_ident(request)

    @pytest.mark.usefixtures('one_proxy')
    def test_forging_the_header_does_not_buy_a_fresh_rate_limit_bucket(self):
        buckets = {self._ident(f'{n}.{n}.{n}.{n}, {REAL}') for n in range(1, 40)}
        assert buckets == {REAL}, 'every forged prefix must land in the same bucket'

    def test_configured_in_settings(self):
        """Not just in a test fixture: the real settings must set it."""
        from django.conf import settings
        assert settings.REST_FRAMEWORK.get('NUM_PROXIES') is not None
