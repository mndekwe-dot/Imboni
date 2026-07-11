"""
Tests for the platform super-admin API (Phase 5): apps.tenants.

Covers the ClientSerializer contract and the SchoolViewSet suspend/reactivate
state transitions plus its IsAdminUser gate.

We drive the viewset with DRF's APIRequestFactory rather than a URL path so the
tests are self-contained: they do NOT require these routes to be wired into the
project's Imboni/urls.py (that wiring is documented in apps/tenants/urls.py).

Client rows are created with auto_create_schema disabled so the tests never try
to CREATE a real Postgres schema / run tenant migrations — we only exercise the
public-schema registry row.
"""
import pytest
from rest_framework import status
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.authentication.factories import UserFactory
from apps.tenants.models import Client
from apps.tenants.serializers import ClientSerializer
from apps.tenants.views import SchoolViewSet


def make_school(name='Springfield High', schema_name='springfield', **kwargs):
    """Create a Client row WITHOUT provisioning a real Postgres schema."""
    school = Client(
        name=name,
        schema_name=schema_name,
        status=kwargs.pop('status', 'active'),
        **kwargs,
    )
    # Prevent django-tenants from creating the schema + running migrations.
    school.auto_create_schema = False
    school.save()
    return school


def platform_admin():
    """A platform operator: staff user, so DRF's IsAdminUser lets them in."""
    return UserFactory(role='admin', is_staff=True)


# ---------------------------------------------------------------------------
# Serializer contract
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestClientSerializer:
    def test_exposes_expected_fields(self):
        school = make_school(plan='premium', status='active', on_trial=False)
        data = ClientSerializer(school).data

        assert set(data.keys()) == {
            'id', 'name', 'schema_name', 'plan', 'status',
            'paid_until', 'on_trial', 'created_on',
        }
        assert data['name'] == 'Springfield High'
        assert data['schema_name'] == 'springfield'
        assert data['plan'] == 'premium'

    def test_schema_name_is_read_only_after_creation(self):
        school = make_school(schema_name='springfield')
        serializer = ClientSerializer(
            school,
            data={'name': 'Renamed', 'schema_name': 'hacked'},
            partial=True,
        )
        assert serializer.is_valid(), serializer.errors
        # schema_name must be ignored — it is read-only.
        assert 'schema_name' not in serializer.validated_data
        assert serializer.validated_data['name'] == 'Renamed'

    def test_created_on_is_read_only(self):
        assert ClientSerializer().fields['created_on'].read_only is True
        assert ClientSerializer().fields['schema_name'].read_only is True


# ---------------------------------------------------------------------------
# suspend / reactivate state transitions
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestSuspendReactivate:
    def setup_method(self):
        self.factory = APIRequestFactory()

    def _call(self, action_name, school, user):
        view = SchoolViewSet.as_view({'post': action_name})
        request = self.factory.post(f'/imboni/platform/schools/{school.pk}/{action_name}/')
        force_authenticate(request, user=user)
        return view(request, pk=school.pk)

    def test_suspend_sets_status_suspended(self):
        school = make_school(status='active')
        response = self._call('suspend', school, platform_admin())

        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'suspended'
        school.refresh_from_db()
        assert school.status == 'suspended'

    def test_reactivate_sets_status_active(self):
        school = make_school(status='suspended')
        response = self._call('reactivate', school, platform_admin())

        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'active'
        school.refresh_from_db()
        assert school.status == 'active'

    def test_suspend_then_reactivate_round_trip(self):
        school = make_school(status='active')
        admin = platform_admin()

        self._call('suspend', school, admin)
        school.refresh_from_db()
        assert school.status == 'suspended'

        self._call('reactivate', school, admin)
        school.refresh_from_db()
        assert school.status == 'active'


# ---------------------------------------------------------------------------
# Permission gate: platform staff only
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestPlatformAdminOnly:
    def setup_method(self):
        self.factory = APIRequestFactory()

    def test_anonymous_is_rejected_from_list(self):
        make_school()
        view = SchoolViewSet.as_view({'get': 'list'})
        request = self.factory.get('/imboni/platform/schools/')
        response = view(request)
        assert response.status_code in (
            status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN,
        )

    def test_non_staff_user_is_rejected_from_list(self):
        make_school()
        non_staff = UserFactory(role='dos', is_staff=False)
        view = SchoolViewSet.as_view({'get': 'list'})
        request = self.factory.get('/imboni/platform/schools/')
        force_authenticate(request, user=non_staff)
        response = view(request)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_non_staff_user_cannot_suspend(self):
        school = make_school(status='active')
        non_staff = UserFactory(role='dos', is_staff=False)
        view = SchoolViewSet.as_view({'post': 'suspend'})
        request = self.factory.post(f'/imboni/platform/schools/{school.pk}/suspend/')
        force_authenticate(request, user=non_staff)
        response = view(request, pk=school.pk)

        assert response.status_code == status.HTTP_403_FORBIDDEN
        school.refresh_from_db()
        assert school.status == 'active'   # unchanged

    def test_staff_user_can_list(self):
        make_school()
        view = SchoolViewSet.as_view({'get': 'list'})
        request = self.factory.get('/imboni/platform/schools/')
        force_authenticate(request, user=platform_admin())
        response = view(request)
        assert response.status_code == status.HTTP_200_OK
