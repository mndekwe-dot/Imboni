"""
Parts of the product an operator can switch off for one school.

A day school has no use for boarding or the infirmary, and a small one may never
open the library. Paying for the plan is one question (``plans.py``); whether
THIS school wants the screens is another, and it is the operator's call, made
from the platform console. Switching a module off hides it and refuses its
endpoints; it never deletes anything, so switching it back on restores the lot.

The library is both plan-gated and switchable: it is available only when the
plan includes it AND it has not been switched off.
"""
from django.db import connection

# module -> the API prefixes that belong to it.
MODULES = {
    'library': ('/imboni/library/',),
    'matron': ('/imboni/matron/',),
    'boarding': (
        '/imboni/discipline/housing/',
        '/imboni/discipline/exeat/',
        '/imboni/discipline/dining/',
    ),
}

TOGGLEABLE = tuple(MODULES)


def disabled_modules(tenant=None):
    """The modules switched off for ``tenant`` (default: the active one)."""
    tenant = tenant if tenant is not None else getattr(connection, 'tenant', None)
    off = getattr(tenant, 'disabled_modules', None) or []
    return [m for m in off if m in MODULES]


def module_enabled(module):
    """False only when the operator has switched ``module`` off for the active school."""
    return module not in disabled_modules()


def module_for_path(path):
    """The switchable module a request path belongs to, or None."""
    for module, prefixes in MODULES.items():
        if path.startswith(prefixes):
            return module
    return None


def snapshot():
    """{module: bool} for the active school, for the UI to hide what is off."""
    from .limits import tenant_has_feature
    off = set(disabled_modules())
    return {
        m: (tenant_has_feature(m) if m == 'library' else m not in off)
        for m in TOGGLEABLE
    }
