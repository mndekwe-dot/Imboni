"""
Recording what an operator did.

`apps.audit` is a TENANT app — it logs what happens inside one school. Nothing
logged what happened ABOVE the schools, which is where the destructive actions
live: provisioning a tenant, suspending a school, signing a contract, recording
a payment against an account.

Everything here writes to the public schema. There is one entry point,
`record()`, and one mixin, `AuditedViewSetMixin`, so an endpoint gets an audit
trail by being mounted rather than by remembering to call something.
"""
import logging

from django_tenants.utils import schema_context, get_public_schema_name

from .models import PlatformAuditLog, PlatformUser

logger = logging.getLogger(__name__)

# Field names whose values must never reach the audit table. An audit log is
# read by more people than the record it describes, so a secret written here is
# a secret spread wider, not narrower.
_REDACTED_FIELDS = frozenset({
    'password', 'admin_password', 'temp_password', 'token', 'token_hash',
    'secret', 'mfa_secret', 'access', 'refresh', 'stripe_customer_id',
    'stripe_subscription_id',
})

_REDACTED = '[redacted]'


def _clean(changes):
    """Drop secrets and make the payload JSON-safe."""
    if not changes:
        return {}
    cleaned = {}
    for key, value in changes.items():
        if key.lower() in _REDACTED_FIELDS:
            cleaned[key] = _REDACTED
            continue
        if isinstance(value, (list, tuple)):
            cleaned[key] = [_stringify(item) for item in value]
        else:
            cleaned[key] = _stringify(value)
    return cleaned


def _stringify(value):
    """JSONField accepts these as-is; everything else becomes its repr."""
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    return str(value)


def _client_ip(request):
    if request is None:
        return None
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR', '')
    if forwarded:
        # Left-most entry is the original client; the rest are proxies.
        return forwarded.split(',')[0].strip() or None
    return request.META.get('REMOTE_ADDR') or None


def record(action, *, actor=None, request=None, target=None, target_type='',
           target_label='', client=None, changes=None):
    """
    Write one audit entry. Never raises.

    An audit failure must not take down the action it was describing — a
    suspension that half-happened because the logging table was unreachable is
    worse than a suspension nobody logged. Failures go to the application log.
    """
    try:
        if actor is None and request is not None:
            candidate = getattr(request, 'user', None)
            actor = candidate if isinstance(candidate, PlatformUser) else None

        target_id = ''
        if target is not None:
            target_id = str(getattr(target, 'pk', '') or '')
            if not target_label:
                target_label = str(target)[:150]
            if not target_type:
                target_type = target.__class__.__name__

        # The operator API is served from the public schema, but a school-side
        # request (an invitation being accepted) is not. Write to public either
        # way, or the entry lands in a tenant schema where nobody looks for it.
        with schema_context(get_public_schema_name()):
            return PlatformAuditLog.objects.create(
                actor=actor,
                actor_email=getattr(actor, 'email', '') or '',
                actor_role=getattr(actor, 'role', '') or '',
                action=action,
                target_type=target_type,
                target_id=target_id,
                target_label=target_label or '',
                client=client,
                changes=_clean(changes),
                ip_address=_client_ip(request),
            )
    except Exception:                                    # pragma: no cover
        logger.exception('Failed to write platform audit entry for %s', action)
        return None


def diff(before, after, fields):
    """
    Build a {'field': [before, after]} map for the fields that actually moved.

    Unchanged fields are left out on purpose: an audit entry listing thirty
    identical values buries the one that changed.
    """
    changes = {}
    for field in fields:
        old = before.get(field)
        new = after.get(field)
        if old != new:
            changes[field] = [old, new]
    return changes


class AuditedViewSetMixin:
    """
    Give a ModelViewSet an audit trail for create/update/delete.

    Set `audit_prefix` (e.g. 'contract') on the viewset; entries are recorded as
    '<prefix>.create' / '.update' / '.delete'. Custom actions call `audit()`
    themselves with their own verb.
    """
    audit_prefix = 'object'

    def audit(self, verb, target=None, changes=None, client=None, label=''):
        return record(
            f'{self.audit_prefix}.{verb}',
            actor=self.request.user if self.request else None,
            request=self.request,
            target=target,
            target_label=label,
            client=client or getattr(target, 'client', None),
            changes=changes,
        )

    def perform_create(self, serializer):
        instance = serializer.save()
        self.audit('create', instance, changes=_clean(serializer.validated_data))
        return instance

    def perform_update(self, serializer):
        before = _snapshot(serializer.instance, serializer.validated_data.keys())
        instance = serializer.save()
        after = _snapshot(instance, serializer.validated_data.keys())
        self.audit('update', instance, changes=diff(before, after, before.keys()))
        return instance

    def perform_destroy(self, instance):
        # Capture the label BEFORE deleting; afterwards there is nothing to read.
        label = str(instance)[:150]
        client = getattr(instance, 'client', None)
        target_type = instance.__class__.__name__
        target_id = str(instance.pk)
        instance.delete()
        record(f'{self.audit_prefix}.delete',
               actor=self.request.user, request=self.request,
               target_type=target_type, target_label=label, client=client,
               changes={'id': target_id})


def _snapshot(instance, fields):
    return {field: _stringify(getattr(instance, field, None)) for field in fields}


__all__ = ['record', 'diff', 'AuditedViewSetMixin']
