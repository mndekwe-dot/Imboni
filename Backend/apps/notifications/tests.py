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


@pytest.mark.django_db(transaction=True)
class TestNotificationPreferencesAreHonoured:
    """
    The Account -> Notifications toggles were stored and rendered but never
    read by the send path, so switching one off changed nothing. These tests
    are the guard against that regressing.

    transaction=True so `transaction.on_commit` callbacks actually fire —
    inside the default atomic test case they would never run and every
    assertion about delivery would pass vacuously.
    """

    def _prefs(self, user, **flags):
        from apps.authentication.models import UserPreferences
        prefs, _ = UserPreferences.objects.get_or_create(user=user)
        for field, value in flags.items():
            setattr(prefs, field, value)
        prefs.save()
        return prefs

    def test_email_is_sent_when_caller_asks_and_preference_allows(self):
        from django.core import mail
        from apps.notifications.services import notify_user

        user = UserFactory(role='parent', email='parent@example.com')
        self._prefs(user, notification_email=True)
        mail.outbox.clear()

        notify_user(user, 'Results ready', 'Term 2 results are published.',
                    'results', send_email=True)

        assert len(mail.outbox) == 1
        assert mail.outbox[0].to == ['parent@example.com']
        assert mail.outbox[0].subject == 'Results ready'

    def test_email_preference_off_suppresses_the_email(self):
        from django.core import mail
        from apps.notifications.services import notify_user

        user = UserFactory(role='parent', email='parent@example.com')
        self._prefs(user, notification_email=False)
        mail.outbox.clear()

        notification = notify_user(user, 'Results ready', 'Published.',
                                   'results', send_email=True)

        assert len(mail.outbox) == 0
        # The in-app record still exists — the toggle governs delivery, not history.
        assert notification is not None
        assert Notification.objects.filter(pk=notification.pk).exists()

    def test_routine_notification_does_not_email_even_when_allowed(self):
        """send_email defaults to False: the preference is a veto, not a trigger."""
        from django.core import mail
        from apps.notifications.services import notify_user

        user = UserFactory(role='parent', email='parent@example.com')
        self._prefs(user, notification_email=True)
        mail.outbox.clear()

        notify_user(user, 'Announcement', 'Sports day moved.', 'announcement')

        assert len(mail.outbox) == 0

    def test_user_with_no_email_address_is_skipped_cleanly(self):
        from django.core import mail
        from apps.notifications.services import notify_user

        user = UserFactory(role='student', email='')
        self._prefs(user, notification_email=True)
        mail.outbox.clear()

        notification = notify_user(user, 'Results ready', 'Published.',
                                   'results', send_email=True)

        assert notification is not None
        assert len(mail.outbox) == 0

    def test_push_preference_off_suppresses_the_broadcast(self, monkeypatch):
        from apps.notifications import services

        user = UserFactory(role='teacher')
        self._prefs(user, notification_push=False)

        calls = []
        monkeypatch.setattr(services, '_broadcast',
                            lambda n, s: calls.append(n) or True)

        notification = services.notify_user(user, 'Conflict', 'Clash found.', 'timetable')

        assert calls == []
        assert notification is not None

    def test_push_preference_on_still_broadcasts(self, monkeypatch):
        from apps.notifications import services

        user = UserFactory(role='teacher')
        self._prefs(user, notification_push=True)

        calls = []
        monkeypatch.setattr(services, '_broadcast',
                            lambda n, s: calls.append(n) or True)

        services.notify_user(user, 'Conflict', 'Clash found.', 'timetable')

        assert len(calls) == 1

    def test_missing_preferences_row_defaults_to_delivering(self):
        """A user with no preferences row must not silently lose notifications."""
        from django.core import mail
        from apps.authentication.models import UserPreferences
        from apps.notifications.services import notify_user

        user = UserFactory(role='parent', email='parent@example.com')
        UserPreferences.objects.filter(user=user).delete()
        mail.outbox.clear()

        notification = notify_user(user, 'Results ready', 'Published.',
                                   'results', send_email=True)

        assert notification is not None
        assert len(mail.outbox) == 1

    def test_notify_users_passes_the_flag_through(self):
        from django.core import mail
        from apps.notifications.services import notify_users

        allowed = UserFactory(role='parent', email='yes@example.com')
        blocked = UserFactory(role='parent', email='no@example.com')
        self._prefs(allowed, notification_email=True)
        self._prefs(blocked, notification_email=False)
        mail.outbox.clear()

        created = notify_users([allowed, blocked], 'Fees due', 'Term 2 fees.',
                               'announcement', send_email=True)

        assert created == 2                       # both get the in-app record
        recipients = [addr for m in mail.outbox for addr in m.to]
        assert recipients == ['yes@example.com']  # only one gets the email


class TestSmsNumberNormalisation:
    """
    Africa's Talking needs E.164. Staff type whatever is on the form, so the
    normaliser is the only thing between a typed '0788…' and a silently
    undelivered message.
    """

    @pytest.mark.parametrize('raw,expected', [
        ('0788123456',      '+250788123456'),
        ('250788123456',    '+250788123456'),
        ('+250788123456',   '+250788123456'),
        ('788123456',       '+250788123456'),
        ('+250 788 123 456', '+250788123456'),
        ('(0788) 123-456',  '+250788123456'),
    ])
    def test_accepted_shapes(self, raw, expected):
        from apps.notifications.sms import normalise_number
        assert normalise_number(raw) == expected

    @pytest.mark.parametrize('raw', ['', None, 'not a number', '123', '+12'])
    def test_rejected_rather_than_guessed(self, raw):
        from apps.notifications.sms import normalise_number
        assert normalise_number(raw) == ''

    def test_unconfigured_send_is_a_no_op_not_an_error(self, settings):
        from apps.notifications.sms import send_sms
        settings.AFRICASTALKING_USERNAME = ''
        settings.AFRICASTALKING_API_KEY = ''
        assert send_sms('0788123456', 'hi') is False


@pytest.mark.django_db(transaction=True)
class TestSmsPreferenceGating:
    def _prefs(self, user, **flags):
        from apps.authentication.models import UserPreferences
        prefs, _ = UserPreferences.objects.get_or_create(user=user)
        for field, value in flags.items():
            setattr(prefs, field, value)
        prefs.save()
        return prefs

    def test_sms_sent_when_asked_and_allowed(self, settings, monkeypatch):
        from apps.notifications import services
        settings.AFRICASTALKING_USERNAME = 'sandbox'
        settings.AFRICASTALKING_API_KEY = 'test-key'

        user = UserFactory(role='parent', phone_number='0788123456')
        self._prefs(user, notification_sms=True)

        sent = []
        monkeypatch.setattr('apps.notifications.tasks.send_sms',
                            lambda to, msg: sent.append((to, msg)) or True,
                            raising=False)
        monkeypatch.setattr(services, '_schedule_sms',
                            lambda u, m: sent.append((u.phone_number, m)))

        services.notify_user(user, 'Absent', 'Marked absent.', 'attendance',
                             send_sms=True)

        assert len(sent) == 1
        assert sent[0][0] == '0788123456'
        assert 'Absent' in sent[0][1]

    def test_sms_preference_off_suppresses_it(self, settings, monkeypatch):
        from apps.notifications import services
        settings.AFRICASTALKING_USERNAME = 'sandbox'
        settings.AFRICASTALKING_API_KEY = 'test-key'

        user = UserFactory(role='parent', phone_number='0788123456')
        self._prefs(user, notification_sms=False)

        sent = []
        monkeypatch.setattr(services, '_schedule_sms', lambda u, m: sent.append(m))

        notification = services.notify_user(user, 'Absent', 'Marked absent.',
                                            'attendance', send_sms=True)

        assert sent == []
        assert notification is not None      # in-app record still created

    def test_no_sms_when_provider_unconfigured(self, settings):
        from apps.notifications.services import _schedule_sms
        settings.AFRICASTALKING_USERNAME = ''
        settings.AFRICASTALKING_API_KEY = ''
        user = UserFactory(role='parent', phone_number='0788123456')
        # Must not raise, and must not queue anything.
        assert _schedule_sms(user, 'hello') is None


@pytest.mark.django_db
class TestPushSubscriptionEndpoints:
    URL = '/imboni/notifications/push/subscribe/'

    def _body(self, endpoint='https://fcm.googleapis.com/fcm/send/abc123'):
        return {'endpoint': endpoint, 'keys': {'p256dh': 'BPk_key', 'auth': 'authsecret'}}

    def test_requires_authentication(self, api_client):
        assert api_client.post(self.URL, self._body(), format='json').status_code == \
            status.HTTP_401_UNAUTHORIZED

    def test_subscribe_creates_a_row(self, make_authenticated_client):
        from apps.notifications.models import PushSubscription
        client, user = make_authenticated_client('parent')

        response = client.post(self.URL, self._body(), format='json')

        assert response.status_code == status.HTTP_201_CREATED
        assert PushSubscription.objects.filter(user=user).count() == 1

    def test_resubscribing_same_browser_updates_not_duplicates(self, make_authenticated_client):
        from apps.notifications.models import PushSubscription
        client, user = make_authenticated_client('parent')

        client.post(self.URL, self._body(), format='json')
        second = client.post(self.URL, self._body(), format='json')

        assert second.status_code == status.HTTP_200_OK
        assert PushSubscription.objects.filter(user=user).count() == 1

    @pytest.mark.parametrize('bad', [
        {'endpoint': '', 'keys': {'p256dh': 'a', 'auth': 'b'}},
        {'endpoint': 'https://x/y', 'keys': {'p256dh': '', 'auth': 'b'}},
        {'endpoint': 'https://x/y', 'keys': {}},
    ])
    def test_incomplete_subscription_is_rejected(self, make_authenticated_client, bad):
        client, _ = make_authenticated_client('parent')
        assert client.post(self.URL, bad, format='json').status_code == \
            status.HTTP_400_BAD_REQUEST

    def test_unsubscribe_removes_only_your_own(self, make_authenticated_client):
        from apps.notifications.models import PushSubscription
        client, user = make_authenticated_client('parent')
        other = UserFactory(role='teacher')
        endpoint = 'https://fcm.googleapis.com/fcm/send/someone-else'
        PushSubscription.objects.create(user=other, endpoint=endpoint,
                                        p256dh='k', auth='a')

        response = client.delete(self.URL, {'endpoint': endpoint}, format='json')

        assert response.data['deleted'] == 0
        assert PushSubscription.objects.filter(endpoint=endpoint).exists()

    def test_public_key_reports_unconfigured_instead_of_erroring(self, make_authenticated_client, settings):
        settings.VAPID_PUBLIC_KEY = ''
        settings.VAPID_PRIVATE_KEY = ''
        client, _ = make_authenticated_client('parent')

        response = client.get('/imboni/notifications/push/key/')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['configured'] is False


@pytest.mark.django_db
class TestPushSending:
    def test_dead_subscription_is_deleted(self, settings, monkeypatch):
        """A 410 from the push service is the only signal a browser is gone."""
        from apps.notifications import push
        from apps.notifications.models import PushSubscription

        settings.VAPID_PUBLIC_KEY = 'pub'
        settings.VAPID_PRIVATE_KEY = 'priv'
        user = UserFactory(role='parent')
        sub = PushSubscription.objects.create(
            user=user, endpoint='https://fcm.googleapis.com/fcm/send/dead',
            p256dh='k', auth='a')

        class FakeResponse:
            status_code = 410

        class FakeWebPushException(Exception):
            def __init__(self):
                self.response = FakeResponse()

        def boom(**kwargs):
            raise FakeWebPushException()

        import sys, types
        fake = types.ModuleType('pywebpush')
        fake.webpush = boom
        fake.WebPushException = FakeWebPushException
        monkeypatch.setitem(sys.modules, 'pywebpush', fake)

        assert push.send_to_subscription(sub, {'title': 'x'}) is False
        assert not PushSubscription.objects.filter(pk=sub.pk).exists()

    def test_unconfigured_push_is_a_no_op(self, settings):
        from apps.notifications.push import send_to_user
        settings.VAPID_PUBLIC_KEY = ''
        settings.VAPID_PRIVATE_KEY = ''
        assert send_to_user(UserFactory(role='parent'), 'x', 'y') == 0


class TestResendEmailBackend:
    def test_missing_api_key_raises_unless_fail_silently(self, settings):
        from apps.notifications.email_backends import ResendEmailBackend
        from django.core.mail import EmailMessage

        settings.RESEND_API_KEY = ''
        message = EmailMessage('s', 'b', 'from@x.com', ['to@x.com'])

        with pytest.raises(ValueError):
            ResendEmailBackend(fail_silently=False).send_messages([message])

        assert ResendEmailBackend(fail_silently=True).send_messages([message]) == 0

    def test_html_alternative_is_forwarded(self, settings, monkeypatch):
        import sys, types
        from django.core.mail import EmailMultiAlternatives

        settings.RESEND_API_KEY = 're_test'
        captured = {}

        fake = types.ModuleType('resend')
        fake.api_key = None
        fake.Emails = types.SimpleNamespace(send=lambda payload: captured.update(payload))
        monkeypatch.setitem(sys.modules, 'resend', fake)

        from apps.notifications.email_backends import ResendEmailBackend
        message = EmailMultiAlternatives('Subject', 'plain', 'from@x.com', ['to@x.com'])
        message.attach_alternative('<b>rich</b>', 'text/html')

        assert ResendEmailBackend().send_messages([message]) == 1
        assert captured['html'] == '<b>rich</b>'
        assert captured['text'] == 'plain'
        assert captured['to'] == ['to@x.com']
