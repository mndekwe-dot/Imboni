"""A new message must reach the person it is for, once and in the right place."""
import pytest

from apps.authentication.factories import UserFactory
from apps.notifications.models import Notification
from .models import Conversation, Message, MessageReadReceipt

pytestmark = pytest.mark.django_db(transaction=True)

CONVS = '/imboni/messages/conversations/'


def thread(a, b):
    c = Conversation.objects.create(subject='Chat')
    c.participants.add(a, b)
    return c


def send(client, conv, text):
    return client.post(f'{CONVS}{conv.id}/messages/', {'content': text}, format='json')


def test_the_recipient_gets_a_notice_pointing_at_their_own_portal(make_authenticated_client):
    client, teacher = make_authenticated_client('teacher')
    parent = UserFactory(role='parent')
    conv = thread(teacher, parent)

    assert send(client, conv, 'Please call me').status_code == 201

    n = Notification.objects.get(user=parent)
    assert n.type == 'message'
    assert n.path == f'/parent/messages?thread={conv.id}'
    assert 'Please call me' in n.message
    assert not Notification.objects.filter(user=teacher).exists()   # not the sender


def test_a_second_unread_message_replaces_the_first_instead_of_stacking(make_authenticated_client):
    client, teacher = make_authenticated_client('teacher')
    parent = UserFactory(role='parent')
    conv = thread(teacher, parent)

    send(client, conv, 'one')
    send(client, conv, 'two')

    notes = Notification.objects.filter(user=parent, type='message')
    assert notes.count() == 1
    assert '2 new messages' in notes.first().title
    assert notes.first().message == 'two'


def test_starting_a_conversation_with_a_first_line_notifies(make_authenticated_client):
    client, parent = make_authenticated_client('parent')
    teacher = UserFactory(role='teacher')

    client.post(CONVS, {'recipient': str(teacher.id), 'content': 'Hello'}, format='json')

    assert Notification.objects.filter(user=teacher, type='message').count() == 1


def test_opening_the_thread_clears_the_notice_and_leaves_a_receipt(make_authenticated_client):
    client, parent = make_authenticated_client('parent')
    teacher = UserFactory(role='teacher')
    conv = thread(parent, teacher)
    msg = Message.objects.create(conversation=conv, sender=teacher, content='Hi')
    from apps.messages.notify import notify_new_message
    notify_new_message(msg)
    assert Notification.objects.filter(user=parent, is_read=False).count() == 1

    client.get(f'{CONVS}{conv.id}/messages/')

    assert Notification.objects.filter(user=parent, is_read=False).count() == 0
    assert MessageReadReceipt.objects.filter(message=msg, user=parent).exists()


def test_a_switched_off_push_still_leaves_the_notice_in_the_feed(make_authenticated_client):
    client, teacher = make_authenticated_client('teacher')
    parent = UserFactory(role='parent')
    from apps.authentication.models import UserPreferences
    UserPreferences.objects.update_or_create(user=parent, defaults={'notification_push': False})
    conv = thread(teacher, parent)

    send(client, conv, 'hello')

    assert Notification.objects.filter(user=parent, type='message').exists()


def test_a_parent_can_now_reach_the_bursar_and_the_librarian(make_authenticated_client):
    client, parent = make_authenticated_client('parent')
    bursar = UserFactory(role='bursar')
    librarian = UserFactory(role='librarian')

    for person in (bursar, librarian):
        r = client.post(CONVS, {'recipient': str(person.id), 'content': 'Hi'}, format='json')
        assert r.status_code == 201
