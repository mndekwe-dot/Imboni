"""
Self-serve school signup (Phase 2).

A public, unauthenticated endpoint that lets a school create its own tenant.
Served from the PUBLIC schema only (see Imboni/urls_public.py +
PUBLIC_SCHEMA_URLCONF), because it reads/writes the tenant registry which lives
in the public schema.
"""
import logging

from django.core.mail import send_mail
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .services import (
    provision_tenant, validate_subdomain, normalize_subdomain, ProvisioningError,
)

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


class SchoolSignupView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = SchoolSignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            client, domain_name = provision_tenant(
                name=data['school_name'],
                subdomain=data['subdomain'],
                admin_email=data['admin_email'],
                admin_password=data['admin_password'],
                admin_first_name=data.get('admin_first_name', ''),
                admin_last_name=data.get('admin_last_name', ''),
                domain_base=_domain_base(request),
            )
        except ProvisioningError as exc:
            # e.g. the subdomain was taken between validation and creation.
            return Response({'subdomain': [str(exc)]}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            logger.exception('School provisioning failed for %r', data.get('subdomain'))
            return Response(
                {'detail': 'Something went wrong creating your school. Please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        url = _school_url(request, domain_name)
        _send_welcome_email(data['admin_email'], client.name, url)

        return Response({
            'school_name': client.name,
            'subdomain': client.schema_name,
            'url': url,
            'admin_email': data['admin_email'],
            'message': 'School created. You can now sign in.',
        }, status=status.HTTP_201_CREATED)


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


def _school_url(request, domain_name):
    scheme = 'https' if request.is_secure() else 'http'
    # Preserve a non-standard port (e.g. dev on :8000) so the link is clickable.
    port = request.get_host().partition(':')[2]
    host = f'{domain_name}:{port}' if port and port not in ('80', '443') else domain_name
    return f'{scheme}://{host}/'


def _send_welcome_email(admin_email, school_name, url):
    """Best-effort welcome email — never let a mail failure break signup."""
    try:
        send_mail(
            subject=f'Welcome to Imboni — {school_name} is ready',
            message=(
                f'Your school "{school_name}" has been created.\n\n'
                f'Sign in at: {url}\n\n'
                'Use the email and password you chose during signup.'
            ),
            from_email=None,   # uses DEFAULT_FROM_EMAIL
            recipient_list=[admin_email],
            fail_silently=True,
        )
    except Exception:
        logger.warning('Welcome email failed for %s', admin_email, exc_info=True)
