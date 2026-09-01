"""
Getting a newly provisioned school into its own account.

Provisioning used to generate a temporary password and return it to the
operator's screen, with a note in the code saying an email "can be added
later". That made onboarding a manual relay: an operator copying a live
credential into an email or a chat thread, where it does not expire, cannot be
revoked, and is visible to everyone else in the conversation.

So the school's first admin is created with an unusable password and receives a
single-use, expiring link instead. The operator sees that an invitation was
sent and whether it was accepted. They never see a credential, which means they
can no longer leak one.

Both ends live here: `create_invitation`/`send_invitation` run on the public
schema (operator side), `accept_invitation` runs on the school's own domain.
"""
import hashlib
import logging
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import send_mail
from django.db import connection, transaction
from django.utils import timezone
from django.utils.crypto import get_random_string
from django_tenants.utils import schema_context, get_public_schema_name
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import SchoolInvitation
from .platform_audit import record

logger = logging.getLogger(__name__)

# A week is long enough for a head teacher to get to it after a weekend, short
# enough that a forwarded email is not a permanent back door.
INVITATION_TTL_DAYS = 7

# 43 characters of base62 is ~256 bits. Long enough that guessing is not a
# strategy, short enough to survive being wrapped by an email client.
TOKEN_LENGTH = 43


def hash_token(raw_token):
    """
    Hash for storage and lookup.

    Plain SHA-256, not a password hasher, and deliberately: a password hash is
    salted per row, which makes it impossible to look a token UP. The token is
    256 bits of randomness rather than something a person chose, so there is no
    dictionary to attack and no need to make hashing slow.
    """
    return hashlib.sha256(raw_token.encode('utf-8')).hexdigest()


def create_invitation(client, email, *, login_url='', created_by=None,
                      ttl_days=INVITATION_TTL_DAYS):
    """
    Create a fresh invitation and return ``(invitation, raw_token)``.

    The raw token is returned ONCE, to be put in the email. It is never stored
    and cannot be recovered — a lost invitation is re-sent, not looked up.

    Any earlier unused invitation for the same school is expired first, so
    re-sending genuinely replaces the old link rather than leaving two live.
    """
    raw_token = get_random_string(TOKEN_LENGTH)
    now = timezone.now()

    with schema_context(get_public_schema_name()):
        with transaction.atomic():
            (SchoolInvitation.objects
             .filter(client=client, accepted_at__isnull=True, expires_at__gt=now)
             .update(expires_at=now))
            invitation = SchoolInvitation.objects.create(
                client=client,
                email=email,
                token_hash=hash_token(raw_token),
                login_url=login_url,
                expires_at=now + timedelta(days=ttl_days),
                created_by=created_by,
            )
    return invitation, raw_token


def invitation_link(domain_name, raw_token, scheme='https'):
    return f'{scheme}://{domain_name}/accept-invite?token={raw_token}'


def send_invitation(invitation, raw_token, *, school_name, domain_name, scheme='https'):
    """
    Email the link. Records the outcome on the invitation either way.

    Returns True on success. A failure is not raised: the school is already
    provisioned by this point, and losing the tenant because an SMTP server was
    briefly down would be a far worse outcome than an operator having to press
    "resend". `delivery_error` is what tells them to.
    """
    link = invitation_link(domain_name, raw_token, scheme=scheme)
    days = max((invitation.expires_at - timezone.now()).days, 1)
    body = (
        f'Your school, {school_name}, is now set up on Imboni.\n\n'
        'Use the link below to choose your password and sign in as the school '
        'administrator:\n\n'
        f'  {link}\n\n'
        f'The link works once and expires in {days} days. If it expires before '
        'you get to it, ask us to send another.\n\n'
        'If you were not expecting this email, you can ignore it. No account '
        'can be used until someone opens this link and sets a password.\n'
    )

    with schema_context(get_public_schema_name()):
        try:
            send_mail(
                subject=f'Set up your Imboni account for {school_name}',
                message=body,
                from_email=None,           # DEFAULT_FROM_EMAIL
                recipient_list=[invitation.email],
                fail_silently=False,
            )
        except Exception as exc:
            logger.exception('Could not send invitation for %s', invitation.client_id)
            invitation.delivery_error = str(exc)[:255]
            invitation.save(update_fields=['delivery_error'])
            return False

        invitation.sent_at = timezone.now()
        invitation.delivery_error = ''
        invitation.save(update_fields=['sent_at', 'delivery_error'])
    return True


class InvitationError(Exception):
    """The token is unknown, spent, expired, or not for this school."""


def find_invitation(raw_token, client):
    """
    Look up a usable invitation for `client`, or raise InvitationError.

    Checking the client matters: the token is looked up from a school's own
    domain, and without this check a valid token for school A, replayed against
    school B's domain, would be accepted there.
    """
    if not raw_token:
        raise InvitationError('This invitation link is not valid.')

    with schema_context(get_public_schema_name()):
        invitation = (SchoolInvitation.objects
                      .filter(token_hash=hash_token(raw_token))
                      .select_related('client').first())
        if invitation is None or (client is not None
                                  and invitation.client_id != client.pk):
            # Same message for unknown and mismatched: telling the difference
            # would confirm that a token exists somewhere else.
            raise InvitationError('This invitation link is not valid.')
        if invitation.accepted_at is not None:
            raise InvitationError('This invitation has already been used. '
                                  'Sign in, or ask your school for a new link.')
        if invitation.is_expired:
            raise InvitationError('This invitation has expired. '
                                  'Ask us to send you a new one.')
        return invitation


def accept_invitation(raw_token, password, client):
    """
    Spend the invitation and set the admin's password inside the school schema.

    Returns the User. Raises InvitationError if the token cannot be used.
    """
    invitation = find_invitation(raw_token, client)

    User = get_user_model()
    with schema_context(client.schema_name):
        user = User.objects.filter(email__iexact=invitation.email).first()
        if user is None:
            # The invitation outlived the account it was for. Nothing sensible
            # to do but stop; re-provisioning is an operator decision.
            raise InvitationError('The account for this invitation no longer exists.')
        user.set_password(password)
        user.is_active = True
        user.save(update_fields=['password', 'is_active'])

    with schema_context(get_public_schema_name()):
        invitation.accepted_at = timezone.now()
        invitation.save(update_fields=['accepted_at'])

    return user


def latest_invitation(client):
    """The most recent invitation for a school, or None. Read-only helper."""
    with schema_context(get_public_schema_name()):
        return SchoolInvitation.objects.filter(client=client).first()


def frontend_scheme():
    """https unless we are explicitly running a local http frontend."""
    return 'http' if str(getattr(settings, 'FRONTEND_URL', '')).startswith('http://') else 'https'


# ── API (school side — served from the school's own domain) ───────────────────

class InvitationCheckView(APIView):
    """
    GET ?token=... → whether this link is still good, and who it is for.

    The accept page calls this before showing a password form, so an expired or
    spent link says so immediately rather than after someone has typed a
    password twice.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        tenant = getattr(connection, 'tenant', None)
        try:
            invitation = find_invitation(request.query_params.get('token'), tenant)
        except InvitationError as exc:
            return Response({'valid': False, 'detail': str(exc)},
                            status=status.HTTP_400_BAD_REQUEST)
        return Response({
            'valid': True,
            'email': invitation.email,
            'school_name': getattr(tenant, 'name', ''),
            'expires_at': invitation.expires_at,
        })


class InvitationAcceptView(APIView):
    """POST {token, password} → sets the password and spends the invitation."""
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        tenant = getattr(connection, 'tenant', None)
        password = request.data.get('password') or ''

        # Django's own validators, so an invited admin is held to the same
        # standard as one who set their password any other way.
        try:
            validate_password(password)
        except DjangoValidationError as exc:
            return Response({'detail': ' '.join(exc.messages)},
                            status=status.HTTP_400_BAD_REQUEST)

        try:
            user = accept_invitation(request.data.get('token'), password, tenant)
        except InvitationError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        record('school.invitation_accepted', client=tenant, request=request,
               target_type='User', target_label=user.email)
        return Response({'detail': 'Your password is set. You can sign in now.',
                         'email': user.email})
