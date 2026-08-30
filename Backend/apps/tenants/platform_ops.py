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

from django.core.cache import cache
from django.db import connection
from django.db.models import Sum
from django.utils import timezone
from django_tenants.utils import get_public_schema_name
from rest_framework import viewsets, status as http_status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    PlatformExpense, Payment, SupportTicket, TicketReply, SchoolApplication, Contract,
    Client, TenantProvision, PlatformAuditLog, PlatformUser,
)
from .platform_auth import (
    IsPlatformAdmin, IsOperations, PlatformJWTAuthentication,
    ReadAnyWriteCommercial, ReadAnyWriteOperations,
)
from .platform_audit import AuditedViewSetMixin, record
from . import invitations
from .school_context import school_context
from .serializers import (
    PlatformAuditLogSerializer, PlatformUserSerializer,
    PlatformExpenseSerializer, PaymentSerializer,
    SupportTicketListSerializer, SupportTicketDetailSerializer, TicketReplySerializer,
    SchoolApplicationSerializer, ContractSerializer,
)
from .services import provision_tenant, ProvisioningError


class _PlatformBase(AuditedViewSetMixin, viewsets.ModelViewSet):
    """
    Shared operator auth for every platform-ops viewset.

    The default is the weakest gate — anyone signed in as an operator — and each
    desk below narrows it. Read access stays wide on purpose: a support agent
    answering "when does our contract end?" should not have to escalate to read
    the answer. It is WRITING that is split by role.
    """
    authentication_classes = [PlatformJWTAuthentication]
    permission_classes = [IsPlatformAdmin]


class ExpenseViewSet(_PlatformBase):
    """The vendor's own bills (money out). Commercial writes; anyone reads."""
    queryset = PlatformExpense.objects.all()
    serializer_class = PlatformExpenseSerializer
    permission_classes = [ReadAnyWriteCommercial]
    audit_prefix = 'expense'


class PaymentViewSet(_PlatformBase):
    """Payments received (money in). Commercial writes; anyone reads."""
    queryset = Payment.objects.all()
    serializer_class = PaymentSerializer
    permission_classes = [ReadAnyWriteCommercial]
    audit_prefix = 'payment'


class SupportTicketViewSet(_PlatformBase):
    """
    Support inbox for the operator. Read + reply + set status (tickets are only
    *created* by school users on the tenant side — see apps/tenants/support.py).
    """
    queryset = SupportTicket.objects.all()
    http_method_names = ['get', 'head', 'options', 'post', 'patch']
    audit_prefix = 'ticket'

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
        self.audit('reply', ticket, client=ticket.client, label=ticket.subject)
        return Response(SupportTicketDetailSerializer(ticket).data)

    @action(detail=True, methods=['post'])
    def set_status(self, request, pk=None):
        ticket = self.get_object()
        new_status = request.data.get('status')
        valid = {s for s, _ in SupportTicket.STATUS_CHOICES}
        if new_status not in valid:
            return Response({'error': f'Invalid status. Use one of: {", ".join(sorted(valid))}.'},
                            status=http_status.HTTP_400_BAD_REQUEST)
        was = ticket.status
        ticket.status = new_status
        ticket.save(update_fields=['status', 'updated_at'])
        self.audit('set_status', ticket, client=ticket.client, label=ticket.subject,
                   changes={'status': [was, new_status]})
        return Response(SupportTicketDetailSerializer(ticket).data)

    @action(detail=True, methods=['get'])
    def context(self, request, pk=None):
        """
        Everything you need to answer this ticket, on the ticket.

        A ticket used to arrive carrying a school name and nothing else, so the
        first move on every one of them was to go and look up the plan, the
        seats and the last payment somewhere else. That lookup is the answer to
        most tickets, so it belongs here rather than three screens away.
        """
        ticket = self.get_object()
        return Response(school_context(ticket.client, ticket.schema_name))


class ContractViewSet(_PlatformBase):
    """
    Contracts with schools + their lifecycle. CRUD plus sign / terminate / renew.
    Auto-suspend on expiry-past-grace is handled by `enforce_contract_lifecycle`.
    """
    queryset = Contract.objects.all()
    serializer_class = ContractSerializer
    permission_classes = [ReadAnyWriteCommercial]
    audit_prefix = 'contract'

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
        was = contract.status
        contract.status = 'active'
        contract.save(update_fields=['signed_at', 'signed_by', 'status', 'updated_at'])
        self.audit('sign', contract, changes={'status': [was, 'active'],
                                              'signed_by': contract.signed_by})
        return Response(ContractSerializer(contract).data)

    @action(detail=True, methods=['post'])
    def terminate(self, request, pk=None):
        contract = self.get_object()
        was = contract.status
        contract.status = 'terminated'
        contract.save(update_fields=['status', 'updated_at'])
        self.audit('terminate', contract, changes={'status': [was, 'terminated']})
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
        self.audit('renew', new, changes={'renewed_from': str(old.pk),
                                          'end_date': str(new.end_date)})
        return Response(ContractSerializer(new).data, status=http_status.HTTP_201_CREATED)


class ApplicationViewSet(AuditedViewSetMixin, viewsets.ReadOnlyModelViewSet):
    """
    School applications to join Imboni. Prospects create these via the public
    apply endpoint; the operator reviews here: approve/reject, then provision
    (a separate step — approving does NOT create the tenant).

    Reviewing is a commercial judgement and provisioning is an infrastructure
    one, so they are gated separately: approve/reject need commercial,
    provisioning needs operations. Anyone may read the queue.
    """
    queryset = SchoolApplication.objects.all()
    serializer_class = SchoolApplicationSerializer
    authentication_classes = [PlatformJWTAuthentication]
    permission_classes = [ReadAnyWriteCommercial]
    audit_prefix = 'application'

    # See the note on SchoolViewSet.OPERATIONS_ACTIONS: action-level
    # permission_classes are router initkwargs and do not survive other
    # mountings, so the rule is stated where it always applies.
    OPERATIONS_ACTIONS = frozenset({'provision', 'resend_invitation'})

    def get_permissions(self):
        if self.action in self.OPERATIONS_ACTIONS:
            return [IsOperations()]
        return super().get_permissions()

    def get_queryset(self):
        qs = super().get_queryset()
        status_filter = self.request.query_params.get('status')
        return qs.filter(status=status_filter) if status_filter else qs

    def _review(self, app, status):
        was = app.status
        app.status = status
        app.review_notes = self.request.data.get('review_notes', app.review_notes)
        app.reviewed_at = timezone.now()
        app.save()
        self.audit(status, app, label=app.school_name,
                   changes={'status': [was, status]})
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
        """
        Turn an approved application into a live school (creates the tenant).

        The school's admin account is created WITHOUT a password and is emailed
        a single-use link to choose one. Nothing in this response is a
        credential: an operator can see that an invitation went out, and to
        where, but has nothing to relay and therefore nothing to leak.
        """
        app = self.get_object()
        if app.status != 'approved':
            return Response({'error': 'Only approved applications can be provisioned.'},
                            status=http_status.HTTP_400_BAD_REQUEST)
        if app.provisioned_client_id:
            return Response({'error': 'This application is already provisioned.'},
                            status=http_status.HTTP_400_BAD_REQUEST)

        parts = app.contact_name.split(' ', 1)
        domain_base = request.get_host().split(':')[0]
        try:
            client, domain_name = provision_tenant(
                name=app.school_name,
                subdomain=app.desired_subdomain,
                admin_email=app.contact_email,
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
        login_url = f'{scheme}://{domain_name}/login/admin'
        invitation, raw_token = invitations.create_invitation(
            client, app.contact_email, login_url=login_url, created_by=request.user)
        delivered = invitations.send_invitation(
            invitation, raw_token, school_name=app.school_name,
            domain_name=domain_name, scheme=scheme)

        self.audit('provision', app, client=client, label=app.school_name,
                   changes={'schema_name': client.schema_name,
                            'plan': client.plan,
                            'invitation_sent': delivered})

        data = SchoolApplicationSerializer(app).data
        data['provisioned'] = {
            'login_url': login_url,
            'admin_email': app.contact_email,
            'invitation': {
                'state': invitation.state,
                'expires_at': invitation.expires_at,
                'delivered': delivered,
                # Populated only when the mail server refused it, so silence is
                # never mistaken for success.
                'delivery_error': invitation.delivery_error,
            },
        }
        return Response(data, status=http_status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def resend_invitation(self, request, pk=None):
        """Issue a fresh link, invalidating the previous one."""
        app = self.get_object()
        client = app.provisioned_client
        if client is None:
            return Response({'error': 'This application has not been provisioned yet.'},
                            status=http_status.HTTP_400_BAD_REQUEST)

        domain = client.domains.filter(is_primary=True).first() or client.domains.first()
        if domain is None:
            return Response({'error': 'This school has no domain to send a link for.'},
                            status=http_status.HTTP_400_BAD_REQUEST)

        scheme = 'https' if request.is_secure() else 'http'
        invitation, raw_token = invitations.create_invitation(
            client, app.contact_email,
            login_url=f'{scheme}://{domain.domain}/login/admin',
            created_by=request.user)
        delivered = invitations.send_invitation(
            invitation, raw_token, school_name=app.school_name,
            domain_name=domain.domain, scheme=scheme)

        self.audit('resend_invitation', app, client=client, label=app.school_name,
                   changes={'email': app.contact_email, 'invitation_sent': delivered})
        return Response({'state': invitation.state,
                         'expires_at': invitation.expires_at,
                         'delivered': delivered,
                         'delivery_error': invitation.delivery_error})


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


class PlatformHealthView(APIView):
    """Health of all of Imboni — infra components + operational queues."""
    authentication_classes = [PlatformJWTAuthentication]
    permission_classes = [IsPlatformAdmin]

    def get(self, request):
        today = timezone.localdate()

        # ── Infra components ──
        components = []

        db_ok = True
        try:
            with connection.cursor() as cur:
                cur.execute('SELECT 1')
        except Exception:  # noqa: BLE001
            db_ok = False
        components.append({'name': 'Database', 'ok': db_ok, 'detail': 'PostgreSQL'})

        cache_ok = True
        try:
            cache.set('imboni_health_probe', '1', 5)
            cache_ok = cache.get('imboni_health_probe') == '1'
        except Exception:  # noqa: BLE001
            cache_ok = False
        components.append({'name': 'Cache / Redis', 'ok': cache_ok, 'detail': 'broker + cache'})

        workers = None
        try:
            from Imboni.celery import app as celery_app
            replies = celery_app.control.ping(timeout=1)
            workers = len(replies or [])
        except Exception:  # noqa: BLE001
            workers = None
        components.append({
            'name': 'Background workers',
            'ok': bool(workers),
            'detail': f'{workers} online' if workers is not None else 'unreachable',
        })

        # ── Operational queues / attention needed ──
        schools = Client.objects.exclude(schema_name=get_public_schema_name())
        expiring = Contract.objects.filter(
            status='active', end_date__gte=today, end_date__lte=today + timedelta(days=30)).count()
        in_grace = Contract.objects.filter(status='active', end_date__lt=today).count()

        return Response({
            'components': components,
            'schools': {
                'total': schools.count(),
                'active': schools.filter(status='active').count(),
                'suspended': schools.filter(status='suspended').count(),
                'trial': schools.filter(status='trial').count(),
                'past_due': schools.filter(status='past_due').count(),
            },
            'provisioning': {
                'pending': TenantProvision.objects.filter(status='pending').count(),
                'failed': TenantProvision.objects.filter(status='failed').count(),
            },
            'attention': {
                'applications_pending': SchoolApplication.objects.filter(status='pending').count(),
                'contracts_expiring_30d': expiring,
                'contracts_in_grace': in_grace,
                'bills_overdue': PlatformExpense.objects.filter(status='due', due_date__lt=today).count(),
                'tickets_unresolved': SupportTicket.objects.filter(status__in=['open', 'in_progress']).count(),
            },
        })


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Who did what, above the schools.

    Read-only by design and by route: there is no create, update or delete
    endpoint anywhere in the API. An audit trail an operator can edit is an
    audit trail that proves nothing, so entries are written by
    `platform_audit.record` and never by a request.

    Every operator can read it, including support. Accountability that only the
    powerful can inspect is not accountability.
    """
    queryset = PlatformAuditLog.objects.select_related('actor', 'client')
    serializer_class = PlatformAuditLogSerializer
    authentication_classes = [PlatformJWTAuthentication]
    permission_classes = [IsPlatformAdmin]

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params
        client_id = params.get('client')
        actor = params.get('actor')
        action_prefix = params.get('action')
        if client_id:
            qs = qs.filter(client_id=client_id)
        if actor:
            qs = qs.filter(actor_email__icontains=actor)
        if action_prefix:
            # Prefix match so 'school' finds school.suspend and school.reactivate
            # without the caller having to know every verb.
            qs = qs.filter(action__startswith=action_prefix)
        return qs[:500]


class OperatorViewSet(_PlatformBase):
    """
    The operator roster: who works here and what they are allowed to do.

    Operations only, in both directions. Granting a role is how someone gets
    the power to suspend a school, so it is itself an operations action -- and
    every change is audited, including the one that made somebody an operator.
    """
    queryset = PlatformUser.objects.all().order_by('email')
    serializer_class = PlatformUserSerializer
    permission_classes = [IsOperations]
    audit_prefix = 'operator'
    http_method_names = ['get', 'head', 'options', 'post', 'patch']

    def perform_create(self, serializer):
        password = serializer.validated_data.pop('password', None)
        operator = serializer.save()
        if password:
            operator.set_password(password)
            operator.save(update_fields=['password'])
        self.audit('create', operator, label=operator.email,
                   changes={'role': operator.role})
        return operator

    def perform_update(self, serializer):
        before = {'role': serializer.instance.role,
                  'is_active': serializer.instance.is_active}
        password = serializer.validated_data.pop('password', None)
        operator = serializer.save()
        if password:
            operator.set_password(password)
            operator.save(update_fields=['password'])
        after = {'role': operator.role, 'is_active': operator.is_active}
        self.audit('update', operator, label=operator.email,
                   changes={k: [before[k], after[k]] for k in before
                            if before[k] != after[k]})
        return operator

    @action(detail=True, methods=['post'])
    def reset_mfa(self, request, pk=None):
        """
        Clear a locked-out operator's second factor.

        Someone loses their phone eventually. Without this the only remedy is a
        database edit, which is worse in every way -- unaudited, and done by
        whoever happens to have shell access.
        """
        operator = self.get_object()
        operator.mfa_enabled = False
        operator.mfa_secret = ''
        operator.save(update_fields=['mfa_enabled', 'mfa_secret'])
        self.audit('reset_mfa', operator, label=operator.email)
        return Response(PlatformUserSerializer(operator).data)
