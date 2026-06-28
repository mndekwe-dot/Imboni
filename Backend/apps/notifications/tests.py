import pytest
from rest_framework import status
from apps.authentication.factories import UserFactory
from .models import Notification


@pytest.mark.django_db
class TestNotificationModel:
    def test_created_unread_by_default(self):
        user = UserFactory(role='dos')
        n = Notification.objects.create(user=user, title='Test', message='Hi', type='announcement')
        assert n.is_read is False
        assert n.read_at is None


@pytest.mark.django_db
class TestNotificationListView:
    def test_requires_authentication(self, api_client):
        response = api_client.get('/imboni/notifications/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_only_returns_own_notifications(self, make_authenticated_client):
        client, user = make_authenticated_client('dos')
        other = UserFactory(role='teacher')
        Notification.objects.create(user=user, title='Mine', message='x', type='results')
        Notification.objects.create(user=other, title='Not mine', message='x', type='results')

        response = client.get('/imboni/notifications/')

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]['title'] == 'Mine'


@pytest.mark.django_db
class TestNotificationMarkReadView:
    def test_mark_read_updates_status(self, make_authenticated_client):
        client, user = make_authenticated_client('dos')
        notification = Notification.objects.create(user=user, title='X', message='x', type='results')

        response = client.patch(f'/imboni/notifications/{notification.id}/read/')

        assert response.status_code == status.HTTP_200_OK
        notification.refresh_from_db()
        assert notification.is_read is True

    def test_cannot_mark_someone_elses_notification_read(self, make_authenticated_client):
        owner = UserFactory(role='dos')
        notification = Notification.objects.create(user=owner, title='X', message='x', type='results')
        client, _other = make_authenticated_client('teacher')

        response = client.patch(f'/imboni/notifications/{notification.id}/read/')

        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
class TestNotificationMarkAllReadView:
    def test_marks_all_unread_as_read(self, make_authenticated_client):
        client, user = make_authenticated_client('dos')
        Notification.objects.create(user=user, title='A', message='x', type='results')
        Notification.objects.create(user=user, title='B', message='x', type='staff')

        response = client.patch('/imboni/notifications/read-all/')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['updated'] == 2
        assert Notification.objects.filter(user=user, is_read=False).count() == 0
