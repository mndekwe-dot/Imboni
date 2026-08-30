"""
Platform operator authentication (Phase 5).

The per-school app authenticates `authentication.User`s with SimpleJWT. Platform
operators are a different principal entirely (`tenants.PlatformUser`, public
schema), so they get their OWN login + token flow here. The two never mix:

  * A platform token carries a ``platform: true`` claim and a
    ``platform_user_id``. `PlatformJWTAuthentication` only accepts those, so a
    normal school-user token can never reach the platform API.
  * A platform token has no tenant `user_id`, so it can't authenticate against
    the per-school endpoints either.

These views/classes are mounted on the PUBLIC schema (bare domain) — see
`apps/tenants/urls.py` / `Imboni/urls_public.py`.
"""
import pyotp
from django.core import signing
from django.utils import timezone
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import AllowAny, BasePermission, SAFE_METHODS
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status as http_status
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

from .models import PlatformUser
from .platform_audit import record


# ── Token issuance ────────────────────────────────────────────────────────────

def issue_tokens(platform_user):
    """Mint an access+refresh pair stamped as a platform token."""
    refresh = RefreshToken()
    refresh['platform'] = True
    refresh['platform_user_id'] = str(platform_user.id)
    refresh['email'] = platform_user.email
    # The role rides along so the frontend can hide what this operator cannot
    # do. It is NOT what authorises anything: every permission check below
    # re-reads the role from the database, so demoting someone takes effect on
    # their next request rather than when their token happens to expire.
    refresh['role'] = platform_user.role
    # RefreshToken.access_token copies our custom claims onto the access token.
    return {'access': str(refresh.access_token), 'refresh': str(refresh)}


def operator_payload(platform_user):
    """What the frontend is told about the signed-in operator."""
    return {
        'email': platform_user.email,
        'name': platform_user.name,
        'role': platform_user.role,
        'mfa_enabled': platform_user.mfa_enabled,
        # True when this operator holds a role that requires a second factor
        # and has not enrolled yet. They can sign in and read; the privileged
        # actions stay closed until they do.
        'mfa_setup_required': platform_user.mfa_required and not platform_user.mfa_enabled,
    }


# ── Authentication ────────────────────────────────────────────────────────────

class PlatformJWTAuthentication(BaseAuthentication):
    """Accept ONLY platform-stamped Bearer tokens; ignore everything else."""

    def authenticate(self, request):
        header = request.META.get('HTTP_AUTHORIZATION', '')
        if not header.startswith('Bearer '):
            return None
        raw = header.split(' ', 1)[1].strip()

        try:
            token = AccessToken(raw)
        except TokenError:
            raise AuthenticationFailed('Invalid or expired token.')

        # Not a platform token → this auth class doesn't handle it. Returning
        # None (not raising) lets the request fall through to "unauthenticated".
        if not token.get('platform'):
            return None

        try:
            user = PlatformUser.objects.get(id=token.get('platform_user_id'), is_active=True)
        except (PlatformUser.DoesNotExist, ValueError, TypeError):
            raise AuthenticationFailed('Platform account not found or inactive.')

        return (user, token)


class IsPlatformAdmin(BasePermission):
    """Allow only authenticated, active platform operators. Any role."""
    message = 'Platform operator access required.'

    def has_permission(self, request, view):
        return isinstance(request.user, PlatformUser) and request.user.is_active


class _RequiresRole(BasePermission):
    """
    Base for the role gates below.

    Two things it enforces, and both matter:

      * the operator's role must be at least `required_role`. Roles nest, so
        operations can do a commercial's job and a commercial can do support's;
      * an operator whose role demands MFA must actually have enrolled. Without
        this, adding the field would have been decoration -- an operations
        account with `mfa_enabled=False` would keep every power it had.

    The role is read from the database row, never from the token, so a demotion
    or a deactivation takes effect on the very next request.
    """
    required_role = PlatformUser.ROLE_SUPPORT

    def has_permission(self, request, view):
        user = request.user
        if not (isinstance(user, PlatformUser) and user.is_active):
            self.message = 'Platform operator access required.'
            return False
        if not user.has_role(self.required_role):
            self.message = (f'This action needs the '
                            f'{self.required_role} role. Yours is {user.role}.')
            return False
        if user.mfa_required and not user.mfa_enabled:
            self.message = ('Set up two-factor authentication before using '
                            'operations tools.')
            return False
        return True


class IsSupport(_RequiresRole):
    """The ticket desk: read a school, answer its questions."""
    required_role = PlatformUser.ROLE_SUPPORT


class IsCommercial(_RequiresRole):
    """Contracts, payments, plans. Money, not infrastructure."""
    required_role = PlatformUser.ROLE_COMMERCIAL


class IsOperations(_RequiresRole):
    """Provisioning, suspension, operator accounts. Requires MFA."""
    required_role = PlatformUser.ROLE_OPERATIONS


class ReadAnyWriteRole(_RequiresRole):
    """
    Any operator may read; writing needs `required_role`.

    Support staff need to SEE a contract or a payment to answer "when does our
    licence end" without being able to change it. Splitting by HTTP method is
    what lets one screen serve both without a second endpoint.
    """
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            user = request.user
            return isinstance(user, PlatformUser) and user.is_active
        return super().has_permission(request, view)


class ReadAnyWriteCommercial(ReadAnyWriteRole):
    required_role = PlatformUser.ROLE_COMMERCIAL


class ReadAnyWriteOperations(ReadAnyWriteRole):
    required_role = PlatformUser.ROLE_OPERATIONS


# ── Second factor ─────────────────────────────────────────────────────────────

ISSUER = 'Imboni Platform'
MFA_CHALLENGE_SALT = 'imboni.platform.mfa'
MFA_CHALLENGE_MAX_AGE = 5 * 60      # the code step must complete within 5 minutes


def issue_mfa_challenge(platform_user):
    """A short-lived signed token that proves the password step already passed."""
    return signing.dumps({'platform_user_id': str(platform_user.id)},
                         salt=MFA_CHALLENGE_SALT)


def resolve_mfa_challenge(challenge):
    """Return the PlatformUser for a valid, unexpired challenge, else None."""
    try:
        data = signing.loads(challenge or '', salt=MFA_CHALLENGE_SALT,
                             max_age=MFA_CHALLENGE_MAX_AGE)
    except (signing.BadSignature, signing.SignatureExpired):
        return None
    return PlatformUser.objects.filter(id=data.get('platform_user_id'),
                                       is_active=True).first()


def verify_mfa_code(platform_user, code):
    """True if `code` is currently valid for this operator's secret."""
    if not (platform_user.mfa_secret and code):
        return False
    return pyotp.TOTP(platform_user.mfa_secret).verify(str(code).strip(), valid_window=1)


# ── Views ─────────────────────────────────────────────────────────────────────

class PlatformLoginView(APIView):
    """POST {email, password} → {access, refresh, user}. Public, no auth."""
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        email = (request.data.get('email') or '').strip().lower()
        password = request.data.get('password') or ''
        if not email or not password:
            return Response({'error': 'Email and password are required.'},
                            status=http_status.HTTP_400_BAD_REQUEST)

        # Same generic 401 whether the email is unknown or the password is wrong,
        # so the endpoint doesn't reveal which platform emails exist.
        invalid = Response({'error': 'Invalid email or password.'},
                           status=http_status.HTTP_401_UNAUTHORIZED)
        try:
            user = PlatformUser.objects.get(email__iexact=email, is_active=True)
        except PlatformUser.DoesNotExist:
            return invalid
        if not user.check_password(password):
            return invalid

        # An operator with a second factor gets no token yet — only a
        # challenge. The password alone must not be enough to reach an API that
        # can switch a school off.
        if user.mfa_enabled:
            return Response({'mfa_required': True,
                             'challenge': issue_mfa_challenge(user)},
                            status=http_status.HTTP_200_OK)

        return self._sign_in(user)

    @staticmethod
    def _sign_in(user):
        user.last_login = timezone.now()
        user.save(update_fields=['last_login'])
        record('operator.login', actor=user, target=user,
               target_label=user.email, changes={'role': user.role})
        return Response({**issue_tokens(user), 'user': operator_payload(user)})


class PlatformMfaVerifyView(APIView):
    """POST {challenge, code} → tokens. The second half of a 2FA login."""
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        user = resolve_mfa_challenge(request.data.get('challenge'))
        if user is None:
            return Response({'error': 'This sign-in attempt expired. Start again.'},
                            status=http_status.HTTP_401_UNAUTHORIZED)
        if not verify_mfa_code(user, request.data.get('code')):
            record('operator.mfa_failed', actor=user, request=request, target=user,
                   target_label=user.email)
            return Response({'error': 'That code is not right. Try the current one.'},
                            status=http_status.HTTP_401_UNAUTHORIZED)
        return PlatformLoginView._sign_in(user)


class PlatformMfaSetupView(APIView):
    """
    POST → a fresh secret + the otpauth URI to scan.

    Rotating on every setup attempt means an abandoned half-enrolment cannot be
    completed later by whoever saw the QR code over a shoulder.
    """
    authentication_classes = [PlatformJWTAuthentication]
    permission_classes = [IsPlatformAdmin]

    def post(self, request):
        user = request.user
        if user.mfa_enabled:
            return Response({'error': 'Two-factor authentication is already on.'},
                            status=http_status.HTTP_400_BAD_REQUEST)
        user.mfa_secret = pyotp.random_base32()
        user.save(update_fields=['mfa_secret'])
        uri = pyotp.TOTP(user.mfa_secret).provisioning_uri(name=user.email,
                                                           issuer_name=ISSUER)
        return Response({'secret': user.mfa_secret, 'otpauth_uri': uri})


class PlatformMfaConfirmView(APIView):
    """
    POST {code} → turns MFA on, but only once a real code has been read off it.

    Enabling on the strength of the secret alone is how people lock themselves
    out of their own account with a misconfigured authenticator.
    """
    authentication_classes = [PlatformJWTAuthentication]
    permission_classes = [IsPlatformAdmin]

    def post(self, request):
        user = request.user
        if not user.mfa_secret:
            return Response({'error': 'Start the setup first.'},
                            status=http_status.HTTP_400_BAD_REQUEST)
        if not verify_mfa_code(user, request.data.get('code')):
            return Response({'error': 'That code is not right. Try the current one.'},
                            status=http_status.HTTP_400_BAD_REQUEST)
        user.mfa_enabled = True
        user.save(update_fields=['mfa_enabled'])
        record('operator.mfa_enabled', actor=user, request=request, target=user,
               target_label=user.email)
        return Response(operator_payload(user))


class PlatformMeView(APIView):
    """GET → the current platform operator (used by the frontend to confirm auth)."""
    authentication_classes = [PlatformJWTAuthentication]
    permission_classes = [IsPlatformAdmin]

    def get(self, request):
        return Response(operator_payload(request.user))
