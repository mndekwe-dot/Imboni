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
            'participants': [str(teacher.id)],
            'subject': 'Question about Michael',
        })

        assert response.status_code == status.HTTP_201_CREATED
        conversation = Conversation.objects.get(id=response.data['id'])
        participant_ids = set(conversation.participants.values_list('id', flat=True))
        assert parent.id in participant_ids
        assert teacher.id in participant_ids

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
