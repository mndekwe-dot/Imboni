"""
A parent paying fees from their phone. The provider is faked: what matters is
that the books are only touched on a confirmed success, exactly once.
"""
from decimal import Decimal

import pytest
from django.utils import timezone

from apps.authentication.factories import ParentStudentRelationshipFactory, StudentFactory, UserFactory
from apps.finance import momo, online_payments
from apps.finance.models import FeePayment, OnlinePayment
from apps.notifications.models import Notification
from apps.student.models import Fee

pytestmark = pytest.mark.django_db



@pytest.fixture(autouse=True)
def _momo_credentials(settings):
    # The school has put its own MoMo credentials in; individual tests take them out.
    settings.MOMO_SUBSCRIPTION_KEY, settings.MOMO_API_USER, settings.MOMO_API_KEY = 'k', 'u', 'p'


class FakeMomo:
    def __init__(self, answer=None, fail_send=False):
        self.answer, self.fail_send, self.sent = answer or {'status': 'PENDING'}, fail_send, []

    def request_to_pay(self, reference, amount, phone, message):
        if self.fail_send:
            raise momo.MomoError('Mobile money did not accept the request. Check the number and try again.')
        self.sent.append((str(reference), amount, phone))

    def status(self, reference):
        return {'transaction_id': '', 'reason': '', **self.answer}


@pytest.fixture
def family(term):
    parent = UserFactory(role='parent')
    child = StudentFactory()
    ParentStudentRelationshipFactory(parent=parent, student=child)
    Fee.objects.create(student=child, term=term, category='tuition', amount=Decimal('100000'),
                       due_date=timezone.localdate())
    return parent, child


class TestPhoneNumbers:
    @pytest.mark.parametrize('written', ['0788123456', '+250 788 123 456', '788123456', '250788123456'])
    def test_every_way_of_writing_it_becomes_one_number(self, written):
        assert online_payments.normalise_phone(written) == '250788123456'

    @pytest.mark.parametrize('bad', ['', '12345', '0788', '+44 7700 900123', 'abc'])
    def test_anything_else_is_refused(self, bad):
        assert online_payments.normalise_phone(bad) is None


class TestInitiate:
    def test_the_prompt_is_sent_but_the_books_are_not_touched(self, family):
        parent, child = family
        client = FakeMomo()

        op = online_payments.initiate(child, parent, '40000', '0788123456', client=client)

        assert op.status == 'pending' and client.sent == [(str(op.provider_ref), Decimal('40000'), '250788123456')]
        assert not FeePayment.objects.exists()

    def test_it_cannot_pay_more_than_is_owed_or_nothing(self, family):
        parent, child = family
        with pytest.raises(online_payments.OnlinePaymentError, match='more than is owed'):
            online_payments.initiate(child, parent, '100001', '0788123456', client=FakeMomo())
        with pytest.raises(online_payments.OnlinePaymentError):
            online_payments.initiate(child, parent, '0', '0788123456', client=FakeMomo())

    def test_a_bad_number_is_refused_before_anything_is_recorded(self, family):
        parent, child = family
        with pytest.raises(online_payments.OnlinePaymentError, match='07XX'):
            online_payments.initiate(child, parent, '1000', '12345', client=FakeMomo())
        assert not OnlinePayment.objects.exists()

    def test_a_refusal_by_the_provider_is_recorded_as_failed_and_told_to_the_parent(self, family):
        parent, child = family
        with pytest.raises(online_payments.OnlinePaymentError, match='did not accept'):
            online_payments.initiate(child, parent, '1000', '0788123456', client=FakeMomo(fail_send=True))
        assert OnlinePayment.objects.get().status == 'failed'

    def test_only_one_prompt_at_a_time_per_child(self, family):
        parent, child = family
        online_payments.initiate(child, parent, '1000', '0788123456', client=FakeMomo())
        with pytest.raises(online_payments.OnlinePaymentError, match='already waiting'):
            online_payments.initiate(child, parent, '1000', '0788123456', client=FakeMomo())

    def test_it_is_off_unless_the_school_has_credentials(self, family, settings):
        parent, child = family
        settings.MOMO_SUBSCRIPTION_KEY = ''
        with pytest.raises(online_payments.OnlinePaymentError, match='not set up'):
            online_payments.initiate(child, parent, '1000', '0788123456', client=FakeMomo())


class TestSettling:
    def _pending(self, family, amount='40000'):
        parent, child = family
        return online_payments.initiate(child, parent, amount, '0788123456', client=FakeMomo())

    def test_a_confirmed_payment_becomes_one_ordinary_receipt(self, family):
        parent, child = family
        op = self._pending(family)

        online_payments.refresh(op, FakeMomo({'status': 'SUCCESSFUL', 'transaction_id': 'TX99'}))

        op.refresh_from_db()
        assert op.status == 'successful' and op.receipt_no
        payment = FeePayment.objects.get()
        assert payment.method == 'momo' and payment.reference == 'TX99' and payment.amount == Decimal('40000')
        assert Notification.objects.filter(user=parent, title='Payment received').count() == 1

    def test_asking_again_cannot_record_it_twice(self, family):
        op = self._pending(family)
        success = FakeMomo({'status': 'SUCCESSFUL', 'transaction_id': 'TX99'})
        online_payments.refresh(op, success)
        online_payments.refresh(op, success)
        online_payments.settle(op.pk)
        assert FeePayment.objects.count() == 1

    def test_a_declined_or_pending_prompt_leaves_the_books_alone(self, family):
        op = self._pending(family)
        online_payments.refresh(op, FakeMomo({'status': 'PENDING'}))
        op.refresh_from_db()
        assert op.status == 'pending'
        online_payments.refresh(op, FakeMomo({'status': 'FAILED', 'reason': 'PAYER_LIMIT_REACHED'}))
        op.refresh_from_db()
        assert op.status == 'failed' and op.detail == 'PAYER_LIMIT_REACHED' and not FeePayment.objects.exists()

    def test_a_prompt_nobody_answered_expires(self, family):
        op = self._pending(family)
        OnlinePayment.objects.filter(pk=op.pk).update(created_at=timezone.now() - online_payments.PENDING_LIFETIME * 2)
        op.refresh_from_db()
        online_payments.refresh(op, FakeMomo({'status': 'PENDING'}))
        op.refresh_from_db()
        assert op.status == 'failed' and 'time' in op.detail

    def test_money_that_arrives_with_nowhere_to_go_is_flagged_never_lost(self, family):
        parent, child = family
        op = self._pending(family, '100000')
        # The office settles the bill by other means while the prompt is open.
        Fee.objects.filter(student=child).delete()

        online_payments.refresh(op, FakeMomo({'status': 'SUCCESSFUL', 'transaction_id': 'TX1'}))

        op.refresh_from_db()
        assert op.status == 'needs_review' and op.detail and not FeePayment.objects.exists()

    def test_an_unreachable_provider_is_not_a_failure(self, family):
        op = self._pending(family)

        class Down(FakeMomo):
            def status(self, reference):
                raise momo.MomoError('down')
        online_payments.refresh(op, Down())
        op.refresh_from_db()
        assert op.status == 'pending'

    def test_the_scheduler_settles_what_was_approved_after_the_page_closed(self, family):
        op = self._pending(family)
        assert online_payments.refresh_all_pending(FakeMomo({'status': 'SUCCESSFUL', 'transaction_id': 'TX7'})) == 1
        op.refresh_from_db()
        assert op.status == 'successful'


class TestParentEndpoints:
    def test_the_parent_sees_whether_they_can_pay_and_how_much(self, api_client, family):
        parent, child = family
        api_client.force_authenticate(parent)
        out = api_client.get(f'/imboni/parents/{child.id}/pay/').data
        assert out['enabled'] is True and out['outstanding'] == '100000.00' and out['attempts'] == []

    def test_it_says_off_when_there_are_no_credentials(self, api_client, family, settings):
        parent, child = family
        api_client.force_authenticate(parent)
        settings.MOMO_API_KEY = ''
        assert api_client.get(f'/imboni/parents/{child.id}/pay/').data['enabled'] is False

    def test_starting_and_following_a_payment(self, api_client, family, monkeypatch):
        parent, child = family
        api_client.force_authenticate(parent)
        fake = FakeMomo()
        monkeypatch.setattr(momo, 'MomoClient', lambda: fake)

        started = api_client.post(f'/imboni/parents/{child.id}/pay/', {'amount': '30000', 'phone': '0788123456'}, format='json')
        assert started.status_code == 201 and started.data['status'] == 'pending'

        fake.answer = {'status': 'SUCCESSFUL', 'transaction_id': 'TX5'}
        polled = api_client.get(f"/imboni/parents/{child.id}/pay/{started.data['id']}/")
        assert polled.data['status'] == 'successful' and polled.data['receipt_no']

    def test_a_rule_broken_is_a_400_with_the_reason(self, api_client, family):
        parent, child = family
        api_client.force_authenticate(parent)
        out = api_client.post(f'/imboni/parents/{child.id}/pay/', {'amount': '999999', 'phone': '0788123456'}, format='json')
        assert out.status_code == 400 and 'more than is owed' in out.data['detail']

    def test_a_parent_cannot_pay_for_or_watch_someone_elses_child(self, api_client, family):
        stranger = UserFactory(role='parent')
        _, child = family
        api_client.force_authenticate(stranger)
        assert api_client.get(f'/imboni/parents/{child.id}/pay/').status_code == 404
        assert api_client.post(f'/imboni/parents/{child.id}/pay/', {'amount': '1', 'phone': '0788123456'}, format='json').status_code == 404

    def test_the_bursar_can_see_what_needs_placing(self, api_client, family):
        parent, child = family
        OnlinePayment.objects.create(student=child, paid_by=parent, amount=Decimal('500'), phone='250788123456',
                                     status='needs_review', detail='Nothing is owing.')
        api_client.force_authenticate(UserFactory(role='bursar'))
        rows = api_client.get('/imboni/finance/online-payments/', {'status': 'needs_review'}).data
        assert [r['status'] for r in rows] == ['needs_review'] and rows[0]['student_id'] == child.student_id

    def test_a_teacher_cannot_see_them(self, api_client):
        api_client.force_authenticate(UserFactory(role='teacher'))
        assert api_client.get('/imboni/finance/online-payments/').status_code == 403


class TestResolving:
    def _stuck(self, family):
        parent, child = family
        return OnlinePayment.objects.create(student=child, paid_by=parent, amount=Decimal('500'), phone='250788123456',
                                            status='needs_review', detail='Nothing is owing.')

    def test_the_office_closes_it_with_a_note_and_a_name(self, api_client, family):
        op = self._stuck(family)
        bursar = UserFactory(role='bursar')
        api_client.force_authenticate(bursar)

        out = api_client.post(f'/imboni/finance/online-payments/{op.id}/resolve/', {'note': 'Credited to next term'}, format='json')

        assert out.status_code == 200
        op.refresh_from_db()
        assert op.status == 'successful' and 'Credited to next term' in op.detail and bursar.get_full_name() in op.detail

    def test_a_note_is_required(self, api_client, family):
        op = self._stuck(family)
        api_client.force_authenticate(UserFactory(role='bursar'))
        assert api_client.post(f'/imboni/finance/online-payments/{op.id}/resolve/', {}, format='json').status_code == 400

    def test_only_a_payment_waiting_for_review_can_be_closed(self, api_client, family):
        parent, child = family
        op = OnlinePayment.objects.create(student=child, paid_by=parent, amount=Decimal('500'), phone='250788123456', status='pending')
        api_client.force_authenticate(UserFactory(role='bursar'))
        assert api_client.post(f'/imboni/finance/online-payments/{op.id}/resolve/', {'note': 'x'}, format='json').status_code == 400
