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

from django.utils.crypto import get_random_string

from .models import PlatformExpense, Payment, SupportTicket, TicketReply, SchoolApplication, Contract
from .platform_auth import IsPlatformAdmin, PlatformJWTAuthentication
from .serializers import (
    PlatformExpenseSerializer, PaymentSerializer,
    SupportTicketListSerializer, SupportTicketDetailSerializer, TicketReplySerializer,
    SchoolApplicationSerializer, ContractSerializer,
)
from .services import provision_tenant, ProvisioningError


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


class ContractViewSet(_PlatformBase):
    """
    Contracts with schools + their lifecycle. CRUD plus sign / terminate / renew.
    Auto-suspend on expiry-past-grace is handled by `enforce_contract_lifecycle`.
    """
    queryset = Contract.objects.all()
    serializer_class = ContractSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        client_id = self.request.query_params.get('client')
        status_filter = self.request.query_params.get('status')
        if client_id:
            qs = qs.filter(client_id=client_id)
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    @action(detail=True, methods=['post'])
    def sign(self, request, pk=None):
        """Mark a contract signed + active."""
        contract = self.get_object()
        contract.signed_at = timezone.now()
        contract.signed_by = request.data.get('signed_by', contract.signed_by)
        contract.status = 'active'
        contract.save(update_fields=['signed_at', 'signed_by', 'status', 'updated_at'])
        return Response(ContractSerializer(contract).data)

    @action(detail=True, methods=['post'])
    def terminate(self, request, pk=None):
        contract = self.get_object()
        contract.status = 'terminated'
        contract.save(update_fields=['status', 'updated_at'])
        return Response(ContractSerializer(contract).data)

    @action(detail=True, methods=['post'])
    def renew(self, request, pk=None):
        """Create a follow-on contract (same duration by default) and expire this one."""
        old = self.get_object()
        duration = old.end_date - old.start_date
        new_start = old.end_date
        new = Contract.objects.create(
            client=old.client, title=old.title, plan=old.plan, amount=old.amount,
            currency=old.currency, billing_interval=old.billing_interval,
            start_date=new_start, end_date=new_start + duration,
            status='active', auto_renew=old.auto_renew, grace_days=old.grace_days,
            signed_at=timezone.now(), signed_by=request.data.get('signed_by', old.signed_by),
        )
        old.status = 'expired'
        old.save(update_fields=['status', 'updated_at'])
        return Response(ContractSerializer(new).data, status=http_status.HTTP_201_CREATED)


class ApplicationViewSet(viewsets.ReadOnlyModelViewSet):
    """
    School applications to join Imboni. Prospects create these via the public
    apply endpoint; the operator reviews here: approve/reject, then provision
    (a separate step — approving does NOT create the tenant).
    """
    queryset = SchoolApplication.objects.all()
    serializer_class = SchoolApplicationSerializer
    authentication_classes = [PlatformJWTAuthentication]
    permission_classes = [IsPlatformAdmin]

    def get_queryset(self):
        qs = super().get_queryset()
        status_filter = self.request.query_params.get('status')
        return qs.filter(status=status_filter) if status_filter else qs

    def _review(self, app, status):
        app.status = status
        app.review_notes = self.request.data.get('review_notes', app.review_notes)
        app.reviewed_at = timezone.now()
        app.save()
        return Response(SchoolApplicationSerializer(app).data)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        app = self.get_object()
        if app.status == 'provisioned':
            return Response({'error': 'Already provisioned.'}, status=http_status.HTTP_400_BAD_REQUEST)
        return self._review(app, 'approved')

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        return self._review(self.get_object(), 'rejected')

    @action(detail=True, methods=['post'])
    def provision(self, request, pk=None):
        """Turn an approved application into a live school (creates the tenant)."""
        app = self.get_object()
        if app.status != 'approved':
            return Response({'error': 'Only approved applications can be provisioned.'},
                            status=http_status.HTTP_400_BAD_REQUEST)
        if app.provisioned_client_id:
            return Response({'error': 'This application is already provisioned.'},
                            status=http_status.HTTP_400_BAD_REQUEST)

        temp_password = get_random_string(12)
        parts = app.contact_name.split(' ', 1)
        domain_base = request.get_host().split(':')[0]
        try:
            client, domain_name = provision_tenant(
                name=app.school_name,
                subdomain=app.desired_subdomain,
                admin_email=app.contact_email,
                admin_password=temp_password,
                admin_first_name=parts[0],
                admin_last_name=parts[1] if len(parts) > 1 else '',
                domain_base=domain_base,
                plan=app.plan_interest or 'free',
                on_trial=True, status='trial',
            )
        except ProvisioningError as exc:
            return Response({'error': str(exc)}, status=http_status.HTTP_400_BAD_REQUEST)

        app.provisioned_client = client
        app.status = 'provisioned'
        app.reviewed_at = app.reviewed_at or timezone.now()
        app.save()

        scheme = 'https' if request.is_secure() else 'http'
        data = SchoolApplicationSerializer(app).data
        # The operator relays these to the school (best-effort email can be added later).
        data['provisioned'] = {
            'login_url': f'{scheme}://{domain_name}/login/admin',
            'admin_email': app.contact_email,
            'temp_password': temp_password,
        }
        return Response(data, status=http_status.HTTP_201_CREATED)


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
