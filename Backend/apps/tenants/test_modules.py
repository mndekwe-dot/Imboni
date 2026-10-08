"""
Switching parts of the product off for one school.

The test school (``test``, premium) is the one every request here is routed to,
so a module is switched off by updating its row in the public registry, which is
where the middleware reads it from.
"""
import pytest
from django.db import connection
from django_tenants.utils import get_public_schema_name, schema_context
from rest_framework import status
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.authentication.factories import UserFactory
from apps.tenants import modules
from apps.tenants.models import Client, PlatformUser
from apps.tenants.views import SchoolViewSet

pytestmark = pytest.mark.django_db


def _switch_off(*names):
    with schema_context(get_public_schema_name()):
        Client.objects.filter(schema_name='test').update(disabled_modules=list(names))


@pytest.fixture(autouse=True)
def _all_on():
    yield
    _switch_off()


def _operator(role=PlatformUser.ROLE_OPERATIONS):
    with schema_context(get_public_schema_name()):
        pu = PlatformUser.objects.filter(email=f'{role}@imboni.com').first()
        if pu is None:
            pu = PlatformUser(email=f'{role}@imboni.com', name='Op', role=role, mfa_enabled=True,
                              mfa_secret='JBSWY3DPEHPK3PXP')
            pu.set_password('PlatformPass123!')
            pu.save()
    return pu


def _post_modules(school, user, body):
    view = SchoolViewSet.as_view({'post': 'modules'})
    request = APIRequestFactory().post(f'/imboni/platform/schools/{school.pk}/modules/', body, format='json')
    force_authenticate(request, user=user)
    with schema_context(get_public_schema_name()):
        return view(request, pk=school.pk)


@pytest.fixture
def school():
    with schema_context(get_public_schema_name()):
        c = Client(name='Day School', schema_name='dayschool', status='active')
        c.auto_create_schema = False
        c.save()
    return c


class TestOperatorSwitch:
    def test_an_operator_switches_modules_off_and_the_list_is_saved(self, school):
        response = _post_modules(school, _operator(), {'disabled': ['matron', 'boarding']})

        assert response.status_code == status.HTTP_200_OK
        assert response.data['disabled_modules'] == ['matron', 'boarding']
        with schema_context(get_public_schema_name()):
            school.refresh_from_db()
        assert school.disabled_modules == ['matron', 'boarding']

    def test_the_list_is_the_whole_truth_so_an_empty_one_switches_everything_back_on(self, school):
        _post_modules(school, _operator(), {'disabled': ['library']})
        response = _post_modules(school, _operator(), {'disabled': []})
        assert response.data['disabled_modules'] == []

    def test_an_unknown_module_is_refused(self, school):
        response = _post_modules(school, _operator(), {'disabled': ['payroll']})
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_only_the_operations_desk_may_do_it(self, school):
        response = _post_modules(school, _operator(PlatformUser.ROLE_SUPPORT), {'disabled': ['matron']})
        assert response.status_code == status.HTTP_403_FORBIDDEN


class TestWhatASchoolSees:
    def test_a_switched_off_module_refuses_its_endpoints(self, make_authenticated_client):
        client, _ = make_authenticated_client('matron')
        _switch_off('matron')

        response = client.get('/imboni/matron/dashboard/')

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert response.json()['code'] == 'module_disabled'

    def test_boarding_covers_housing_exeat_and_dining(self, make_authenticated_client):
        client, _ = make_authenticated_client('discipline')
        _switch_off('boarding')
        for path in ('housing/beds/', 'exeat/', 'dining/'):
            assert client.get(f'/imboni/discipline/{path}').status_code == status.HTTP_403_FORBIDDEN

    def test_other_modules_keep_working(self, make_authenticated_client):
        client, _ = make_authenticated_client('discipline')
        _switch_off('matron')
        assert client.get('/imboni/discipline/exeat/').status_code == status.HTTP_200_OK

    def test_the_library_answers_that_it_is_switched_off_not_that_the_plan_lacks_it(self, make_authenticated_client):
        client, _ = make_authenticated_client('librarian')
        _switch_off('library')

        assert client.get('/imboni/library/availability/').status_code == status.HTTP_403_FORBIDDEN
        assert modules.snapshot()['library'] is False

    def test_the_school_can_ask_what_is_on(self, make_authenticated_client):
        client, _ = make_authenticated_client('teacher')
        _switch_off('matron')

        assert client.get('/imboni/school/modules/').json() == {
            'library': True, 'matron': False, 'boarding': True}
