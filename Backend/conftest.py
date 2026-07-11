"""
Shared pytest fixtures, available to every test in the project without importing.
"""
import pytest
from django.db import connection
from django_tenants.utils import (
    get_tenant_model, get_tenant_domain_model, get_public_schema_name,
)
from rest_framework.test import APIClient
from apps.authentication.factories import UserFactory


# ── Multi-tenancy test harness ──────────────────────────────────────────────────
# Under django-tenants, pytest-django's default DB setup migrates only the shared
# (public) schema, so tests that touch per-school tables fail with "relation ...
# does not exist". We create a dedicated 'test' tenant whose domain is 'testserver'
# — the host the DRF/Django test client uses by default — so TenantMainMiddleware
# routes every test request into the test schema. We also pin the connection to
# that schema so ORM calls in factories/fixtures/test bodies land there too.
TEST_SCHEMA = 'test'
TEST_DOMAIN = 'testserver'


@pytest.fixture(scope='session')
def django_db_setup(django_db_setup, django_db_blocker):
    with django_db_blocker.unblock():
        TenantModel = get_tenant_model()
        DomainModel = get_tenant_domain_model()

        # A public tenant record so the public schema is routable if ever hit.
        public_schema = get_public_schema_name()
        if not TenantModel.objects.filter(schema_name=public_schema).exists():
            pub = TenantModel(schema_name=public_schema, name='Public',
                              on_trial=False, status='active')
            pub.save(verbosity=0)
            DomainModel.objects.get_or_create(
                domain='public', defaults={'tenant': pub, 'is_primary': True})

        # The tenant every test runs inside. Saving it (auto_create_schema) creates
        # the schema and migrates all TENANT_APPS into it — once, thanks to --reuse-db.
        tenant = TenantModel.objects.filter(schema_name=TEST_SCHEMA).first()
        if tenant is None:
            tenant = TenantModel(schema_name=TEST_SCHEMA, name='Test School',
                                 on_trial=True, status='active')
            tenant.save(verbosity=0)
            DomainModel.objects.create(domain=TEST_DOMAIN, tenant=tenant, is_primary=True)

        connection.set_tenant(tenant)
    yield


@pytest.fixture(autouse=True)
def _pin_test_tenant(request):
    """Keep the connection on the test tenant schema for every DB-using test."""
    if request.node.get_closest_marker('django_db') is None:
        yield
        return
    request.getfixturevalue('django_db_setup')
    connection.set_tenant(get_tenant_model().objects.get(schema_name=TEST_SCHEMA))
    yield


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def make_authenticated_client(api_client):
    """
    Usage:
        client, user = make_authenticated_client('dos')
    Returns an APIClient already authenticated as a freshly-created user of the given role.
    """
    def _make(role='dos', **kwargs):
        user = UserFactory(role=role, **kwargs)
        api_client.force_authenticate(user)
        return api_client, user
    return _make


@pytest.fixture
def dos_user():
    return UserFactory(role='dos')


@pytest.fixture
def teacher_user():
    return UserFactory(role='teacher')


@pytest.fixture
def admin_user():
    return UserFactory(role='admin')


@pytest.fixture
def matron_user():
    return UserFactory(role='matron')


@pytest.fixture
def discipline_user():
    return UserFactory(role='discipline')


@pytest.fixture
def parent_user():
    return UserFactory(role='parent')
