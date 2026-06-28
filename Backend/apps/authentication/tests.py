import pytest
from rest_framework import status
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
from apps.authentication.factories import UserFactory
from .models import User


@pytest.mark.django_db
class TestLoginView:
    def test_wrong_password_returns_clean_error(self, api_client):
        UserFactory(role='dos', email='dos1@imboni.test', username='dos1@imboni.test')
        response = api_client.post('/imboni/auth/login/', {
            'username': 'dos1@imboni.test',
            'password': 'WrongPassword!',
            'portal': 'dos',
        })

        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert 'error' in response.data

    def test_login_with_mismatched_portal_is_rejected(self, api_client):
        UserFactory(role='teacher', email='teach1@imboni.test', username='teach1@imboni.test')
        response = api_client.post('/imboni/auth/login/', {
            'username': 'teach1@imboni.test',
            'password': 'TestPass123!',
            'portal': 'dos',
        })

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert 'error' in response.data

    def test_successful_login_returns_tokens_and_user(self, api_client):
        user = UserFactory(role='dos', email='dos2@imboni.test', username='dos2@imboni.test')
        response = api_client.post('/imboni/auth/login/', {
            'username': 'dos2@imboni.test',
            'password': 'TestPass123!',
            'portal': 'dos',
        })

        assert response.status_code == status.HTTP_200_OK
        assert 'access' in response.data
        assert 'refresh' in response.data
        assert response.data['user']['role'] == 'dos'
        assert response.data['user']['id'] == str(user.id)

    def test_missing_credentials_returns_400_not_500(self, api_client):
        response = api_client.post('/imboni/auth/login/', {'portal': 'dos'})

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'error' in response.data

    def test_invalid_portal_returns_400(self, api_client):
        UserFactory(role='dos', email='dos3@imboni.test', username='dos3@imboni.test')
        response = api_client.post('/imboni/auth/login/', {
            'username': 'dos3@imboni.test',
            'password': 'TestPass123!',
            'portal': 'not-a-real-portal',
        })

        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestPasswordResetConfirmView:
    def test_invalid_token_is_rejected_cleanly(self, api_client):
        user = UserFactory(role='dos')
        uid = urlsafe_base64_encode(force_bytes(user.pk))

        response = api_client.post('/imboni/auth/password-reset/confirm/', {
            'uid': uid,
            'token': 'bogus-token',
            'new_password': 'NewPass123!',
        })

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'error' in response.data

    def test_invalid_uid_is_rejected_cleanly(self, api_client):
        response = api_client.post('/imboni/auth/password-reset/confirm/', {
            'uid': 'not-a-valid-uid',
            'token': 'whatever',
            'new_password': 'NewPass123!',
        })

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'error' in response.data

    def test_missing_fields_returns_400(self, api_client):
        response = api_client.post('/imboni/auth/password-reset/confirm/', {})

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_valid_token_resets_password(self, api_client):
        user = UserFactory(role='dos')
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)

        response = api_client.post('/imboni/auth/password-reset/confirm/', {
            'uid': uid,
            'token': token,
            'new_password': 'BrandNewPass123!',
        })

        assert response.status_code == status.HTTP_200_OK
        user.refresh_from_db()
        assert user.check_password('BrandNewPass123!')


@pytest.mark.django_db
class TestAccountProfileView:
    def test_requires_authentication(self, api_client):
        response = api_client.get('/imboni/account/profile/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_authenticated_user_can_view_own_profile(self, make_authenticated_client):
        client, user = make_authenticated_client('teacher')
        response = client.get('/imboni/account/profile/')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['id'] == str(user.id)
        assert response.data['role'] == 'teacher'

    def test_authenticated_user_can_update_own_profile(self, make_authenticated_client):
        client, user = make_authenticated_client('teacher')
        response = client.patch('/imboni/account/profile/', {'first_name': 'Updated'})

        assert response.status_code == status.HTTP_200_OK
        user.refresh_from_db()
        assert user.first_name == 'Updated'


@pytest.mark.django_db
class TestSendInvitationView:
    def test_non_inviter_role_is_rejected(self, make_authenticated_client):
        client, _user = make_authenticated_client('teacher')
        response = client.post('/imboni/auth/invite/', {
            'first_name': 'New',
            'last_name': 'Student',
            'role': 'student',
            'email': 'newstudent@imboni.test',
        })

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_dos_can_invite_student(self, make_authenticated_client):
        client, _user = make_authenticated_client('dos')
        response = client.post('/imboni/auth/invite/', {
            'first_name': 'New',
            'last_name': 'Student',
            'role': 'student',
            'email': 'newstudent2@imboni.test',
        })

        assert response.status_code == status.HTTP_201_CREATED

    def test_dos_cannot_invite_role_outside_allowed_list(self, make_authenticated_client):
        # IsDOS permission lets the DOS through has_permission, but CanInvite.can_invite_role
        # should still reject roles DOS is not allowed to invite (e.g. 'admin').
        client, _user = make_authenticated_client('dos')
        response = client.post('/imboni/auth/invite/', {
            'first_name': 'New',
            'last_name': 'Admin',
            'role': 'admin',
            'email': 'newadmin@imboni.test',
        })

        assert response.status_code == status.HTTP_403_FORBIDDEN
