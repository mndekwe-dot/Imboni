"""
The library against how a school library desk actually runs.

Who may borrow, what losing a book costs, and where fine money goes.
"""
from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from apps.authentication.factories import UserFactory
from apps.library import services
from apps.library.models import CopyEvent, Fine, LibrarySettings
from apps.library.tests import make_book

pytestmark = pytest.mark.django_db


class TestWhoMayBorrow:
    def test_a_parent_is_not_a_borrower(self):
        with pytest.raises(services.LibraryError, match='not a library borrower'):
            services.issue(make_book().copies.first(), UserFactory(role='parent'))

    def test_a_pupil_who_has_left_cannot_borrow(self):
        with pytest.raises(services.LibraryError, match='no longer has an active account'):
            services.issue(make_book().copies.first(),
                           UserFactory(role='student', is_active=False))

    def test_an_unpaid_fine_has_to_be_settled_first(self):
        pupil = UserFactory(role='student')
        old = services.issue(make_book('Old').copies.first(), pupil)
        services.return_loan(old)
        Fine.objects.create(loan=old, days_late=2, rate=Decimal('50'), amount=Decimal('100'))

        with pytest.raises(services.LibraryError, match='library fines'):
            services.issue(make_book('New').copies.first(), pupil)

    def test_a_waived_fine_does_not_block(self):
        pupil = UserFactory(role='student')
        old = services.issue(make_book('Old').copies.first(), pupil)
        services.return_loan(old)
        fine = Fine.objects.create(loan=old, days_late=2, rate=Decimal('50'),
                                   amount=Decimal('100'))
        services.waive_fine(fine, reason='First time, apologised.')

        assert services.issue(make_book('New').copies.first(), pupil)


class TestLosingABook:
    def test_the_borrower_is_charged_the_replacement_and_the_lateness(self):
        settings_row = LibrarySettings.load()
        settings_row.fine_per_day = Decimal('50')
        settings_row.save()
        book = make_book()
        copy = book.copies.first()
        copy.price = Decimal('6000')
        copy.save()
        pupil = UserFactory(role='student')
        loan = services.issue(copy, pupil)
        loan.due_on = timezone.localdate() - timedelta(days=4)
        loan.save(update_fields=['due_on'])

        event = services.record_copy_event(copy, 'lost', reason='Left on the bus.')

        fine = Fine.objects.get(loan=loan)
        assert fine.kind == 'lost'
        assert fine.amount == Decimal('6200.00')
        assert event.borrower == pupil
        assert event.charged == Decimal('6200.00')
        loan.refresh_from_db()
        assert loan.returned_at is not None
        assert 'lost' in loan.notes.lower()

    def test_a_charge_the_librarian_names_replaces_the_list_price(self):
        copy = make_book().copies.first()
        copy.price = Decimal('6000')
        copy.save()
        loan = services.issue(copy, UserFactory(role='student'))

        services.record_copy_event(copy, 'lost', charged='3500')

        assert Fine.objects.get(loan=loan).amount == Decimal('3500.00')

    def test_a_book_lost_off_the_shelf_charges_nobody(self):
        copy = make_book().copies.first()

        services.record_copy_event(copy, 'lost', reason='Missing at stocktake.')

        assert not Fine.objects.exists()
        assert CopyEvent.objects.get().borrower is None


class TestFineMoney:
    def _fine(self):
        loan = services.issue(make_book().copies.first(), UserFactory(role='student'))
        services.return_loan(loan)
        return Fine.objects.create(loan=loan, days_late=3, rate=Decimal('100'),
                                   amount=Decimal('300'))

    def test_a_paid_fine_is_income_in_the_finance_office(self):
        from apps.finance.models import CashAccount, OtherIncome
        from apps.finance.services import account_balance

        safe = CashAccount.objects.create(name='Safe', kind='cash', is_default=True)
        fine = self._fine()

        services.pay_fine(fine, received_by=UserFactory(role='librarian'))

        fine.refresh_from_db()
        assert fine.paid is True
        income = OtherIncome.objects.get(pk=fine.income_id)
        assert income.category.name == 'Library fines'
        assert income.amount == Decimal('300.00')
        assert account_balance(safe) == Decimal('300.00')

    def test_a_fine_cannot_be_paid_twice(self):
        fine = self._fine()
        services.pay_fine(fine)

        with pytest.raises(services.LibraryError, match='already settled'):
            services.pay_fine(fine)

    def test_waiving_needs_a_reason(self):
        with pytest.raises(services.LibraryError, match='why'):
            services.waive_fine(self._fine(), reason='  ')

    def test_the_borrower_history_page_answers(self, make_authenticated_client):
        client, _ = make_authenticated_client('librarian')
        pupil = UserFactory(role='student')
        services.issue(make_book().copies.first(), pupil)

        response = client.get(f'/imboni/library/borrowers/{pupil.id}/')

        assert response.status_code == 200
        assert response.data['owed'] == '0'


class TestALostBookTurnsUp:
    def _lost(self, *, days_late=0, price='6000', rate='50'):
        settings_row = LibrarySettings.load()
        settings_row.fine_per_day = Decimal(rate)
        settings_row.save()
        copy = make_book().copies.first()
        copy.price = Decimal(price)
        copy.save()
        pupil = UserFactory(role='student')
        loan = services.issue(copy, pupil)
        loan.due_on = timezone.localdate() - timedelta(days=days_late)
        loan.save(update_fields=['due_on'])
        services.record_copy_event(copy, 'lost')
        copy.refresh_from_db()
        return copy, pupil, Fine.objects.get(loan=loan)

    def test_an_unpaid_charge_drops_to_the_lateness(self):
        copy, _, fine = self._lost(days_late=4)

        event = services.record_copy_event(copy, 'found')

        fine.refresh_from_db()
        assert fine.kind == 'late'
        assert fine.amount == Decimal('200.00')
        assert 'cancelled' in event.reason
        copy.refresh_from_db()
        assert copy.status == 'available'

    def test_an_unpaid_charge_with_no_lateness_goes(self):
        copy, _, _ = self._lost()

        services.record_copy_event(copy, 'found')

        assert not Fine.objects.exists()

    def test_a_paid_charge_is_refunded_from_the_finance_office(self):
        from apps.finance.models import CashAccount, OtherIncome
        from apps.finance.services import account_balance

        safe = CashAccount.objects.create(name='Safe', kind='cash', is_default=True)
        copy, pupil, fine = self._lost(days_late=2)
        services.pay_fine(fine)
        assert account_balance(safe) == Decimal('6100.00')

        event = services.record_copy_event(copy, 'found')

        fine.refresh_from_db()
        assert fine.refunded == Decimal('6000.00')
        assert event.borrower == pupil
        refund = OtherIncome.objects.get(refund_of_id=fine.income_id)
        assert refund.amount == Decimal('-6000.00')
        # The lateness stays with the school; the price goes back.
        assert account_balance(safe) == Decimal('100.00')

    def test_finding_it_twice_does_not_refund_twice(self):
        from apps.finance.models import CashAccount, OtherIncome

        CashAccount.objects.create(name='Safe', kind='cash', is_default=True)
        copy, _, fine = self._lost()
        services.pay_fine(fine)
        services.record_copy_event(copy, 'found')
        services.record_copy_event(copy, 'lost')
        services.record_copy_event(copy, 'found')

        assert OtherIncome.objects.filter(refund_of__isnull=False).count() == 1

    def test_the_charge_stands_when_the_replacement_was_already_bought(self):
        copy, _, fine = self._lost()

        services.record_copy_event(copy, 'found', settle_charge=False)

        fine.refresh_from_db()
        assert fine.kind == 'lost' and fine.amount == Decimal('6000.00')

    def test_the_missing_list_says_what_the_borrower_was_charged(self, make_authenticated_client):
        client, _ = make_authenticated_client('librarian')
        self._lost(days_late=2)

        rows = client.get('/imboni/library/lost-damaged/').data

        charge = rows[0]['lost_charge']
        assert charge['amount'] == '6100.00'
        assert charge['replacement'] == '6000.00'
        assert charge['paid'] is False


class TestExportsAnswer:
    """Every Print and Export button 404'd: DRF claimed `?format=` for itself."""

    @pytest.mark.parametrize('path, fmt, kind', [
        ('overdue/', 'csv', 'text/csv'),
        ('overdue/', 'pdf', 'application/pdf'),
        ('usage/', 'csv', 'text/csv'),
        ('usage/', 'pdf', 'application/pdf'),
        ('lost-damaged/', 'csv', 'text/csv'),
    ])
    def test_the_list_downloads(self, make_authenticated_client, path, fmt, kind):
        client, _ = make_authenticated_client('librarian')

        response = client.get(f'/imboni/library/{path}?format={fmt}')

        assert response.status_code == 200
        assert response['Content-Type'].startswith(kind)
