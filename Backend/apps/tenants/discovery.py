"""
"Find my school" — recovery for the subdomain model.

Imboni serves each school at its own subdomain, so the URL carries the tenant
identity. That is what makes schema isolation work, but it leaves a user who
forgot their school's address with nowhere to go: the bare domain is the
marketing site and knows nothing about them.

This module closes that gap the way Slack does for workspaces. A user enters an
email on the public site; if that address belongs to any school, the school's
URL is emailed to it. Nothing is ever revealed in the HTTP response.

THE ENUMERATION RULE
--------------------
This endpoint must never let a caller learn whether an email is enrolled
anywhere. Three things enforce that, and all three matter:

1. The response is identical either way ("if that address is registered, we
   have sent it an email"), including its status code.
2. The lookup runs in a Celery task, so the response returns before any search
   happens. A synchronous search would leak the answer through response time --
   a hit walks every tenant schema and sends mail, a miss returns immediately.
   That timing difference is a reliable oracle.
3. The endpoint is throttled per IP.

Without (2), (1) is decorative. A parent's email address revealing which school
their child attends is exactly the kind of disclosure this product cannot make.
"""
import logging

from django.core.mail import send_mail
from django_tenants.utils import schema_context, get_public_schema_name
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

logger = logging.getLogger(__name__)


def find_schools_for_email(email):
    """
    Every school the given email has an active account at.

    Returns a list of {'name', 'domain'} dicts. Walks each tenant schema in
    turn, because there is no cross-schema query: that separation is the whole
    point of the isolation model, and this is the rare operation that has to
    pay for it.
    """
    from django.contrib.auth import get_user_model
    from .models import Client, Domain

    email = (email or '').strip().lower()
    if not email:
        return []

    User = get_user_model()
    matches = []

    with schema_context(get_public_schema_name()):
        tenants = list(
            Client.objects.exclude(schema_name=get_public_schema_name())
            .exclude(status='suspended')
            .values('schema_name', 'name')
        )
        domains = {
            d['tenant__schema_name']: d['domain']
            for d in Domain.objects.values('tenant__schema_name', 'domain')
        }

    for tenant in tenants:
        schema = tenant['schema_name']
        domain = domains.get(schema)
        if not domain:
            continue
        try:
            with schema_context(schema):
                if User.objects.filter(email__iexact=email, is_active=True).exists():
                    matches.append({'name': tenant['name'], 'domain': domain})
        except Exception:
            # A tenant whose schema is mid-migration or otherwise unreadable
            # must not break the lookup for every other school.
            logger.warning('find_schools_for_email: could not search %s', schema,
                           exc_info=True)
            continue

    return matches


def send_school_reminder(email, schools, scheme='https'):
    """
    Email the matching school links.

    Sends nothing when there are no matches: a "no schools found" email would
    confirm to whoever triggered it that the address is NOT enrolled, which is
    the same disclosure in reverse, and it would also let this endpoint be used
    to send unsolicited mail to arbitrary addresses.
    """
    if not schools:
        return False

    lines = [f'  {s["name"]}: {scheme}://{s["domain"]}/' for s in schools]
    body = (
        'You asked us to remind you where to sign in to Imboni.\n\n'
        'Your account is registered at:\n\n'
        + '\n'.join(lines)
        + '\n\nOpen the link for your school and sign in as usual.\n\n'
        'If you did not request this, you can ignore this email. Nobody has '
        'been given access to your account.\n'
    )

    try:
        send_mail(
            subject='Your Imboni school link',
            message=body,
            from_email=None,   # DEFAULT_FROM_EMAIL
            recipient_list=[email],
            fail_silently=False,
        )
        return True
    except Exception:
        # No address in the message: Sentry is configured with
        # send_default_pii=False so error reports cannot carry PII, and an
        # interpolated recipient would put it back in through the front door.
        logger.exception('send_school_reminder: delivery failed')
        return False


# ── API ───────────────────────────────────────────────────────────────────────

# One message, whatever happened. Kept as a constant so no future edit can
# accidentally make the hit and miss paths say different things.
SAME_ANSWER = (
    'If that email address is registered with a school on Imboni, we have sent '
    'it a message with the link to sign in. Please check your inbox and your '
    'spam folder.'
)


class FindMySchoolSerializer(serializers.Serializer):
    email = serializers.EmailField()


class FindMySchoolView(APIView):
    """
    POST /imboni/find-school/   {"email": "..."}   -> 202, always the same body.

    Public schema only: it is the bare domain a lost user lands on, and the
    tenant registry it needs lives there.

    Returns 202 rather than 200 deliberately. The work has been accepted, not
    completed -- and there is nothing to report about the outcome, which is the
    whole point.
    """
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'school_lookup'

    def post(self, request):
        serializer = FindMySchoolSerializer(data=request.data)
        if not serializer.is_valid():
            # Even a malformed address gets the standard answer. Distinguishing
            # "not an email" from "email we don't know" is harmless here, but
            # keeping one exit path means there is no second response body for a
            # later change to make revealing.
            return Response({'detail': SAME_ANSWER}, status=status.HTTP_202_ACCEPTED)

        email = serializer.validated_data['email'].strip().lower()
        scheme = 'https' if request.is_secure() else 'http'

        from .tasks import find_my_school_task
        try:
            find_my_school_task.delay(email, scheme)
        except Exception:
            # Broker down. Log it, but still answer normally -- an error here
            # would tell the caller their address was worth processing.
            logger.exception('find_my_school: could not queue lookup')

        return Response({'detail': SAME_ANSWER}, status=status.HTTP_202_ACCEPTED)
