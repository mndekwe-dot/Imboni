"""
Celery tasks for the parents app. The weekly digest runs every Friday via
Celery beat (see Imboni/celery.py); the consent fan-out is dispatched from
the create-consent-request view so big parent lists don't block the request.
"""
from io import StringIO

from celery import shared_task


@shared_task
def send_weekly_digest_task(no_email=False):
    """Send each parent their children's weekly summary."""
    from django.core.management import call_command

    out = StringIO()
    args = ['--no-email'] if no_email else []
    call_command('send_weekly_digest', *args, stdout=out)
    return out.getvalue().strip()


@shared_task
def notify_consent_parents_task(request_id):
    """
    Notify every parent targeted by a consent request (one notification per
    parent, however many of their children are in the targeted grade).
    """
    from apps.notifications.services import notify_user
    from .models import ConsentRequest, ParentStudentRelationship

    req = ConsentRequest.objects.filter(pk=request_id, is_active=True).first()
    if not req:
        return 0

    rels = ParentStudentRelationship.objects.select_related('parent', 'student')
    if req.grade:
        rels = rels.filter(student__grade=req.grade)

    notified = set()
    for rel in rels:
        if rel.parent_id in notified:
            continue
        notify_user(
            rel.parent,
            title=f'Consent required: {req.title}',
            message=(
                f"Your approval is requested for '{req.title}' on {req.event_date}. "
                f"Please respond in the parent portal."
            ),
            type='announcement',
            path='/parent/children',
        )
        notified.add(rel.parent_id)
    return len(notified)
