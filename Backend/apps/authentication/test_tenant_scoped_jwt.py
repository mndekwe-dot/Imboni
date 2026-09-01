"""
A school JWT must name the schema it was issued in, and be refused elsewhere.

Today User.id is a random UUID, so a token from another school names a row that
does not exist and is rejected anyway. That is a property of the key type, not
of the auth layer — these tests pin the auth layer's own behaviour so the
boundary does not quietly depend on the primary key staying a UUID.
"""
import pytest
from django.db import connection
from rest_framework_simplejwt.exceptions import InvalidToken
from rest_framework_simplejwt.tokens import RefreshToken

from apps.authentication.authentication import TenantScopedJWTAuthentication
from apps.authentication.tokens import SCHEMA_CLAIM, tokens_for_user


@pytest.mark.django_db
def test_a_minted_token_names_its_schema(dos_user):
    refresh = tokens_for_user(dos_user)
    access = refresh.access_token
    assert access[SCHEMA_CLAIM] == connection.schema_name


@pytest.mark.django_db
def test_a_token_from_this_schema_is_accepted(dos_user):
    raw = str(tokens_for_user(dos_user).access_token)
    validated = TenantScopedJWTAuthentication().get_validated_token(raw)
    assert validated[SCHEMA_CLAIM] == connection.schema_name


@pytest.mark.django_db
def test_a_token_stamped_with_another_schema_is_refused(dos_user):
    refresh = tokens_for_user(dos_user)
    access = refresh.access_token
    access[SCHEMA_CLAIM] = 'some_other_school'

    with pytest.raises(InvalidToken):
        TenantScopedJWTAuthentication().get_validated_token(str(access))


@pytest.mark.django_db
def test_a_token_without_the_claim_is_refused(dos_user):
    """Tokens minted before this claim existed force one re-login. Intended."""
    legacy = RefreshToken.for_user(dos_user).access_token
    assert SCHEMA_CLAIM not in legacy.payload

    with pytest.raises(InvalidToken):
        TenantScopedJWTAuthentication().get_validated_token(str(legacy))


@pytest.mark.django_db
def test_login_issues_a_scoped_token(api_client, dos_user):
    dos_user.set_password('Str0ng-Passw0rd!')
    dos_user.save(update_fields=['password'])

    resp = api_client.post('/imboni/auth/login/', {
        'email': dos_user.email, 'password': 'Str0ng-Passw0rd!', 'portal': 'dos',
    }, format='json')
    assert resp.status_code == 200, resp.data

    validated = TenantScopedJWTAuthentication().get_validated_token(resp.data['access'])
    assert validated[SCHEMA_CLAIM] == connection.schema_name
