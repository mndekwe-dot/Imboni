"""
Platform super-admin API routes (Phase 5).

WIRING — add this ONE line to the project's Imboni/urls.py urlpatterns
(alongside the other `path('imboni/', include(...))` entries):

    path('imboni/', include('apps.tenants.urls')),

IMPORTANT — PUBLIC SCHEMA ONLY:
These endpoints read/write Client/Domain, which exist only in the public
schema, so they must be served from the BARE domain (e.g. http://localhost/ or
the platform apex), NOT a school subdomain like springfield.localhost. django-
tenants routes the bare domain to the public schema, which is exactly where the
tenant registry lives. IsAdminUser (is_staff) further restricts access to
platform operators.

Resulting endpoints:
    POST /imboni/platform/auth/login/              — platform operator login
    GET  /imboni/platform/auth/me/                 — current platform operator
    GET  /imboni/platform/schools/                 — list schools
    GET  /imboni/platform/schools/<pk>/            — retrieve a school
    POST /imboni/platform/schools/<pk>/restrict/   — put a school read-only
    POST /imboni/platform/schools/<pk>/suspend/    — suspend a school
    POST /imboni/platform/schools/<pk>/reactivate/ — reactivate a school
    GET  /imboni/platform/audit/                   — who did what (read-only)
    ---- /imboni/platform/operators/               — the operator roster

Access is split by operator role (support / commercial / operations) — see
`platform_auth.py`. Reading stays wide; writing narrows by desk.
"""
from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views
from . import platform_ops
from .platform_auth import (
    PlatformLoginView, PlatformMeView, PlatformMfaConfirmView,
    PlatformMfaSetupView, PlatformMfaVerifyView,
)

router = DefaultRouter()
router.register(r'platform/schools', views.SchoolViewSet, basename='platform-school')
# Phase 6 — platform operations (money + support desk).
router.register(r'platform/expenses', platform_ops.ExpenseViewSet, basename='platform-expense')
router.register(r'platform/payments', platform_ops.PaymentViewSet, basename='platform-payment')
router.register(r'platform/tickets', platform_ops.SupportTicketViewSet, basename='platform-ticket')
# Phase 7 — school applications (intake -> review -> provision) + contracts.
router.register(r'platform/applications', platform_ops.ApplicationViewSet, basename='platform-application')
router.register(r'platform/contracts', platform_ops.ContractViewSet, basename='platform-contract')
# Accountability + who works here. The audit log is read-only by route as
# well as by policy: there is no write endpoint for it anywhere.
router.register(r'platform/audit', platform_ops.AuditLogViewSet, basename='platform-audit')
router.register(r'platform/operators', platform_ops.OperatorViewSet, basename='platform-operator')

urlpatterns = [
    path('platform/auth/login/', PlatformLoginView.as_view(), name='platform-login'),
    path('platform/auth/me/', PlatformMeView.as_view(), name='platform-me'),
    # Second factor: verify completes a login, setup/confirm enrol one.
    path('platform/auth/mfa/verify/', PlatformMfaVerifyView.as_view(), name='platform-mfa-verify'),
    path('platform/auth/mfa/setup/', PlatformMfaSetupView.as_view(), name='platform-mfa-setup'),
    path('platform/auth/mfa/confirm/', PlatformMfaConfirmView.as_view(), name='platform-mfa-confirm'),
    path('platform/summary/', platform_ops.PlatformSummaryView.as_view(), name='platform-summary'),
    path('platform/health/', platform_ops.PlatformHealthView.as_view(), name='platform-health'),
    *router.urls,
]
