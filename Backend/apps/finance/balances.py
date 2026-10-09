"""
What each student owes, for many students at once.

`services.student_balance` answers for one student and walks their fees. A list
(a class's clearance, the awaiting-deposit queue) needs the same answer for
dozens, and asking per student is how a page ends up running hundreds of
queries. This is the same arithmetic in two grouped queries.

Same definition as the rest of finance: what was charged, less every payment
that has not been reversed (waivers and amounts carried forward are payments
here too, because they settle a bill), never below zero.
"""
from decimal import Decimal

from django.db.models import Sum

ZERO = Decimal('0')


def balances_for(student_ids):
    """{student_id: {'charged', 'paid', 'owed'}} for every id given."""
    from apps.student.models import Fee
    from .models import FeePayment

    ids = list(student_ids)
    charged = {
        r['student_id']: r['t'] or ZERO
        for r in Fee.objects.filter(student_id__in=ids).order_by()
        .values('student_id').annotate(t=Sum('amount'))
    }
    paid = {
        r['fee__student_id']: r['t'] or ZERO
        for r in FeePayment.objects
        .filter(fee__student_id__in=ids, reversed_at__isnull=True).order_by()
        .values('fee__student_id').annotate(t=Sum('amount'))
    }
    out = {}
    for sid in ids:
        c, p = charged.get(sid, ZERO), paid.get(sid, ZERO)
        out[sid] = {'charged': c, 'paid': p, 'owed': max(c - p, ZERO)}
    return out
