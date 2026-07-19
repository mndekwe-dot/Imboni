"""Dormitory assignment as a bin-packing problem.

The problem
-----------
A boarding school has rooms with a fixed number of beds and a body of boarders
who must all sleep somewhere. We must place every boarder into a room so that:

* no room ever holds more students than it has beds  (hard),
* a student is never put in a dormitory reserved for the other gender  (hard),
* students of the same class stay together where possible  (soft, priority 1),
* rooms fill evenly instead of some being crammed and others near-empty
  (soft, priority 2).

The hard constraints alone are exactly **bin packing**: items (students) of
size 1 into bins (rooms) of fixed capacity. Deciding the minimum number of bins
is NP-hard, so an exact search is the wrong tool for a matron who wants an
answer in a second. Bin packing is also the textbook case where a cheap greedy
heuristic is provably close to optimal, which is why we use one.

Why first-fit-decreasing over class groups
------------------------------------------
Treating students as individual items would satisfy the capacity limit and
nothing else — classmates would scatter across the building. So the items we
pack are not students but **cohorts**: all boarders sharing a class (and, where
the data supports it, a gender). A cohort is an item of size N that we try to
keep in one room.

FFD then says: sort the items largest-first and place each into the bin that
takes it. Placing large cohorts while every room is still empty is the whole
point of the "decreasing" — a 12-student class placed first can claim a
12-bed room, whereas if small groups go first they fragment the big rooms and
the large class has to be split. This is the standard FFD argument and it is
what makes the difference between "S3A is in room 4" and "S3A is in six rooms".

Room choice, given a cohort of ``remaining`` students, in order:

1. Rooms that can take the **whole** remainder beat rooms that cannot — this is
   the cohesion preference (priority 1), expressed as a bin choice.
2. Among rooms that can take it all: **best fit**, the room with the fewest
   beds left over. Least waste, and it leaves the large rooms free for the
   large cohorts still to come. Among rooms that cannot: the emptiest, so the
   cohort is split into as few pieces as possible.
3. Ties break toward the room with fewer occupants — the evenness preference
   (priority 2). It only ever applies between rooms that fit the cohort
   equally well, so it never costs cohesion.
4. Finally the caller's room order, which makes the whole thing deterministic.

A cohort that runs out of gender-compatible beds is **reported** in
``unplaced`` with a reason, never raised — same contract as the other
generators: the caller adds rooms or capacity and regenerates.

Pure module: no Django, no ORM.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Hashable, Sequence

# A dormitory marked with this gender accepts anybody.
MIXED = "mixed"


@dataclass(frozen=True)
class RoomSlot:
    """One room with beds to fill."""

    key: Hashable
    dormitory_id: Hashable
    dormitory_name: str
    room_number: str
    capacity: int
    gender: str = MIXED       # 'male' | 'female' | 'mixed'


@dataclass(frozen=True)
class Boarder:
    """One student needing a bed."""

    key: Hashable
    group: str                # class/grade label — the cohesion key
    gender: str | None = None  # None when the school records no gender


@dataclass
class HousingResult:
    # student key -> room key
    placements: dict[Hashable, Hashable] = field(default_factory=dict)
    # room key -> [student keys], in the order they were seated
    occupancy: dict[Hashable, list] = field(default_factory=dict)
    # (student key, reason) for everyone who could not be seated
    unplaced: list[tuple] = field(default_factory=list)

    @property
    def is_complete(self) -> bool:
        return not self.unplaced


def gender_compatible(room_gender: str | None, student_gender: str | None) -> bool:
    """True when a student of ``student_gender`` may sleep in this room.

    An unknown gender on either side is permissive: the school simply does not
    record it, and refusing every bed would be worse than ignoring the rule.
    """
    if not room_gender or room_gender == MIXED:
        return True
    if not student_gender:
        return True
    return room_gender == student_gender


def solve_housing(
    rooms: Sequence[RoomSlot],
    students: Sequence[Boarder],
) -> HousingResult:
    """Pack students into rooms, keeping classes together within capacity.

    Parameters
    ----------
    rooms:
        Available rooms. ``key`` must be unique; the sequence order is the
        deterministic tie-break.
    students:
        Boarders to place. ``key`` must be unique.

    Returns
    -------
    HousingResult with the room chosen per student, the resulting per-room
    occupancy, and everyone who could not be placed (with a reason).

    Determinism: identical input yields identical output.
    """
    room_keys = [r.key for r in rooms]
    if len(set(room_keys)) != len(room_keys):
        raise ValueError("room keys must be unique")
    student_keys = [s.key for s in students]
    if len(set(student_keys)) != len(student_keys):
        raise ValueError("student keys must be unique")
    if any(r.capacity < 0 for r in rooms):
        raise ValueError("room capacity cannot be negative")

    order = {r.key: i for i, r in enumerate(rooms)}
    free = {r.key: r.capacity for r in rooms}
    occupancy: dict[Hashable, list] = {r.key: [] for r in rooms}
    placements: dict[Hashable, Hashable] = {}
    unplaced: list[tuple] = []

    # ── Build the items: cohorts of (class, gender) ──────────────────────────
    cohorts: dict[tuple, list] = {}
    for s in students:
        cohorts.setdefault((s.group, s.gender), []).append(s)

    # FFD: largest cohort first, label as a deterministic tie-break.
    ordered = sorted(
        cohorts.items(),
        key=lambda kv: (-len(kv[1]), str(kv[0][0]), str(kv[0][1])),
    )

    for (group, gender), members in ordered:
        remaining = list(members)
        while remaining:
            eligible = [
                r for r in rooms
                if free[r.key] > 0 and gender_compatible(r.gender, gender)
            ]
            if not eligible:
                reason = _no_room_reason(rooms, gender)
                unplaced.extend((s.key, reason) for s in remaining)
                break

            need = len(remaining)
            room = min(eligible, key=lambda r: _rank(r, free[r.key], need, order))

            take = min(free[room.key], need)
            for s in remaining[:take]:
                placements[s.key] = room.key
                occupancy[room.key].append(s.key)
            free[room.key] -= take
            remaining = remaining[take:]

    return HousingResult(
        placements=placements, occupancy=occupancy, unplaced=unplaced,
    )


def _rank(room: RoomSlot, free_beds: int, need: int, order: dict) -> tuple:
    """Sort key for choosing a room — see the module docstring."""
    fits_all = free_beds >= need
    return (
        0 if fits_all else 1,                       # 1. whole cohort in one room
        (free_beds - need) if fits_all else -free_beds,  # 2. best fit / biggest chunk
        room.capacity - free_beds,                  # 3. fewer occupants — even fill
        order[room.key],                            # 4. determinism
    )


def _no_room_reason(rooms: Sequence[RoomSlot], gender: str | None) -> str:
    """Explain, in words a matron can act on, why nobody else fits."""
    compatible = [r for r in rooms if gender_compatible(r.gender, gender)]
    if not compatible:
        return f"No dormitory accepts students of gender '{gender}'."
    return "All matching rooms are full — no free beds left."
