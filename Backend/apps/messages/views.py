from rest_framework import generics, permissions, status
from rest_framework.response import Response
from django.http import Http404
from django.utils import timezone
from .models import Conversation, Message
from .serializers import ConversationSerializer, MessageSerializer


class ConversationListCreateView(generics.ListCreateAPIView):
    """
    GET  /imboni/messages/conversations/  — list the logged-in user's conversations
    POST /imboni/messages/conversations/  — start a new conversation

    POST body:
    {
        "participants": ["<teacher-uuid>"],   // other participants (self is added automatically)
        "subject": "Question about Michael"
    }
    """
    serializer_class = ConversationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return (
            Conversation.objects
            .filter(participants=self.request.user)
            .prefetch_related('participants', 'messages')
            .order_by('-updated_at')
        )

    def perform_create(self, serializer):
        conversation = serializer.save()
        # Always add the sender as a participant
        conversation.participants.add(self.request.user)


class MessageListCreateView(generics.ListCreateAPIView):
    """
    GET  /imboni/messages/conversations/<conv_id>/messages/  — read messages
    POST /imboni/messages/conversations/<conv_id>/messages/  — send a message

    POST body:
    {
        "content": "Hello Mr. King..."
    }
    """
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def _get_conversation_for_participant(self):
        """
        Without this check, any authenticated user could read or post to any
        conversation just by knowing its ID — there was previously no
        verification that the requester is actually a participant.
        """
        try:
            conversation = Conversation.objects.get(pk=self.kwargs['conversation_pk'])
        except Conversation.DoesNotExist:
            raise Http404
        if not conversation.participants.filter(pk=self.request.user.pk).exists():
            raise Http404
        return conversation

    def get_queryset(self):
        conversation = self._get_conversation_for_participant()
        return (
            Message.objects
            .filter(conversation=conversation)
            .select_related('sender')
            .order_by('created_at')
        )

    def perform_create(self, serializer):
        conversation = self._get_conversation_for_participant()
        serializer.save(sender=self.request.user, conversation=conversation)
        # Mark conversation as updated
        conversation.updated_at = timezone.now()
        conversation.save(update_fields=['updated_at'])
