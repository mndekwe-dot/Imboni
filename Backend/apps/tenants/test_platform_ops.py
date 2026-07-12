"""
Tests for platform operations (Phase 6): expenses, payments, tickets, summary.

Operator endpoints (public schema) are driven via APIRequestFactory wrapped in
schema_context(public); the school-side support endpoints run in the pinned
`test` tenant and write through to the public inbox.
"""
from datetime import timedelta

import pytest
from django.utils import timezone
from django_tenants.utils import schema_context, get_public_schema_name
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.authentication.factories import UserFactory
from apps.tenants import platform_ops
from apps.tenants.models import PlatformUser, PlatformExpense, Payment, SupportTicket
from apps.tenants.support import MyTicketsView, MyTicketReplyView

pytestmark = pytest.mark.django_db
factory = APIRequestFactory()


def _public():
    return schema_context(get_public_schema_name())


def platform_admin(email='ops@imboni.com'):
    with _public():
        pu = PlatformUser(email=email, name='Ops')
        pu.set_password('PlatformPass123!')
        pu.save()
    return pu


def _authed(method, user, data=None):
    req = getattr(factory, method)('/x/', data or {}, format='json')
    force_authenticate(req, user=user)
    return req


# ── Expenses (money out) ──────────────────────────────────────────────────────

class TestExpenses:
    def test_create_lists_and_flags_overdue(self):
        op = platform_admin()
        create = platform_ops.ExpenseViewSet.as_view({'post': 'create'})
        req = _authed('post', op, {
            'name': 'AWS', 'amount': '12.50', 'due_date': str(timezone.localdate() - timedelta(days=2)),
            'category': 'hosting', 'recurrence': 'monthly',
        })
        with _public():
            resp = create(req)
        assert resp.status_code == 201
        assert resp.data['is_overdue'] is True

    def test_mark_paid_clears_overdue(self):
        op = platform_admin()
        with _public():
            exp = PlatformExpense.objects.create(name='Domain', amount='10',
                                                 due_date=timezone.localdate() - timedelta(days=1))
        patch = platform_ops.ExpenseViewSet.as_view({'patch': 'partial_update'})
        req = _authed('patch', op, {'status': 'paid'})
        with _public():
            resp = patch(req, pk=str(exp.id))
        assert resp.status_code == 200
        assert resp.data['status'] == 'paid'
        assert resp.data['is_overdue'] is False

    def test_school_user_is_rejected(self):
        school_user = UserFactory(role='admin', is_staff=True)
        req = _authed('get', school_user)
        with _public():
            resp = platform_ops.ExpenseViewSet.as_view({'get': 'list'})(req)
        assert resp.status_code == 403


# ── Payments (money in) + summary ─────────────────────────────────────────────

class TestRevenueAndSummary:
    def test_summary_aggregates_money_and_tickets(self):
        op = platform_admin()
        with _public():
            Payment.objects.create(school_name='A', amount='100.00', status='succeeded')
            Payment.objects.create(school_name='B', amount='50.00', status='failed')  # not counted
            PlatformExpense.objects.create(name='AWS', amount='10',
                                           due_date=timezone.localdate() - timedelta(days=1))
            SupportTicket.objects.create(schema_name='test', subject='S', body='B', status='open')

        req = _authed('get', op)
        with _public():
            resp = platform_ops.PlatformSummaryView.as_view()(req)
        assert resp.status_code == 200
        assert resp.data['revenue']['total'] == '100.00'          # only the succeeded one
        assert resp.data['revenue']['payments_count'] == 1
        assert resp.data['expenses']['overdue_count'] == 1
        assert resp.data['tickets']['open'] == 1


# ── Support tickets ───────────────────────────────────────────────────────────

class TestSupportTickets:
    def test_school_raises_and_sees_only_own_tickets(self):
        user = UserFactory(role='admin', email='a@test.com', first_name='Ann', last_name='K``e')
        # raise (runs in the 'test' tenant, writes to public inbox)
        resp = MyTicketsView.as_view()(_authed('post', user, {
            'subject': 'Login broken', 'body': 'Cannot sign in', 'priority': 'high'}))
        assert resp.status_code == 201
        assert resp.data['school_name']  # snapshotted from the tenant

        # a ticket from another school must not be visible here
        with _public():
            SupportTicket.objects.create(schema_name='otherschool', subject='x', body='y')

        listed = MyTicketsView.as_view()(_authed('get', user))
        assert len(listed.data) == 1
        assert listed.data[0]['subject'] == 'Login broken'

    def test_operator_reply_moves_open_to_in_progress(self):
        op = platform_admin()
        with _public():
            t = SupportTicket.objects.create(schema_name='test', school_name='Test',
                                             subject='S', body='B', status='open')
        reply = platform_ops.SupportTicketViewSet.as_view({'post': 'reply'})
        req = _authed('post', op, {'body': 'We are looking into it.'})
        with _public():
            resp = reply(req, pk=str(t.id))
        assert resp.status_code == 200
        assert resp.data['status'] == 'in_progress'
        assert len(resp.data['replies']) == 1
        assert resp.data['replies'][0]['author_type'] == 'operator'

    def test_operator_set_status(self):
        op = platform_admin()
        with _public():
            t = SupportTicket.objects.create(schema_name='test', subject='S', body='B', status='open')
        set_status = platform_ops.SupportTicketViewSet.as_view({'post': 'set_status'})
        with _public():
            resp = set_status(_authed('post', op, {'status': 'resolved'}), pk=str(t.id))
        assert resp.status_code == 200
        assert resp.data['status'] == 'resolved'

    def test_school_reply_reopens_resolved_ticket(self):
        user = UserFactory(role='admin', email='b@test.com')
        with _public():
            t = SupportTicket.objects.create(schema_name='test', subject='S', body='B', status='resolved')
        resp = MyTicketReplyView.as_view()(_authed('post', user, {'body': 'Still broken'}), pk=str(t.id))
        assert resp.status_code == 201
        assert resp.data['status'] == 'open'   # re-opened


# ── School applications (Phase 7) ─────────────────────────────────────────────

from apps.tenants.onboarding import SchoolApplyView          # noqa: E402
from apps.tenants.models import SchoolApplication, Client     # noqa: E402


class TestApplications:
    def _apply(self, **data):
        req = factory.post('/imboni/onboarding/apply/', data, format='json')
        with _public():
            return SchoolApplyView.as_view()(req)

    def test_public_apply_creates_pending(self):
        resp = self._apply(school_name='Green Valley', desired_subdomain='greenvalley',
                           contact_name='Jane Doe', contact_email='jane@gv.com')
        assert resp.status_code == 201
        with _public():
            app = SchoolApplication.objects.get(id=resp.data['id'])
        assert app.status == 'pending'

    def test_apply_rejects_bad_subdomain(self):
        resp = self._apply(school_name='X', desired_subdomain='A B!',
                           contact_name='Y', contact_email='y@x.com')
        assert resp.status_code == 400

    def test_operator_approve(self):
        op = platform_admin()
        with _public():
            app = SchoolApplication.objects.create(school_name='GV', desired_subdomain='gv',
                                                   contact_name='J', contact_email='j@gv.com')
        view = platform_ops.ApplicationViewSet.as_view({'post': 'approve'})
        with _public():
            resp = view(_authed('post', op, {'review_notes': 'ok'}), pk=str(app.id))
        assert resp.status_code == 200
        assert resp.data['status'] == 'approved'
        assert resp.data['review_notes'] == 'ok'

    def test_cannot_provision_unapproved(self):
        op = platform_admin()
        with _public():
            app = SchoolApplication.objects.create(school_name='GV', desired_subdomain='gv',
                                                   contact_name='J', contact_email='j@gv.com')
        view = platform_ops.ApplicationViewSet.as_view({'post': 'provision'})
        with _public():
            resp = view(_authed('post', op), pk=str(app.id))
        assert resp.status_code == 400

    def test_provision_marks_provisioned_and_returns_creds(self, monkeypatch):
        op = platform_admin()
        with _public():
            app = SchoolApplication.objects.create(school_name='GV', desired_subdomain='gv',
                                                   contact_name='Jane Doe', contact_email='j@gv.com',
                                                   status='approved')
            client = Client(name='GV', schema_name='gvfake')
            client.auto_create_schema = False
            client.save()
        # Avoid building a real Postgres schema in the test.
        monkeypatch.setattr('apps.tenants.platform_ops.provision_tenant',
                            lambda **kw: (client, 'gv.localhost'))
        view = platform_ops.ApplicationViewSet.as_view({'post': 'provision'})
        with _public():
            resp = view(_authed('post', op), pk=str(app.id))
        assert resp.status_code == 201
        assert resp.data['status'] == 'provisioned'
        assert resp.data['provisioned']['temp_password']
        assert resp.data['provisioned']['login_url'].endswith('/login/admin')


# ── Contracts + lifecycle (Phase 7.2) ─────────────────────────────────────────

from apps.tenants.models import Contract                       # noqa: E402
from apps.tenants.lifecycle import enforce_contract_lifecycle  # noqa: E402


class TestContracts:
    def _client(self, name='Co', schema='cofake', status='active'):
        with _public():
            c = Client(name=name, schema_name=schema, status=status)
            c.auto_create_schema = False
            c.save()
        return c

    def test_create_sign_renew(self):
        op = platform_admin()
        client = self._client()
        create = platform_ops.ContractViewSet.as_view({'post': 'create'})
        with _public():
            resp = create(_authed('post', op, {
                'client': str(client.id), 'title': '2026 Annual', 'amount': '100',
                'start_date': str(timezone.localdate()),
                'end_date': str(timezone.localdate() + timedelta(days=365))}))
        assert resp.status_code == 201
        assert resp.data['status'] == 'draft'
        cid = resp.data['id']

        with _public():
            signed = platform_ops.ContractViewSet.as_view({'post': 'sign'})(
                _authed('post', op, {'signed_by': 'Ops'}), pk=cid)
        assert signed.data['status'] == 'active'
        assert signed.data['signed_by'] == 'Ops'

        with _public():
            renewed = platform_ops.ContractViewSet.as_view({'post': 'renew'})(_authed('post', op), pk=cid)
        assert renewed.status_code == 201
        assert renewed.data['status'] == 'active'
        with _public():
            assert Contract.objects.get(id=cid).status == 'expired'   # old one closed out

    def test_lifecycle_suspends_school_past_grace(self):
        client = self._client(status='active')
        with _public():
            Contract.objects.create(client=client, title='old',
                                    start_date=timezone.localdate() - timedelta(days=400),
                                    end_date=timezone.localdate() - timedelta(days=30),
                                    status='active', grace_days=14)
        result = enforce_contract_lifecycle()
        assert result['expired'] == 1 and result['suspended'] == 1
        with _public():
            client.refresh_from_db()
        assert client.status == 'suspended'

    def test_lifecycle_within_grace_leaves_school_active(self):
        client = self._client(status='active')
        with _public():
            Contract.objects.create(client=client, title='recent',
                                    start_date=timezone.localdate() - timedelta(days=400),
                                    end_date=timezone.localdate() - timedelta(days=5),
                                    status='active', grace_days=14)
        result = enforce_contract_lifecycle()
        assert result['suspended'] == 0
        with _public():
            client.refresh_from_db()
        assert client.status == 'active'
