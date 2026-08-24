"""
Every API view must say who may call it.

DRF falls back to DEFAULT_PERMISSION_CLASSES when a view declares nothing, and
here that default is `IsAuthenticated` — "any signed-in user". That is a
reasonable floor and a terrible default for a school system, where the roles
sharing a login screen include students and parents.

Three views were reached this way: one could reschedule or delete an exam, one
could edit or delete a school announcement, and one could create a
password-bearing parent account linked to any child. None of them decided to be
open to everyone. They simply never said anything, and the framework decided
for them.

So this walks the real URL conf and requires an explicit declaration. Silence
is the bug, and a view that genuinely is public passes by saying `AllowAny`
out loud.
"""

import pytest
from django.urls import get_resolver

pytestmark = pytest.mark.django_db


def _view_classes():
    """Every DRF view class reachable from the root URL conf, with its route."""
    found = {}

    def walk(patterns, prefix=''):
        for pattern in patterns:
            route = prefix + str(pattern.pattern)
            if hasattr(pattern, 'url_patterns'):
                walk(pattern.url_patterns, route)
                continue
            callback = pattern.callback
            # DRF sets .cls on as_view(); plain Django CBVs set .view_class.
            cls = getattr(callback, 'cls', None) or getattr(callback, 'view_class', None)
            # Only our own views; DRF's router root is not ours to declare on.
            if (cls is not None and hasattr(cls, 'permission_classes')
                    and getattr(cls, '__module__', '').startswith('apps.')):
                found.setdefault(cls, route)

    walk(get_resolver().url_patterns)
    return found


# Both are real ways to answer "who may call this": the attribute for a fixed
# rule, the override when it depends on the method (read open, write staff-only).
DECLARATIONS = ('permission_classes', 'get_permissions')


def _declares_permissions(cls):
    """
    True when the view — or a base class of ours — decides its own permissions.

    Walking the MRO rather than just __dict__ so a shared base can carry the
    decision for its subclasses; restricted to `apps.` so inheriting DRF's own
    APIView default does not count as having decided anything.
    """
    return any(
        name in base.__dict__
        for base in cls.__mro__
        if getattr(base, '__module__', '').startswith('apps.')
        for name in DECLARATIONS
    )


def test_every_view_declares_its_permissions():
    undeclared = sorted(
        f'{cls.__module__}.{cls.__name__}  ({route})'
        for cls, route in _view_classes().items()
        if not _declares_permissions(cls)
    )
    assert not undeclared, (
        'These views fall through to DEFAULT_PERMISSION_CLASSES '
        '(IsAuthenticated — any signed-in user, students included).\n'
        'Declare permission_classes explicitly; use AllowAny if it really is '
        'public:\n  ' + '\n  '.join(undeclared)
    )


def test_the_walker_actually_finds_views():
    """A guard that silently matches nothing would pass forever."""
    assert len(_view_classes()) > 100
