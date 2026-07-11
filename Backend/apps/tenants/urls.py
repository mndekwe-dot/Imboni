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
    GET  /imboni/platform/schools/                 — list schools
    GET  /imboni/platform/schools/<pk>/            — retrieve a school
    POST /imboni/platform/schools/<pk>/suspend/    — suspend a school
    POST /imboni/platform/schools/<pk>/reactivate/ — reactivate a school
"""
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r'platform/schools', views.SchoolViewSet, basename='platform-school')

urlpatterns = router.urls
