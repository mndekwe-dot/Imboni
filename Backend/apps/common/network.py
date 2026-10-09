"""
Who is on the other end of this request?

Behind nginx, the TCP peer is always the proxy, so the real client address
travels in X-Forwarded-For. That header is a LIST the client is free to start:
nginx appends the address it actually saw to whatever the client already sent.

    client sends   X-Forwarded-For: 1.2.3.4          (forged)
    nginx forwards X-Forwarded-For: 1.2.3.4, 203.0.113.9
                                    ^^^^^^^  ^^^^^^^^^^^
                                    forged   the real peer, added by nginx

Only the entries added by OUR proxies can be trusted, and those are at the
RIGHT-hand end. Reading the left-most entry (as the audit log used to) lets
anyone choose the address that is recorded. Using the whole header as the
identity (as DRF's throttles do when NUM_PROXIES is unset) lets anyone get a
fresh rate-limit bucket on every request by changing the forged part, which
defeats every throttle in the app, including the login and 2FA ones.

`NUM_PROXIES` (REST_FRAMEWORK setting) says how many trusted proxies sit in
front of Django. This reads the same setting DRF's throttles use, so the two
can never disagree about who a client is.
"""
import ipaddress

from rest_framework.settings import api_settings


def _valid(value):
    """A normalised IP string, or None. Never raises: a header is user input."""
    try:
        return str(ipaddress.ip_address((value or '').strip()))
    except ValueError:
        return None


def client_ip(request):
    """The client's IP as seen by our outermost trusted proxy, or None."""
    if request is None:
        return None

    meta = request.META
    peer = meta.get('REMOTE_ADDR')
    forwarded = meta.get('HTTP_X_FORWARDED_FOR')
    proxies = api_settings.NUM_PROXIES

    if forwarded and (proxies is None or proxies > 0):
        entries = [e.strip() for e in forwarded.split(',') if e.strip()]
        if entries:
            trusted = 1 if proxies is None else proxies
            return _valid(entries[-min(trusted, len(entries))]) or _valid(peer)

    return _valid(peer)
