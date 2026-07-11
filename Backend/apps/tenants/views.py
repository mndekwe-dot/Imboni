"""
Platform super-admin API (Phase 5) — the vendor's control plane for schools.

These views let the platform operator (the vendor running Imboni) list schools,
inspect a single school, and suspend/reactivate a school's subscription. They
read and write ``Client``/``Domain``, which exist ONLY in the public schema, so
this API must be served from the bare domain (no subdomain) — see urls.py for
the exact include line and the PUBLIC-schema requirement.

Access is restricted to Django staff users (``IsAdminUser`` → ``is_staff``),
i.e. platform operators, NOT per-school 'admin'-role users.

NOTE: Creating a school is intentionally NOT handled here. Provisioning a new
tenant (creating the Postgres schema, running tenant migrations, registering the
domain and seeding an admin user) is done by the existing management command:

    python manage.py provision_school --name "..." --subdomain "..." \
        --admin-email "..."

This viewset only manages the lifecycle of schools that already exist.
"""
from rest_framework import viewsets, status as http_status
from rest_framework.decorators import action
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response

from .models import Client
from .serializers import ClientSerializer


class SchoolViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Platform admin management of schools (tenants).

    Routes (mounted under ``platform/schools/`` — see urls.py):
        GET  platform/schools/                 — list all schools
        GET  platform/schools/<pk>/            — retrieve one school
        POST platform/schools/<pk>/suspend/    — set status='suspended'
        POST platform/schools/<pk>/reactivate/ — set status='active'

    Create/update/delete of the Client row are deliberately NOT exposed:
      - provisioning a school is done by the ``provision_school`` command, and
      - the only mutations a vendor performs day-to-day are suspend/reactivate.
    """
    queryset = Client.objects.all().order_by('name')
    serializer_class = ClientSerializer
    permission_classes = [IsAdminUser]

    def _set_status(self, request, pk, new_status):
        school = self.get_object()
        school.status = new_status
        school.save(update_fields=['status'])
        serializer = self.get_serializer(school)
        return Response(serializer.data, status=http_status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def suspend(self, request, pk=None):
        """Suspend a school (e.g. non-payment). Sets status='suspended'."""
        return self._set_status(request, pk, 'suspended')

    @action(detail=True, methods=['post'])
    def reactivate(self, request, pk=None):
        """Reactivate a suspended school. Sets status='active'."""
        return self._set_status(request, pk, 'active')
