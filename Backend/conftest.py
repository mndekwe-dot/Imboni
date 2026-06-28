"""
Shared pytest fixtures, available to every test in the project without importing.
"""
import pytest
from rest_framework.test import APIClient
from apps.authentication.factories import UserFactory


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def make_authenticated_client(api_client):
    """
    Usage:
        client, user = make_authenticated_client('dos')
    Returns an APIClient already authenticated as a freshly-created user of the given role.
    """
    def _make(role='dos', **kwargs):
        user = UserFactory(role=role, **kwargs)
        api_client.force_authenticate(user)
        return api_client, user
    return _make


@pytest.fixture
def dos_user():
    return UserFactory(role='dos')


@pytest.fixture
def teacher_user():
    return UserFactory(role='teacher')


@pytest.fixture
def admin_user():
    return UserFactory(role='admin')


@pytest.fixture
def matron_user():
    return UserFactory(role='matron')


@pytest.fixture
def discipline_user():
    return UserFactory(role='discipline')


@pytest.fixture
def parent_user():
    return UserFactory(role='parent')
