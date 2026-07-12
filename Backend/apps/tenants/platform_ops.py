"""
Platform operations API (Phase 6) — the operator's money + support desk.

Everything here is operator-only (PlatformJWTAuthentication + IsPlatformAdmin) and
lives on the PUBLIC schema (bare domain), alongside the schools API:

    /imboni/platform/expenses/     — CRUD the vendor's bills/services (money out)
    /imboni/platform/payments/     — payments received from schools (money in)
    /imboni/platform/tickets/      — support inbox: list, view, reply, set status
    /imboni/platform/summary/      — finance + support headline numbers
"""
from datetime import timedelta
from decimal import Decimal

from django.db.models import Sum
from django.utils import timezone
from rest_framework import viewsets, status as http_status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import PlatformExpense, Payment, SupportTicket, TicketReply
from .platform_auth import IsPlatformAdmin, PlatformJWTAuthentication
from .serializers import (
    PlatformExpenseSerializer, PaymentSerializer,
    SupportTicketListSerializer, SupportTicketDetailSerializer, TicketReplySerializer,
)


class _PlatformBase(viewsets.ModelViewSet):
    """Shared operator-only auth for every platform-ops viewset."""
    authentication_classes = [PlatformJWTAuthentication]
    permission_classes = [IsPlatformAdmin]


class ExpenseViewSet(_PlatformBase):
    """Full CRUD over the vendor's services/bills (money out)."""
    queryset = PlatformExpense.objects.all()
    serializer_class = PlatformExpenseSerializer


class PaymentViewSet(_PlatformBase):
    """Payments received (money in). Create allows manual entry until Stripe is live."""
    queryset = Payment.objects.all()
    serializer_class = PaymentSerializer


class SupportTicketViewSet(_PlatformBase):
    """
    Support inbox for the operator. Read + reply + set status (tickets are only
    *created* by school users on the tenant side — see apps/tenants/support.py).
    """
    queryset = SupportTicket.objects.all()
    http_method_names = ['get', 'head', 'options', 'post', 'patch']

    def get_serializer_class(self):
        return SupportTicketListSerializer if self.action == 'list' else SupportTicketDetailSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    @action(detail=True, methods=['post'])
    def reply(self, request, pk=None):
        """Operator posts a reply; a still-open ticket moves to 'in_progress'."""
        ticket = self.get_object()
        body = (request.data.get('body') or '').strip()
        if not body:
            return Response({'error': 'Reply body is required.'},
                            status=http_status.HTTP_400_BAD_REQUEST)
        TicketReply.objects.create(
            ticket=ticket, author_type='operator',
            author_name=getattr(request.user, 'email', 'operator'), body=body,
        )
        if ticket.status == 'open':
            ticket.status = 'in_progress'
            ticket.save(update_fields=['status', 'updated_at'])
        return Response(SupportTicketDetailSerializer(ticket).data)

    @action(detail=True, methods=['post'])
    def set_status(self, request, pk=None):
        ticket = self.get_object()
        new_status = request.data.get('status')
        valid = {s for s, _ in SupportTicket.STATUS_CHOICES}
        if new_status not in valid:
            return Response({'error': f'Invalid status. Use one of: {", ".join(sorted(valid))}.'},
                            status=http_status.HTTP_400_BAD_REQUEST)
        ticket.status = new_status
        ticket.save(update_fields=['status', 'updated_at'])
        return Response(SupportTicketDetailSerializer(ticket).data)


class PlatformSummaryView(APIView):
    """Headline numbers for the operator dashboard — money + support at a glance."""
    authentication_classes = [PlatformJWTAuthentication]
    permission_classes = [IsPlatformAdmin]

    def get(self, request):
        today = timezone.localdate()
        month_start = today.replace(day=1)

        succeeded = Payment.objects.filter(status='succeeded')
        revenue_total = succeeded.aggregate(t=Sum('amount'))['t'] or Decimal('0')
        revenue_month = succeeded.filter(received_at__date__gte=month_start).aggregate(
            t=Sum('amount'))['t'] or Decimal('0')

        unpaid = PlatformExpense.objects.filter(status='due')
        overdue = unpaid.filter(due_date__lt=today)
        upcoming = unpaid.filter(due_date__gte=today, due_date__lte=today + timedelta(days=30))

        return Response({
            'revenue': {
                'total': str(revenue_total),
                'this_month': str(revenue_month),
                'payments_count': succeeded.count(),
            },
            'expenses': {
                'due_total': str(unpaid.aggregate(t=Sum('amount'))['t'] or Decimal('0')),
                'overdue_count': overdue.count(),
                'overdue_total': str(overdue.aggregate(t=Sum('amount'))['t'] or Decimal('0')),
                'upcoming_30d_count': upcoming.count(),
            },
            'tickets': {
                'open': SupportTicket.objects.filter(status='open').count(),
                'in_progress': SupportTicket.objects.filter(status='in_progress').count(),
                'unresolved': SupportTicket.objects.filter(status__in=['open', 'in_progress']).count(),
            },
        })
