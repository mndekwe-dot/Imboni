"""
URLconf for the PUBLIC schema (the bare domain / marketing + signup site).

django-tenants uses this (via PUBLIC_SCHEMA_URLCONF in settings) for requests to
the bare domain, while school subdomains keep using the full app in Imboni.urls.
Only endpoints that operate on the public schema belong here — the tenant
registry (Client/Domain) lives in the public schema, so onboarding + platform
admin are served from here, NOT from a school subdomain.
"""
from django.urls import path, include

from apps.tenants.onboarding import SchoolSignupView, ProvisionStatusView
from apps.tenants.billing import StripeWebhookView

urlpatterns = [
    # Self-serve school signup (Phase 2) — unauthenticated, async.
    path('imboni/onboarding/signup/', SchoolSignupView.as_view(), name='school-signup'),
    path('imboni/onboarding/status/<uuid:pk>/', ProvisionStatusView.as_view(),
         name='school-signup-status'),

    # Stripe webhook (Phase 3) — server-to-server on the public/bare domain.
    path('imboni/billing/webhook/', StripeWebhookView.as_view(), name='stripe-webhook'),

    # Platform super-admin API (Phase 5) — IsAdminUser.
    path('imboni/', include('apps.tenants.urls')),
]
