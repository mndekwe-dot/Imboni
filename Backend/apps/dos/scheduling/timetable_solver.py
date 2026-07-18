"""Weekly class timetabling as a constraint-satisfaction problem (backtracking).

The problem
-----------
Each (class, subject) pair needs a number of *lessons* per week, taught by a
fixed teacher. We must place every lesson into a (day, period) slot so that:

* a class attends at most one lesson per slot,
* a teacher teaches at most one lesson per slot,
* a slot runs no more lessons than there are rooms (a per-slot capacity).

That is a classic CSP. Unlike the exam scheduler — which greedily colours a
conflict graph — timetabling is tighter (two independent clash dimensions,
class *and* teacher), so a purely greedy pass can dead-end even when a valid
timetable exists. We therefore use **backtracking search** with two standard
accelerators:

* **MRV** (minimum-remaining-values): always assign the lesson with the fewest
  legal slots left — fail fast, prune early.
* **Forward checking** via incremental slot bookkeeping: a slot is legal only if
  the class and teacher are both free in it and it is below capacity.

A soft preference spreads a class's periods of the *same subject* across
different days (nicer timetables) by trying less-loaded days first; it never
overrides a hard constraint.

Search is bounded by ``max_backtracks``. If the bound is hit the best partial
assignment found so far is returned, with the unplaced lessons reported — the
caller can widen the grid (more periods/days or rooms) and regenerate. The
module is pure: no Django, no ORM.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Hashable, Sequence


@dataclass(frozen=True)
class Lesson:
    """One lesson instance to place.

    Several lessons of the same (class, subject) simply appear as several
    Lesson objects with distinct ``key``s; they share ``class_id`` so the
    class-clash constraint already forces them into different slots.

    ``weight`` (1-10, 5 = neutral) tunes the *soft* preferences only — it never
    overrides a hard clash. It does two things:

    * **First pick.** Among lessons that are equally constrained (same MRV
      count), heavier lessons are assigned first and therefore choose from a
      fuller set of slots. This is the main effect: when subjects compete for a
      scarce free day or an early period, the heavy one wins and the light one
      takes what is left. In a grid too tight to fit everything it also makes
      heavy lessons likelier to be placed at all.
    * **Spread strength.** The cost of putting two lessons of the same subject
      on one day scales with weight, so a heavy subject will accept a much
      later period to keep its lessons on separate days. (With a free day
      available, spreading is cheap enough that any weight prefers it; the
      scaling decides who yields when days are contested.)
    """

    key: Hashable
    class_id: Hashable
    teacher_id: Hashable
    subject_id: Hashable | None = None  # only used for the soft day-spread
    weight: int = 5


# How much one same-day repeat of a subject costs, per point of lesson weight,
# relative to one step of period-lateness. High enough that a weight-5 subject
# prefers a much later period over doubling up, while a weight-1 subject does
# not. See Lesson.weight.
SPREAD_COST = 10


@dataclass
class TimetableResult:
    placements: dict[Hashable, int] = field(default_factory=dict)  # lesson key -> slot index
    unscheduled: list[Hashable] = field(default_factory=list)
    backtracks: int = 0

    @property
    def is_complete(self) -> bool:
        return not self.unscheduled


class _Booking:
    """Mutable slot bookkeeping for forward checking (fast legality checks)."""

    def __init__(self, num_slots, capacity, slot_day, slot_pos=None):
        self.capacity = capacity
        self.slot_day = slot_day                       # slot index -> day id
        # slot index -> position within its day (0 = first period). All zero
        # when the caller supplies no positions, which disables the morning
        # preference and leaves only the day-spread.
        self.slot_pos = list(slot_pos) if slot_pos is not None else [0] * num_slots
        self.class_busy = [set() for _ in range(num_slots)]
        self.teacher_busy = [set() for _ in range(num_slots)]
        self.load = [0] * num_slots
        # (class_id, subject_id, day) -> count, for the soft day-spread pref.
        self.subject_day = {}

    def legal(self, lesson, slot):
        return (
            self.load[slot] < self.capacity
            and lesson.class_id not in self.class_busy[slot]
            and lesson.teacher_id not in self.teacher_busy[slot]
        )

    def assign(self, lesson, slot):
        self.class_busy[slot].add(lesson.class_id)
        self.teacher_busy[slot].add(lesson.teacher_id)
        self.load[slot] += 1
        day = self.slot_day[slot]
        k = (lesson.class_id, lesson.subject_id, day)
        self.subject_day[k] = self.subject_day.get(k, 0) + 1

    def unassign(self, lesson, slot):
        self.class_busy[slot].discard(lesson.class_id)
        self.teacher_busy[slot].discard(lesson.teacher_id)
        self.load[slot] -= 1
        day = self.slot_day[slot]
        k = (lesson.class_id, lesson.subject_id, day)
        self.subject_day[k] -= 1

    def legal_slots(self, lesson, num_slots):
        return [s for s in range(num_slots) if self.legal(lesson, s)]

    def slot_cost(self, lesson, slot):
        """Soft-preference cost of a legal slot (lower is better).

        ``SPREAD_COST * weight`` per lesson of the same subject already on that
        day, plus the slot's position in the day. Scaling only the spread term
        by weight is what makes weight meaningful: a heavy subject trades a
        later period for a clear day, a light one does the opposite.
        """
        same_day = self.subject_day.get(
            (lesson.class_id, lesson.subject_id, self.slot_day[slot]), 0
        )
        return SPREAD_COST * lesson.weight * same_day + self.slot_pos[slot]

    def ordered_slots(self, lesson, num_slots):
        """Legal slots ordered by soft-preference cost, then index for stability."""
        legal = self.legal_slots(lesson, num_slots)
        return sorted(legal, key=lambda s: (self.slot_cost(lesson, s), s))


def solve_timetable(
    lessons: Sequence[Lesson],
    num_slots: int,
    slot_days: Sequence[Hashable],
    slot_capacity: int,
    max_backtracks: int = 50_000,
    slot_positions: Sequence[int] | None = None,
) -> TimetableResult:
    """Place every lesson into a slot in ``[0, num_slots)`` via backtracking.

    Parameters
    ----------
    lessons:
        The lesson instances to place. ``key`` must be unique.
    num_slots:
        Total (day, period) slots available.
    slot_days:
        ``slot_days[i]`` is the day id of slot ``i`` (used for the soft spread).
        Must have length ``num_slots``.
    slot_capacity:
        Max concurrent lessons per slot (typically the number of rooms). >= 1.
    max_backtracks:
        Safety bound on search effort; on exhaustion the best partial assignment
        is returned rather than looping forever.
    slot_positions:
        Optional position of each slot within its day (0 = first period). Gives
        heavier lessons an earlier-period preference; omit to disable it.

    Determinism: identical input yields identical output.
    """
    if num_slots < 0:
        raise ValueError("num_slots must be non-negative")
    if slot_capacity < 1:
        raise ValueError("slot_capacity must be at least 1")
    if len(slot_days) != num_slots:
        raise ValueError("slot_days must have length num_slots")
    if slot_positions is not None and len(slot_positions) != num_slots:
        raise ValueError("slot_positions must have length num_slots")
    keys = [l.key for l in lessons]
    if len(set(keys)) != len(keys):
        raise ValueError("lesson keys must be unique")

    booking = _Booking(num_slots, slot_capacity, list(slot_days), slot_positions)
    order = {l.key: i for i, l in enumerate(lessons)}
    placements: dict[Hashable, int] = {}
    remaining = list(lessons)

    # Track the best (largest) complete-so-far assignment across the search so a
    # bounded run still returns something useful.
    best = {"placements": {}, "count": 0}
    state = {"backtracks": 0, "exhausted": False}

    def record_best():
        if len(placements) > best["count"]:
            best["count"] = len(placements)
            best["placements"] = dict(placements)

    def select_unassigned(unassigned):
        # MRV first (fewest legal slots) — that's the performance-critical
        # heuristic. Among equally-constrained lessons the heavier one is
        # assigned first, so it picks from a fuller set of slots and, in a
        # grid too tight to fit everything, is likelier to be placed at all.
        return min(
            unassigned,
            key=lambda l: (
                len(booking.legal_slots(l, num_slots)), -l.weight, order[l.key],
            ),
        )

    def backtrack(unassigned):
        if not unassigned:
            return True
        if state["backtracks"] >= max_backtracks:
            state["exhausted"] = True
            return False

        lesson = select_unassigned(unassigned)
        rest = [l for l in unassigned if l.key != lesson.key]

        slots = booking.ordered_slots(lesson, num_slots)
        if not slots:
            # Dead end for this lesson; count it and let the caller backtrack.
            state["backtracks"] += 1
            record_best()
            return False

        for slot in slots:
            booking.assign(lesson, slot)
            placements[lesson.key] = slot
            record_best()
            if backtrack(rest):
                return True
            booking.unassign(lesson, slot)
            del placements[lesson.key]
            state["backtracks"] += 1
            if state["backtracks"] >= max_backtracks:
                state["exhausted"] = True
                return False
        return False

    solved = backtrack(remaining) if remaining else True

    if solved:
        final = placements
    else:
        # Use the best partial assignment discovered.
        final = best["placements"]

    unscheduled = sorted((k for k in keys if k not in final), key=lambda k: order[k])
    return TimetableResult(
        placements=dict(final),
        unscheduled=unscheduled,
        backtracks=state["backtracks"],
    )
