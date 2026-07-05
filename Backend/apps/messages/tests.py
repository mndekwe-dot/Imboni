import pytest
from rest_framework import status
from apps.authentication.factories import UserFactory
from .models import Conversation, Message


@pytest.mark.django_db
class TestConversationListCreateView:
    def test_create_conversation_adds_sender_as_participant(self, make_authenticated_client):
        client, parent = make_authenticated_client('parent')
        teacher = UserFactory(role='teacher')

        response = client.post('/imboni/messages/conversations/', {
            'recipient': str(teacher.id),
            'subject': 'Question about Michael',
            'content': 'Hello, a quick question.',
        }, format='json')

        assert response.status_code == status.HTTP_201_CREATED
        conversation = Conversation.objects.get(id=response.data['id'])
        participant_ids = set(conversation.participants.values_list('id', flat=True))
        assert parent.id in participant_ids
        assert teacher.id in participant_ids
        # The optional first message was sent
        assert conversation.messages.filter(sender=parent, content='Hello, a quick question.').exists()

    def test_starting_a_second_conversation_reuses_the_existing_thread(self, make_authenticated_client):
        client, parent = make_authenticated_client('parent')
        teacher = UserFactory(role='teacher')

        r1 = client.post('/imboni/messages/conversations/',
                         {'recipient': str(teacher.id), 'content': 'First'}, format='json')
        r2 = client.post('/imboni/messages/conversations/',
                         {'recipient': str(teacher.id), 'content': 'Second'}, format='json')

        assert r1.data['id'] == r2.data['id']            # same thread, not a duplicate
        assert Conversation.objects.filter(participants=parent).count() == 1

    def test_list_only_returns_own_conversations(self, make_authenticated_client):
        client, parent = make_authenticated_client('parent')
        teacher = UserFactory(role='teacher')
        other_parent = UserFactory(role='parent')

        mine = Conversation.objects.create(subject='Mine')
        mine.participants.add(parent, teacher)

        not_mine = Conversation.objects.create(subject='Not mine')
        not_mine.participants.add(other_parent, teacher)

        response = client.get('/imboni/messages/conversations/')

        results = response.data['results'] if isinstance(response.data, dict) else response.data
        subjects = [c['subject'] for c in results]
        assert subjects == ['Mine']

    def test_unauthenticated_cannot_list_conversations(self, api_client):
        response = api_client.get('/imboni/messages/conversations/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_last_message_reflects_most_recent_message(self, make_authenticated_client):
        client, parent = make_authenticated_client('parent')
        teacher = UserFactory(role='teacher')
        conversation = Conversation.objects.create(subject='Chat')
        conversation.participants.add(parent, teacher)
        Message.objects.create(conversation=conversation, sender=parent, content='First')
        Message.objects.create(conversation=conversation, sender=teacher, content='Second')

        response = client.get('/imboni/messages/conversations/')

        results = response.data['results'] if isinstance(response.data, dict) else response.data
        assert results[0]['last_message']['content'] == 'Second'


@pytest.mark.django_db
class TestMessageListCreateView:
    def test_participant_can_send_message(self, make_authenticated_client):
        client, parent = make_authenticated_client('parent')
        teacher = UserFactory(role='teacher')
        conversation = Conversation.objects.create(subject='Chat')
        conversation.participants.add(parent, teacher)

        response = client.post(
            f'/imboni/messages/conversations/{conversation.id}/messages/',
            {'content': 'Hello Mr. King'},
        )

        assert response.status_code == status.HTTP_201_CREATED
        message = Message.objects.get(conversation=conversation)
        assert message.sender == parent
        assert message.content == 'Hello Mr. King'

    def test_sending_message_updates_conversation_timestamp(self, make_authenticated_client):
        client, parent = make_authenticated_client('parent')
        conversation = Conversation.objects.create(subject='Chat')
        conversation.participants.add(parent)
        original_updated_at = conversation.updated_at

        client.post(
            f'/imboni/messages/conversations/{conversation.id}/messages/',
            {'content': 'Hello'},
        )

        conversation.refresh_from_db()
        assert conversation.updated_at >= original_updated_at

    def test_list_messages_ordered_by_creation(self, make_authenticated_client):
        client, parent = make_authenticated_client('parent')
        conversation = Conversation.objects.create(subject='Chat')
        conversation.participants.add(parent)
        Message.objects.create(conversation=conversation, sender=parent, content='First')
        Message.objects.create(conversation=conversation, sender=parent, content='Second')

        response = client.get(f'/imboni/messages/conversations/{conversation.id}/messages/')

        assert response.status_code == status.HTTP_200_OK
        results = response.data['results'] if isinstance(response.data, dict) else response.data
        contents = [m['content'] for m in results]
        assert contents == ['First', 'Second']

    def test_unauthenticated_cannot_send_message(self, api_client):
        conversation = Conversation.objects.create(subject='Chat')
        response = api_client.post(
            f'/imboni/messages/conversations/{conversation.id}/messages/',
            {'content': 'Hello'},
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_non_participant_cannot_read_or_post_to_a_conversation(self, make_authenticated_client):
        """
        Was a real access-control gap: MessageListCreateView only checked
        IsAuthenticated, never that request.user is actually one of
        conversation.participants. Fixed via _get_conversation_for_participant().
        """
        participant = UserFactory(role='parent')
        conversation = Conversation.objects.create(subject='Private chat')
        conversation.participants.add(participant)

        client, _intruder = make_authenticated_client('teacher')

        get_response = client.get(f'/imboni/messages/conversations/{conversation.id}/messages/')
        post_response = client.post(
            f'/imboni/messages/conversations/{conversation.id}/messages/',
            {'content': 'I should not be able to do this'},
        )

        assert get_response.status_code == status.HTTP_404_NOT_FOUND
        assert post_response.status_code == status.HTTP_404_NOT_FOUND

    def test_participant_can_read_and_post_to_their_own_conversation(self, make_authenticated_client):
        client, user = make_authenticated_client('teacher')
        conversation = Conversation.objects.create(subject='My chat')
        conversation.participants.add(user)

        get_response = client.get(f'/imboni/messages/conversations/{conversation.id}/messages/')
        post_response = client.post(
            f'/imboni/messages/conversations/{conversation.id}/messages/',
            {'content': 'Hello'},
        )

        assert get_response.status_code == status.HTTP_200_OK
        assert post_response.status_code == status.HTTP_201_CREATED


@pytest.mark.django_db
class TestMessagingSafeguardingPolicy:
    """Staff-mediated policy: pupils/parents may only message staff."""

    def test_student_cannot_message_another_student(self, make_authenticated_client):
        client, _student = make_authenticated_client('student')
        other_student = UserFactory(role='student')

        response = client.post('/imboni/messages/conversations/',
                               {'recipient': str(other_student.id), 'content': 'hey'}, format='json')

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert Conversation.objects.count() == 0

    def test_parent_cannot_message_another_parent(self, make_authenticated_client):
        client, _parent = make_authenticated_client('parent')
        other_parent = UserFactory(role='parent')

        response = client.post('/imboni/messages/conversations/',
                               {'recipient': str(other_parent.id), 'content': 'hi'}, format='json')

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_student_can_message_a_teacher(self, make_authenticated_client):
        client, _student = make_authenticated_client('student')
        teacher = UserFactory(role='teacher')

        response = client.post('/imboni/messages/conversations/',
                               {'recipient': str(teacher.id), 'content': 'Question about homework'}, format='json')

        assert response.status_code == status.HTTP_201_CREATED

    def test_staff_can_message_a_student(self, make_authenticated_client):
        client, _teacher = make_authenticated_client('teacher')
        student = UserFactory(role='student')

        response = client.post('/imboni/messages/conversations/',
                               {'recipient': str(student.id), 'content': 'Please see me after class'}, format='json')

        assert response.status_code == status.HTTP_201_CREATED


@pytest.mark.django_db
class TestMessageContactsView:
    def test_student_only_sees_staff_contacts(self, make_authenticated_client):
        client, _student = make_authenticated_client('student')
        teacher = UserFactory(role='teacher')
        matron = UserFactory(role='matron')
        other_student = UserFactory(role='student')
        a_parent = UserFactory(role='parent')

        response = client.get('/imboni/messages/contacts/')

        assert response.status_code == status.HTTP_200_OK
        ids = {c['id'] for c in response.data}
        assert str(teacher.id) in ids
        assert str(matron.id) in ids
        assert str(other_student.id) not in ids     # no pupil↔pupil
        assert str(a_parent.id) not in ids          # no pupil↔parent

    def test_staff_can_see_everyone(self, make_authenticated_client):
        client, _teacher = make_authenticated_client('teacher')
        student = UserFactory(role='student')
        parent = UserFactory(role='parent')

        response = client.get('/imboni/messages/contacts/')

        ids = {c['id'] for c in response.data}
        assert str(student.id) in ids
        assert str(parent.id) in ids

    def test_contacts_search_filters_by_name(self, make_authenticated_client):
        client, _student = make_authenticated_client('student')
        UserFactory(role='teacher', first_name='Grace', last_name='Uwase')
        UserFactory(role='teacher', first_name='Eric', last_name='Mugabo')

        response = client.get('/imboni/messages/contacts/', {'search': 'Grace'})

        names = [c['name'] for c in response.data]
        assert any('Grace' in n for n in names)
        assert all('Eric' not in n for n in names)


@pytest.mark.django_db
class TestUnreadCountsAndReadReceipts:
    def test_unread_count_reflects_incoming_messages(self, make_authenticated_client):
        client, parent = make_authenticated_client('parent')
        teacher = UserFactory(role='teacher')
        conv = Conversation.objects.create(subject='Chat')
        conv.participants.add(parent, teacher)
        Message.objects.create(conversation=conv, sender=teacher, content='Unread 1')
        Message.objects.create(conversation=conv, sender=teacher, content='Unread 2')
        Message.objects.create(conversation=conv, sender=parent, content='My own — not counted')

        response = client.get('/imboni/messages/conversations/')
        results = response.data['results'] if isinstance(response.data, dict) else response.data
        assert results[0]['unread_count'] == 2

    def test_opening_a_thread_marks_incoming_messages_read(self, make_authenticated_client):
        client, parent = make_authenticated_client('parent')
        teacher = UserFactory(role='teacher')
        conv = Conversation.objects.create(subject='Chat')
        conv.participants.add(parent, teacher)
        Message.objects.create(conversation=conv, sender=teacher, content='Unread')

        # Open the thread
        client.get(f'/imboni/messages/conversations/{conv.id}/messages/')

        # Now the conversation shows zero unread
        response = client.get('/imboni/messages/conversations/')
        results = response.data['results'] if isinstance(response.data, dict) else response.data
        assert results[0]['unread_count'] == 0

    def test_other_participant_is_reported_for_one_to_one(self, make_authenticated_client):
        client, parent = make_authenticated_client('parent')
        teacher = UserFactory(role='teacher', first_name='Grace', last_name='Uwase')
        conv = Conversation.objects.create(subject='Chat')
        conv.participants.add(parent, teacher)

        response = client.get('/imboni/messages/conversations/')
        results = response.data['results'] if isinstance(response.data, dict) else response.data
        other = results[0]['other_participant']
        assert other['name'] == 'Grace Uwase'
        assert other['role'] == 'teacher'
