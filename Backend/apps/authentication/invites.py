"""
Invitation tokens.

These used to come from `default_token_generator.make_token(request.user)` —
Django's *password reset* generator, keyed on the INVITER. Three things were
wrong with that:

  * It is deterministic in (inviter, second), so two invitations sent by the
    same administrator in the same second were byte-identical. The `unique`
    constraint on the column turned that into an IntegrityError rather than a
    security hole, which meant bulk and CSV import failed on the second row.
  * It is derived from the inviter's password hash and last_login, so the
    inviter changing their password silently invalidated every invitation they
    had ever sent.
  * The result was stored in cleartext, so anyone who could read the table —
    a backup, a support query — held working registration links.

A token is now 43 characters of `get_random_string` (~256 bits) and only its
SHA-256 is stored. Plain SHA-256 rather than a password hasher on purpose: the
token is machine-generated randomness, not something a person chose, so there
is no dictionary to slow down — and a salted hash could not be looked up.

This mirrors `apps/tenants/invitations.py`, which already did it correctly for
school-level invitations.
"""
import hashlib

from django.conf import settings
from django.utils import timezone
from django.utils.crypto import constant_time_compare, get_random_string
from datetime import timedelta

TOKEN_LENGTH = 43


def hash_token(raw_token):
    """SHA-256 hex digest used for both storage and lookup."""
    return hashlib.sha256(raw_token.encode('utf-8')).hexdigest()


def new_token():
    """A fresh raw token. Returned once; only its hash is ever persisted."""
    return get_random_string(TOKEN_LENGTH)


def default_expiry():
    return timezone.now() + timedelta(days=settings.INVITATION_EXPIRY_DAYS)


def find_by_token(model, raw_token):
    """
    The Invitation matching `raw_token`, or None.

    Looks up by hash, then re-compares in constant time so the lookup cannot be
    turned into a timing oracle by an attacker who can submit many guesses.
    """
    if not raw_token:
        return None
    digest = hash_token(raw_token)
    invitation = model.objects.filter(token_hash=digest).first()
    if invitation is None:
        return None
    if not constant_time_compare(invitation.token_hash, digest):
        return None
    return invitation
