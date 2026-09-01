"""
Stripe webhook: signature, idempotency, and what a handler failure does.

This endpoint decides whether a school is active or suspended and is
unauthenticated by design, so the signature is the whole of its security.

Driven through APIRequestFactory inside a public-schema context, matching
test_platform_ops.py — the endpoint lives in Imboni/urls_public.py and the
Django test client does not route to the public urlconf in this harness.
"""
import json
from unittest import mock

import pytest
from django.test import override_settings
from django_tenants.utils import schema_context, get_public_schema_name
from rest_framework.test import APIRequestFactory

from apps.tenants.billing import StripeWebhookView, _construct_event
from apps.tenants.models import StripeEvent

factory = APIRequestFactory()
WEBHOOK_URL = '/imboni/billing/webhook/'


def _public():
    return schema_context(get_public_schema_name())


def _post(body=b'{}', signature=''):
    req = factory.post(WEBHOOK_URL, data=body,
                       content_type='application/json',
                       HTTP_STRIPE_SIGNATURE=signature)
    with _public():
        return StripeWebhookView.as_view()(req)


# ── signature ─────────────────────────────────────────────────────────────────

@override_settings(STRIPE_WEBHOOK_SECRET='')
def test_unsigned_payload_is_refused_when_no_secret_configured():
    """
    With no secret this used to json.loads() whatever arrived, so anyone who
    found the URL could set a tenant's status to 'active' — or 'suspended'.
    """
    payload = json.dumps({'id': 'evt_forged', 'type': 'checkout.session.completed',
                          'data': {'object': {'metadata': {'schema': 'victim'}}}}).encode()
    assert _construct_event(payload, '') is None


@override_settings(STRIPE_WEBHOOK_SECRET='whsec_test')
def test_bad_signature_is_refused():
    payload = json.dumps({'id': 'evt_1', 'type': 'ping'}).encode()
    assert _construct_event(payload, 'not-a-real-signature') is None


@pytest.mark.django_db
@override_settings(STRIPE_WEBHOOK_SECRET='')
def test_endpoint_returns_400_for_an_unsigned_event():
    resp = _post(json.dumps({'id': 'evt_forged', 'type': 'ping'}).encode())
    assert resp.status_code == 400


# ── idempotency ───────────────────────────────────────────────────────────────

@pytest.mark.django_db
@override_settings(STRIPE_WEBHOOK_SECRET='whsec_test')
def test_a_redelivered_event_is_handled_once():
    event = {'id': 'evt_dup', 'type': 'ping', 'data': {'object': {}}}

    with mock.patch('apps.tenants.billing._construct_event', return_value=event), \
         mock.patch('apps.tenants.billing._handle_event') as handle:
        first = _post()
        second = _post()

    assert first.status_code == 200
    assert second.status_code == 200
    assert handle.call_count == 1, 'the replay was processed a second time'
    with _public():
        assert StripeEvent.objects.filter(event_id='evt_dup').count() == 1


# ── failure must be retryable ─────────────────────────────────────────────────

@pytest.mark.django_db
@override_settings(STRIPE_WEBHOOK_SECRET='whsec_test')
def test_handler_failure_returns_500_so_stripe_retries():
    """
    A 200 told Stripe the event succeeded and it was never redelivered, so one
    transient error left a paying school suspended with only a log line.
    """
    event = {'id': 'evt_boom', 'type': 'ping', 'data': {'object': {}}}

    with mock.patch('apps.tenants.billing._construct_event', return_value=event), \
         mock.patch('apps.tenants.billing._handle_event',
                    side_effect=RuntimeError('database went away')):
        resp = _post()

    assert resp.status_code == 500
    # The claim is released, so the retry is allowed to run.
    with _public():
        assert not StripeEvent.objects.filter(event_id='evt_boom').exists()


@pytest.mark.django_db
@override_settings(STRIPE_WEBHOOK_SECRET='whsec_test')
def test_a_failed_event_is_processed_on_retry():
    event = {'id': 'evt_retry', 'type': 'ping', 'data': {'object': {}}}
    calls = []

    def flaky(evt):
        calls.append(evt)
        if len(calls) == 1:
            raise RuntimeError('transient')

    with mock.patch('apps.tenants.billing._construct_event', return_value=event), \
         mock.patch('apps.tenants.billing._handle_event', side_effect=flaky):
        failed = _post()
        retried = _post()

    assert failed.status_code == 500
    assert retried.status_code == 200
    assert len(calls) == 2


# ── one payment, one Payment row ──────────────────────────────────────────────

@pytest.mark.django_db
def test_checkout_completion_does_not_record_a_payment():
    """
    Stripe sends checkout.session.completed AND invoice.payment_succeeded for
    the same money under different ids, so recording both double-counted
    revenue. The invoice is the single source of money-in.
    """
    from apps.tenants.billing import _handle_event
    from apps.tenants.models import Client, Payment

    with _public():
        client = Client.objects.filter(schema_name='test').first()
        before = Payment.objects.count()

    _handle_event({
        'id': 'evt_checkout', 'type': 'checkout.session.completed',
        'data': {'object': {
            'metadata': {'schema': 'test', 'plan': 'premium'},
            'customer': 'cus_x', 'subscription': 'sub_x',
            'amount_total': 5000, 'currency': 'usd', 'payment_intent': 'pi_x',
        }},
    })

    with _public():
        assert Payment.objects.count() == before, 'checkout recorded a payment row'
        client.refresh_from_db()
        assert client.status == 'active'
