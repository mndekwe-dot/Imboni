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
from django.utils import timezone
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import AllowAny, BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status as http_status
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

from .models import PlatformUser


# ── Token issuance ────────────────────────────────────────────────────────────

def issue_tokens(platform_user):
    """Mint an access+refresh pair stamped as a platform token."""
    refresh = RefreshToken()
    refresh['platform'] = True
    refresh['platform_user_id'] = str(platform_user.id)
    refresh['email'] = platform_user.email
    # RefreshToken.access_token copies our custom claims onto the access token.
    return {'access': str(refresh.access_token), 'refresh': str(refresh)}


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
    """Allow only authenticated, active platform operators."""
    message = 'Platform operator access required.'

    def has_permission(self, request, view):
        return isinstance(request.user, PlatformUser) and request.user.is_active


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

        user.last_login = timezone.now()
        user.save(update_fields=['last_login'])

        return Response({**issue_tokens(user),
                         'user': {'email': user.email, 'name': user.name}})


class PlatformMeView(APIView):
    """GET → the current platform operator (used by the frontend to confirm auth)."""
    authentication_classes = [PlatformJWTAuthentication]
    permission_classes = [IsPlatformAdmin]

    def get(self, request):
        return Response({'email': request.user.email, 'name': request.user.name})
