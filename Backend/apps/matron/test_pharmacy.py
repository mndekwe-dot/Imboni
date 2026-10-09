"""The sick bay's cupboard: stock that cannot silently go wrong."""
from datetime import timedelta

import pytest
from django.utils import timezone

from apps.authentication.factories import StudentFactory
from apps.matron import pharmacy
from apps.matron.models import PharmacyItem, PharmacyMovement

TODAY = timezone.localdate()


class TestStatus:
    def test_the_worst_problem_wins(self):
        assert pharmacy.status_of(50, 10, TODAY - timedelta(days=1)) == 'expired'   # plenty, but out of date
        assert pharmacy.status_of(0, 10, None) == 'out'
        assert pharmacy.status_of(5, 10, None) == 'low'
        assert pharmacy.status_of(5, 10, TODAY + timedelta(days=5)) == 'low'        # low outranks expiring
        assert pharmacy.status_of(50, 10, TODAY + timedelta(days=30)) == 'expiring'
        assert pharmacy.status_of(50, 10, TODAY + timedelta(days=400)) == 'ok'
        assert pharmacy.status_of(1, 0, None) == 'ok'                                # no reorder level set

    def test_exactly_at_the_reorder_level_is_low(self):
        assert pharmacy.status_of(10, 10, None) == 'low'

    def test_an_item_that_expires_today_is_still_usable_today(self):
        assert pharmacy.status_of(50, 10, TODAY) == 'expiring'


@pytest.mark.django_db
class TestStock:
    URL = '/imboni/matron/pharmacy/'

    def test_an_item_is_added_with_opening_stock_and_it_is_logged(self, make_authenticated_client):
        client, _ = make_authenticated_client('matron')
        out = client.post(self.URL, {'name': 'Paracetamol', 'unit': 'tablets', 'quantity': 200,
                                     'reorder_level': 50}, format='json')
        assert out.status_code == 201 and out.data['quantity'] == 200 and out.data['status'] == 'ok'
        assert PharmacyMovement.objects.get().reason == 'received'

    def test_quantity_cannot_be_typed_over_only_moved(self, make_authenticated_client):
        client, _ = make_authenticated_client('matron')
        item = PharmacyItem.objects.create(name='ORS', quantity=10)
        client.patch(f'{self.URL}{item.id}/', {'quantity': 999, 'reorder_level': 4}, format='json')
        item.refresh_from_db()
        assert item.quantity == 10 and item.reorder_level == 4

    def test_dispensing_reduces_stock_and_names_the_student(self, make_authenticated_client):
        client, nurse = make_authenticated_client('matron')
        item = PharmacyItem.objects.create(name='ORS', quantity=10)
        student = StudentFactory()

        out = client.post(f'{self.URL}{item.id}/move/', {'change': 2, 'reason': 'dispensed',
                                                         'student': str(student.id)}, format='json')

        assert out.status_code == 200 and out.data['quantity'] == 8        # "2" is taken as out, not in
        move = PharmacyMovement.objects.get()
        assert move.change == -2 and move.student == student and move.by == nurse

    def test_stock_cannot_go_below_zero(self, make_authenticated_client):
        client, _ = make_authenticated_client('matron')
        item = PharmacyItem.objects.create(name='ORS', quantity=1)
        out = client.post(f'{self.URL}{item.id}/move/', {'change': 5, 'reason': 'dispensed'}, format='json')
        assert out.status_code == 400 and 'Only 1' in out.data['detail']
        item.refresh_from_db()
        assert item.quantity == 1 and not PharmacyMovement.objects.exists()

    def test_a_correction_can_go_either_way(self, make_authenticated_client):
        client, _ = make_authenticated_client('matron')
        item = PharmacyItem.objects.create(name='Bandages', quantity=10)
        client.post(f'{self.URL}{item.id}/move/', {'change': -3, 'reason': 'correction'}, format='json')
        client.post(f'{self.URL}{item.id}/move/', {'change': 1, 'reason': 'correction'}, format='json')
        item.refresh_from_db()
        assert item.quantity == 8

    def test_the_list_puts_the_worst_first(self, make_authenticated_client):
        client, _ = make_authenticated_client('matron')
        PharmacyItem.objects.create(name='A fine', quantity=100, reorder_level=10)
        PharmacyItem.objects.create(name='B out', quantity=0, reorder_level=10)
        PharmacyItem.objects.create(name='C old', quantity=100, expiry_date=TODAY - timedelta(days=3))
        names = [r['name'] for r in client.get(self.URL).data]
        assert names == ['C old', 'B out', 'A fine']

    def test_the_logbook_shows_who_and_why(self, make_authenticated_client):
        client, nurse = make_authenticated_client('matron')
        item = PharmacyItem.objects.create(name='ORS', quantity=10)
        client.post(f'{self.URL}{item.id}/move/', {'change': 4, 'reason': 'received', 'note': 'Delivery'}, format='json')
        rows = client.get(f'{self.URL}{item.id}/history/').data
        assert rows[0]['reason'] == 'received' and rows[0]['by_name'] == nurse.get_full_name() and rows[0]['note'] == 'Delivery'

    def test_bad_input_is_refused(self, make_authenticated_client):
        client, _ = make_authenticated_client('matron')
        item = PharmacyItem.objects.create(name='ORS', quantity=10)
        assert client.post(f'{self.URL}{item.id}/move/', {'change': 'lots', 'reason': 'received'}, format='json').status_code == 400
        assert client.post(f'{self.URL}{item.id}/move/', {'change': 1, 'reason': 'gift'}, format='json').status_code == 400
        assert client.post(f'{self.URL}{item.id}/move/', {'change': 0, 'reason': 'received'}, format='json').status_code == 400

    def test_only_the_matron_can_use_it(self, make_authenticated_client):
        client, _ = make_authenticated_client('teacher')
        assert client.get(self.URL).status_code == 403
