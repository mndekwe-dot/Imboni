"""
Telling the other person a message has arrived.

Until this existed a message was only ever discovered by someone who already had
the app open: nothing wrote a notification, so there was no bell entry, no push
to a closed browser and no email. A parent who was written to by a teacher
learned nothing until they happened to look.

Two rules keep it from becoming noise:

* One notification per conversation. A second message in a thread the person has
  not opened replaces the first ("3 new messages") instead of stacking up.
* Email only for the first unread message in a thread. Further messages ride on
  the in-app and push channels, so a quick back-and-forth is not forty emails.

The recipient's preferences still decide the channels (see notify_user): they
can silence push and email, never switch on one the sender did not ask for.
"""
import logging

from apps.notifications.models import Notification
from apps.notifications.services import notify_user

logger = logging.getLogger(__name__)

# Where each role's own messages page lives. A single path would 404 or bounce
# a pupil into a staff portal.
MESSAGES_PATH = {
    'student': '/student/messages', 'parent': '/parent/messages',
    'teacher': '/teacher/messages', 'dos': '/dos/messages',
    'discipline': '/discipline/messages', 'matron': '/matron/messages',
    'admin': '/admin/messages', 'librarian': '/library/messages',
    'bursar': '/finance/messages',
}
PREVIEW_CHARS = 120


def _path_for(user, conversation):
    base = MESSAGES_PATH.get(user.role, '/')
    return f'{base}?conversation={conversation.id}'


def notify_new_message(message):
    """Notify every other participant of ``message``. Never raises."""
    try:
        conversation = message.conversation
        sender = message.sender
        sender_name = sender.get_full_name() or sender.username
        text = (message.content or '').strip() or 'Sent an attachment'
        preview = text if len(text) <= PREVIEW_CHARS else text[:PREVIEW_CHARS - 1] + '…'

        for recipient in conversation.participants.exclude(pk=sender.pk).filter(is_active=True):
            path = _path_for(recipient, conversation)
            unread = conversation.messages.filter(
                is_read=False).exclude(sender=recipient).count()
            earlier = Notification.objects.filter(
                user=recipient, type='message', path=path, is_read=False)
            first = not earlier.exists()
            # Replace rather than stack: the newest line is what matters.
            earlier.delete()

            title = (f'{sender_name} sent you a message' if unread <= 1
                     else f'{sender_name}: {unread} new messages')
            notify_user(recipient, title, preview, type='message', path=path,
                        send_email=first)
    except Exception:  # noqa: BLE001 - a notification must never fail a send
        logger.warning('Could not notify recipients of message %s',
                       getattr(message, 'pk', '?'), exc_info=True)
