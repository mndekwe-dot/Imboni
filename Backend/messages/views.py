from rest_framework import generics, permissions, status
from rest_framework.response import Response
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

    def get_queryset(self):
        return (
            Message.objects
            .filter(conversation_id=self.kwargs['conversation_pk'])
            .select_related('sender')
            .order_by('created_at')
        )

    def perform_create(self, serializer):
        conversation = Conversation.objects.get(pk=self.kwargs['conversation_pk'])
        serializer.save(sender=self.request.user, conversation=conversation)
        # Mark conversation as updated
        conversation.updated_at = timezone.now()
        conversation.save(update_fields=['updated_at'])
