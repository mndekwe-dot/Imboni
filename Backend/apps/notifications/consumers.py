"""
WebSocket consumer for the real-time notification bell.

    ws(s)://<school-subdomain>/imboni/ws/notifications/?token=<JWT access token>

Two things make this consumer different from an ordinary Django view, and both
are security-critical:

1. AUTHENTICATION. A browser cannot set an Authorization header on a WebSocket
   handshake, and this API carries no session cookie (stateless JWT). So the
   access token travels in the query string and is validated here with the same
   SimpleJWT machinery DRF uses for HTTP. Anything that fails validation is
   closed immediately with a 4401 code — we never `accept()` first.

2. TENANCY. `TenantMainMiddleware` only runs for HTTP requests; a WebSocket
   never passes through it, so `connection.schema_name` would still be whatever
   the worker last used. We therefore resolve the tenant ourselves from the
   handshake `Host` header (exactly as the middleware does) and run every ORM
   call inside `schema_context(<that schema>)`. The user is looked up INSIDE the
   resolved school's schema, so a token minted by school A cannot name a user of
   school B. On top of that the channel group name is namespaced by schema, so
   even a bug in group bookkeeping cannot cross-deliver between schools.

Close codes
    4400  malformed handshake (no Host header)
    4401  missing / invalid / expired token, or unknown-inactive user
    4404  Host does not map to a live school (or maps to the public schema,
          which has no notifications table at all)
"""
import hashlib
import logging
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django_tenants.utils import (
    get_public_schema_name,
    get_tenant_domain_model,
    schema_context,
)

logger = logging.getLogger(__name__)

# Channels rejects group names longer than 100 chars or containing anything
# outside [A-Za-z0-9-_.]. A schema name may be up to 63 chars and a user id is a
# 36-char UUID, which together can overflow that budget — so the identity is
# carried by a digest of BOTH values (making cross-schema collision infeasible)
# with a truncated, human-readable schema prefix kept for log/redis-key triage.
GROUP_PREFIX = 'notify'


def notification_group_name(schema_name, user_id):
    """
    The channel group a single user of a single school listens on.

    The schema name is part of the hashed material, so two different schools can
    never produce the same group even for identical user ids. This function is
    the ONLY place group names are built — the consumer and the broadcaster both
    call it, so they cannot drift apart.
    """
    digest = hashlib.sha256(f'{schema_name}:{user_id}'.encode()).hexdigest()[:32]
    safe_prefix = ''.join(c for c in str(schema_name) if c.isalnum() or c in '-_')[:40]
    return f'{GROUP_PREFIX}.{safe_prefix}.{digest}'


@database_sync_to_async
def _resolve_tenant(hostname):
    """
    Map a handshake Host header to a tenant, mirroring TenantMainMiddleware.

    The Domain table lives in the public schema, so the lookup is forced there
    regardless of whatever schema this worker thread was last left on.
    """
    hostname = (hostname or '').split(':')[0].strip().lower()
    if not hostname:
        return None
    DomainModel = get_tenant_domain_model()
    with schema_context(get_public_schema_name()):
        domain = (DomainModel.objects
                  .select_related('tenant')
                  .filter(domain=hostname)
                  .first())
        if domain is None:
            return None
        tenant = domain.tenant
        # Touch the attributes we need while still inside the public schema so
        # nothing lazy-loads later against the wrong search_path.
        _ = (tenant.schema_name, tenant.name)
        return tenant


@database_sync_to_async
def _authenticate(schema_name, raw_token):
    """
    Validate a JWT and load the owning user FROM THE GIVEN SCHEMA.

    Signature/expiry validation is schema-independent, but the `user_id` claim
    is only meaningful inside one school's schema — resolving it anywhere else
    would be the cross-tenant hole. Returns None for every failure mode; the
    caller does not get to learn which one.
    """
    from rest_framework_simplejwt.authentication import JWTAuthentication

    if not raw_token:
        return None

    auth = JWTAuthentication()
    try:
        # Rejects bad signatures, expired tokens and refresh tokens presented as
        # access tokens (token_type claim is checked by AccessToken).
        validated = auth.get_validated_token(raw_token)
    except Exception:
        return None

    with schema_context(schema_name):
        try:
            user = auth.get_user(validated)
        except Exception:
            return None
        if user is None or not user.is_active:
            return None
        # Materialise before leaving the schema context.
        return {'id': str(user.pk), 'email': user.email}


class NotificationConsumer(AsyncJsonWebsocketConsumer):
    """Pushes this user's notifications, for this school only."""

    group_name = None

    async def connect(self):
        host = None
        for name, value in self.scope.get('headers', []):
            if name == b'host':
                host = value.decode('latin-1')
                break
        if not host:
            await self.close(code=4400)
            return

        tenant = await _resolve_tenant(host)
        if tenant is None or tenant.schema_name == get_public_schema_name():
            # Unknown subdomain, or the bare platform domain which has no
            # notifications table. Never fall back to "some" schema.
            await self.close(code=4404)
            return

        params = parse_qs(self.scope.get('query_string', b'').decode('latin-1'))
        raw_token = (params.get('token') or [None])[0]

        user = await _authenticate(tenant.schema_name, raw_token)
        if user is None:
            await self.close(code=4401)
            return

        self.schema_name = tenant.schema_name
        self.user_id = user['id']
        self.group_name = notification_group_name(tenant.schema_name, user['id'])

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self.send_json({'type': 'connected', 'schema': tenant.schema_name})

    async def disconnect(self, code):
        if self.group_name:
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content, **kwargs):
        """
        The stream is push-only. Answer pings so a client can keep the
        connection warm through an idle proxy; ignore everything else rather
        than exposing any server-side action over the socket.
        """
        if isinstance(content, dict) and content.get('type') == 'ping':
            await self.send_json({'type': 'pong'})

    # ── channel-layer handlers ────────────────────────────────────────────────
    async def notify(self, event):
        """Handler for {'type': 'notify', ...} messages sent to the group."""
        await self.send_json({
            'type': 'notification',
            'notification': event.get('notification'),
        })
