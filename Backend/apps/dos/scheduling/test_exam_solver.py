"""Unit tests for the pure exam scheduler. No DB / tenant needed."""

import pytest

from apps.dos.scheduling.exam_solver import Exam, SlotMeta, solve_exam_schedule


def _placed_groups_per_slot(exams, result):
    """slot index -> list of groups placed in it (to assert no clashes)."""
    by_slot = {}
    group_of = {e.key: e.group for e in exams}
    for key, slot in result.placements.items():
        by_slot.setdefault(slot, []).append(group_of[key])
    return by_slot


def test_no_two_exams_of_same_class_share_a_slot():
    # 3 subjects for one class -> all must land in different slots.
    exams = [Exam(key=f"c1-s{i}", group="c1") for i in range(3)]
    result = solve_exam_schedule(exams, num_slots=5, slot_capacity=10)

    assert result.is_complete
    slots = [result.placements[e.key] for e in exams]
    assert len(set(slots)) == 3  # all distinct


def test_independent_classes_can_share_a_slot():
    # Two different classes, one exam each, one slot, capacity 2 -> both fit.
    exams = [Exam("c1-math", "c1"), Exam("c2-math", "c2")]
    result = solve_exam_schedule(exams, num_slots=1, slot_capacity=2)

    assert result.is_complete
    assert result.placements["c1-math"] == 0
    assert result.placements["c2-math"] == 0


def test_slot_capacity_is_respected():
    # Three non-conflicting exams, capacity 1 -> they must spread over 3 slots.
    exams = [Exam(f"e{i}", group=f"g{i}") for i in range(3)]
    result = solve_exam_schedule(exams, num_slots=3, slot_capacity=1)

    assert result.is_complete
    by_slot = _placed_groups_per_slot(exams, result)
    assert all(len(v) == 1 for v in by_slot.values())


def test_overflow_is_reported_not_raised():
    # 4 exams for the same class but only 3 slots -> one cannot be placed.
    exams = [Exam(f"c1-s{i}", "c1") for i in range(4)]
    result = solve_exam_schedule(exams, num_slots=3, slot_capacity=5)

    assert not result.is_complete
    assert len(result.unscheduled) == 1
    assert len(result.placements) == 3


def test_capacity_overflow_reports_unscheduled():
    # 3 independent exams, 1 slot, capacity 2 -> exactly one overflows.
    exams = [Exam(f"e{i}", group=f"g{i}") for i in range(3)]
    result = solve_exam_schedule(exams, num_slots=1, slot_capacity=2)

    assert len(result.placements) == 2
    assert len(result.unscheduled) == 1


def test_deterministic_across_runs():
    exams = [Exam(f"c{c}-s{s}", f"c{c}") for c in range(3) for s in range(3)]
    r1 = solve_exam_schedule(exams, num_slots=6, slot_capacity=2)
    r2 = solve_exam_schedule(exams, num_slots=6, slot_capacity=2)
    assert r1.placements == r2.placements
    assert r1.unscheduled == r2.unscheduled


def test_empty_input():
    result = solve_exam_schedule([], num_slots=5, slot_capacity=2)
    assert result.placements == {}
    assert result.is_complete


def test_groupless_exams_never_conflict():
    # No group => no edges => all can share a single slot up to capacity.
    exams = [Exam(f"e{i}", group=None) for i in range(3)]
    result = solve_exam_schedule(exams, num_slots=1, slot_capacity=3)
    assert result.is_complete
    assert set(result.placements.values()) == {0}


def test_rejects_duplicate_keys():
    with pytest.raises(ValueError):
        solve_exam_schedule([Exam("dup", "a"), Exam("dup", "b")], 3, 1)


def test_rejects_bad_capacity():
    with pytest.raises(ValueError):
        solve_exam_schedule([Exam("e", "g")], num_slots=3, slot_capacity=0)


# ── weights ──────────────────────────────────────────────────────────────────

def test_heavy_exam_survives_when_window_is_tight():
    # 4 same-class exams, only 3 slots: the LIGHTEST must be the one dropped.
    exams = [
        Exam("math", "c1", weight=10),
        Exam("eng",  "c1", weight=7),
        Exam("phy",  "c1", weight=6),
        Exam("art",  "c1", weight=1),
    ]
    result = solve_exam_schedule(exams, num_slots=3, slot_capacity=5)

    assert result.unscheduled == ["art"]
    assert "math" in result.placements


def test_heavy_exam_prefers_morning_slot():
    # Two slots on one day (pos 0 = morning, pos 1 = afternoon), two exams of
    # different classes: the heavy one must take the morning.
    meta = [SlotMeta(day=0, pos=0), SlotMeta(day=0, pos=1)]
    exams = [Exam("art", "c1", weight=1), Exam("math", "c2", weight=10)]
    result = solve_exam_schedule(exams, num_slots=2, slot_capacity=1, slot_meta=meta)

    assert result.is_complete
    assert result.placements["math"] == 0   # morning
    assert result.placements["art"] == 1


def test_heavy_exams_of_same_class_get_a_rest_gap():
    # One slot per day over 3 days; two heavy exams for the same class should
    # land on days 0 and 2 (skipping the adjacent day), not back-to-back.
    meta = [SlotMeta(day=d, pos=0) for d in range(3)]
    exams = [Exam("math", "c1", weight=10), Exam("phy", "c1", weight=10)]
    result = solve_exam_schedule(exams, num_slots=3, slot_capacity=1, slot_meta=meta)

    assert result.is_complete
    days = sorted(meta[s].day for s in result.placements.values())
    assert days == [0, 2]


def test_light_exams_still_pack_tightly():
    # Weight-1 exams: the gap penalty is small but nonzero, yet with only two
    # days available they must still both be placed (constraints beat prefs).
    meta = [SlotMeta(day=d, pos=0) for d in range(2)]
    exams = [Exam("a", "c1", weight=1), Exam("b", "c1", weight=1)]
    result = solve_exam_schedule(exams, num_slots=2, slot_capacity=1, slot_meta=meta)

    assert result.is_complete   # adjacent days accepted when there's no choice


def test_slot_meta_length_validated():
    with pytest.raises(ValueError):
        solve_exam_schedule([Exam("e", "g")], num_slots=2, slot_capacity=1,
                            slot_meta=[SlotMeta(0, 0)])


def test_weighted_still_deterministic():
    meta = [SlotMeta(day=d, pos=p) for d in range(4) for p in range(2)]
    exams = [Exam(f"c{c}-s{s}", f"c{c}", weight=(s % 3) * 4 + 1)
             for c in range(3) for s in range(3)]
    r1 = solve_exam_schedule(exams, 8, 2, slot_meta=meta)
    r2 = solve_exam_schedule(exams, 8, 2, slot_meta=meta)
    assert r1.placements == r2.placements
    assert r1.unscheduled == r2.unscheduled


def test_larger_instance_is_conflict_free():
    # 5 classes x 6 subjects, 2 concurrent venues.
    exams = [Exam(f"c{c}-s{s}", f"c{c}") for c in range(5) for s in range(6)]
    result = solve_exam_schedule(exams, num_slots=20, slot_capacity=2)

    assert result.is_complete
    # Assert the hard constraint directly: no class twice in one slot.
    seen = set()
    for e in exams:
        slot = result.placements[e.key]
        assert (e.group, slot) not in seen
        seen.add((e.group, slot))
