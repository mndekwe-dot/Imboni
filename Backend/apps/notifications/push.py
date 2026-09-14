"""
Web Push delivery (VAPID).

This is the channel that reaches a parent whose phone is in their pocket and
whose browser is closed — the one thing the in-app feed and the WebSocket
cannot do.

Configuration (.env):

    VAPID_PUBLIC_KEY     base64url, also served to the browser
    VAPID_PRIVATE_KEY    base64url, secret
    VAPID_ADMIN_EMAIL    contact address the push service can reach you on

Generate a keypair once:

    from py_vapid import Vapid01
    from py_vapid.utils import b64urlencode
    from cryptography.hazmat.primitives import serialization as s

    v = Vapid01(); v.generate_keys()
    public  = b64urlencode(v.public_key.public_bytes(
        s.Encoding.X962, s.PublicFormat.UncompressedPoint))
    private = b64urlencode(
        v.private_key.private_numbers().private_value.to_bytes(32, 'big'))

The encodings matter: the raw uncompressed P-256 point for the public key, the
raw 32-byte scalar for the private key. py_vapid's `public_pem`/`private_pem`
helpers are NOT what a browser or pywebpush expect, and a wrongly-encoded key
stays silent until the first real push fails.

Both keys go in .env. Changing them later invalidates every existing
subscription — every browser has to re-subscribe — so generate once and keep
the private key out of the repo.

With no keys configured this module reports itself unavailable and every send
is a logged no-op, so development and CI need no credentials.
"""
import json
import logging

from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)

# Push services reject anything much over 4 KB once encrypted.
_MAX_PAYLOAD_BYTES = 3500


def is_configured():
    """True when a VAPID keypair is present."""
    return bool(
        getattr(settings, 'VAPID_PUBLIC_KEY', '')
        and getattr(settings, 'VAPID_PRIVATE_KEY', '')
    )


def public_key():
    """The key the browser needs in order to subscribe."""
    return getattr(settings, 'VAPID_PUBLIC_KEY', '')


def _claims():
    email = getattr(settings, 'VAPID_ADMIN_EMAIL', '') or 'admin@example.com'
    return {'sub': f'mailto:{email}'}


def send_to_subscription(subscription, payload):
    """
    Deliver one payload to one browser.

    Returns True on success. A subscription the push service reports as gone
    (404/410) is deleted here — that is the only signal a browser ever gives
    that someone uninstalled the app or revoked permission, and keeping dead
    rows means retrying them forever.
    """
    if not is_configured():
        logger.info('Push skipped: no VAPID keys configured')
        return False

    try:
        from pywebpush import WebPushException, webpush
    except ImportError:
        logger.warning('Push skipped: the pywebpush package is not installed')
        return False

    body = json.dumps(payload)
    if len(body.encode('utf-8')) > _MAX_PAYLOAD_BYTES:
        # Trim the message rather than let the push service reject the whole thing.
        trimmed = dict(payload)
        trimmed['body'] = (trimmed.get('body') or '')[:400] + '…'
        body = json.dumps(trimmed)

    try:
        webpush(
            subscription_info={
                'endpoint': subscription.endpoint,
                'keys': {'p256dh': subscription.p256dh, 'auth': subscription.auth},
            },
            data=body,
            vapid_private_key=settings.VAPID_PRIVATE_KEY,
            vapid_claims=_claims(),
            timeout=10,
        )
    except WebPushException as exc:
        status = getattr(getattr(exc, 'response', None), 'status_code', None)
        if status in (404, 410):
            logger.info('Push subscription %s is gone (%s) — deleting',
                        subscription.pk, status)
            subscription.delete()
        else:
            logger.warning('Push to subscription %s failed (%s)',
                           subscription.pk, status, exc_info=True)
        return False
    except Exception:
        logger.warning('Push to subscription %s failed', subscription.pk, exc_info=True)
        return False

    try:
        subscription.last_used_at = timezone.now()
        subscription.save(update_fields=['last_used_at'])
    except Exception:
        pass  # bookkeeping only — the notification was delivered

    return True


def send_to_user(user, title, body, path='', tag=''):
    """
    Push to every browser this user has subscribed. Returns delivered count.

    Never raises. Callers treat push as best-effort, exactly like the
    WebSocket broadcast and the email copy.
    """
    if user is None or not is_configured():
        return 0

    from .models import PushSubscription

    payload = {'title': title, 'body': body, 'path': path, 'tag': tag or 'imboni'}

    delivered = 0
    try:
        subscriptions = list(PushSubscription.objects.filter(user=user))
    except Exception:
        logger.warning('Could not load push subscriptions for user %s',
                       getattr(user, 'pk', '?'), exc_info=True)
        return 0

    for subscription in subscriptions:
        if send_to_subscription(subscription, payload):
            delivered += 1
    return delivered
