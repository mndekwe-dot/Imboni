"""
Stripe billing (Phase 3) — the "rent or buy" money path.

Two audiences:
  * The school (on its own subdomain, authenticated admin): BillingStatusView and
    CheckoutView start a Stripe Checkout subscription.
  * Stripe (server-to-server, on the public/bare domain): StripeWebhookView
    receives subscription lifecycle events and flips Client.status, which the
    SubscriptionStatusMiddleware already enforces (suspended -> 402, past_due -> header).

Client/Domain live in the public schema, so writes go through schema_context().
With no Stripe keys configured (settings.STRIPE_ENABLED is False), the endpoints
degrade gracefully instead of erroring, and the webhook — if STRIPE_WEBHOOK_SECRET
is unset — trusts the payload so the flow can be exercised locally without Stripe.
"""
import logging

import stripe
from django.conf import settings
from django.db import connection, transaction
from django_tenants.utils import schema_context, get_public_schema_name
from rest_framework import status as http_status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from decimal import Decimal, InvalidOperation

from .limits import capacity_snapshot
from .models import Client, Payment, StripeEvent

logger = logging.getLogger(__name__)


def _record_payment(client, amount_cents, currency, plan, stripe_id):
    """Store a received payment (money in) for the platform revenue view.

    Stripe amounts are integer minor units (cents), so we divide by 100.
    Best-effort: never let a bookkeeping write break webhook handling.
    """
    if not client or not amount_cents:
        return
    try:
        amount = Decimal(amount_cents) / 100
    except (InvalidOperation, TypeError):
        return
    with schema_context(get_public_schema_name()):
        if stripe_id and Payment.objects.filter(stripe_payment_id=stripe_id).exists():
            return   # idempotent: Stripe may retry the same event
        Payment.objects.create(
            client=client, school_name=client.name, amount=amount,
            currency=(currency or 'usd').upper(), plan=plan or client.plan,
            status='succeeded', stripe_payment_id=stripe_id or '',
        )


# ── Status mapping (pure, unit-tested) ──────────────────────────────────────────

# Stripe subscription.status -> our Client.status.
_STATUS_MAP = {
    'active': 'active',
    'trialing': 'active',          # in a paid trial = full access
    'past_due': 'past_due',
    'incomplete': 'past_due',
    'unpaid': 'suspended',
    'canceled': 'suspended',
    'incomplete_expired': 'suspended',
    'paused': 'suspended',
}


def map_subscription_status(stripe_status):
    """Map a Stripe subscription status to our Client.status (default past_due)."""
    return _STATUS_MAP.get(stripe_status, 'past_due')


# ── Public-schema Client helpers ────────────────────────────────────────────────

def _update_client(pk, **fields):
    with schema_context(get_public_schema_name()):
        Client.objects.filter(pk=pk).update(**fields)


def _find_client(schema=None, customer_id=None):
    with schema_context(get_public_schema_name()):
        qs = Client.objects.all()
        client = qs.filter(schema_name=schema).first() if schema else None
        if client is None and customer_id:
            client = qs.filter(stripe_customer_id=customer_id).first()
        return client


def _absolute(request, path):
    scheme = 'https' if request.is_secure() else 'http'
    return f'{scheme}://{request.get_host()}{path}'


# ── School-facing views (tenant subdomain) ──────────────────────────────────────

class BillingStatusView(APIView):
    """Current plan/subscription status for the logged-in school."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        tenant = connection.tenant
        return Response({
            'plan': tenant.plan,
            'status': tenant.status,
            'on_trial': tenant.on_trial,
            'has_subscription': bool(tenant.stripe_subscription_id),
            'stripe_enabled': settings.STRIPE_ENABLED,
            'plans': [
                {'key': 'basic', 'name': 'Basic'},
                {'key': 'premium', 'name': 'Premium'},
            ],
            # Phase 4: current seat usage vs plan caps, for the usage meters.
            'usage': capacity_snapshot(),
        })


class CheckoutView(APIView):
    """Start a Stripe Checkout subscription session for the school."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not settings.STRIPE_ENABLED:
            return Response({'detail': 'Billing is not configured on this server.'},
                            status=http_status.HTTP_503_SERVICE_UNAVAILABLE)
        if getattr(request.user, 'role', None) != 'admin':
            return Response({'detail': 'Only a school administrator can manage billing.'},
                            status=http_status.HTTP_403_FORBIDDEN)

        plan = request.data.get('plan')
        price_id = settings.STRIPE_PRICES.get(plan)
        if not price_id:
            return Response({'detail': f'Unknown or unconfigured plan: {plan!r}.'},
                            status=http_status.HTTP_400_BAD_REQUEST)

        tenant = connection.tenant
        stripe.api_key = settings.STRIPE_SECRET_KEY

        try:
            customer_id = tenant.stripe_customer_id
            if not customer_id:
                customer = stripe.Customer.create(
                    name=tenant.name,
                    metadata={'schema': tenant.schema_name},
                )
                customer_id = customer.id
                _update_client(tenant.pk, stripe_customer_id=customer_id)

            session = stripe.checkout.Session.create(
                mode='subscription',
                customer=customer_id,
                line_items=[{'price': price_id, 'quantity': 1}],
                success_url=_absolute(request, settings.STRIPE_SUCCESS_PATH),
                cancel_url=_absolute(request, settings.STRIPE_CANCEL_PATH),
                metadata={'schema': tenant.schema_name, 'plan': plan},
                subscription_data={'metadata': {'schema': tenant.schema_name, 'plan': plan}},
            )
        except stripe.error.StripeError as exc:  # pragma: no cover - network path
            logger.exception('Stripe checkout failed for %s', tenant.schema_name)
            return Response({'detail': f'Stripe error: {exc.user_message or "checkout failed"}.'},
                            status=http_status.HTTP_502_BAD_GATEWAY)

        return Response({'checkout_url': session.url})


# ── Stripe webhook (public/bare domain, server-to-server) ────────────────────────

class StripeWebhookView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        event = _construct_event(request.body,
                                 request.META.get('HTTP_STRIPE_SIGNATURE', ''))
        if event is None:
            return Response({'detail': 'Invalid payload/signature.'},
                            status=http_status.HTTP_400_BAD_REQUEST)

        event_id = event.get('id') or ''
        etype = event.get('type', '')

        # Claim the event id before doing any work. A redelivery of an event we
        # already finished is acknowledged and dropped.
        if event_id:
            with schema_context(get_public_schema_name()):
                _, fresh = StripeEvent.objects.get_or_create(
                    event_id=event_id, defaults={'event_type': etype})
            if not fresh:
                logger.info('Stripe event %s already processed; ignoring replay', event_id)
                return Response(status=http_status.HTTP_200_OK)

        try:
            with transaction.atomic():
                _handle_event(event)
        except Exception:
            # This used to log and return 200. A 200 tells Stripe the event was
            # handled successfully, so it was never redelivered: one transient
            # database error meant a school that had paid stayed suspended, with
            # nothing but a log line to say why. Releasing the claim and
            # returning 500 lets Stripe's own retry schedule fix it.
            logger.exception('Error handling Stripe event %s (%s)', event_id, etype)
            if event_id:
                with schema_context(get_public_schema_name()):
                    StripeEvent.objects.filter(event_id=event_id).delete()
            return Response({'detail': 'Handler failed; please retry.'},
                            status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response(status=http_status.HTTP_200_OK)


def _construct_event(payload, sig_header):
    """
    Verify + parse a Stripe event. In production STRIPE_WEBHOOK_SECRET must be set
    and the signature is checked. If it is unset (local/dev), the payload is
    trusted as-is so the flow can be exercised without Stripe — never do that in
    production.
    """
    secret = settings.STRIPE_WEBHOOK_SECRET
    if not secret:
        # This endpoint decides whether a school is active or suspended, and it
        # is unauthenticated by design because Stripe calls it. The signature IS
        # the authentication. Without a secret it used to trust whatever JSON
        # arrived, so anyone who found the URL could grant themselves a paid
        # plan or suspend a competitor. An unset secret is a misconfiguration,
        # not a local-dev convenience — use `stripe listen`, which issues one.
        logger.error('STRIPE_WEBHOOK_SECRET is not set; refusing webhook.')
        return None
    try:
        return stripe.Webhook.construct_event(payload, sig_header, secret)
    except (ValueError, stripe.error.SignatureVerificationError):
        logger.warning('Rejected Stripe webhook: bad signature/payload')
        return None


def _handle_event(event):
    etype = event.get('type', '')
    obj = event.get('data', {}).get('object', {})
    meta = obj.get('metadata') or {}
    schema = meta.get('schema')

    if etype == 'checkout.session.completed':
        client = _find_client(schema=schema, customer_id=obj.get('customer'))
        if client:
            _update_client(
                client.pk,
                status='active',
                on_trial=False,
                plan=meta.get('plan', client.plan),
                stripe_customer_id=obj.get('customer') or client.stripe_customer_id,
                stripe_subscription_id=obj.get('subscription') or client.stripe_subscription_id,
            )
            # Deliberately does NOT record a payment. Stripe sends both this and
            # invoice.payment_succeeded for the same money, and the two carry
            # different ids (payment_intent vs invoice), so _record_payment's
            # dedupe on stripe_payment_id could not see they were the same —
            # every subscription start was counted twice in platform revenue.
            # The invoice is the single source of money-in; this event only
            # flips the school's status.
        return

    if etype == 'invoice.payment_succeeded':
        client = _find_client(schema=schema, customer_id=obj.get('customer'))
        if client:
            _record_payment(client, obj.get('amount_paid'), obj.get('currency'),
                            client.plan, obj.get('id'))
        return

    if etype in ('customer.subscription.updated', 'customer.subscription.created'):
        client = _find_client(schema=schema, customer_id=obj.get('customer'))
        if client:
            _update_client(
                client.pk,
                status=map_subscription_status(obj.get('status', '')),
                on_trial=False,
                stripe_subscription_id=obj.get('id') or client.stripe_subscription_id,
            )
        return

    if etype == 'customer.subscription.deleted':
        client = _find_client(schema=schema, customer_id=obj.get('customer'))
        if client:
            _update_client(client.pk, status='suspended')
        return

    if etype == 'invoice.payment_failed':
        client = _find_client(schema=schema, customer_id=obj.get('customer'))
        if client:
            _update_client(client.pk, status='past_due')
        return

    logger.info('Unhandled Stripe event type: %s', etype)
