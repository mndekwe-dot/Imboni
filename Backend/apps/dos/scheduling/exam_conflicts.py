"""Clashes between scheduled exams.

The generator never produces these - its solver forbids them - but a paper added
or moved by hand can: the same class sitting two papers at once, one room hosting
two papers, an invigilator in two places, or more candidates than seats.

Everything here is pure: it takes exams that already carry their facts, so the
rules can be tested without a database.
"""
from __future__ import annotations

from collections import defaultdict


def _overlap(a, b):
    return a.exam_date == b.exam_date and a.start_time < b.end_time and b.start_time < a.end_time


def find_conflicts(exams, seats_by_class=None, capacity_by_venue=None):
    """Map each exam id to the list of problems it is part of.

    ``exams`` need ``id, title, exam_date, start_time, end_time, class_id,
    venue, invigilator_id``. ``seats_by_class`` is {class_id: students};
    ``capacity_by_venue`` is {venue name: seats} for venues whose size is known.
    A problem is ``{'type': 'class'|'venue'|'invigilator'|'capacity', 'with': [titles], ...}``.
    """
    seats_by_class = seats_by_class or {}
    capacity_by_venue = capacity_by_venue or {}
    found = defaultdict(list)

    by_day = defaultdict(list)
    for e in exams:
        by_day[e.exam_date].append(e)

    def pair_check(kind, key):
        for day in by_day.values():
            for i, a in enumerate(day):
                for b in day[i + 1:]:
                    ka, kb = key(a), key(b)
                    if ka and ka == kb and _overlap(a, b):
                        found[a.id].append({'type': kind, 'with': [b.title]})
                        found[b.id].append({'type': kind, 'with': [a.title]})

    pair_check('class', lambda e: e.class_id)
    pair_check('venue', lambda e: (e.venue or '').strip().lower())
    pair_check('invigilator', lambda e: e.invigilator_id)

    # Capacity: everyone sitting in one room at overlapping times, against its seats.
    for day in by_day.values():
        for e in day:
            venue = (e.venue or '').strip()
            seats = capacity_by_venue.get(venue)
            if not venue or seats is None:
                continue
            sitting = [o for o in day if (o.venue or '').strip() == venue and (o is e or _overlap(e, o))]
            needed = sum(seats_by_class.get(o.class_id, 0) for o in sitting)
            if needed > seats:
                found[e.id].append({'type': 'capacity', 'needed': needed, 'seats': seats, 'with': []})

    return dict(found)
