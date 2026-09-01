"""A platform operator's TOTP code is good once, not for the whole window."""
import time

import pyotp
import pytest

from apps.tenants.models import PlatformUser
from apps.tenants.platform_auth import verify_mfa_code


@pytest.fixture
def operator(db):
    return PlatformUser.objects.create(
        email='ops@imboni.test', name='Ops', role=PlatformUser.ROLE_OPERATIONS,
        mfa_secret=pyotp.random_base32(), mfa_enabled=True,
    )


@pytest.mark.django_db
def test_a_valid_code_is_accepted_once(operator):
    code = pyotp.TOTP(operator.mfa_secret).now()
    assert verify_mfa_code(operator, code) is True


@pytest.mark.django_db
def test_the_same_code_cannot_be_replayed(operator):
    """
    valid_window=1 keeps a code usable across three 30s steps, which is what
    made a shoulder-surfed or proxy-logged code good for ~90 seconds.
    """
    code = pyotp.TOTP(operator.mfa_secret).now()
    assert verify_mfa_code(operator, code) is True
    assert verify_mfa_code(operator, code) is False

    operator.refresh_from_db()
    assert operator.mfa_last_step is not None


@pytest.mark.django_db
def test_an_earlier_step_is_refused_after_a_later_one(operator):
    totp = pyotp.TOTP(operator.mfa_secret)
    now = int(time.time())
    previous = totp.at(now - totp.interval)
    current = totp.now()

    assert verify_mfa_code(operator, current) is True
    # The previous step is still inside valid_window, but it is behind the
    # watermark, so it must not be reusable.
    assert verify_mfa_code(operator, previous) is False


@pytest.mark.django_db
def test_garbage_is_refused(operator):
    assert verify_mfa_code(operator, '000000') is False
    assert verify_mfa_code(operator, '') is False
    assert verify_mfa_code(operator, None) is False


@pytest.mark.django_db
def test_an_operator_without_a_secret_cannot_pass(db):
    user = PlatformUser.objects.create(email='nosecret@imboni.test',
                                       role=PlatformUser.ROLE_SUPPORT)
    assert verify_mfa_code(user, '123456') is False
