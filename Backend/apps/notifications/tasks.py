"""
Shared Celery tasks for notifications and email, plus safe_delay() — the
helper every request-path caller should use so the app keeps working when
no broker is running (common in development).
"""
import socket
import time
from urllib.parse import urlparse

from celery import shared_task

# Cached broker probe: kombu retries a dead broker for ~100s, which would hang
# any request that tries to queue a task. A raw 1s TCP check, cached for 30s,
# keeps safe_delay() fast whether Redis is up or not.
_broker_state = {'ok': None, 'checked_at': 0.0}
_BROKER_PROBE_TTL = 30


def _broker_reachable():
    now = time.time()
    if _broker_state['ok'] is not None and now - _broker_state['checked_at'] < _BROKER_PROBE_TTL:
        return _broker_state['ok']

    from django.conf import settings
    url = urlparse(getattr(settings, 'CELERY_BROKER_URL', ''))
    host = url.hostname or 'localhost'
    port = url.port or 6379
    try:
        sock = socket.create_connection((host, port), timeout=1)
        sock.close()
        ok = True
    except OSError:
        ok = False

    _broker_state['ok'] = ok
    _broker_state['checked_at'] = now
    return ok


def safe_delay(task, *args, **kwargs):
    """
    Queue the task when the broker is reachable; fall back to running it
    inline otherwise. Use this from views so a missing/downed Redis never
    breaks a request — the work just happens synchronously instead.
    """
    if _broker_reachable():
        try:
            return task.delay(*args, **kwargs)
        except Exception:
            return task.apply(args=args, kwargs=kwargs)
    return task.apply(args=args, kwargs=kwargs)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_email_task(self, subject, message, recipient_list, from_email=None):
    """Send one email with automatic retries (3 attempts, 60s apart)."""
    from django.conf import settings
    from django.core.mail import send_mail

    try:
        return send_mail(
            subject=subject,
            message=message,
            from_email=from_email or getattr(settings, 'DEFAULT_FROM_EMAIL', None),
            recipient_list=recipient_list,
            fail_silently=False,
        )
    except Exception as exc:
        raise self.retry(exc=exc)


@shared_task
def bulk_notify_task(user_ids, title, message, type='announcement', path=''):
    """Create the same in-app notification for many users, off the request path."""
    from apps.authentication.models import User
    from .services import notify_users

    users = User.objects.filter(id__in=user_ids, is_active=True)
    return notify_users(users, title, message, type, path)
