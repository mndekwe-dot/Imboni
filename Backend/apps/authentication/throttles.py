"""
Rate limits for signing in.

Two limits, because they stop two different things:

  per address   a flood from one machine, whoever it is trying to be. Generous,
                because a whole school can sit behind one address and sign in
                together when the first lesson starts. This used to be the ONLY
                limit, at 5 a minute: the sixth pupil in a classroom was refused.

  per account   one account being guessed at. Counted per (address, account)
                and only for WRONG passwords, so an attacker hammering a
                teacher's email from their own machine is stopped after three
                tries without being able to lock the real teacher out from
                theirs, and signing in correctly never uses the allowance up.

Neither limit trusts X-Forwarded-For beyond the proxy we run: the address comes
from apps.common.network.client_ip.
"""
import hashlib

from rest_framework.throttling import SimpleRateThrottle

from apps.common.network import client_ip


class LoginAccountThrottle(SimpleRateThrottle):
    """
    Wrong passwords against one account from one address (scope 'login_account').

    Only FAILED attempts count. Counting every request would lock a teacher out
    of their own account after a few perfectly good sign-ins in an hour (a
    second device, a new tab, signing out and back in), which is the opposite
    of what a guessing limit is for. The view records a failure with
    ``record_failure`` and clears the count on a correct password.
    """
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

    def _history(self, request):
        key = self.get_cache_key(request, None)
        if key is None or self.rate is None:
            return key, None
        now = self.timer()
        history = self.cache.get(key, [])
        while history and history[-1] <= now - self.duration:
            history.pop()
        return key, (history, now)

    def allow_request(self, request, view):
        """Refuse once the limit of failures is reached. Never records."""
        key, state = self._history(request)
        if state is None:
            return True
        self.key = key
        self.history, self.now = state
        if len(self.history) >= self.num_requests:
            return self.throttle_failure()
        return True

    def record_failure(self, request):
        """Count one wrong password against this (address, account)."""
        key, state = self._history(request)
        if state is None:
            return
        history, now = state
        history.insert(0, now)
        self.cache.set(key, history, self.duration)

    def reset(self, request):
        """A correct password clears the count, so past typos are forgiven."""
        key = self.get_cache_key(request, None)
        if key is not None:
            self.cache.delete(key)
