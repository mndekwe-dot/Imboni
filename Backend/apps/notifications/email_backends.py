"""
A Django email backend that sends through Resend's HTTP API.

Why an API backend rather than Resend's SMTP relay: many hosts block outbound
port 587, and an HTTPS call fails fast and loudly instead of hanging on a
blocked socket. Everything already written against `send_mail()` and
`EmailMultiAlternatives` keeps working unchanged — this only swaps the wire.

Configuration (.env):

    EMAIL_PROVIDER=resend
    RESEND_API_KEY=re_...
    DEFAULT_FROM_EMAIL=Imboni School <noreply@yourdomain>

The From address must be on a domain you have verified in Resend, otherwise
every send is rejected. Until the domain is verified, Resend only allows
sending to the account owner's own address.
"""
import logging

from django.conf import settings
from django.core.mail.backends.base import BaseEmailBackend

logger = logging.getLogger(__name__)


class ResendEmailBackend(BaseEmailBackend):
    """
    Sends each EmailMessage through Resend.

    Honours `fail_silently`, so callers that already accept best-effort
    delivery (the notification path) keep that behaviour, while callers that
    must know about a failure (password reset) still raise.
    """

    def __init__(self, fail_silently=False, **kwargs):
        super().__init__(fail_silently=fail_silently, **kwargs)
        self.api_key = getattr(settings, 'RESEND_API_KEY', '')

    def send_messages(self, email_messages):
        if not email_messages:
            return 0

        if not self.api_key:
            msg = 'RESEND_API_KEY is not set — no email can be sent.'
            if self.fail_silently:
                logger.warning(msg)
                return 0
            raise ValueError(msg)

        try:
            import resend
        except ImportError:
            msg = 'The resend package is not installed.'
            if self.fail_silently:
                logger.warning(msg)
                return 0
            raise

        resend.api_key = self.api_key

        sent = 0
        for message in email_messages:
            if self._send(resend, message):
                sent += 1
        return sent

    def _send(self, resend, message):
        recipients = list(message.to or [])
        if not recipients:
            return False

        payload = {
            'from': message.from_email or settings.DEFAULT_FROM_EMAIL,
            'to': recipients,
            'subject': message.subject or '',
            'text': message.body or '',
        }
        if message.cc:
            payload['cc'] = list(message.cc)
        if message.bcc:
            payload['bcc'] = list(message.bcc)
        if message.reply_to:
            payload['reply_to'] = list(message.reply_to)

        # EmailMultiAlternatives carries the HTML part alongside the plain text.
        for content, mimetype in getattr(message, 'alternatives', []) or []:
            if mimetype == 'text/html':
                payload['html'] = content
                break

        try:
            resend.Emails.send(payload)
            return True
        except Exception:
            logger.warning('Resend rejected an email to %s', recipients, exc_info=True)
            if not self.fail_silently:
                raise
            return False
