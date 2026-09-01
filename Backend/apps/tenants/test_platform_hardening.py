"""
The six gaps that stood between the platform layer and an operable one:

  1. a provisioned school was never told it existed — an operator relayed a
     temporary password by hand;
  2. two front doors, one of which reviewed nobody;
  3. one flat operator role: whoever answered a ticket could suspend a school;
  4. no record of anything an operator did;
  5. suspension was the only lever, and it was all-or-nothing;
  6. a ticket arrived with a school name and nothing else.

Each section below is one of them.
"""
from datetime import timedelta

import pyotp
import pytest
from django.contrib.auth import get_user_model
from django.core import mail
from django.utils import timezone
from django_tenants.utils import schema_context, get_public_schema_name
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.tenants import invitations, platform_ops
from apps.tenants.middleware import (
    ALLOW, BLOCK, READ_ONLY, WARN, subscription_decision,
)
from apps.tenants.models import (
    Client, PlatformAuditLog, PlatformUser, SchoolApplication, SchoolInvitation,
    SupportTicket,
)
from apps.tenants.platform_auth import verify_mfa_code
from apps.tenants.views import SchoolViewSet

pytestmark = pytest.mark.django_db
factory = APIRequestFactory()

PUBLIC = get_public_schema_name()
TENANT = 'test'      # the schema conftest.py pins for every tenant-side test


def _public():
    return schema_context(PUBLIC)


def operator(email='ops@imboni.com', role=PlatformUser.ROLE_OPERATIONS, mfa=True):
    with _public():
        pu = PlatformUser(email=email, name='Ops', role=role, mfa_enabled=mfa,
                          mfa_secret=pyotp.random_base32() if mfa else '')
        pu.set_password('PlatformPass123!')
        pu.save()
    return pu


def _authed(method, user, data=None):
    req = getattr(factory, method)('/x/', data or {}, format='json')
    force_authenticate(req, user=user)
    return req


def fake_school(name='Ov', schema='ovfake', status='active'):
    with _public():
        client = Client(name=name, schema_name=schema, status=status)
        client.auto_create_schema = False   # no real Postgres schema in tests
        client.save()
    return client


# ── 1. The school is told it exists, and no credential is relayed ─────────────

class TestInvitationReplacesTheRelayedPassword:
    def test_provisioning_emails_a_link_and_returns_no_password(self, monkeypatch):
        op = operator()
        client = fake_school(name='GV', schema='gvfake')
        with _public():
            app = SchoolApplication.objects.create(
                school_name='GV', desired_subdomain='gv', contact_name='Jane Doe',
                contact_email='jane@gv.rw', status='approved')
        monkeypatch.setattr('apps.tenants.platform_ops.provision_tenant',
                            lambda **kw: (client, 'gv.localhost'))

        view = platform_ops.ApplicationViewSet.as_view({'post': 'provision'})
        with _public():
            resp = view(_authed('post', op), pk=str(app.id))

        assert resp.status_code == 201
        provisioned = resp.data['provisioned']
        assert 'temp_password' not in provisioned
        assert provisioned['invitation']['delivered'] is True

        # The link went to the school, not to the operator's screen.
        assert len(mail.outbox) == 1
        assert mail.outbox[0].to == ['jane@gv.rw']
        assert '/accept-invite?token=' in mail.outbox[0].body

    def test_the_admin_cannot_sign_in_until_the_invitation_is_accepted(self):
        """A provisioned school has an account, not a usable one."""
        User = get_user_model()
        with schema_context(TENANT):
            user = User.objects.create(username='newhead', email='head@sp.rw',
                                       role='admin')
            user.set_unusable_password()
            user.save()
            assert user.has_usable_password() is False

        client = Client.objects.get(schema_name=TENANT)
        invitation, raw = invitations.create_invitation(client, 'head@sp.rw')
        invitations.accept_invitation(raw, 'a-Strong-Passphrase-9', client)

        with schema_context(TENANT):
            user.refresh_from_db()
            assert user.has_usable_password() is True
            assert user.check_password('a-Strong-Passphrase-9')

    def test_a_token_is_single_use(self):
        client = Client.objects.get(schema_name=TENANT)
        User = get_user_model()
        with schema_context(TENANT):
            u = User.objects.create(username='once', email='once@sp.rw', role='admin')
            u.set_unusable_password()
            u.save()

        _, raw = invitations.create_invitation(client, 'once@sp.rw')
        invitations.accept_invitation(raw, 'first-Password-11', client)

        with pytest.raises(invitations.InvitationError):
            invitations.accept_invitation(raw, 'second-Password-22', client)

    def test_an_expired_token_is_refused(self):
        client = Client.objects.get(schema_name=TENANT)
        invitation, raw = invitations.create_invitation(client, 'late@sp.rw')
        with _public():
            invitation.expires_at = timezone.now() - timedelta(minutes=1)
            invitation.save(update_fields=['expires_at'])

        with pytest.raises(invitations.InvitationError):
            invitations.find_invitation(raw, client)

    def test_a_token_for_one_school_is_refused_at_another(self):
        """Replaying a valid token against a different school's domain fails."""
        theirs = Client.objects.get(schema_name=TENANT)
        ours = fake_school(name='Other', schema='otherfake')
        _, raw = invitations.create_invitation(theirs, 'head@sp.rw')

        with pytest.raises(invitations.InvitationError):
            invitations.find_invitation(raw, ours)

    def test_raw_tokens_are_never_stored(self):
        client = Client.objects.get(schema_name=TENANT)
        _, raw = invitations.create_invitation(client, 'head@sp.rw')
        with _public():
            stored = SchoolInvitation.objects.filter(client=client).first()
        assert stored.token_hash != raw
        assert stored.token_hash == invitations.hash_token(raw)

    def test_resending_kills_the_previous_link(self):
        client = Client.objects.get(schema_name=TENANT)
        _, first = invitations.create_invitation(client, 'head@sp.rw')
        _, second = invitations.create_invitation(client, 'head@sp.rw')

        with pytest.raises(invitations.InvitationError):
            invitations.find_invitation(first, client)
        assert invitations.find_invitation(second, client) is not None


# ── 2. The unreviewed door creates a demo, not a school ───────────────────────

class TestSelfServeCreatesADemo:
    def test_a_demo_knows_when_it_ends(self):
        with _public():
            demo = Client(name='Trying It', schema_name='tryfake', is_demo=True,
                          demo_expires_on=timezone.localdate() - timedelta(days=1))
            demo.auto_create_schema = False
            demo.save()
        assert demo.is_expired_demo is True

    def test_an_expired_demo_is_stopped_by_the_nightly_run(self):
        from apps.tenants.lifecycle import enforce_contract_lifecycle
        with _public():
            demo = Client(name='Stale', schema_name='stalefake', status='trial',
                          is_demo=True,
                          demo_expires_on=timezone.localdate() - timedelta(days=2))
            demo.auto_create_schema = False
            demo.save()

        result = enforce_contract_lifecycle()

        assert result['demos_expired'] == 1
        with _public():
            demo.refresh_from_db()
        assert demo.status == 'suspended'

    def test_a_live_demo_is_left_alone(self):
        from apps.tenants.lifecycle import enforce_contract_lifecycle
        with _public():
            demo = Client(name='Fresh', schema_name='freshfake', status='trial',
                          is_demo=True,
                          demo_expires_on=timezone.localdate() + timedelta(days=10))
            demo.auto_create_schema = False
            demo.save()

        assert enforce_contract_lifecycle()['demos_expired'] == 0
        with _public():
            demo.refresh_from_db()
        assert demo.status == 'trial'


# ── 3. Three roles, not one login ─────────────────────────────────────────────

class TestRolesAreSeparated:
    def test_support_cannot_suspend_a_school(self):
        support = operator('support@imboni.com', PlatformUser.ROLE_SUPPORT, mfa=False)
        school = fake_school(schema='suspfake')
        view = SchoolViewSet.as_view({'post': 'suspend'})
        with _public():
            resp = view(_authed('post', support), pk=str(school.id))
        assert resp.status_code == 403
        with _public():
            school.refresh_from_db()
        assert school.status == 'active'

    def test_commercial_cannot_suspend_a_school_either(self):
        comm = operator('comm@imboni.com', PlatformUser.ROLE_COMMERCIAL, mfa=False)
        school = fake_school(schema='comfake')
        view = SchoolViewSet.as_view({'post': 'suspend'})
        with _public():
            resp = view(_authed('post', comm), pk=str(school.id))
        assert resp.status_code == 403

    def test_operations_can(self):
        ops = operator('ops2@imboni.com')
        school = fake_school(schema='opsfake')
        view = SchoolViewSet.as_view({'post': 'suspend'})
        with _public():
            resp = view(_authed('post', ops), pk=str(school.id))
        assert resp.status_code == 200
        with _public():
            school.refresh_from_db()
        assert school.status == 'suspended'

    def test_support_cannot_write_a_payment_but_can_read_them(self):
        support = operator('s2@imboni.com', PlatformUser.ROLE_SUPPORT, mfa=False)
        create = platform_ops.PaymentViewSet.as_view({'post': 'create'})
        with _public():
            resp = create(_authed('post', support, {'amount': '10', 'school_name': 'X'}))
        assert resp.status_code == 403

        listing = platform_ops.PaymentViewSet.as_view({'get': 'list'})
        with _public():
            resp = listing(_authed('get', support))
        assert resp.status_code == 200

    def test_an_operations_account_without_mfa_is_refused_its_powers(self):
        """
        The role is not the permission; the enrolled second factor is.

        Without this, adding an MFA field would have been decoration: the
        migration promotes every existing operator to operations, and they
        would all have kept their powers with nothing enrolled.
        """
        naked = operator('nomfa@imboni.com', PlatformUser.ROLE_OPERATIONS, mfa=False)
        school = fake_school(schema='nomfafake')
        view = SchoolViewSet.as_view({'post': 'suspend'})
        with _public():
            resp = view(_authed('post', naked), pk=str(school.id))
        assert resp.status_code == 403

    def test_a_demotion_takes_effect_immediately_not_at_token_expiry(self):
        """Permissions read the row, not the claim baked into the token."""
        ops = operator('demote@imboni.com')
        school = fake_school(schema='demotefake')
        view = SchoolViewSet.as_view({'post': 'suspend'})

        with _public():
            PlatformUser.objects.filter(pk=ops.pk).update(role=PlatformUser.ROLE_SUPPORT)
            ops.refresh_from_db()
            resp = view(_authed('post', ops), pk=str(school.id))
        assert resp.status_code == 403

    def test_role_ranks_nest(self):
        ops = PlatformUser(role=PlatformUser.ROLE_OPERATIONS)
        assert ops.has_role(PlatformUser.ROLE_SUPPORT)
        assert ops.has_role(PlatformUser.ROLE_COMMERCIAL)

        support = PlatformUser(role=PlatformUser.ROLE_SUPPORT)
        assert support.has_role(PlatformUser.ROLE_SUPPORT)
        assert not support.has_role(PlatformUser.ROLE_OPERATIONS)

    def test_a_totp_code_verifies_against_the_secret(self):
        """
        The operator must be a saved row: accepting a code now also spends it,
        by writing the time-step it belongs to back to the account. An
        unsaved instance has nowhere to record that, so it fails closed.
        """
        user = operator('totp@imboni.com')
        with _public():
            assert verify_mfa_code(user, pyotp.TOTP(user.mfa_secret).now())
            assert not verify_mfa_code(user, '000000')
            assert not verify_mfa_code(user, '')


# ── 4. Operator actions are recorded ──────────────────────────────────────────

class TestOperatorActionsAreAudited:
    def test_suspending_a_school_is_recorded_with_the_actor_and_the_change(self):
        ops = operator('audit@imboni.com')
        school = fake_school(schema='audfake')
        view = SchoolViewSet.as_view({'post': 'suspend'})
        with _public():
            view(_authed('post', ops), pk=str(school.id))
            entry = PlatformAuditLog.objects.filter(action='school.suspend').first()

        assert entry is not None
        assert entry.actor_email == 'audit@imboni.com'
        assert entry.actor_role == PlatformUser.ROLE_OPERATIONS
        assert entry.changes['status'] == ['active', 'suspended']
        assert entry.client_id == school.pk

    def test_the_automatic_suspension_is_recorded_too(self):
        """A school switched off by the nightly job still has an explanation."""
        from apps.tenants.lifecycle import enforce_contract_lifecycle
        from apps.tenants.models import Contract
        school = fake_school(schema='autofake')
        with _public():
            Contract.objects.create(client=school, title='old',
                                    start_date=timezone.localdate() - timedelta(days=500),
                                    end_date=timezone.localdate() - timedelta(days=60),
                                    status='active', grace_days=14)

        enforce_contract_lifecycle()

        with _public():
            entry = PlatformAuditLog.objects.filter(action='school.auto_suspend').first()
        assert entry is not None
        assert entry.actor_email == ''          # nobody: the clock did it
        assert 'expired past grace' in entry.changes['reason']

    def test_secrets_are_stripped_before_they_reach_the_log(self):
        from apps.tenants.platform_audit import record
        with _public():
            record('test.thing', changes={'password': 'hunter2', 'plan': 'premium',
                                          'mfa_secret': 'ABCDEF'})
            entry = PlatformAuditLog.objects.filter(action='test.thing').first()
        assert entry.changes['password'] == '[redacted]'
        assert entry.changes['mfa_secret'] == '[redacted]'
        assert entry.changes['plan'] == 'premium'

    def test_a_failure_to_audit_never_breaks_the_action_it_describes(self, monkeypatch):
        from apps.tenants import platform_audit

        def boom(*args, **kwargs):
            raise RuntimeError('audit table is on fire')

        monkeypatch.setattr(platform_audit.PlatformAuditLog.objects, 'create', boom)
        assert platform_audit.record('test.explodes') is None

    def test_the_log_is_read_only_by_route(self):
        """There is no create/update/delete anywhere on the audit endpoint."""
        assert not hasattr(platform_ops.AuditLogViewSet, 'create')
        assert not hasattr(platform_ops.AuditLogViewSet, 'update')
        assert not hasattr(platform_ops.AuditLogViewSet, 'destroy')

    def test_support_can_read_the_log(self):
        """Accountability only the powerful can inspect is not accountability."""
        support = operator('reader@imboni.com', PlatformUser.ROLE_SUPPORT, mfa=False)
        view = platform_ops.AuditLogViewSet.as_view({'get': 'list'})
        with _public():
            resp = view(_authed('get', support))
        assert resp.status_code == 200


# ── 5. Suspension is a staircase, not a switch ────────────────────────────────

class TestReadOnlyIsTheStepBeforeSuspension:
    def test_reads_pass_while_writes_are_refused(self):
        assert subscription_decision(TENANT, 'read_only', '/imboni/results/', 'GET') == READ_ONLY
        assert subscription_decision(TENANT, 'read_only', '/imboni/results/', 'POST') == BLOCK
        assert subscription_decision(TENANT, 'read_only', '/imboni/results/', 'DELETE') == BLOCK

    def test_a_restricted_school_can_still_pay_ask_and_export(self):
        for path in ('/imboni/billing/checkout/', '/imboni/support/tickets/',
                     '/imboni/export/students/'):
            assert subscription_decision(TENANT, 'read_only', path, 'POST') == ALLOW

    def test_a_suspended_school_is_still_blocked_outright(self):
        assert subscription_decision(TENANT, 'suspended', '/imboni/results/', 'GET') == BLOCK

    def test_nothing_else_changed(self):
        assert subscription_decision(TENANT, 'active', '/imboni/results/', 'POST') == ALLOW
        assert subscription_decision(TENANT, 'past_due', '/imboni/results/', 'POST') == WARN
        assert subscription_decision(PUBLIC, 'read_only', '/anything/', 'POST') == ALLOW

    def test_an_operator_can_restrict_without_suspending(self):
        ops = operator('restrict@imboni.com')
        school = fake_school(schema='resfake')
        view = SchoolViewSet.as_view({'post': 'restrict'})
        with _public():
            resp = view(_authed('post', ops), pk=str(school.id))
        assert resp.status_code == 200
        with _public():
            school.refresh_from_db()
        assert school.status == 'read_only'

    def test_reactivating_clears_it(self):
        ops = operator('react@imboni.com')
        school = fake_school(schema='reafake', status='read_only')
        view = SchoolViewSet.as_view({'post': 'reactivate'})
        with _public():
            view(_authed('post', ops), pk=str(school.id))
            school.refresh_from_db()
        assert school.status == 'active'


# ── 6. A ticket arrives with its school attached ──────────────────────────────

class TestTicketsCarryTheirContext:
    def test_context_answers_the_questions_a_ticket_raises(self):
        ops = operator('ctx@imboni.com')
        school = Client.objects.get(schema_name=TENANT)
        with _public():
            ticket = SupportTicket.objects.create(
                client=school, schema_name=TENANT, subject='We cannot sign in',
                body='Nothing works', status='open')

        view = platform_ops.SupportTicketViewSet.as_view({'get': 'context'})
        with _public():
            resp = view(_authed('get', ops), pk=str(ticket.id))

        assert resp.status_code == 200
        assert resp.data['school']['schema_name'] == TENANT
        # The facts the first reply needs, without leaving the ticket.
        for key in ('capacity', 'contract', 'last_payment', 'invitation',
                    'open_tickets', 'uncovered', 'admin_can_sign_in'):
            assert key in resp.data

    def test_an_unreadable_school_degrades_instead_of_500ing(self):
        """
        A school whose schema cannot be read is exactly when an operator most
        needs the page to load — and the failed query must not poison the rest
        of the request's transaction.
        """
        from apps.tenants.school_context import school_context
        broken = fake_school(name='Broken', schema='doesnotexist')

        data = school_context(broken)

        assert data['reachable'] is False
        assert data['capacity'] is None
        assert data['school']['name'] == 'Broken'
        # The transaction survived: another query still works.
        with _public():
            assert Client.objects.filter(schema_name='doesnotexist').exists()

    def test_a_ticket_from_a_deleted_school_still_renders(self):
        from apps.tenants.school_context import school_context
        data = school_context(None, schema_name='gone')
        assert data['school'] is None
        assert data['schema_name'] == 'gone'

    def test_seat_limits_come_from_the_school_not_the_connection(self):
        """
        `schema_context` switches the schema, not `connection.tenant`.

        Read the plan off the connection here and an operator sees this
        school's head-count measured against whatever plan the PUBLIC tenant
        happens to carry -- a limit belonging to nobody.
        """
        from apps.tenants.school_context import school_context
        school = Client.objects.get(schema_name=TENANT)
        with _public():
            Client.objects.filter(pk=school.pk).update(plan='free')
            school.refresh_from_db()

        data = school_context(school)

        assert data['capacity']['plan'] == 'free'
        # The free plan's caps, from plans.PLAN_LIMITS -- not None, which is
        # what an unlimited (premium) plan would have produced.
        assert data['capacity']['resources']['students']['limit'] == 50
        assert data['capacity']['resources']['staff']['limit'] == 10
