"""Unit tests for the pure timetable CSP solver. No DB needed."""

import pytest

from apps.dos.scheduling.timetable_solver import Lesson, solve_timetable


def _grid(days, periods):
    """num_slots + slot_days for `days` school days x `periods` per day."""
    slot_days = [d for d in range(days) for _ in range(periods)]
    return len(slot_days), slot_days


def _no_double_booking(lessons, result, attr):
    """Assert no two placed lessons share `attr` in the same slot."""
    by_slot = {}
    val = {l.key: getattr(l, attr) for l in lessons}
    for key, slot in result.placements.items():
        by_slot.setdefault(slot, []).append(val[key])
    for group in by_slot.values():
        assert len(group) == len(set(group)), f"{attr} double-booked in a slot"


def test_places_all_lessons_for_a_feasible_instance():
    n, days = _grid(5, 6)  # 30 slots
    lessons = [Lesson(f"c1-math-{i}", "c1", "t1", "math") for i in range(4)]
    lessons += [Lesson(f"c1-eng-{i}", "c1", "t2", "eng") for i in range(3)]
    result = solve_timetable(lessons, n, days, slot_capacity=10)

    assert result.is_complete
    assert len(result.placements) == 7


def test_no_class_or_teacher_double_booking():
    n, days = _grid(5, 6)
    # Two classes share teacher t1 for maths -> t1 can't be in two places at once.
    lessons = [Lesson(f"c1-m-{i}", "c1", "t1", "math") for i in range(3)]
    lessons += [Lesson(f"c2-m-{i}", "c2", "t1", "math") for i in range(3)]
    result = solve_timetable(lessons, n, days, slot_capacity=10)

    assert result.is_complete
    _no_double_booking(lessons, result, "class_id")
    _no_double_booking(lessons, result, "teacher_id")


def test_capacity_limits_concurrent_lessons():
    # 3 independent classes, 1 period/day for 1 day -> capacity 2 leaves one out.
    n, days = _grid(1, 1)  # a single slot
    lessons = [Lesson(f"c{i}", f"c{i}", f"t{i}", "x") for i in range(3)]
    result = solve_timetable(lessons, n, days, slot_capacity=2)

    assert len(result.placements) == 2
    assert len(result.unscheduled) == 1


def test_infeasible_overflow_is_reported():
    # One class needs 5 maths lessons but only 3 slots exist.
    n, days = _grid(1, 3)
    lessons = [Lesson(f"c1-m-{i}", "c1", "t1", "math") for i in range(5)]
    result = solve_timetable(lessons, n, days, slot_capacity=5)

    assert not result.is_complete
    assert len(result.placements) == 3
    assert len(result.unscheduled) == 2


def test_soft_spread_prefers_distinct_days():
    # 3 maths lessons for one class, 5 days x 2 periods, plenty of room.
    # The soft preference should put them on 3 different days.
    n, days = _grid(5, 2)
    lessons = [Lesson(f"c1-m-{i}", "c1", "t1", "math") for i in range(3)]
    result = solve_timetable(lessons, n, days, slot_capacity=5)

    assert result.is_complete
    used_days = {days[slot] for slot in result.placements.values()}
    assert len(used_days) == 3


def test_deterministic():
    n, days = _grid(5, 6)
    lessons = [Lesson(f"c{c}-s{s}-{i}", f"c{c}", f"t{s}", f"s{s}")
               for c in range(3) for s in range(4) for i in range(3)]
    r1 = solve_timetable(lessons, n, days, slot_capacity=3)
    r2 = solve_timetable(lessons, n, days, slot_capacity=3)
    assert r1.placements == r2.placements
    assert r1.unscheduled == r2.unscheduled


def test_empty_input_is_complete():
    n, days = _grid(5, 6)
    result = solve_timetable([], n, days, slot_capacity=3)
    assert result.is_complete
    assert result.placements == {}


def test_realistic_instance_solves_conflict_free():
    # 4 classes, each 6 subjects, ~4 periods each = ~96 lessons, distinct
    # teacher per (class-band, subject). 5 days x 7 periods = 35 slots, 6 rooms.
    n, days = _grid(5, 7)
    lessons = []
    for c in range(4):
        for s in range(6):
            for i in range(4):
                lessons.append(Lesson(f"c{c}-s{s}-{i}", f"c{c}", f"t{c%2}-{s}", f"s{s}"))
    result = solve_timetable(lessons, n, days, slot_capacity=6)

    assert result.is_complete, f"left {len(result.unscheduled)} unplaced"
    _no_double_booking(lessons, result, "class_id")
    _no_double_booking(lessons, result, "teacher_id")


def test_rejects_duplicate_keys():
    n, days = _grid(2, 2)
    with pytest.raises(ValueError):
        solve_timetable([Lesson("dup", "c1", "t1"), Lesson("dup", "c2", "t2")], n, days, 1)


def test_rejects_mismatched_slot_days():
    with pytest.raises(ValueError):
        solve_timetable([Lesson("a", "c1", "t1")], num_slots=4, slot_days=[0, 0], slot_capacity=1)
