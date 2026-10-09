"""
Rate limits for signing in.

Two limits, because they stop two different things:

  per address   a flood from one machine, whoever it is trying to be. Generous,
                because a whole school can sit behind one address and sign in
                together when the first lesson starts. This used to be the ONLY
                limit, at 5 a minute: the sixth pupil in a classroom was refused.

  per account   one account being guessed at. Counted per (address, account), so
                an attacker hammering a teacher's email from their own machine
                is stopped after a handful of tries without being able to lock
                the real teacher out from theirs.

Neither limit trusts X-Forwarded-For beyond the proxy we run: the address comes
from apps.common.network.client_ip.
"""
import hashlib

from rest_framework.throttling import SimpleRateThrottle

from apps.common.network import client_ip


class LoginAccountThrottle(SimpleRateThrottle):
    """Attempts against one account from one address (scope 'login_account')."""
    scope = 'login_account'

    def get_cache_key(self, request, view):
        who = (request.data.get('username') or request.data.get('email') or '')
        who = str(who).strip().lower()
        if not who:
            # Nothing to key on. The view rejects an empty login with a 400 and
            # the per-address limit still applies.
            return None
        # Hashed: the cache key is not a place to keep a list of email addresses.
        digest = hashlib.sha256(who.encode('utf-8')).hexdigest()[:32]
        ident = f'{client_ip(request) or "unknown"}:{digest}'
        return self.cache_format % {'scope': self.scope, 'ident': ident}
