"""
Every role must be able to reach a portal.

The login endpoint takes a `portal` field and refuses any name it does not
recognise, before it even looks at the password. So a portal that exists in the
frontend but not in AuthViewSet.PORTAL_ROLES is not merely misconfigured — it
is a login page that cannot be logged into, by anybody, ever.

That is not hypothetical. The librarian and bursar portals both shipped that
way: the routes, the pages and the seeded accounts were all in place, and the
sign-in button returned 400 'Invalid portal'. Nothing failed, because nothing
asked.
"""
import pytest
from rest_framework import status

from apps.authentication.factories import UserFactory
from apps.authentication.models import User
from apps.authentication.views import AuthViewSet

pytestmark = pytest.mark.django_db

LOGIN = '/imboni/auth/login/'
PASSWORD = 'PortalCheck123!'


def test_every_role_has_a_portal_it_can_sign_in_through():
    roles = {code for code, _label in User.USER_ROLES}
    reachable = {role for allowed in AuthViewSet.PORTAL_ROLES.values() for role in allowed}
    assert roles - reachable == set(), (
        'these roles have no portal, so those accounts cannot sign in at all'
    )


def test_labels_and_roles_describe_the_same_portals():
    # A portal with no label falls back to its raw key in the 403 message, so
    # the user is told they lack access to the "dos" portal rather than the
    # Director of Studies Portal.
    assert set(AuthViewSet.PORTAL_ROLES) == set(AuthViewSet.PORTAL_LABELS)


@pytest.mark.parametrize('portal,role', sorted(
    (portal, allowed[0]) for portal, allowed in AuthViewSet.PORTAL_ROLES.items()
))
def test_the_matching_role_is_accepted_by_each_portal(api_client, portal, role):
    user = UserFactory(role=role)
    user.set_password(PASSWORD)
    user.save()

    response = api_client.post(LOGIN, {
        'email': user.email, 'password': PASSWORD, 'portal': portal,
    })

    assert response.status_code == status.HTTP_200_OK, (
        f'{role} cannot sign in through the {portal} portal: {response.data}'
    )
    assert 'access' in response.data


def test_a_wrong_role_is_refused_with_403_not_400(api_client):
    # 400 means "no such portal" and 403 means "not your portal". Conflating
    # them is how the missing entries stayed invisible: the librarian saw the
    # same failure a parent would.
    parent = UserFactory(role='parent')
    parent.set_password(PASSWORD)
    parent.save()

    response = api_client.post(LOGIN, {
        'email': parent.email, 'password': PASSWORD, 'portal': 'library',
    })

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert 'Library Portal' in response.data['error']


def test_an_unknown_portal_is_still_rejected(api_client):
    user = UserFactory(role='admin')
    user.set_password(PASSWORD)
    user.save()

    response = api_client.post(LOGIN, {
        'email': user.email, 'password': PASSWORD, 'portal': 'nosuchportal',
    })

    assert response.status_code == status.HTTP_400_BAD_REQUEST
