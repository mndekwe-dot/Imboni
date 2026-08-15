"""
Tests for "find my school" and the public school identity endpoint.

The security property under test is NON-ENUMERATION: a caller must not be able
to tell, from anything the API does, whether an email address is registered.
Several tests here exist only to pin that down, because it is the kind of
property a well-meaning future change ("let's tell them we couldn't find it")
quietly destroys.

Run with:
    python -m pytest apps/tenants/test_discovery.py -q
"""
from unittest.mock import patch

import pytest
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from apps.tenants.discovery import (
    SAME_ANSWER,
    find_schools_for_email,
    send_school_reminder,
)


# ── The pure pieces: no database needed ───────────────────────────────────────

class TestSendSchoolReminder:
    def test_sends_nothing_when_there_are_no_matches(self):
        """
        A "no schools found" email would confirm to whoever triggered it that
        the address is NOT registered -- the same disclosure in reverse -- and
        would let the endpoint be used to mail arbitrary strangers.
        """
        with patch('apps.tenants.discovery.send_mail') as send:
            assert send_school_reminder('nobody@example.com', []) is False
            send.assert_not_called()

    def test_sends_one_email_listing_every_school(self):
        schools = [
            {'name': 'Green Hills', 'domain': 'green.imboni.tech'},
            {'name': 'Lycee de Kigali', 'domain': 'lycee.imboni.tech'},
        ]
        with patch('apps.tenants.discovery.send_mail') as send:
            assert send_school_reminder('parent@example.com', schools) is True
            send.assert_called_once()
            body = send.call_args.kwargs['message']
            assert 'https://green.imboni.tech/' in body
            assert 'https://lycee.imboni.tech/' in body
            assert send.call_args.kwargs['recipient_list'] == ['parent@example.com']

    def test_honours_the_scheme(self):
        with patch('apps.tenants.discovery.send_mail') as send:
            send_school_reminder('p@example.com',
                                 [{'name': 'S', 'domain': 's.localhost'}],
                                 scheme='http')
            assert 'http://s.localhost/' in send.call_args.kwargs['message']

    def test_a_mail_failure_is_swallowed(self):
        """The caller is a Celery task; a broken SMTP server must not retry-loop."""
        with patch('apps.tenants.discovery.send_mail', side_effect=OSError('smtp down')):
            assert send_school_reminder('p@example.com',
                                        [{'name': 'S', 'domain': 's.x'}]) is False


class TestFindSchoolsForEmail:
    def test_blank_email_finds_nothing_without_touching_the_database(self):
        assert find_schools_for_email('') == []
        assert find_schools_for_email(None) == []
        assert find_schools_for_email('   ') == []


# ── The endpoint ──────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestFindMySchoolView:
    """
    Every path must produce byte-identical output. These tests deliberately
    assert on sameness rather than on content.
    """

    def _post(self, payload):
        # The endpoint is public-schema only: the bare domain is where a user
        # who has lost their subdomain lands, and the tenant registry it
        # searches lives there. conftest registers 'public' as that schema's
        # domain, so addressing that host is what routes to urls_public --
        # reverse() against the tenant urlconf would not find the route at all.
        url = reverse('find-my-school', urlconf='Imboni.urls_public')
        with override_settings(ALLOWED_HOSTS=['*']):
            return APIClient().post(url, payload, format='json', HTTP_HOST='public')

    def test_known_and_unknown_addresses_are_indistinguishable(self):
        with patch('apps.tenants.tasks.find_my_school_task.delay'):
            known = self._post({'email': 'someone@example.com'})
            unknown = self._post({'email': 'nobody-at-all@example.com'})

        assert known.status_code == unknown.status_code == 202
        assert known.data == unknown.data == {'detail': SAME_ANSWER}

    def test_a_malformed_address_gets_the_same_answer(self):
        """
        Not a security requirement in itself, but keeping ONE exit path means
        there is no second response body for a later edit to make revealing.
        """
        with patch('apps.tenants.tasks.find_my_school_task.delay'):
            res = self._post({'email': 'not-an-email'})
        assert res.status_code == 202
        assert res.data == {'detail': SAME_ANSWER}

    def test_missing_email_field_gets_the_same_answer(self):
        with patch('apps.tenants.tasks.find_my_school_task.delay'):
            res = self._post({})
        assert res.status_code == 202
        assert res.data == {'detail': SAME_ANSWER}

    def test_the_lookup_is_queued_not_run_inline(self):
        """
        The search must happen in the worker. Done inline, the response time
        would differ between a hit (walk every schema, send mail) and a miss
        (return at once) -- a reliable timing oracle that defeats the identical
        response body.
        """
        with patch('apps.tenants.tasks.find_my_school_task.delay') as delay:
            self._post({'email': 'Someone@Example.COM'})
            delay.assert_called_once()
            emailed, scheme = delay.call_args[0]
            # Normalised before queueing, so the task does not have to care.
            assert emailed == 'someone@example.com'
            assert scheme in ('http', 'https')

    def test_a_broken_broker_still_answers_normally(self):
        """
        A 500 here would tell the caller their address was worth processing.
        """
        with patch('apps.tenants.tasks.find_my_school_task.delay',
                   side_effect=RuntimeError('redis down')):
            res = self._post({'email': 'someone@example.com'})
        assert res.status_code == 202
        assert res.data == {'detail': SAME_ANSWER}


@pytest.mark.django_db
class TestSchoolIdentityView:
    def test_returns_the_schools_name_on_a_tenant(self):
        """
        conftest routes the test client into the 'test' tenant, so this is the
        tenant-side behaviour.
        """
        from apps.dos.models import SchoolSetting
        setting = SchoolSetting.get_setting()
        setting.school_name = 'Green Hills Academy'
        setting.save()

        res = APIClient().get(reverse('school-identity'))

        assert res.status_code == 200
        assert res.data['name'] == 'Green Hills Academy'
        assert res.data['subdomain'] == 'test'

    def test_needs_no_authentication(self):
        """The login page renders this before anyone has signed in."""
        res = APIClient().get(reverse('school-identity'))
        assert res.status_code == 200

    def test_exposes_nothing_beyond_name_subdomain_and_status(self):
        """
        This is the only unauthenticated endpoint on a tenant. Anything added
        to it is added to the public internet, so the shape is pinned here on
        purpose: a new key should fail this test and make someone think.
        """
        res = APIClient().get(reverse('school-identity'))
        assert set(res.data.keys()) == {'name', 'subdomain', 'status'}
