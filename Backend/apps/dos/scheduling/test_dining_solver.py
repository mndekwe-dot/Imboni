"""Unit tests for the pure dining-sitting solver. No DB needed."""

import pytest

from apps.dos.scheduling.dining_solver import DiningGroup, Sitting, solve_dining_plan


def _sittings(n, capacity, meal="lunch"):
    return [Sitting(key=f"s{i}", capacity=capacity, meal=meal) for i in range(n)]


def test_seats_every_group_when_capacity_is_ample():
    groups = [DiningGroup(f"c{i}", 30) for i in range(4)]
    result = solve_dining_plan(groups, _sittings(2, 200))

    assert result.is_complete
    assert len(result.assignments) == 4


def test_capacity_is_never_exceeded():
    groups = [DiningGroup(f"c{i}", 40) for i in range(5)]
    sittings = _sittings(3, 100)
    result = solve_dining_plan(groups, sittings)

    for s in sittings:
        assert result.occupancy[s.key] <= s.capacity


def test_load_is_spread_evenly():
    # 6 equal classes over 3 sittings with room to spare -> 2 each.
    groups = [DiningGroup(f"c{i}", 30) for i in range(6)]
    sittings = _sittings(3, 200)
    result = solve_dining_plan(groups, sittings)

    assert result.is_complete
    assert result.spread_for([s.key for s in sittings]) == 0


def test_largest_group_is_placed_first_so_it_still_fits():
    # Total demand equals total capacity exactly: only a decreasing-order pack
    # succeeds. Ascending order would strand the 100-seat class.
    groups = [DiningGroup("small-a", 10), DiningGroup("small-b", 10),
              DiningGroup("big", 100)]
    sittings = [Sitting("s0", 100), Sitting("s1", 20)]
    result = solve_dining_plan(groups, sittings)

    assert result.is_complete
    assert result.assignments["big"] == "s0"


def test_group_too_large_for_any_sitting_is_reported():
    groups = [DiningGroup("huge", 500)]
    result = solve_dining_plan(groups, _sittings(2, 100))

    assert not result.is_complete
    key, reason = result.unassigned[0]
    assert key == "huge"
    assert "exceeds every" in reason


def test_overflow_when_capacity_runs_out_is_reported():
    groups = [DiningGroup(f"c{i}", 60) for i in range(3)]   # 180 needed
    result = solve_dining_plan(groups, _sittings(2, 60))    # 120 available

    assert len(result.assignments) == 2
    assert len(result.unassigned) == 1
    assert "seats left" in result.unassigned[0][1]


def test_meals_are_kept_separate():
    groups = [DiningGroup("c1", 20, meal="breakfast"), DiningGroup("c2", 20, meal="lunch")]
    sittings = [Sitting("b0", 100, meal="breakfast"), Sitting("l0", 100, meal="lunch")]
    result = solve_dining_plan(groups, sittings)

    assert result.assignments["c1"] == "b0"
    assert result.assignments["c2"] == "l0"


def test_group_with_no_sitting_for_its_meal_is_reported():
    groups = [DiningGroup("c1", 20, meal="supper")]
    result = solve_dining_plan(groups, _sittings(1, 100, meal="lunch"))

    assert not result.is_complete
    assert "no sittings configured" in result.unassigned[0][1]


def test_empty_inputs():
    assert solve_dining_plan([], _sittings(2, 100)).is_complete
    result = solve_dining_plan([DiningGroup("c1", 10)], [])
    assert not result.is_complete


def test_deterministic():
    groups = [DiningGroup(f"c{i}", 20 + (i % 4) * 10) for i in range(9)]
    sittings = _sittings(3, 120)
    r1 = solve_dining_plan(groups, sittings)
    r2 = solve_dining_plan(groups, sittings)
    assert r1.assignments == r2.assignments
    assert r1.unassigned == r2.unassigned


def test_rejects_duplicate_keys():
    with pytest.raises(ValueError):
        solve_dining_plan([DiningGroup("c1", 10), DiningGroup("c1", 10)], _sittings(1, 100))
    with pytest.raises(ValueError):
        solve_dining_plan([DiningGroup("c1", 10)], [Sitting("s", 10), Sitting("s", 10)])


def test_rejects_negative_size():
    with pytest.raises(ValueError):
        solve_dining_plan([DiningGroup("c1", -5)], _sittings(1, 100))
