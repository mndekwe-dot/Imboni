"""
Fixtures for the notification WebSocket tests.

These tests need something the rest of the suite does not: a SECOND live tenant
schema, so that "school A must never receive school B's notifications" can be
proven against real, separate Postgres schemas rather than a mock.

The tenant + its users are built once per session (committed, outside any test
transaction) so the expensive `migrate_schemas` for the extra schema happens at
most once — and not at all on a `--reuse-db` run.
"""
import pytest
from django.db import connection
from django_tenants.utils import (
    get_public_schema_name,
    get_tenant_domain_model,
    get_tenant_model,
    schema_context,
)

# Both schools get their OWN schema. School A deliberately does NOT reuse the
# suite-wide 'test' tenant: this fixture is session-scoped and writes through
# django_db_blocker.unblock(), so anything it creates escapes per-test rollback
# and lives for the whole run. A stray user in the shared schema silently
# inflates every other app's counts — it broke the plan-limit tests in
# apps/tenants, which assert exact staff/student totals. Keeping both schools
# self-contained means this file can never perturb another app's fixtures.
SCHEMA_A = 'wsschoola'
HOST_A = 'wsschoola.testserver'

SCHEMA_B = 'wsschoolb'
HOST_B = 'wsschoolb.testserver'

# The schema the rest of the suite runs in; restored before the fixture returns.
ROOT_TEST_SCHEMA = 'test'

# Deliberately used as the primary key of a user in BOTH schemas — see ws_tenants.
SHARED_USER_ID = '5f9c2a10-0000-4000-8000-00000000beef'


def _ensure_user(schema_name, username, email, pk=None):
    from apps.authentication.models import User
    with schema_context(schema_name):
        defaults = {'email': email, 'role': 'teacher', 'is_active': True}
        if pk is None:
            user, _ = User.objects.get_or_create(username=username, defaults=defaults)
        else:
            defaults['username'] = username
            user, _ = User.objects.get_or_create(pk=pk, defaults=defaults)
        if not user.is_active:
            User.objects.filter(pk=user.pk).update(is_active=True)
        return str(user.pk)


def _access_token(schema_name, user_id):
    """Mint an access token for a user, resolved inside that user's own schema."""
    from rest_framework_simplejwt.tokens import AccessToken

    from apps.authentication.models import User
    with schema_context(schema_name):
        user = User.objects.get(pk=user_id)
        return str(AccessToken.for_user(user))


@pytest.fixture(scope='session')
def ws_tenants(django_db_setup, django_db_blocker):
    """
    Returns a dict describing two independent schools:

        {'a': {'schema', 'host', 'user_id', 'token'}, 'b': {...}}
    """
    with django_db_blocker.unblock():
        TenantModel = get_tenant_model()
        DomainModel = get_tenant_domain_model()

        # django-tenants refuses to create a tenant from inside a tenant schema,
        # and the root conftest leaves the connection pinned to 'test'.
        with schema_context(get_public_schema_name()):
            for schema, host, label in (
                (SCHEMA_A, HOST_A, 'WS School A'),
                (SCHEMA_B, HOST_B, 'WS School B'),
            ):
                tenant = TenantModel.objects.filter(schema_name=schema).first()
                if tenant is None:
                    tenant = TenantModel(schema_name=schema, name=label,
                                         on_trial=True, status='active', plan='premium')
                    # auto_create_schema=True -> creates the schema, migrates TENANT_APPS
                    tenant.save(verbosity=0)
                DomainModel.objects.get_or_create(
                    domain=host, defaults={'tenant': tenant, 'is_primary': True})

        user_a = _ensure_user(SCHEMA_A, 'ws_user_a', 'ws_a@example.com', pk=SHARED_USER_ID)

        # THE ADVERSARIAL CASE. User ids are only unique *within* a schema, so a
        # second school is free to hold a user with the very same primary key.
        # If channel groups were keyed on the user id alone, these two accounts —
        # different people, different schools — would share one group and each
        # would receive the other's notifications. Building the fixture this way
        # is what gives the isolation test real teeth.
        shadow_b = _ensure_user(SCHEMA_B, 'ws_shadow_b', 'ws_shadow@example.com',
                                pk=SHARED_USER_ID)
        assert shadow_b == user_a, 'fixture must give both schools the same user id'

        # A user that exists ONLY in school B, for the cross-school token test.
        user_b_only = _ensure_user(SCHEMA_B, 'ws_user_b', 'ws_b@example.com')

        data = {
            'a': {'schema': SCHEMA_A, 'host': HOST_A, 'user_id': user_a,
                  'token': _access_token(SCHEMA_A, user_a)},
            'b': {'schema': SCHEMA_B, 'host': HOST_B, 'user_id': shadow_b,
                  'token': _access_token(SCHEMA_B, shadow_b)},
            'b_only': {'schema': SCHEMA_B, 'host': HOST_B, 'user_id': user_b_only,
                       'token': _access_token(SCHEMA_B, user_b_only)},
        }

        # Leave the connection where the rest of the suite expects it — the root
        # 'test' tenant, NOT one of this file's schools.
        connection.set_tenant(TenantModel.objects.get(schema_name=ROOT_TEST_SCHEMA))

    return data
