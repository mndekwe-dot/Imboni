"""
Where a signed-in browser keeps its session.

The refresh token is the long-lived credential: whoever holds it can mint
access tokens for a week. It used to be handed to the page in the login answer
and kept in localStorage, where any script running on the page could read it
and send it elsewhere. One injected script, one stolen week.

It now travels only in a cookie the page cannot read:

  HttpOnly      no script can see it, so none can copy it out
  Secure        never sent over plain http (outside local development)
  SameSite      Strict: another site cannot make the browser send it
  Path          /imboni/auth/ only, so it is not attached to every API call
  host-only     no Domain attribute, so one school's cookie is never sent to
                another school's subdomain

The page still gets the short-lived access token in the answer and keeps it in
memory. That is the piece a script on the page could reach, which is why it
lasts minutes, not days.
"""
import hashlib

from django.conf import settings
from rest_framework.throttling import SimpleRateThrottle

REFRESH_COOKIE = 'imboni_refresh'
COOKIE_PATH = '/imboni/auth/'

# Set on the refresh token when the person ticked "Remember me": the cookie then
# outlives the browser. Without it the cookie is a session cookie and goes when
# the browser closes, which is what a shared school computer needs.
REMEMBER_CLAIM = 'remember'


def _secure(request):
    return request.is_secure() or not settings.DEBUG


def set_refresh_cookie(response, request, refresh):
    """Put `refresh` (a RefreshToken) in the browser's cookie jar."""
    lifetime = settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME']
    response.set_cookie(
        REFRESH_COOKIE,
        str(refresh),
        max_age=int(lifetime.total_seconds()) if refresh.get(REMEMBER_CLAIM) else None,
        path=COOKIE_PATH,
        secure=_secure(request),
        httponly=True,
        samesite='Strict',
    )
    return response


def clear_refresh_cookie(response):
    response.delete_cookie(REFRESH_COOKIE, path=COOKIE_PATH, samesite='Strict')
    return response


def sent_by_our_page(request):
    """
    True when the request carries the header only our own pages send.

    A second lock behind SameSite. A form on another site can make a browser
    POST here, but it cannot add a custom header without a CORS preflight, and
    the preflight is refused for any origin that is not ours.
    """
    return request.headers.get('X-Requested-With') == 'XMLHttpRequest'


class RefreshRateThrottle(SimpleRateThrottle):
    """
    Limits refreshes per session, not per address.

    A whole school usually shares one public IP. The page refreshes on every
    load, so an address-based limit would sign a computer lab out the moment a
    class opened the app together. Keyed on the token instead: each session
    gets its own allowance, and a request with no token falls back to the IP.
    """
    scope = 'token_refresh'

    def get_cache_key(self, request, view):
        raw = request.COOKIES.get(REFRESH_COOKIE) or ''
        if not raw and hasattr(request, 'data'):
            raw = str(request.data.get('refresh') or '')
        ident = hashlib.sha256(raw.encode()).hexdigest() if raw else self.get_ident(request)
        return self.cache_format % {'scope': self.scope, 'ident': ident}
