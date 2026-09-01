"""
Invitation tokens and the bulk/CSV invite paths.

These exist because 878 passing tests did not notice that
POST /imboni/auth/invite/bulk/ returned 500 on its first row: nothing had ever
called it. The first test here is that call.
"""
import hashlib

import pytest
from rest_framework.test import APIClient

from apps.authentication import invites
from apps.authentication.models import Invitation


@pytest.fixture
def admin_client(admin_user):
    client = APIClient()
    client.force_authenticate(admin_user)
    return client


# ── the endpoint that was broken ──────────────────────────────────────────────

@pytest.mark.django_db
def test_bulk_invite_creates_every_invitation(admin_client):
    resp = admin_client.post('/imboni/auth/invite/bulk/', {
        'invitations': [
            {'first_name': 'Aline', 'last_name': 'Uwase',
             'role': 'teacher', 'email': 'aline@example.test'},
            {'first_name': 'Eric', 'last_name': 'Niyonzima',
             'role': 'teacher', 'email': 'eric@example.test'},
            {'first_name': 'Chantal', 'last_name': 'Mukamana',
             'role': 'teacher', 'email': 'chantal@example.test'},
        ],
    }, format='json')

    assert resp.status_code == 201, resp.data
    assert len(resp.data['sent']) == 3, resp.data
    assert resp.data['failed'] == []
    assert Invitation.objects.filter(role='teacher').count() == 3


@pytest.mark.django_db
def test_invitations_sent_together_get_distinct_tokens(admin_client):
    """
    The old scheme derived the token from the INVITER plus a second-granularity
    timestamp, so a batch sent in one request produced one token repeated.
    """
    admin_client.post('/imboni/auth/invite/bulk/', {
        'invitations': [
            {'first_name': 'A', 'last_name': 'One', 'role': 'teacher',
             'email': 'a@example.test'},
            {'first_name': 'B', 'last_name': 'Two', 'role': 'teacher',
             'email': 'b@example.test'},
        ],
    }, format='json')

    hashes = list(Invitation.objects.values_list('token_hash', flat=True))
    assert len(hashes) == 2
    assert len(set(hashes)) == 2, 'two invitations share a token'
    assert all(h for h in hashes), 'an invitation has an empty token hash'


# ── the token itself ──────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_raw_token_is_never_stored(admin_client):
    resp = admin_client.post('/imboni/auth/invite/', {
        'first_name': 'Solange', 'last_name': 'Ingabire',
        'role': 'teacher', 'email': 'solange@example.test',
    }, format='json')
    assert resp.status_code == 201, resp.data

    inv = Invitation.objects.get(email='solange@example.test')
    assert not hasattr(inv, 'token'), 'the plaintext token column is back'
    assert len(inv.token_hash) == 64          # sha256 hex
    # The stored value is a hash, so it cannot itself be used as a link.
    assert invites.find_by_token(Invitation, inv.token_hash) is None


def test_hash_token_is_plain_sha256():
    assert invites.hash_token('abc') == hashlib.sha256(b'abc').hexdigest()


@pytest.mark.django_db
def test_find_by_token_matches_only_the_right_invitation(admin_user):
    raw = invites.new_token()
    inv = Invitation.objects.create(
        first_name='X', last_name='Y', role='teacher', email='x@example.test',
        invited_by=admin_user, expires_at=invites.default_expiry(),
        token_hash=invites.hash_token(raw), uid='',
    )
    assert invites.find_by_token(Invitation, raw).pk == inv.pk
    assert invites.find_by_token(Invitation, invites.new_token()) is None
    assert invites.find_by_token(Invitation, '') is None
    assert invites.find_by_token(Invitation, None) is None


# ── verification rejects a token that is not this invitation's ────────────────

@pytest.mark.django_db
def test_another_invitations_token_does_not_verify(admin_user):
    from django.utils.http import urlsafe_base64_encode
    from django.utils.encoding import force_bytes

    raws = {}
    for name, role in (('target', 'admin'), ('attacker', 'student')):
        raw = invites.new_token()
        inv = Invitation.objects.create(
            first_name=name, last_name='T', role=role,
            email=f'{name}@example.test', invited_by=admin_user,
            expires_at=invites.default_expiry(),
            token_hash=invites.hash_token(raw), uid='',
        )
        inv.uid = urlsafe_base64_encode(force_bytes(inv.pk))
        inv.save(update_fields=['uid'])
        raws[name] = (inv, raw)

    target, _ = raws['target']
    _, attacker_raw = raws['attacker']

    client = APIClient()
    # The attacker's own token against the admin invitation's uid.
    resp = client.get(f'/imboni/auth/register/verify/{target.uid}/{attacker_raw}/')
    assert resp.status_code == 400, resp.data
