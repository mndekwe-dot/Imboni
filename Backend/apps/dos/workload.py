"""How loaded a teacher is, measured against the week the school actually has.

There is no national periods-per-week figure to hard-code: a school's week is
its bell schedule times its school days. A full-time teacher is measured against
all of that; a part-time teacher against half. The numbers are deliberately
simple so a DOS can reason about them: "22 of 40 periods".
"""
from collections import defaultdict

PART_TIME_SHARE = 0.5
HEAVY_AT = 0.9          # share of capacity at which a load is called heavy
SCHOOL_DAYS = 5


def weekly_capacity(slots_per_day, employment_type):
    """Periods a teacher could be asked to take in a week."""
    share = PART_TIME_SHARE if employment_type == 'part_time' else 1.0
    return int(round(slots_per_day * SCHOOL_DAYS * share))


def load_level(periods, capacity):
    """'none' | 'light' | 'normal' | 'heavy' | 'over', or 'unknown' without a capacity."""
    if not capacity:
        return 'unknown'
    if periods == 0:
        return 'none'
    ratio = periods / capacity
    if ratio > 1:
        return 'over'
    if ratio >= HEAVY_AT:
        return 'heavy'
    if ratio < 0.25:
        return 'light'
    return 'normal'


def double_bookings(entries):
    """Count lessons a teacher is timetabled for while already in another.

    ``entries`` are (teacher_id, day, start_time, end_time, class_id). Two
    lessons for the same class at the same time are one lesson taught to a
    merged group, not a clash.
    """
    by_slot = defaultdict(list)
    for teacher_id, day, start, end, class_id in entries:
        by_slot[(teacher_id, day)].append((start, end, class_id))

    clashes = defaultdict(int)
    for (teacher_id, _day), lessons in by_slot.items():
        for i, (s1, e1, c1) in enumerate(lessons):
            for s2, e2, c2 in lessons[i + 1:]:
                if c1 != c2 and s1 < e2 and s2 < e1:
                    clashes[teacher_id] += 1
    return dict(clashes)
