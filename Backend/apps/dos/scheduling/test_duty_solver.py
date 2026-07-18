"""Unit tests for the pure duty-roster solver. No DB needed."""

import pytest

from apps.dos.scheduling.duty_solver import DutySeat, solve_duty_roster


def _seat(day, post, start, end, index=0):
    return DutySeat(key=f"{day}-{post}-{index}", day=day, post_id=post,
                    start=start, end=end, index=index)


def test_fills_every_seat_when_staff_are_plentiful():
    seats = [_seat("mon", "assembly", 480, 500), _seat("tue", "assembly", 480, 500)]
    result = solve_duty_roster(seats, ["a", "b", "c"])

    assert result.is_complete
    assert len(result.assignments) == 2


def test_load_is_evenly_spread():
    # 9 seats over 3 staff on distinct days -> exactly 3 each.
    seats = [_seat(f"d{d}", "break", 600, 630) for d in range(9)]
    result = solve_duty_roster(seats, ["a", "b", "c"])

    assert result.is_complete
    assert sorted(result.load.values()) == [3, 3, 3]
    assert result.spread == 0


def test_spread_stays_within_one_when_seats_do_not_divide_evenly():
    seats = [_seat(f"d{d}", "break", 600, 630) for d in range(10)]
    result = solve_duty_roster(seats, ["a", "b", "c"])

    assert result.is_complete
    assert result.spread <= 1


def test_max_per_day_is_respected():
    # Three non-overlapping posts on one day, 3 staff, max 1 duty per day.
    seats = [
        _seat("mon", "assembly", 480, 500),
        _seat("mon", "break", 600, 630),
        _seat("mon", "prep", 900, 960),
    ]
    result = solve_duty_roster(seats, ["a", "b", "c"], max_per_day=1)

    assert result.is_complete
    assert sorted(result.assignments.values()) == ["a", "b", "c"]  # all different


def test_overlapping_duties_never_go_to_one_person():
    # Two overlapping posts on the same day; with max_per_day=2 the day cap
    # would allow doubling up, but the time overlap must still prevent it.
    seats = [
        _seat("mon", "gate", 600, 660),
        _seat("mon", "yard", 630, 690),
    ]
    result = solve_duty_roster(seats, ["a", "b"], max_per_day=2)

    assert result.is_complete
    assert len(set(result.assignments.values())) == 2


def test_unfillable_seats_are_reported_not_raised():
    # One staff member, two same-day non-overlapping posts, max 1 per day.
    seats = [_seat("mon", "assembly", 480, 500), _seat("mon", "break", 600, 630)]
    result = solve_duty_roster(seats, ["a"], max_per_day=1)

    assert not result.is_complete
    assert len(result.unfilled) == 1
    assert len(result.assignments) == 1


def test_no_staff_leaves_everything_unfilled():
    seats = [_seat("mon", "assembly", 480, 500)]
    result = solve_duty_roster(seats, [])
    assert result.unfilled == ["mon-assembly-0"]
    assert result.assignments == {}


def test_same_post_twice_in_a_day_goes_to_different_people():
    # A post needing two staff on one day.
    seats = [_seat("mon", "gate", 600, 660, i) for i in range(2)]
    result = solve_duty_roster(seats, ["a", "b"], max_per_day=2)

    assert result.is_complete
    assert len(set(result.assignments.values())) == 2


def test_rotation_varies_who_gets_which_post():
    # Two posts a day over two days with two staff: each person should end up
    # on both posts rather than owning one.
    seats = []
    for day in ("mon", "tue"):
        seats.append(_seat(day, "early", 480, 500))
        seats.append(_seat(day, "late", 900, 960))
    result = solve_duty_roster(seats, ["a", "b"], max_per_day=2)

    assert result.is_complete
    early = {result.assignments[f"{d}-early-0"] for d in ("mon", "tue")}
    assert len(early) == 2   # not always the same person on the early duty


def test_deterministic():
    seats = [_seat(f"d{d}", f"p{p}", 600 + p * 60, 630 + p * 60)
             for d in range(5) for p in range(3)]
    r1 = solve_duty_roster(seats, ["a", "b", "c", "d"], max_per_day=2)
    r2 = solve_duty_roster(seats, ["a", "b", "c", "d"], max_per_day=2)
    assert r1.assignments == r2.assignments
    assert r1.unfilled == r2.unfilled


def test_rejects_duplicate_seat_keys():
    s = _seat("mon", "gate", 600, 660)
    with pytest.raises(ValueError):
        solve_duty_roster([s, s], ["a"])


def test_rejects_bad_max_per_day():
    with pytest.raises(ValueError):
        solve_duty_roster([], ["a"], max_per_day=0)
