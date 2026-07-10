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


@pytest.mark.django_db
class TestCeleryTasks:
    def test_bulk_notify_task_creates_notifications(self):
        from .tasks import bulk_notify_task

        users = [UserFactory(role='parent') for _ in range(2)]
        inactive = UserFactory(role='parent', is_active=False)

        result = bulk_notify_task.apply(args=(
            [str(u.id) for u in users] + [str(inactive.id)],
            'Hello', 'Message body', 'announcement', '/parent',
        )).get()

        assert result == 2
        assert Notification.objects.filter(title='Hello').count() == 2
        assert not Notification.objects.filter(user=inactive).exists()

    def test_safe_delay_falls_back_to_inline_without_a_broker(self):
        from .tasks import safe_delay, bulk_notify_task

        user = UserFactory(role='parent')
        # No broker is running in the test environment — .delay() fails and
        # safe_delay must execute the task inline instead of raising.
        safe_delay(bulk_notify_task, [str(user.id)], 'Inline', 'Body')

        assert Notification.objects.filter(user=user, title='Inline').count() == 1

    def test_send_email_task_uses_locmem_backend(self, settings):
        from .tasks import send_email_task
        from django.core import mail

        settings.EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'
        sent = send_email_task.apply(args=('Subject', 'Body', ['parent@example.com'])).get()

        assert sent == 1
        assert len(mail.outbox) == 1
        assert mail.outbox[0].to == ['parent@example.com']


@pytest.mark.django_db
class TestPeriodicTaskWrappers:
    def test_due_date_reminder_task_runs_the_command(self):
        from apps.teacher.tasks import send_due_date_reminders_task
        result = send_due_date_reminders_task.apply(args=(1,)).get()
        assert 'reminder(s) sent' in result

    def test_weekly_digest_task_runs_the_command(self):
        from apps.parents.tasks import send_weekly_digest_task
        result = send_weekly_digest_task.apply(kwargs={'no_email': True}).get()
        assert 'digest(s) sent' in result

    def test_beat_schedule_points_at_real_tasks(self):
        from Imboni.celery import app
        from celery import current_app

        for entry in app.conf.beat_schedule.values():
            # Task must be registered — a typo here would fail silently at runtime
            assert entry['task'] in current_app.tasks or entry['task'].startswith('apps.')
            module_path, func_name = entry['task'].rsplit('.', 1)
            import importlib
            module = importlib.import_module(module_path)
            assert hasattr(module, func_name)
