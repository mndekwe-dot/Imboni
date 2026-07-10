"""
Write helper for the audit trail.

Usage:
    from apps.audit.services import audit
    audit(request.user, 'invitation.sent', target=email, detail={'role': role})

Auditing must never break the action being audited, so failures are swallowed.
"""
from .models import AuditEntry


def audit(actor, action, target='', detail=None):
    try:
        return AuditEntry.objects.create(
            actor=actor if getattr(actor, 'pk', None) else None,
            actor_name=(actor.get_full_name() or actor.username) if actor else '',
            actor_role=getattr(actor, 'role', '') if actor else '',
            action=action,
            target=str(target)[:255],
            detail=detail or {},
        )
    except Exception:
        return None
