"""Who is away on an exéat on a given day.

Teachers mark a register from the classroom, where "not here" looks the same
whether a student is truanting or signed out at the gate with a parent's
permission. This answers the second case so the register can say so.
"""
from datetime import datetime, time

from django.utils import timezone

from .models import ExeatPass


def students_away(student_ids, day):
    """The subset of ``student_ids`` signed out on ``day`` (passes that were actually used)."""
    tz = timezone.get_current_timezone()
    start = timezone.make_aware(datetime.combine(day, time.min), tz)
    end = timezone.make_aware(datetime.combine(day, time.max), tz)
    away = set()
    for p in ExeatPass.objects.filter(
        student_id__in=student_ids, status__in=['out', 'returned'], departure_at__lte=end,
    ):
        back = p.actual_return_at or p.expected_return_at
        if back >= start:
            away.add(p.student_id)
    return away
