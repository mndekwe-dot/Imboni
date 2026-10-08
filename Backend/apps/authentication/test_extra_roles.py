"""A teacher who is also the assistant DOS: more portals, never more than they were given."""
import pytest

from apps.audit.models import AuditEntry
from apps.authentication.factories import UserFactory
from apps.authentication.permissions import (
    IsDOS, IsDOSOrAdmin, IsDisciplineOrMatron, IsMatron, has_role,
)
from apps.staff.models import StaffMember

pytestmark = pytest.mark.django_db


class TestHasRole:
    def test_the_primary_role_still_counts(self):
        assert has_role(UserFactory(role='dos'), 'dos')

    def test_a_secondary_role_counts_too(self):
        teacher = UserFactory(role='teacher', extra_roles=['dos'])
        assert has_role(teacher, 'dos') and has_role(teacher, 'teacher') and not has_role(teacher, 'matron')

    def test_admin_in_extra_roles_grants_nothing(self):
        # Written by hand or by a bug, it must not become the key to everything.
        assert not has_role(UserFactory(role='teacher', extra_roles=['admin']), 'admin')
        assert not has_role(UserFactory(role='student', extra_roles=['parent']), 'parent')

    def test_it_reaches_every_permission_class(self):
        class Req:
            def __init__(self, user):
                self.user = user
        teacher = UserFactory(role='teacher', extra_roles=['dos', 'matron'])
        assert IsDOS().has_permission(Req(teacher), None)
        assert IsDOSOrAdmin().has_permission(Req(teacher), None)
        assert IsMatron().has_permission(Req(teacher), None)
        assert IsDisciplineOrMatron().has_permission(Req(teacher), None)
        assert not IsDOS().has_permission(Req(UserFactory(role='teacher')), None)


class TestEndpoints:
    def test_a_teacher_with_the_dos_role_can_open_the_dos_portal(self, make_authenticated_client):
        client, teacher = make_authenticated_client('teacher')
        assert client.get('/imboni/dos/teachers/').status_code == 403
        teacher.extra_roles = ['dos']
        teacher.save()
        assert client.get('/imboni/dos/teachers/').status_code == 200

    def test_they_still_cannot_do_what_neither_role_allows(self, make_authenticated_client):
        client, teacher = make_authenticated_client('teacher')
        teacher.extra_roles = ['dos']
        teacher.save()
        assert client.get('/imboni/finance/dashboard/').status_code == 403

    def test_the_login_payload_says_which_extra_portals_there_are(self, make_authenticated_client):
        client, teacher = make_authenticated_client('teacher')
        teacher.extra_roles = ['matron']
        teacher.save()
        from apps.authentication.serializers import UserSerializer
        assert UserSerializer(teacher).data['extra_roles'] == ['matron']

    def test_a_user_cannot_give_themselves_a_role(self, make_authenticated_client):
        client, teacher = make_authenticated_client('teacher')
        client.patch('/imboni/account/profile/', {'extra_roles': ['dos']}, format='json')
        teacher.refresh_from_db()
        assert teacher.extra_roles == []


class TestAdminScreen:
    def _member(self, role='teacher'):
        user = UserFactory(role=role)
        # Creating a login already gives the person a register entry.
        member, _ = StaffMember.objects.get_or_create(user=user, defaults={'first_name': 'A', 'last_name': 'B'})
        return user, member

    def test_the_admin_sets_the_full_list_and_it_is_audited(self, make_authenticated_client):
        client, admin = make_authenticated_client('admin')
        user, member = self._member()

        out = client.patch(f'/imboni/staff/members/{member.id}/roles/', {'extra_roles': ['matron', 'dos']}, format='json')

        assert out.status_code == 200 and out.data['extra_roles'] == ['dos', 'matron']
        user.refresh_from_db()
        assert user.extra_roles == ['dos', 'matron']
        entry = AuditEntry.objects.get(action='user.extra_roles_changed')
        assert entry.actor == admin and entry.detail == {'extra_roles': [[], ['dos', 'matron']]}

        assert client.patch(f'/imboni/staff/members/{member.id}/roles/', {'extra_roles': []}, format='json').data['extra_roles'] == []

    def test_a_role_equal_to_their_own_is_dropped(self, make_authenticated_client):
        client, _ = make_authenticated_client('admin')
        user, member = self._member('dos')
        out = client.patch(f'/imboni/staff/members/{member.id}/roles/', {'extra_roles': ['dos', 'matron']}, format='json')
        assert out.data['extra_roles'] == ['matron']

    def test_admin_is_not_a_role_that_can_be_handed_out(self, make_authenticated_client):
        client, _ = make_authenticated_client('admin')
        _, member = self._member()
        assert client.patch(f'/imboni/staff/members/{member.id}/roles/', {'extra_roles': ['admin']}, format='json').status_code == 400

    def test_students_and_parents_cannot_hold_one(self, make_authenticated_client):
        client, _ = make_authenticated_client('admin')
        _, member = self._member('parent')
        assert client.patch(f'/imboni/staff/members/{member.id}/roles/', {'extra_roles': ['dos']}, format='json').status_code == 400

    def test_a_member_without_a_login_is_told_to_invite_them(self, make_authenticated_client):
        client, _ = make_authenticated_client('admin')
        member = StaffMember.objects.create(first_name='No', last_name='Login')
        assert client.patch(f'/imboni/staff/members/{member.id}/roles/', {'extra_roles': ['dos']}, format='json').status_code == 400

    def test_nobody_but_the_admin_may_hand_out_roles(self, make_authenticated_client):
        client, _ = make_authenticated_client('bursar')
        _, member = self._member()
        assert client.patch(f'/imboni/staff/members/{member.id}/roles/', {'extra_roles': ['dos']}, format='json').status_code == 403

    def test_the_staff_list_shows_what_each_person_holds(self, make_authenticated_client):
        client, _ = make_authenticated_client('admin')
        user, member = self._member()
        user.extra_roles = ['matron']
        user.save()
        rows = client.get('/imboni/staff/members/').data
        rows = rows['results'] if isinstance(rows, dict) else rows
        assert next(r for r in rows if r['id'] == str(member.id))['account_extra_roles'] == ['matron']
