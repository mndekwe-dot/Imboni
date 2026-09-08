"""
Small helpers for creating in-app notifications from anywhere in the codebase.

Usage:
    from apps.notifications.services import notify_user, notify_users, notify_parents_of

    notify_user(user, 'Absence recorded', 'John was marked absent today.', 'attendance', '/parent/attendance')
    notify_parents_of(student, 'Incident reported', '...', 'attendance')

Every notification created here is also pushed over the recipient's WebSocket
(see consumers.py). The push is scheduled with `transaction.on_commit`, so a
notification that gets rolled back is never delivered, and it is strictly
best-effort: a dead Redis / channel layer logs a warning and never breaks the
request that created the notification.
"""
import logging

from django.db import connection, transaction

from .models import Notification

logger = logging.getLogger(__name__)


def _broadcast(notification, schema_name):
    """Push one notification to its recipient's channel group. Never raises."""
    try:
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer

        from .consumers import notification_group_name
        from .serializers import NotificationSerializer

        layer = get_channel_layer()
        if layer is None:          # channels not configured — polling still works
            return False

        group = notification_group_name(schema_name, notification.user_id)
        payload = NotificationSerializer(notification).data
        async_to_sync(layer.group_send)(group, {
            'type': 'notify',                 # -> NotificationConsumer.notify()
            'notification': payload,
        })
        return True
    except Exception:
        # Delivery is a nice-to-have; the REST poll is the source of truth.
        logger.warning('Notification WebSocket broadcast failed for %s',
                       getattr(notification, 'pk', '?'), exc_info=True)
        return False


def _schedule_broadcast(notification):
    """
    Queue the push for after the surrounding transaction commits.

    The schema is captured NOW, on the request's connection, because the
    on_commit callback may run once the tenant context has already moved on.
    """
    schema_name = getattr(connection, 'schema_name', None)
    if not schema_name:
        return
    try:
        transaction.on_commit(lambda: _broadcast(notification, schema_name))
    except Exception:
        logger.warning('Could not schedule notification broadcast', exc_info=True)


def _preferences_for(user):
    """
    The user's notification toggles, or None if they cannot be loaded.

    None means "no opinion recorded" and every caller below treats that as
    the permissive default — a missing preferences row must never silently
    swallow a notification.
    """
    try:
        from apps.authentication.models import UserPreferences
        prefs, _ = UserPreferences.objects.get_or_create(user=user)
        return prefs
    except Exception:
        logger.warning('Could not load notification preferences for user %s',
                       getattr(user, 'pk', '?'), exc_info=True)
        return None


def _schedule_email(user, title, message):
    """
    Queue the email copy of a notification after the transaction commits.

    Best-effort, exactly like the WebSocket push: the in-app notification is
    the source of truth, and a broken mail backend must not fail the request
    that created it.
    """
    address = (getattr(user, 'email', '') or '').strip()
    if not address:
        return
    try:
        from .tasks import safe_delay, send_email_task
        transaction.on_commit(
            lambda: safe_delay(send_email_task, title, message, [address])
        )
    except Exception:
        logger.warning('Could not schedule notification email for %s',
                       getattr(user, 'pk', '?'), exc_info=True)


def _schedule_sms(user, message):
    """Queue an SMS copy after commit. Best-effort, like every other channel."""
    raw = (getattr(user, 'phone_number', '') or '').strip()
    if not raw:
        return
    try:
        from .sms import is_configured
        if not is_configured():
            return          # no provider wired up: stay quiet rather than retry
        from .tasks import safe_delay, send_sms_task
        transaction.on_commit(
            lambda: safe_delay(send_sms_task, raw, message)
        )
    except Exception:
        logger.warning('Could not schedule notification SMS for %s',
                       getattr(user, 'pk', '?'), exc_info=True)


def _schedule_push(user, title, message, path):
    """Queue a Web Push copy after commit. Best-effort."""
    try:
        from .push import is_configured
        if not is_configured():
            return          # no VAPID keys: the WebSocket broadcast still runs
        from .tasks import safe_delay, send_push_task
        user_id = user.pk
        transaction.on_commit(
            lambda: safe_delay(send_push_task, user_id, title, message, path)
        )
    except Exception:
        logger.warning('Could not schedule web push for %s',
                       getattr(user, 'pk', '?'), exc_info=True)


def notify_user(user, title, message, type='announcement', path='', send_email=False,
                send_sms=False):
    """
    Create a single notification. Returns the Notification, or None on failure.

    The recipient's preferences (Account -> Notifications) are honoured here:

    * `notification_push`  gates both live deliveries — the WebSocket broadcast
      and the Web Push notice that reaches a closed browser. Turning it off
      stops those; the notification is still created and still shows up in the
      feed, because the feed is the record of what happened, not a channel.
    * `notification_email` gates the email copy — but only for callers that
      asked for one by passing `send_email=True`.
    * `notification_sms`   gates the SMS copy, likewise only for callers that
      passed `send_sms=True`. SMS costs money per message, so it is opt-in at
      the call site and vetoable by the recipient.

    Every preference is a veto, never a trigger: routine in-app notices do not
    become email or SMS just because a toggle is on.
    """
    if user is None:
        return None
    try:
        notification = Notification.objects.create(
            user=user, title=title, message=message, type=type, path=path,
        )
    except Exception:
        return None

    prefs = _preferences_for(user)

    if prefs is None or prefs.notification_push:
        _schedule_broadcast(notification)
        _schedule_push(user, title, message, path)

    if send_email and (prefs is None or prefs.notification_email):
        _schedule_email(user, title, message)

    if send_sms and (prefs is None or prefs.notification_sms):
        _schedule_sms(user, f'{title}: {message}')

    return notification


def notify_users(users, title, message, type='announcement', path='', send_email=False,
                 send_sms=False):
    """Create the same notification for several users. Returns count created."""
    created = 0
    for u in users:
        if notify_user(u, title, message, type, path,
                       send_email=send_email, send_sms=send_sms):
            created += 1
    return created


def notify_parents_of(student, title, message, type='announcement', path='',
                      send_email=False, send_sms=False):
    """
    Notify every parent/guardian linked to a student.
    Returns count of notifications created.
    """
    from apps.parents.models import ParentStudentRelationship
    parent_users = [
        rel.parent for rel in
        ParentStudentRelationship.objects.filter(student=student).select_related('parent')
    ]
    return notify_users(parent_users, title, message, type, path,
                        send_email=send_email, send_sms=send_sms)


def notify_role(role, title, message, type='announcement', path='',
                send_email=False, send_sms=False):
    """Notify every active user with a given role (e.g. 'admin', 'discipline')."""
    from apps.authentication.models import User
    users = User.objects.filter(role=role, is_active=True)
    return notify_users(users, title, message, type, path,
                        send_email=send_email, send_sms=send_sms)
