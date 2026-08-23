"""
Tests for the public school-branding endpoint.

The sign-in screen has to show whose school it belongs to before anyone has
signed in, so this one endpoint sits outside IsDOSOrAdmin while the rest of
school-settings stays behind it. That makes its field list the whole of its
security: these tests exist to keep the list short.
"""
import pytest
from rest_framework import status

from apps.dos.models import SchoolSetting

URL = '/imboni/dos/branding/'
SETTINGS_URL = '/imboni/dos/school-settings/'


@pytest.mark.django_db
class TestBrandingIsPublic:
    def test_a_signed_out_visitor_can_read_the_school_name(self, client):
        """The reason the endpoint exists: branding the sign-in screen."""
        setting = SchoolSetting.get_setting()
        setting.school_name = 'Green Hills Secondary'
        setting.save()

        response = client.get(URL)

        assert response.status_code == status.HTTP_200_OK
        assert response.json()['school_name'] == 'Green Hills Secondary'

    def test_it_returns_a_null_logo_rather_than_failing_when_none_is_set(self, client):
        """Most schools will never upload one; that is not an error state."""
        response = client.get(URL)

        assert response.status_code == status.HTTP_200_OK
        assert response.json()['logo'] is None

    def test_a_school_with_no_name_yet_returns_an_empty_string(self, client):
        """The frontend falls back to the Imboni mark, so it needs '' not a 500."""
        setting = SchoolSetting.get_setting()
        setting.school_name = ''
        setting.save()

        response = client.get(URL)

        assert response.status_code == status.HTTP_200_OK
        assert response.json()['school_name'] == ''


@pytest.mark.django_db
class TestBrandingExposesNothingElse:
    def test_it_returns_only_the_two_branding_fields(self, client):
        """
        The guard on widening this. Timezone, currency and terms are
        operational details of a school's setup, and an endpoint that anyone
        on the internet can read is not where they belong. If this fails,
        someone added a field to the branding response - move it back to
        /school-settings/, which is authenticated.
        """
        setting = SchoolSetting.get_setting()
        setting.school_name = 'Green Hills Secondary'
        setting.currency = 'KES'
        setting.timezone = 'Africa/Nairobi'
        setting.save()

        body = client.get(URL).json()

        assert set(body) == {'school_name', 'logo'}
        assert 'currency' not in body
        assert 'timezone' not in body
        assert 'terms' not in body


@pytest.mark.django_db
class TestSchoolSettingsStaysProtected:
    def test_the_full_settings_endpoint_still_refuses_a_signed_out_visitor(self, client):
        """
        Adding a public sibling must not have opened the authenticated one.
        Read together with the test above: branding is public and narrow,
        settings is private and wide.
        """
        response = client.get(SETTINGS_URL)

        assert response.status_code in (status.HTTP_401_UNAUTHORIZED,
                                        status.HTTP_403_FORBIDDEN)

    def test_a_dos_can_still_read_the_full_settings(self, make_authenticated_client):
        client, _ = make_authenticated_client('dos')

        response = client.get(SETTINGS_URL)

        assert response.status_code == status.HTTP_200_OK
        assert 'currency' in response.json()
