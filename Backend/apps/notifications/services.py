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


def notify_user(user, title, message, type='announcement', path=''):
    """Create a single notification. Returns the Notification, or None on failure."""
    if user is None:
        return None
    try:
        notification = Notification.objects.create(
            user=user, title=title, message=message, type=type, path=path,
        )
    except Exception:
        return None
    _schedule_broadcast(notification)
    return notification


def notify_users(users, title, message, type='announcement', path=''):
    """Create the same notification for several users. Returns count created."""
    created = 0
    for u in users:
        if notify_user(u, title, message, type, path):
            created += 1
    return created


def notify_parents_of(student, title, message, type='announcement', path=''):
    """
    Notify every parent/guardian linked to a student.
    Returns count of notifications created.
    """
    from apps.parents.models import ParentStudentRelationship
    parent_users = [
        rel.parent for rel in
        ParentStudentRelationship.objects.filter(student=student).select_related('parent')
    ]
    return notify_users(parent_users, title, message, type, path)


def notify_role(role, title, message, type='announcement', path=''):
    """Notify every active user with a given role (e.g. 'admin', 'discipline')."""
    from apps.authentication.models import User
    users = User.objects.filter(role=role, is_active=True)
    return notify_users(users, title, message, type, path)
