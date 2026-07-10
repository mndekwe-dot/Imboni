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


@pytest.mark.django_db
class TestPrivilegeEscalationIsBlocked:
    """
    Regression tests for the critical self-promotion hole: UserViewSet is a
    ModelViewSet and role used to be a writable serializer field, so any user
    could PATCH their own record to become an admin.
    """
    def test_student_cannot_promote_self_to_admin(self, make_authenticated_client):
        client, student = make_authenticated_client('student')

        response = client.patch(f'/imboni/users/{student.id}/', {'role': 'admin'}, format='json')

        student.refresh_from_db()
        assert student.role == 'student'                 # role unchanged
        # Request itself may succeed (200) but the privileged field is ignored
        assert response.status_code in (status.HTTP_200_OK, status.HTTP_403_FORBIDDEN)
        if response.status_code == status.HTTP_200_OK:
            assert response.data['role'] == 'student'

    def test_student_cannot_reactivate_self_via_is_active(self, make_authenticated_client):
        client, student = make_authenticated_client('student')
        student.is_active = True
        student.save()

        client.patch(f'/imboni/users/{student.id}/', {'is_active': False, 'role': 'admin'}, format='json')

        student.refresh_from_db()
        assert student.role == 'student'
        assert student.is_active is True                 # is_active is read-only here

    def test_non_admin_cannot_create_users(self, make_authenticated_client):
        client, _teacher = make_authenticated_client('teacher')

        response = client.post('/imboni/users/', {
            'username': 'sneaky', 'email': 'sneaky@x.com',
            'first_name': 'S', 'last_name': 'Neaky', 'role': 'admin',
        }, format='json')

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert not User.objects.filter(email='sneaky@x.com').exists()

    def test_non_admin_cannot_register_arbitrary_role(self, make_authenticated_client):
        client, _student = make_authenticated_client('student')

        response = client.post('/imboni/users/register/', {
            'username': 'newadmin', 'email': 'newadmin@x.com',
            'password': 'ComplexPass123!', 'password_confirm': 'ComplexPass123!',
            'first_name': 'New', 'last_name': 'Admin', 'role': 'admin',
        }, format='json')

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert not User.objects.filter(email='newadmin@x.com').exists()

    def test_admin_can_still_manage_users(self, make_authenticated_client):
        client, _admin = make_authenticated_client('admin')
        response = client.get('/imboni/users/', {'role': 'teacher'})
        assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
class TestLoginThrottling:
    def test_login_is_rate_limited_per_ip(self, api_client, monkeypatch):
        # Throttling is disabled under the test suite by default (rates=None);
        # force a low rate on the login throttle to prove it's wired up.
        # SimpleRateThrottle uses a truthy class `rate` attr directly.
        from apps.authentication.views import LoginRateThrottle
        from django.core.cache import cache
        cache.clear()
        # raising=False: `rate` only exists on instances, not the class
        monkeypatch.setattr(LoginRateThrottle, 'rate', '3/min', raising=False)

        statuses = []
        for _ in range(5):
            r = api_client.post('/imboni/auth/login/', {
                'username': 'nobody@imboni.test', 'password': 'x', 'portal': 'dos',
            })
            statuses.append(r.status_code)

        assert statuses.count(status.HTTP_429_TOO_MANY_REQUESTS) >= 1
        cache.clear()   # don't leak throttle state into other tests
