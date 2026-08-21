"""
The language a user can choose is agreed in two places: this serializer's
SUPPORTED_LANGUAGES and the frontend's SUPPORTED_LANGUAGES in src/i18n/index.js.

They drifted once already. The tuple said ('en', 'rw') while the frontend
shipped a Français button, so picking French returned 400 and the switcher
rolled back to English in front of the user. Nothing failed until someone tried
it by hand.

These tests need no database: validate_language is a pure method, so they run
even where Postgres is unavailable.
"""
import re
from pathlib import Path

import pytest
from rest_framework import serializers

from .serializers import UserPreferencesSerializer

SUPPORTED = UserPreferencesSerializer.SUPPORTED_LANGUAGES


@pytest.mark.parametrize('code', SUPPORTED)
def test_every_supported_language_validates(code):
    assert UserPreferencesSerializer().validate_language(code) == code


def test_french_is_accepted():
    # Named on its own because this is the one that regressed.
    assert UserPreferencesSerializer().validate_language('fr') == 'fr'


@pytest.mark.parametrize('code', ['de', 'sw', 'EN', '', 'english'])
def test_unsupported_language_is_rejected(code):
    with pytest.raises(serializers.ValidationError):
        UserPreferencesSerializer().validate_language(code)


def test_error_names_the_languages_that_would_have_worked():
    # The message is the only clue a developer gets when the two lists drift.
    with pytest.raises(serializers.ValidationError) as exc:
        UserPreferencesSerializer().validate_language('de')
    message = str(exc.value)
    assert "'de'" in message
    for code in SUPPORTED:
        assert code in message


def test_matches_the_languages_the_frontend_ships():
    """
    Read the frontend's list rather than restate it — a copy of a value cannot
    guard that value. The frontend suite performs the mirror of this check, so
    the drift is caught from whichever side is edited first.
    """
    index_js = (Path(__file__).resolve().parents[3]
                / 'Frontend' / 'src' / 'i18n' / 'index.js')
    assert index_js.exists(), f'frontend i18n entrypoint not found at {index_js}'

    block = re.search(r'SUPPORTED_LANGUAGES\s*=\s*\[(.*?)\]',
                      index_js.read_text(encoding='utf-8'), re.S)
    assert block, 'SUPPORTED_LANGUAGES not found in Frontend/src/i18n/index.js'
    frontend = re.findall(r"code:\s*'([a-z]{2})'", block.group(1))

    assert sorted(frontend) == sorted(SUPPORTED)


@pytest.mark.django_db
class TestPreferencesEndpoint:
    """
    The round trip the switcher actually performs. The unit tests above prove
    validate_language accepts 'fr'; these prove a real PATCH survives the view,
    the serializer and the database — which is where the regression was visible.
    """
    URL = '/imboni/account/preferences/'

    def test_french_saves_and_reads_back(self, make_authenticated_client):
        client, user = make_authenticated_client('parent')

        response = client.patch(self.URL, {'language': 'fr'}, format='json')

        assert response.status_code == 200, response.data
        assert response.data['language'] == 'fr'
        # Read it back rather than trusting the response echo: the model field
        # is a plain CharField, so a value can be accepted and still not stored.
        assert client.get(self.URL).data['language'] == 'fr'

    @pytest.mark.parametrize('code', SUPPORTED)
    def test_every_advertised_language_round_trips(self, make_authenticated_client, code):
        client, _ = make_authenticated_client('student')
        assert client.patch(self.URL, {'language': code}, format='json').status_code == 200

    def test_unsupported_language_is_a_400_not_a_silent_save(self, make_authenticated_client):
        client, _ = make_authenticated_client('teacher')
        client.patch(self.URL, {'language': 'rw'}, format='json')

        response = client.patch(self.URL, {'language': 'de'}, format='json')

        assert response.status_code == 400
        # The previous choice must survive a rejected one.
        assert client.get(self.URL).data['language'] == 'rw'

    def test_preferences_require_authentication(self, api_client):
        assert api_client.patch(self.URL, {'language': 'fr'}, format='json').status_code in (401, 403)
