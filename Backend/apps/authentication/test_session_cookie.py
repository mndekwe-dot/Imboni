"""
The long-lived credential lives where no script can read it.

The refresh token used to come back in the login answer and sit in the page's
localStorage for a week. These tests hold the replacement: an HttpOnly cookie
the page cannot see, traded for short-lived access tokens.
"""
import pyotp
import pytest
from django.conf import settings

from apps.authentication.factories import UserFactory
from apps.authentication.session import COOKIE_PATH, REFRESH_COOKIE
from apps.authentication.test_two_factor import enrol
from apps.authentication.tokens import tokens_for_user

LOGIN = '/imboni/auth/login/'
REFRESH = '/imboni/auth/token/refresh/'
LOGOUT = '/imboni/auth/logout/'
OURS = {'HTTP_X_REQUESTED_WITH': 'XMLHttpRequest'}
CREDS = {'email': 'teacher@imboni.test', 'password': 'TestPass123!', 'portal': 'teacher'}


@pytest.fixture
def teacher(db):
    return UserFactory(role='teacher', email='teacher@imboni.test', username='teacher@imboni.test')


def sign_in(client, **extra):
    return client.post(LOGIN, {**CREDS, **extra}, format='json')


@pytest.mark.django_db
class TestSigningIn:
    def test_the_refresh_token_is_in_a_cookie_and_not_in_the_answer(self, api_client, teacher):
        res = sign_in(api_client)
        assert res.status_code == 200
        assert 'access' in res.data and 'refresh' not in res.data

        cookie = res.cookies[REFRESH_COOKIE]
        assert cookie.value
        assert cookie['httponly'] is True          # no script can read it
        assert cookie['secure'] is True            # never over plain http
        assert cookie['samesite'] == 'Strict'      # another site cannot send it
        assert cookie['path'] == COOKIE_PATH       # not attached to every API call
        assert cookie['domain'] == ''              # host-only: never another school's subdomain

    def test_without_remember_me_it_goes_when_the_browser_closes(self, api_client, teacher):
        assert sign_in(api_client).cookies[REFRESH_COOKIE]['max-age'] == ''

    def test_with_remember_me_it_lasts_as_long_as_the_token(self, api_client, teacher):
        cookie = sign_in(api_client, remember=True).cookies[REFRESH_COOKIE]
        assert cookie['max-age'] == int(settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds())

    def test_a_failed_sign_in_sets_no_cookie(self, api_client, teacher):
        res = api_client.post(LOGIN, {**CREDS, 'password': 'wrong'}, format='json')
        assert res.status_code == 401
        assert REFRESH_COOKIE not in res.cookies

    def test_two_factor_hands_over_the_cookie_only_at_the_second_step(self, api_client):
        user = UserFactory(role='admin', email='admin@imboni.test')
        user.set_password('AdminPass123!')
        user.save()
        _, secret = enrol(user)

        first = api_client.post(LOGIN, {'email': 'admin@imboni.test', 'password': 'AdminPass123!', 'portal': 'admin'}, format='json')
        assert first.data.get('requires_2fa') is True
        assert REFRESH_COOKIE not in first.cookies

        second = api_client.post('/imboni/auth/2fa/login/', {
            'challenge': first.data['challenge'], 'code': pyotp.TOTP(secret).now(), 'remember': True,
        }, format='json')
        assert second.status_code == 200
        assert 'refresh' not in second.data
        assert second.cookies[REFRESH_COOKIE]['httponly'] is True
        assert second.cookies[REFRESH_COOKIE]['max-age'] != ''

    def test_the_access_token_is_short_lived(self):
        assert settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds() <= 15 * 60


@pytest.mark.django_db
class TestRenewing:
    def test_the_cookie_buys_a_new_access_token_and_is_replaced(self, api_client, teacher):
        first = sign_in(api_client).cookies[REFRESH_COOKIE].value

        res = api_client.post(REFRESH, {}, format='json', **OURS)
        assert res.status_code == 200
        assert set(res.data) == {'access'}                       # still no refresh token in the answer
        assert res.cookies[REFRESH_COOKIE].value not in ('', first)

        # The new access token really works.
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")
        assert api_client.get('/imboni/account/profile/').status_code == 200

    def test_a_used_refresh_token_cannot_be_used_again(self, api_client, teacher):
        first = sign_in(api_client).cookies[REFRESH_COOKIE].value
        assert api_client.post(REFRESH, {}, format='json', **OURS).status_code == 200

        api_client.cookies[REFRESH_COOKIE] = first                # a copy somebody kept
        res = api_client.post(REFRESH, {}, format='json', **OURS)
        assert res.status_code == 401
        assert res.cookies[REFRESH_COOKIE].value == ''           # and the dead cookie is removed

    def test_remember_me_survives_the_rotation(self, api_client, teacher):
        sign_in(api_client, remember=True)
        res = api_client.post(REFRESH, {}, format='json', **OURS)
        assert res.cookies[REFRESH_COOKIE]['max-age'] != ''

    def test_a_session_cookie_stays_a_session_cookie(self, api_client, teacher):
        sign_in(api_client)
        res = api_client.post(REFRESH, {}, format='json', **OURS)
        assert res.cookies[REFRESH_COOKIE]['max-age'] == ''

    def test_another_site_cannot_spend_the_cookie(self, api_client, teacher):
        sign_in(api_client)
        # A cross-site form post: the cookie rides along, our header does not.
        res = api_client.post(REFRESH, {}, format='json')
        assert res.status_code == 403
        assert 'access' not in res.data

    def test_nobody_signed_in_gets_nothing(self, api_client, db):
        assert api_client.post(REFRESH, {}, format='json', **OURS).status_code == 401

    def test_an_access_token_is_not_a_refresh_token(self, api_client, teacher):
        access = sign_in(api_client).data['access']
        api_client.cookies[REFRESH_COOKIE] = access
        assert api_client.post(REFRESH, {}, format='json', **OURS).status_code == 401

    def test_a_token_from_another_school_is_refused(self, api_client, teacher):
        foreign = tokens_for_user(teacher)
        foreign['schema'] = 'some_other_school'
        res = api_client.post(REFRESH, {'refresh': str(foreign)}, format='json')
        assert res.status_code == 401

    def test_a_token_stored_by_an_older_page_is_traded_for_a_cookie_once(self, api_client, teacher):
        # Browsers signed in before this change hold the token in localStorage.
        # The page posts it once; from then on only the cookie exists.
        stored = str(tokens_for_user(teacher))
        res = api_client.post(REFRESH, {'refresh': stored}, format='json')
        assert res.status_code == 200
        assert set(res.data) == {'access'}
        assert res.cookies[REFRESH_COOKIE]['httponly'] is True

    def test_a_deactivated_account_cannot_renew(self, api_client, teacher):
        sign_in(api_client)
        teacher.is_active = False
        teacher.save()
        assert api_client.post(REFRESH, {}, format='json', **OURS).status_code == 401


@pytest.mark.django_db
class TestSigningOut:
    def test_it_revokes_the_token_and_removes_the_cookie(self, api_client, teacher):
        kept = sign_in(api_client).cookies[REFRESH_COOKIE].value

        res = api_client.post(LOGOUT, {}, format='json', **OURS)
        assert res.status_code == 200
        assert res.cookies[REFRESH_COOKIE].value == ''

        api_client.cookies[REFRESH_COOKIE] = kept                 # a copy somebody kept
        assert api_client.post(REFRESH, {}, format='json', **OURS).status_code == 401

    def test_it_works_with_no_access_token_at_all(self, api_client, teacher):
        # It used to need a valid access token, so an expired session could not
        # be signed out of.
        sign_in(api_client)
        api_client.credentials()
        assert api_client.post(LOGOUT, {}, format='json', **OURS).status_code == 200

    def test_it_never_fails_even_with_nothing_to_sign_out_of(self, api_client, db):
        assert api_client.post(LOGOUT, {}, format='json', **OURS).status_code == 200

    def test_another_site_cannot_sign_somebody_out(self, api_client, teacher):
        kept = sign_in(api_client).cookies[REFRESH_COOKIE].value
        assert api_client.post(LOGOUT, {}, format='json').status_code == 403
        api_client.cookies[REFRESH_COOKIE] = kept
        assert api_client.post(REFRESH, {}, format='json', **OURS).status_code == 200
