"""
TOTP two-factor helpers: secret/QR generation, code verification, single-use
backup codes, and the short-lived signed login challenge.

Kept separate from views so the crypto/logic is unit-testable on its own.
"""
import base64
import secrets

import pyotp
import qrcode
import qrcode.image.svg
from django.conf import settings
from django.contrib.auth.hashers import make_password, check_password
from django.core import signing
from django.utils import timezone

from .models import TwoFactorConfig

ISSUER = 'Imboni'
CHALLENGE_SALT = 'imboni.2fa.login'
CHALLENGE_MAX_AGE = 5 * 60          # a login 2FA step must complete within 5 minutes
BACKUP_CODE_COUNT = 10


def get_or_create_pending(user):
    """
    Return the user's 2FA config, minting a fresh secret when there isn't an
    already-enabled one. Re-running setup before confirming rotates the secret.
    """
    config, _ = TwoFactorConfig.objects.get_or_create(
        user=user, defaults={'secret': pyotp.random_base32()},
    )
    if not config.is_enabled and not config.secret:
        config.secret = pyotp.random_base32()
        config.save(update_fields=['secret'])
    return config


def rotate_secret(config):
    """Assign a fresh TOTP secret (used on each fresh, unconfirmed setup attempt)."""
    config.secret = pyotp.random_base32()
    config.save(update_fields=['secret'])
    return config


def provisioning_uri(config, user):
    """The otpauth:// URI an authenticator app scans."""
    label = user.email or user.username
    return pyotp.TOTP(config.secret).provisioning_uri(name=label, issuer_name=ISSUER)


def qr_data_uri(uri):
    """Render the provisioning URI as an inline SVG data: URI (no pillow needed)."""
    img = qrcode.make(uri, image_factory=qrcode.image.svg.SvgPathImage)
    from io import BytesIO
    buf = BytesIO()
    img.save(buf)
    b64 = base64.b64encode(buf.getvalue()).decode()
    return f'data:image/svg+xml;base64,{b64}'


def verify_totp(config, token):
    """True if `token` is a currently-valid 6-digit code (±1 time step of drift)."""
    if not token:
        return False
    return pyotp.TOTP(config.secret).verify(str(token).strip(), valid_window=1)


def generate_backup_codes(config):
    """
    Create a fresh set of one-time backup codes, store them hashed, and return
    the plaintext list to show the user ONCE. Replaces any previous set.
    """
    codes = [f'{secrets.randbelow(10**8):08d}' for _ in range(BACKUP_CODE_COUNT)]
    config.backup_codes = [make_password(c) for c in codes]
    config.save(update_fields=['backup_codes'])
    return codes


def verify_backup_code(config, code):
    """
    Check `code` against the stored hashes; if it matches, consume it (remove
    that hash so it can't be reused) and return True.
    """
    code = (code or '').strip()
    if not code:
        return False
    for hashed in config.backup_codes:
        if check_password(code, hashed):
            config.backup_codes = [h for h in config.backup_codes if h != hashed]
            config.save(update_fields=['backup_codes'])
            return True
    return False


def enable(config):
    """Mark 2FA as confirmed/active."""
    config.is_enabled = True
    config.confirmed_at = timezone.now()
    config.save(update_fields=['is_enabled', 'confirmed_at'])


# ── Login challenge (stateless, signed) ─────────────────────────────────────────

def make_challenge(user, portal):
    """A short-lived signed token that stands in for 'password already verified'."""
    return signing.dumps({'uid': str(user.id), 'portal': portal or ''}, salt=CHALLENGE_SALT)


def read_challenge(value):
    """
    Decode a challenge token, returning its payload or None if it's invalid or
    older than CHALLENGE_MAX_AGE.
    """
    try:
        return signing.loads(value, salt=CHALLENGE_SALT, max_age=CHALLENGE_MAX_AGE)
    except signing.BadSignature:
        return None
