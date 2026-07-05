from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import Q
from django.http import Http404
from django.utils import timezone
from apps.authentication.models import User
from .models import Conversation, Message
from .serializers import (
    ConversationSerializer, MessageSerializer, STAFF_ROLES, ROLE_LABELS,
)


def _can_message(sender, recipient):
    """
    Staff-mediated policy: students and parents may only message staff.
    Staff may message anyone. Nobody messages themselves.
    """
    if sender.id == recipient.id:
        return False
    if sender.role in STAFF_ROLES:
        return True
    # student / parent → recipient must be staff
    return recipient.role in STAFF_ROLES


class MessageContactsView(APIView):
    """
    GET /imboni/messages/contacts/?search=&role=

    Who the current user is allowed to start a conversation with, per the
    staff-mediated policy. Students/parents see staff only; staff see everyone.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        me = request.user
        qs = User.objects.filter(is_active=True).exclude(pk=me.pk)

        if me.role not in STAFF_ROLES:
            # Pupils and parents may only reach staff — enforced here AND on
            # conversation creation (this endpoint is just the picker).
            qs = qs.filter(role__in=STAFF_ROLES)

        role = request.query_params.get('role', '').strip()
        if role:
            qs = qs.filter(role=role)

        search = request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search) |
                Q(email__icontains=search)
            )

        qs = qs.order_by('role', 'last_name', 'first_name')[:50]
        return Response([
            {
                'id':         str(u.id),
                'name':       u.get_full_name() or u.username,
                'role':       u.role,
                'role_label': ROLE_LABELS.get(u.role, u.role),
            }
            for u in qs
        ])


class ConversationListCreateView(generics.ListCreateAPIView):
    """
    GET  /imboni/messages/conversations/  — the user's conversations
    POST /imboni/messages/conversations/  — start (or reuse) a 1-to-1 conversation
         body: { "recipient": "<user-uuid>", "subject"?: "...", "content"?: "..." }

    A 1-to-1 conversation between the same two people is reused rather than
    duplicated. An optional first message can be sent in the same request.
    """
    serializer_class = ConversationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['request'] = self.request
        return ctx

    def get_queryset(self):
        return (
            Conversation.objects
            .filter(participants=self.request.user)
            .prefetch_related('participants', 'messages')
            .order_by('-updated_at')
        )

    def create(self, request, *args, **kwargs):
        recipient_id = request.data.get('recipient')
        if not recipient_id:
            return Response({'error': 'recipient is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            recipient = User.objects.get(pk=recipient_id, is_active=True)
        except (User.DoesNotExist, ValueError, TypeError):
            return Response({'error': 'Recipient not found.'}, status=status.HTTP_404_NOT_FOUND)

        # SAFEGUARDING: enforce the messaging policy on the server, not just
        # in the contacts picker. A student POSTing another student's id here
        # must be rejected.
        if not _can_message(request.user, recipient):
            return Response(
                {'error': 'You are not allowed to message this person.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Reuse an existing 1-to-1 conversation if one exists
        conversation = (
            Conversation.objects
            .filter(is_group=False, participants=request.user)
            .filter(participants=recipient)
            .first()
        )
        if not conversation:
            conversation = Conversation.objects.create(
                subject=request.data.get('subject', ''), is_group=False,
            )
            conversation.participants.add(request.user, recipient)

        content = (request.data.get('content') or '').strip()
        if content:
            Message.objects.create(
                conversation=conversation, sender=request.user, content=content,
            )
            conversation.updated_at = timezone.now()
            conversation.save(update_fields=['updated_at'])

        data = ConversationSerializer(conversation, context={'request': request}).data
        return Response(data, status=status.HTTP_201_CREATED)


class MessageListCreateView(generics.ListCreateAPIView):
    """
    GET  /imboni/messages/conversations/<conv_id>/messages/  — read a thread
    POST /imboni/messages/conversations/<conv_id>/messages/  — send a message
         body: { "content": "..." }

    Reading a thread marks the other party's messages as read.
    """
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['request'] = self.request
        return ctx

    def _get_conversation_for_participant(self):
        """
        Without this check, any authenticated user could read or post to any
        conversation just by knowing its ID — there was previously no
        verification that the requester is actually a participant.
        """
        try:
            conversation = Conversation.objects.get(pk=self.kwargs['conversation_pk'])
        except (Conversation.DoesNotExist, ValueError, TypeError):
            raise Http404
        if not conversation.participants.filter(pk=self.request.user.pk).exists():
            raise Http404
        return conversation

    def get_queryset(self):
        conversation = self._get_conversation_for_participant()
        # Opening the thread marks the other side's unread messages as read.
        conversation.messages.filter(is_read=False).exclude(
            sender=self.request.user
        ).update(is_read=True, read_at=timezone.now())
        return (
            Message.objects
            .filter(conversation=conversation)
            .select_related('sender')
            .order_by('created_at')
        )

    def perform_create(self, serializer):
        conversation = self._get_conversation_for_participant()
        serializer.save(sender=self.request.user, conversation=conversation)
        conversation.updated_at = timezone.now()
        conversation.save(update_fields=['updated_at'])
