"""
Self-serve signup (Phase 2) — the demo door.

A public, unauthenticated endpoint. It used to create a real school, which left
Imboni with two front doors and a review process on only one of them: anyone
who could fill in a form could mint a permanent tenant, while the application
queue existed precisely to put a human in front of that decision.

So this door now creates a DEMO: a tenant with an end date, marked `is_demo`,
that stops on its own if nobody converts it. Nothing about the product is held
back -- a demo is the whole thing -- but a school that wants to keep it applies,
and a person reviews that. We sell to institutions holding children's health
and discipline records; a human looking at who they are is not bureaucracy.

Served from the PUBLIC schema only (see Imboni/urls_public.py +
PUBLIC_SCHEMA_URLCONF), because it reads/writes the tenant registry which lives
in the public schema.
"""
import logging

from django.contrib.auth.hashers import make_password
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .models import TenantProvision
from .services import (DEMO_TRIAL_DAYS, validate_subdomain, normalize_subdomain,
                       ProvisioningError)
from .tasks import provision_school_task

logger = logging.getLogger(__name__)


class SchoolSignupSerializer(serializers.Serializer):
    school_name      = serializers.CharField(max_length=120)
    subdomain        = serializers.CharField(max_length=63)
    admin_first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    admin_last_name  = serializers.CharField(max_length=150, required=False, allow_blank=True)
    admin_email      = serializers.EmailField()
    admin_password   = serializers.CharField(min_length=8, write_only=True)

    def validate_subdomain(self, value):
        value = normalize_subdomain(value)
        try:
            validate_subdomain(value)
        except ProvisioningError as exc:
            raise serializers.ValidationError(str(exc))
        return value

    def validate_admin_password(self, value):
        # min_length=8 on its own let a school administrator's account be
        # protected by "password". The invitation flow already runs Django's
        # validators; signup is the same account by another route and should
        # not be the weaker door.
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        return value


class SchoolSignupView(APIView):
    permission_classes = [AllowAny]
    # Every accepted POST creates a Postgres schema and migrates ~20 apps into
    # it, and entrypoint.sh re-inspects every schema on each container boot — so
    # junk tenants are not just clutter, they permanently slow deploys. At the
    # default anonymous ceiling this was 60 schemas a minute per IP.
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'school_signup'

    def post(self, request):
        serializer = SchoolSignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Record the request, then hand the slow part (schema + migrations) to a
        # Celery worker so this response returns immediately. The password is
        # hashed here and passed to the task as a hash — it is never stored.
        rec = TenantProvision.objects.create(
            school_name=data['school_name'],
            subdomain=data['subdomain'],
            admin_email=data['admin_email'],
            admin_first_name=data.get('admin_first_name', ''),
            admin_last_name=data.get('admin_last_name', ''),
            status='pending',
        )
        provision_school_task.delay(
            str(rec.id),
            make_password(data['admin_password']),
            _domain_base(request),
            'https' if request.is_secure() else 'http',
        )

        return Response({
            'provision_id': str(rec.id),
            'status': rec.status,
            'subdomain': rec.subdomain,
            'status_url': f'/imboni/onboarding/status/{rec.id}/',
            'is_demo': True,
            'trial_days': DEMO_TRIAL_DAYS,
            'message': (f'Creating your {DEMO_TRIAL_DAYS}-day demo. '
                        'This takes a moment.'),
        }, status=status.HTTP_202_ACCEPTED)


class ProvisionStatusView(APIView):
    """Poll target for the frontend during async signup."""
    permission_classes = [AllowAny]

    def get(self, request, pk):
        try:
            rec = TenantProvision.objects.get(pk=pk)
        except TenantProvision.DoesNotExist:
            return Response({'detail': 'Unknown provisioning id.'},
                            status=status.HTTP_404_NOT_FOUND)
        return Response({
            'status': rec.status,          # pending | ready | failed
            'subdomain': rec.subdomain,
            'school_name': rec.school_name,
            'admin_email': rec.admin_email,
            'url': rec.url,                # set once ready
            'detail': rec.detail,          # set once failed
        })


# ── helpers ─────────────────────────────────────────────────────────────────────

def _domain_base(request):
    """
    The base domain new schools hang off, derived from the public site's host so
    it matches the environment (localhost in dev, imboni.com in prod). Falls back
    to 'localhost' for bare IPs.
    """
    host = request.get_host().split(':')[0].lower()
    if not host or host.replace('.', '').isdigit():   # empty or raw IPv4
        return 'localhost'
    return host


class SchoolApplyView(APIView):
    """
    Public 'apply to join Imboni' endpoint (Phase 7). Unlike the self-serve
    signup above, this does NOT create a tenant — it records an application for
    the platform operator to review and, if approved, provision.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        from .serializers import SchoolApplySerializer
        serializer = SchoolApplySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        application = serializer.save()
        return Response(
            {'detail': 'Application received. Our team will review it and be in touch.',
             'id': str(application.id)},
            status=status.HTTP_201_CREATED,
        )
