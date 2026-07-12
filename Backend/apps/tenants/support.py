"""
School-side support (Phase 6) — how a school user RAISES a ticket.

These endpoints are served on the school subdomain (tenant schema) and are used
by the school's own staff. The tickets themselves live in the PUBLIC schema (one
inbox across all schools), so we write/read them via schema_context(public),
always scoped to the caller's own school (`schema_name`) — a school can only ever
see its own tickets, never another school's.

    GET/POST /imboni/support/tickets/              — list own tickets / raise one
    POST     /imboni/support/tickets/<id>/reply/   — add a message to own ticket
"""
from django.db import connection
from django_tenants.utils import schema_context, get_public_schema_name
from rest_framework import serializers, status as http_status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Client, SupportTicket, TicketReply
from .serializers import SupportTicketDetailSerializer


class RaiseTicketSerializer(serializers.Serializer):
    subject = serializers.CharField(max_length=200)
    body = serializers.CharField()
    priority = serializers.ChoiceField(
        choices=[c[0] for c in SupportTicket.PRIORITY_CHOICES], default='normal')


def _actor(request):
    user = request.user
    name = (user.get_full_name() or '').strip() or getattr(user, 'username', '') or user.email
    return user.email, name, getattr(user, 'role', '')


class MyTicketsView(APIView):
    """List this school's tickets, or raise a new one."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        schema = connection.schema_name
        with schema_context(get_public_schema_name()):
            qs = SupportTicket.objects.filter(schema_name=schema)
            data = SupportTicketDetailSerializer(qs, many=True).data
        return Response(data)

    def post(self, request):
        ser = RaiseTicketSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        tenant = connection.tenant
        email, name, role = _actor(request)
        with schema_context(get_public_schema_name()):
            client = Client.objects.filter(schema_name=tenant.schema_name).first()
            ticket = SupportTicket.objects.create(
                client=client,
                school_name=tenant.name,
                schema_name=tenant.schema_name,
                raised_by_email=email,
                raised_by_name=name,
                raised_by_role=role,
                subject=ser.validated_data['subject'],
                body=ser.validated_data['body'],
                priority=ser.validated_data['priority'],
            )
            data = SupportTicketDetailSerializer(ticket).data
        return Response(data, status=http_status.HTTP_201_CREATED)


class MyTicketReplyView(APIView):
    """Add a reply to one of this school's own tickets (re-opens if resolved)."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        body = (request.data.get('body') or '').strip()
        if not body:
            return Response({'error': 'Reply body is required.'},
                            status=http_status.HTTP_400_BAD_REQUEST)

        schema = connection.schema_name
        _email, name, _role = _actor(request)
        with schema_context(get_public_schema_name()):
            ticket = SupportTicket.objects.filter(id=pk, schema_name=schema).first()
            if ticket is None:
                return Response({'error': 'Ticket not found.'},
                                status=http_status.HTTP_404_NOT_FOUND)
            TicketReply.objects.create(
                ticket=ticket, author_type='school', author_name=name, body=body)
            # A school replying to a resolved ticket re-opens the conversation.
            if ticket.status in ('resolved', 'closed'):
                ticket.status = 'open'
                ticket.save(update_fields=['status', 'updated_at'])
            data = SupportTicketDetailSerializer(ticket).data
        return Response(data, status=http_status.HTTP_201_CREATED)
