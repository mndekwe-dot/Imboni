"""
Is this student free to leave?

At the end of term a boarding student cannot simply walk out. They have to have
paid, returned their library books, and be out of the sick bay with no medicine
still held for them. Each of those lives in a different portal, so the person at
the gate had no way to know except by asking four offices, or by paper chits.

This puts the four answers in one place. It answers a whole class in a fixed
number of queries (never one per student), because the usual question is "who in
S4A can leave?", not "can Amina?".

A check is cleared when the student owes that office nothing. The reasons are
returned with the verdict, so the family is told what to bring back or pay
instead of being sent away with a bare "no".
"""
from collections import defaultdict
from decimal import Decimal

from django.db.models import Count, Sum
from django.utils import timezone

ZERO = Decimal('0')


def clearance_for(students, day=None):
    """
    {student.id: {...}} for the given students (each with .user loaded).

    Per student:
      finance   {'cleared', 'owed'}                    fees charged less fees paid
      library   {'cleared', 'books_out', 'owed'}       open loans, unpaid fines
      medical   {'cleared', 'in_sick_bay', 'medication'}  in the sick bay now,
                                                       or medicine still held
      cleared   all three
      away      signed out on an exeat today (information, not a blocker)
    """
    students = list(students)
    if not students:
        return {}

    from apps.finance.balances import balances_for
    from apps.library.models import Fine, Loan
    from apps.matron.models import MedicationSchedule
    from apps.matron.sickbay_service import students_in_sick_bay
    from apps.discipline.exeat_service import students_away

    day = day or timezone.localdate()
    ids = [s.id for s in students]
    user_ids = [s.user_id for s in students if s.user_id]

    # ── finance: the same definition of "owed" the bursar uses ─────────────
    owed_by = balances_for(ids)

    # ── library: books still out, fines still owed ──────────────────────────
    books_out = {
        r['borrower_id']: r['n']
        for r in Loan.objects.filter(borrower_id__in=user_ids, returned_at__isnull=True).order_by()
        .values('borrower_id').annotate(n=Count('id'))
    }
    fines_owed = {
        r['loan__borrower_id']: r['t'] or ZERO
        for r in Fine.objects.filter(loan__borrower_id__in=user_ids, paid=False, waived=False).order_by()
        .values('loan__borrower_id').annotate(t=Sum('amount'))
    }

    # ── matron: in the sick bay today, or medicine still on the books ───────
    in_bay = students_in_sick_bay(ids, day)
    medication = defaultdict(list)
    for m in MedicationSchedule.objects.filter(student_id__in=ids, is_active=True):
        if m.end_date is None or m.end_date >= day:
            medication[m.student_id].append(m.medicine_name)

    away = students_away(ids, day)

    out = {}
    for s in students:
        owed = owed_by[s.id]['owed']
        lib_owed = fines_owed.get(s.user_id, ZERO)
        n_books = books_out.get(s.user_id, 0)
        meds = sorted(medication.get(s.id, []))
        bay = s.id in in_bay

        finance = {'cleared': owed == ZERO, 'owed': owed}
        library = {'cleared': n_books == 0 and lib_owed == ZERO, 'books_out': n_books, 'owed': lib_owed}
        medical = {'cleared': not bay and not meds, 'in_sick_bay': bay, 'medication': meds}
        out[s.id] = {
            'finance': finance,
            'library': library,
            'medical': medical,
            'cleared': finance['cleared'] and library['cleared'] and medical['cleared'],
            'away': s.id in away,
        }
    return out
