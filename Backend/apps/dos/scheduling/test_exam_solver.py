"""Unit tests for the pure exam scheduler. No DB / tenant needed."""

import pytest

from apps.dos.scheduling.exam_solver import Exam, solve_exam_schedule


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
