"""
SMS delivery through Africa's Talking.

Kept deliberately thin: one `send_sms()` that either sends or explains why it
did not. Callers treat SMS as best-effort — a failed message is logged and
never breaks the request or the in-app notification that triggered it.

Configuration (all from .env, see settings.py):

    AFRICASTALKING_USERNAME   'sandbox' while testing, your app name in production
    AFRICASTALKING_API_KEY    from the Africa's Talking dashboard
    AFRICASTALKING_SENDER_ID  optional; the shortcode/alphanumeric sender

With no API key configured the module reports itself unavailable and every
send is a logged no-op, so development and CI need no credentials.
"""
import logging
import re

from django.conf import settings

logger = logging.getLogger(__name__)

# Rwanda's country code, used to normalise the local 07XXXXXXXX form that
# staff actually type into the +2507XXXXXXXX that Africa's Talking requires.
_DEFAULT_COUNTRY_CODE = '+250'


def is_configured():
    """True when there is enough config to attempt a send."""
    return bool(
        getattr(settings, 'AFRICASTALKING_USERNAME', '')
        and getattr(settings, 'AFRICASTALKING_API_KEY', '')
    )


def normalise_number(raw):
    """
    Return a phone number in E.164, or '' if it cannot be made into one.

    Accepts the shapes people actually enter: '0788123456', '250788123456',
    '+250 788 123 456', '(0788) 123-456'. Anything else is rejected rather
    than guessed at — a wrong number is worse than no message.
    """
    if not raw:
        return ''

    digits = re.sub(r'[^\d+]', '', str(raw))
    if not digits:
        return ''

    if digits.startswith('+'):
        return digits if len(digits) >= 10 else ''

    # 0788123456 -> +250788123456
    if digits.startswith('0') and len(digits) >= 9:
        return f"{_DEFAULT_COUNTRY_CODE}{digits[1:]}"

    # 250788123456 -> +250788123456
    if digits.startswith('250') and len(digits) >= 12:
        return f"+{digits}"

    # Bare local number, 9 digits: 788123456 -> +250788123456
    if len(digits) == 9:
        return f"{_DEFAULT_COUNTRY_CODE}{digits}"

    return ''


def send_sms(to, message):
    """
    Send one SMS. Returns True when Africa's Talking accepted it.

    Never raises: an SMS is a notification channel, not the transaction.
    """
    number = normalise_number(to)
    if not number:
        logger.warning('SMS skipped: could not normalise recipient %r', to)
        return False

    if not is_configured():
        logger.info('SMS skipped for %s: Africa\'s Talking is not configured', number)
        return False

    try:
        import africastalking
    except ImportError:
        logger.warning('SMS skipped: the africastalking package is not installed')
        return False

    try:
        africastalking.initialize(
            settings.AFRICASTALKING_USERNAME,
            settings.AFRICASTALKING_API_KEY,
        )
        sender = getattr(settings, 'AFRICASTALKING_SENDER_ID', '') or None
        kwargs = {'message': message, 'recipients': [number]}
        if sender:
            kwargs['sender_id'] = sender

        response = africastalking.SMS.send(**kwargs)

        # Africa's Talking answers 200 even for per-recipient failures, so the
        # per-recipient status is the only honest success signal.
        recipients = (response or {}).get('SMSMessageData', {}).get('Recipients', [])
        if not recipients:
            logger.warning('SMS to %s returned no recipient status: %r', number, response)
            return False

        status = recipients[0].get('status', '')
        if status.lower() != 'success':
            logger.warning('SMS to %s rejected by Africa\'s Talking: %s', number, status)
            return False

        return True
    except Exception:
        logger.warning('SMS to %s failed', number, exc_info=True)
        return False
