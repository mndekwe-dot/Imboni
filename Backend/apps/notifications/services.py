"""
Small helpers for creating in-app notifications from anywhere in the codebase.

Usage:
    from apps.notifications.services import notify_user, notify_users, notify_parents_of

    notify_user(user, 'Absence recorded', 'John was marked absent today.', 'attendance', '/parent/attendance')
    notify_parents_of(student, 'Incident reported', '...', 'attendance')
"""
from .models import Notification


def notify_user(user, title, message, type='announcement', path=''):
    """Create a single notification. Returns the Notification, or None on failure."""
    if user is None:
        return None
    try:
        return Notification.objects.create(
            user=user, title=title, message=message, type=type, path=path,
        )
    except Exception:
        return None


def notify_users(users, title, message, type='announcement', path=''):
    """Create the same notification for several users. Returns count created."""
    created = 0
    for u in users:
        if notify_user(u, title, message, type, path):
            created += 1
    return created


def notify_parents_of(student, title, message, type='announcement', path=''):
    """
    Notify every parent/guardian linked to a student.
    Returns count of notifications created.
    """
    from apps.parents.models import ParentStudentRelationship
    parent_users = [
        rel.parent for rel in
        ParentStudentRelationship.objects.filter(student=student).select_related('parent')
    ]
    return notify_users(parent_users, title, message, type, path)


def notify_role(role, title, message, type='announcement', path=''):
    """Notify every active user with a given role (e.g. 'admin', 'discipline')."""
    from apps.authentication.models import User
    users = User.objects.filter(role=role, is_active=True)
    return notify_users(users, title, message, type, path)
