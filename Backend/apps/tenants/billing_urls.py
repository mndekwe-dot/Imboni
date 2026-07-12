"""
School-facing billing routes — served on the TENANT subdomain (Imboni.urls),
authenticated as the school's admin. The Stripe webhook is NOT here; it lives on
the public schema in Imboni.urls_public.
"""
from django.urls import path

from .billing import BillingStatusView, CheckoutView

urlpatterns = [
    path('imboni/billing/status/', BillingStatusView.as_view(), name='billing-status'),
    path('imboni/billing/checkout/', CheckoutView.as_view(), name='billing-checkout'),
]
