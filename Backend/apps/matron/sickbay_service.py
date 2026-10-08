"""Who is in the sick bay on a given day.

A boarder admitted to the sick bay is not in class, but they are not a truant
either. The teacher's register asks this so it can start them as excused with
the reason, the same way it does for a student signed out on an exéat.
"""
from datetime import datetime, time

from django.db.models import Q
from django.utils import timezone

from .models import HealthRecord


def students_in_sick_bay(student_ids, day):
    """The subset of ``student_ids`` admitted to the sick bay at some point on ``day``."""
    tz = timezone.get_current_timezone()
    start = timezone.make_aware(datetime.combine(day, time.min), tz)
    end = timezone.make_aware(datetime.combine(day, time.max), tz)
    still_in = Q(discharged_at__isnull=True, status__in=['in_sick_bay', 'observation'])
    return set(
        HealthRecord.objects
        .filter(student_id__in=student_ids, admitted=True, visit_datetime__lte=end)
        .filter(still_in | Q(discharged_at__gte=start))
        .values_list('student_id', flat=True)
    )
