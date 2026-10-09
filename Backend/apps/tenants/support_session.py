"""
A support session: a platform operator looking at a school as its administrator
sees it, to answer "why does this not work for us?" without screenshots.

What makes this safe to have at all:

    read-only      every method but GET/HEAD/OPTIONS is refused for the lifetime of the
                   token (see TenantScopedJWTAuthentication). The operator can look and
                   cannot change a mark, a payment or a password.
    short          5-30 minutes, no refresh token: when it ends, it ends.
    reasoned       the operator must say why, and it is recorded against their name.
    visible        the school's own audit log gets an entry, so an administrator can see
                   that and why Imboni looked. Nothing here is covert.
    operations     only the operations desk, with MFA, may open one.

The token is an ordinary school access token for the school's first administrator
with two extra claims. It is handed over in the URL *fragment*, which a browser
never sends to a server, so it does not land in anyone's access logs.
"""
from datetime import timedelta

from django_tenants.utils import schema_context
from rest_framework_simplejwt.tokens import AccessToken

SUPPORT_CLAIM = 'support_session'
OPERATOR_CLAIM = 'operator'

MIN_MINUTES, MAX_MINUTES, DEFAULT_MINUTES = 5, 30, 20


class SupportSessionError(Exception):
    """The session cannot be opened; the message is shown to the operator."""


def open_support_session(client, operator, reason, minutes=DEFAULT_MINUTES):
    """Mint the token. Returns ``(token, admin_user, minutes)``."""
    from apps.audit.models import AuditEntry
    from apps.authentication.models import User
    from apps.authentication.tokens import SCHEMA_CLAIM

    reason = (reason or '').strip()
    if len(reason) < 10:
        raise SupportSessionError('Say why you need to look, in a sentence: it is shown to the school.')
    try:
        minutes = int(minutes)
    except (TypeError, ValueError):
        minutes = DEFAULT_MINUTES
    minutes = max(MIN_MINUTES, min(MAX_MINUTES, minutes))

    with schema_context(client.schema_name):
        admin = User.objects.filter(role='admin', is_active=True).order_by('created_at').first()
        if admin is None:
            raise SupportSessionError('This school has no active administrator to look through.')
        token = AccessToken.for_user(admin)
        token[SCHEMA_CLAIM] = client.schema_name
        token[SUPPORT_CLAIM] = True
        token[OPERATOR_CLAIM] = operator.email
        token.set_exp(lifetime=timedelta(minutes=minutes))
        AuditEntry.objects.create(
            actor=None, actor_name=f'Imboni support ({operator.email})', actor_role='support',
            action='support.session_opened', target=admin.get_full_name() or admin.username,
            detail={'reason': reason[:500], 'minutes': minutes, 'read_only': True})
    return str(token), admin, minutes
