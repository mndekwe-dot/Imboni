"""The sick bay's cupboard: what is low, what is about to expire, and moving stock.

The status rules are pure so they can be tested without a database. "Out" and
"expired" outrank "low" and "expiring": a nurse scanning the list should see the
worst problem with each item first.
"""
from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from .models import PharmacyItem, PharmacyMovement

EXPIRY_WARNING_DAYS = 60


class PharmacyError(Exception):
    """A rule was broken; the message is shown to the nurse as-is."""


def status_of(quantity, reorder_level, expiry_date, today=None):
    """One word for the worst problem an item has: expired, out, low, expiring or ok."""
    today = today or timezone.localdate()
    if expiry_date and expiry_date < today:
        return 'expired'
    if quantity <= 0:
        return 'out'
    if reorder_level and quantity <= reorder_level:
        return 'low'
    if expiry_date and expiry_date <= today + timedelta(days=EXPIRY_WARNING_DAYS):
        return 'expiring'
    return 'ok'


@transaction.atomic
def move(item, change, reason, *, by=None, note='', student=None):
    """
    Add to or take from stock, and write it in the logbook.

    Stock cannot go below zero: a dispense that would is refused, because the
    count is wrong somewhere and silently clamping it hides where. The
    stock-take correction is the honest way to fix a wrong count.
    """
    if not change:
        raise PharmacyError('Say how many.')
    if reason in ('dispensed', 'expired') and change > 0:
        change = -change
    if reason == 'received' and change < 0:
        raise PharmacyError('Received stock cannot be negative.')
    item = PharmacyItem.objects.select_for_update().get(pk=item.pk)
    if item.quantity + change < 0:
        raise PharmacyError(f'Only {item.quantity} {item.unit} of {item.name} in stock.')
    item.quantity += change
    item.save(update_fields=['quantity'])
    return PharmacyMovement.objects.create(item=item, change=change, reason=reason, note=note[:255],
                                           student=student, by=by)
