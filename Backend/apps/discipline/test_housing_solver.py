"""Unit tests for the pure dormitory bin-packing solver. No DB needed."""

import pytest

from apps.discipline.housing_solver import (
    Boarder, RoomSlot, gender_compatible, solve_housing,
)


def _room(key, capacity, gender='mixed', dorm='Bisoke'):
    return RoomSlot(key=key, dormitory_id=dorm, dormitory_name=dorm,
                    room_number=key, capacity=capacity, gender=gender)


def _students(group, n, gender=None, prefix=''):
    return [Boarder(key=f"{prefix}{group}-{i}", group=group, gender=gender)
            for i in range(n)]


# ── hard constraints ─────────────────────────────────────────────────────────

def test_capacity_is_never_exceeded():
    rooms = [_room('r1', 2), _room('r2', 3)]
    result = solve_housing(rooms, _students('S1A', 5))

    assert result.is_complete
    assert len(result.occupancy['r1']) <= 2
    assert len(result.occupancy['r2']) <= 3


def test_every_student_gets_exactly_one_room():
    rooms = [_room('r1', 4), _room('r2', 4)]
    students = _students('S1A', 3) + _students('S2B', 4)
    result = solve_housing(rooms, students)

    assert set(result.placements) == {s.key for s in students}
    seated = [k for keys in result.occupancy.values() for k in keys]
    assert sorted(seated) == sorted(result.placements)
    assert len(seated) == len(set(seated))    # nobody in two rooms


def test_gendered_dorm_rejects_the_other_gender():
    rooms = [_room('boys', 10, gender='male')]
    result = solve_housing(rooms, _students('S1A', 3, gender='female'))

    assert result.placements == {}
    assert len(result.unplaced) == 3
    assert all('gender' in reason for _, reason in result.unplaced)


def test_mixed_dorm_accepts_everyone():
    rooms = [_room('r1', 10, gender='mixed')]
    students = (_students('S1A', 2, gender='male', prefix='b')
                + _students('S1A', 2, gender='female', prefix='g'))
    result = solve_housing(rooms, students)

    assert result.is_complete
    assert len(result.occupancy['r1']) == 4


def test_students_go_to_their_matching_dorm():
    rooms = [_room('boys', 5, gender='male'), _room('girls', 5, gender='female')]
    boys = _students('S1A', 3, gender='male', prefix='b')
    girls = _students('S1A', 3, gender='female', prefix='g')
    result = solve_housing(rooms, boys + girls)

    assert result.is_complete
    assert set(result.occupancy['boys']) == {s.key for s in boys}
    assert set(result.occupancy['girls']) == {s.key for s in girls}


def test_unknown_gender_is_permissive():
    assert gender_compatible('male', None) is True
    assert gender_compatible(None, 'female') is True
    assert gender_compatible('mixed', 'female') is True
    assert gender_compatible('male', 'female') is False


# ── soft preferences ─────────────────────────────────────────────────────────

def test_a_class_that_fits_stays_in_one_room():
    rooms = [_room('r1', 6), _room('r2', 6)]
    result = solve_housing(rooms, _students('S1A', 4) + _students('S2B', 4))

    for group in ('S1A', 'S2B'):
        rooms_used = {result.placements[k] for k in result.placements
                      if k.startswith(group)}
        assert len(rooms_used) == 1
    # ...and the two classes did not land on top of each other.
    assert result.placements['S1A-0'] != result.placements['S2B-0']


def test_largest_group_is_placed_first_so_it_is_not_split():
    # The 6-bed room is the only one that can hold the 6-student class. A
    # first-fit that ignored size would fill it with the small class first.
    rooms = [_room('big', 6), _room('small', 3)]
    result = solve_housing(rooms, _students('S1A', 6) + _students('S2B', 3))

    assert result.is_complete
    assert set(result.occupancy['big']) == {f'S1A-{i}' for i in range(6)}
    assert set(result.occupancy['small']) == {f'S2B-{i}' for i in range(3)}


def test_best_fit_avoids_wasting_the_large_room():
    # A 3-student class should take the 3-bed room, not the 10-bed one.
    rooms = [_room('huge', 10), _room('snug', 3)]
    result = solve_housing(rooms, _students('S1A', 3))

    assert len(result.occupancy['snug']) == 3
    assert result.occupancy['huge'] == []


def test_oversized_group_is_split_into_as_few_rooms_as_possible():
    rooms = [_room('r1', 4), _room('r2', 4), _room('r3', 4)]
    result = solve_housing(rooms, _students('S1A', 6))

    assert result.is_complete
    used = {r for r in result.occupancy if result.occupancy[r]}
    assert len(used) == 2


# ── reporting, not raising ───────────────────────────────────────────────────

def test_students_beyond_capacity_are_reported_not_raised():
    rooms = [_room('r1', 2)]
    result = solve_housing(rooms, _students('S1A', 5))

    assert not result.is_complete
    assert len(result.placements) == 2
    assert len(result.unplaced) == 3
    assert all(reason for _, reason in result.unplaced)


def test_no_rooms_leaves_everyone_unplaced():
    result = solve_housing([], _students('S1A', 3))
    assert result.placements == {}
    assert len(result.unplaced) == 3


def test_no_students_is_a_valid_empty_plan():
    result = solve_housing([_room('r1', 4)], [])
    assert result.is_complete
    assert result.occupancy == {'r1': []}


# ── determinism & input validation ───────────────────────────────────────────

def test_deterministic():
    rooms = [_room(f'r{i}', 4) for i in range(5)]
    students = (_students('S1A', 7) + _students('S2B', 5)
                + _students('S3C', 6) + _students('S4D', 3))

    first = solve_housing(rooms, students)
    second = solve_housing(rooms, students)

    assert first.placements == second.placements
    assert first.occupancy == second.occupancy
    assert first.unplaced == second.unplaced


def test_rejects_duplicate_room_keys():
    with pytest.raises(ValueError):
        solve_housing([_room('r1', 2), _room('r1', 3)], [])


def test_rejects_duplicate_student_keys():
    s = Boarder(key='dup', group='S1A')
    with pytest.raises(ValueError):
        solve_housing([_room('r1', 4)], [s, s])


def test_rejects_negative_capacity():
    with pytest.raises(ValueError):
        solve_housing([_room('r1', -1)], [])
