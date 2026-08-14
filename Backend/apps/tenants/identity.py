"""
Public identity for a school subdomain.

When a parent opens demo.imboni.tech they should see their school's name, not
generic product chrome. The login page has to render that BEFORE anyone signs
in, so this endpoint is deliberately unauthenticated.

WHAT IT MAY EXPOSE
------------------
Only what a visitor to that subdomain can already infer: the school's name and
its subscription state. Nothing about pupils, staff, counts, or anything that
would let an unauthenticated caller measure the school.

The name is not a secret -- the school publishes its own URL and puts its name
on its gate. Counts and rosters are secrets. Keep that line where it is: this
is the one endpoint on a tenant that answers without credentials, so anything
added here is added to the public internet.
"""
from django.db import connection
from django_tenants.utils import get_public_schema_name
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView


class SchoolIdentityView(APIView):
    """
    GET /imboni/school/identity/

    Returns the school behind the current hostname:

        {"name": "Demo Secondary School", "subdomain": "demo", "status": "active"}

    On the bare domain (public schema) there is no school, so it returns
    `{"name": null}` rather than 404 -- the frontend uses one code path and
    simply renders unbranded when there is nothing to brand.
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        schema = getattr(connection, 'schema_name', get_public_schema_name())

        if schema == get_public_schema_name():
            return Response({'name': None, 'subdomain': None, 'status': None})

        tenant = getattr(connection, 'tenant', None)

        # Prefer the name the school set for itself in DOS settings; fall back
        # to the name it was provisioned with.
        name = None
        try:
            from apps.dos.models import SchoolSetting
            configured = SchoolSetting.get_setting().school_name
            name = (configured or '').strip() or None
        except Exception:
            name = None

        if not name and tenant is not None:
            name = getattr(tenant, 'name', None)

        return Response({
            'name': name,
            'subdomain': schema,
            # Lets the login page warn a suspended school's staff why their
            # sign-in will not get them very far, instead of failing opaquely.
            'status': getattr(tenant, 'status', None) if tenant is not None else None,
        })
