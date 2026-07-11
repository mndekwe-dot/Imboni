# Phase 3 — Stripe Billing Plan (Imboni)

This document describes how Stripe plugs into the existing `django-tenants`
setup to drive the `Client.status` field that
`apps.tenants.middleware.SubscriptionStatusMiddleware` enforces.

## 1. Object mapping: Stripe <-> Imboni

| Stripe object            | Imboni model / field                                  | Notes |
|--------------------------|-------------------------------------------------------|-------|
| **Customer**             | `Client` (one Stripe Customer per school)             | Store the Stripe customer id on `Client` (add `stripe_customer_id = CharField(...)`). One school = one tenant schema = one Customer. |
| **Subscription**         | `Client.status`, `Client.plan`, `Client.paid_until`   | The Subscription's `status` and current period drive our fields (see mapping below). Store `stripe_subscription_id` on `Client`. |
| **Price / Product**      | `Client.plan` (`free` / `basic` / `premium`)          | Each plan tier maps to a Stripe Price. Selected at checkout. |
| **Invoice / PaymentIntent** | (transient) drives status transitions via webhooks | We don't persist invoices; we react to their events. |

New fields to add to `apps/tenants/models.Client` in Phase 3:
`stripe_customer_id`, `stripe_subscription_id` (both nullable CharField).

### Stripe subscription status -> `Client.status`

| Stripe `Subscription.status`         | `Client.status` | `on_trial` | Middleware effect |
|--------------------------------------|-----------------|------------|-------------------|
| `trialing`                           | `trial`         | `True`     | allow             |
| `active`                             | `active`        | `False`    | allow             |
| `past_due` / `unpaid`                | `past_due`      | `False`    | warn (`X-Subscription-Status: past_due`) |
| `canceled` / `incomplete_expired`    | `suspended`     | `False`    | block (HTTP 402)  |

## 2. Webhook endpoint that flips `Client.status`

Add a **public-schema** billing app (or `apps/tenants/billing_views.py`) exposing:

```
POST /imboni/billing/webhook/     -> StripeWebhookView   (CSRF-exempt, no auth)
POST /imboni/billing/checkout/    -> CreateCheckoutSession (authenticated school admin)
GET  /imboni/billing/portal/      -> CustomerPortalSession (authenticated school admin)
```

The webhook is the source of truth. Sketch:

```python
# apps/tenants/billing_views.py
import stripe
from django.conf import settings
from django.http import HttpResponse, HttpResponseBadRequest
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.views import View
from apps.tenants.models import Client

STATUS_MAP = {
    'trialing': ('trial', True),
    'active': ('active', False),
    'past_due': ('past_due', False),
    'unpaid': ('past_due', False),
    'canceled': ('suspended', False),
    'incomplete_expired': ('suspended', False),
}

@method_decorator(csrf_exempt, name='dispatch')
class StripeWebhookView(View):
    def post(self, request):
        payload = request.body
        sig = request.META.get('HTTP_STRIPE_SIGNATURE', '')
        try:
            event = stripe.Webhook.construct_event(
                payload, sig, settings.STRIPE_WEBHOOK_SECRET
            )
        except (ValueError, stripe.error.SignatureVerificationError):
            return HttpResponseBadRequest()

        if event['type'] in (
            'customer.subscription.updated',
            'customer.subscription.deleted',
            'customer.subscription.created',
        ):
            sub = event['data']['object']
            status_pair = STATUS_MAP.get(sub['status'])
            if status_pair:
                new_status, on_trial = status_pair
                # Look up the tenant by its stored Stripe customer id. This runs
                # in the PUBLIC schema, where the Client table lives.
                Client.objects.filter(
                    stripe_customer_id=sub['customer']
                ).update(
                    status=new_status,
                    on_trial=on_trial,
                    paid_until=_period_end_date(sub),
                )
        return HttpResponse(status=200)
```

Important: `Client` (a `TenantMixin`) lives in the **public** schema, so the
webhook — which arrives on the public domain, not a tenant subdomain — can read
and update it directly. No `schema_context` juggling needed for the write.

## 3. Trial handling (`on_trial` / `paid_until`)

* On school signup, create the `Client` with `status='trial'`, `on_trial=True`.
  Either start a Stripe subscription with a `trial_period_days`, or run a
  local trial and only create the Stripe Subscription at checkout.
* `paid_until` mirrors the Stripe subscription's `current_period_end`
  (converted to a date). It is informational/UX for now (e.g. "renews on...");
  the middleware keys purely off `status`.
* A nightly job (or Stripe's `customer.subscription.trial_will_end` webhook)
  can flip `on_trial=False` and, if no payment method is attached when the
  trial ends, Stripe moves the subscription to `past_due` -> then `canceled`,
  which our webhook maps to `past_due` -> `suspended` automatically.

## 4. Where the middleware plugs into `MIDDLEWARE`

In `Backend/Imboni/settings.py`, `MIDDLEWARE` currently begins:

```python
MIDDLEWARE = [
    # Must be first: resolves the subdomain -> tenant schema before anything
    # touches the database or auth.
    'django_tenants.middleware.main.TenantMainMiddleware',
    "corsheaders.middleware.CorsMiddleware",
    ...
]
```

Add exactly this line **immediately after** `TenantMainMiddleware` (so
`connection.tenant` is already resolved) and **before** the CORS/auth stack:

```python
    'apps.tenants.middleware.SubscriptionStatusMiddleware',
```

Resulting order (only the top shown):

```python
MIDDLEWARE = [
    'django_tenants.middleware.main.TenantMainMiddleware',
    'apps.tenants.middleware.SubscriptionStatusMiddleware',   # <-- ADD HERE
    "corsheaders.middleware.CorsMiddleware",
    'django.middleware.security.SecurityMiddleware',
    ...
]
```

Position rationale: it must run *after* the tenant is resolved (so it can read
`connection.tenant.status`) but there is no need to run any of the security /
session / auth stack for a school that is being blocked with a 402, so placing
it high in the list short-circuits blocked requests cheaply.

## 5. Settings to add (Phase 3)

```python
STRIPE_SECRET_KEY = config('STRIPE_SECRET_KEY', default='')
STRIPE_WEBHOOK_SECRET = config('STRIPE_WEBHOOK_SECRET', default='')
STRIPE_PUBLISHABLE_KEY = config('STRIPE_PUBLISHABLE_KEY', default='')
```

And add `stripe` to `requirements.txt`. The `/imboni/billing/` URL prefix must
be wired into `Backend/Imboni/urls.py` and is already allow-listed in
`middleware.ALWAYS_ALLOWED_PREFIXES` so a suspended school can reach checkout.
