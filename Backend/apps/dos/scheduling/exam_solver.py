"""Exam timetabling as bounded-capacity graph colouring (DSatur heuristic).

The problem
-----------
We must place a set of *exams* into an ordered list of *time-slots* so that:

* Two exams that share students are never in the same slot.
  Here "share students" is approximated by "belong to the same class" — the
  natural conflict for a school where each class sits its subjects separately.
* No slot holds more exams than there are venues to run them in
  (a per-slot *capacity*).

This is exactly graph colouring: each exam is a node, an edge joins two exams
that conflict, and each colour is a time-slot. The twist is that colours have a
finite capacity (how many exams can run at once), so it is *bounded* colouring.

Why DSatur
----------
DSatur (Brélaz, 1979) colours the vertex with the highest *saturation degree*
first — the one hemmed in by the most distinctly-coloured neighbours — breaking
ties by ordinary degree. Colouring the most-constrained exam next is a strong
greedy heuristic that, in practice, uses close to the minimum number of slots
and rarely backtracks. We don't backtrack at all: if an exam cannot be placed
within the available slots it is returned as *unscheduled* rather than failing
the whole run, so the caller can widen the exam window and try again.

This module is intentionally pure — it knows nothing about Django, the ORM, or
tenants. Feed it plain data, get plain data back.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Hashable, Sequence


@dataclass(frozen=True)
class Exam:
    """One exam to place. `key` is any hashable id the caller understands.

    `group` is the conflict key — exams sharing a group cannot be concurrent
    (for a school, the class id). Exams with no group (``None``) never conflict
    with anyone on that basis.

    `weight` (1-10, 5 = neutral) expresses importance. Heavier exams are
    placed earlier in the DSatur order (so when the window is too tight, the
    *light* exams are the ones left unscheduled), prefer earlier slots within
    a day, and repel other heavy exams of the same group on adjacent days.
    """

    key: Hashable
    group: Hashable | None = None
    weight: int = 5


@dataclass(frozen=True)
class SlotMeta:
    """Position of a slot in the calendar, for weighted preferences.

    `day` is an ordinal day index (0 = first exam day); `pos` is the slot's
    rank within that day (0 = first/morning). Without metadata the solver
    falls back to first-fit and weights only affect placement order.
    """

    day: int
    pos: int


# Cost of a heavy exam sitting on a day adjacent to another exam of the same
# class, per point of combined weight. Scaled to dominate the morning
# preference (whose cost is weight * pos, pos typically 0-3) so rest gaps for
# important exams win over slot-of-day niceties.
GAP_PENALTY = 4


@dataclass
class ScheduleResult:
    # exam key -> slot index (into the `slots` list passed to solve_exam_schedule)
    placements: dict[Hashable, int] = field(default_factory=dict)
    # exam keys that could not be placed within the available slots/capacity
    unscheduled: list[Hashable] = field(default_factory=list)

    @property
    def is_complete(self) -> bool:
        return not self.unscheduled


def _conflict_map(exams: Sequence[Exam]) -> dict[Hashable, set[Hashable]]:
    """Adjacency: exam key -> set of exam keys it conflicts with (same group)."""
    by_group: dict[Hashable, list[Hashable]] = {}
    for e in exams:
        if e.group is None:
            continue
        by_group.setdefault(e.group, []).append(e.key)

    adjacency: dict[Hashable, set[Hashable]] = {e.key: set() for e in exams}
    for members in by_group.values():
        for a in members:
            for b in members:
                if a != b:
                    adjacency[a].add(b)
    return adjacency


def solve_exam_schedule(
    exams: Sequence[Exam],
    num_slots: int,
    slot_capacity: int,
    slot_meta: Sequence[SlotMeta] | None = None,
) -> ScheduleResult:
    """Assign each exam a slot index in ``[0, num_slots)`` via DSatur.

    Parameters
    ----------
    exams:
        Exams to place. Duplicate keys are not allowed.
    num_slots:
        How many ordered time-slots are available (e.g. exam_days * slots_per_day).
    slot_capacity:
        Maximum exams that may occupy one slot at once (typically the number of
        available venues). Must be >= 1 to place anything.
    slot_meta:
        Optional calendar position per slot (same length/order as the slot
        indices). When provided, exam weights steer *which* feasible slot an
        exam takes: heavier exams prefer earlier positions in the day, and
        avoid days adjacent to their class's other heavy exams. When omitted,
        placement is first-fit (weights still control placement order).

    Returns
    -------
    ScheduleResult with the chosen slot per exam and any exams that did not fit.

    Determinism: for a given input the output is identical every run — ties in
    saturation/weight/degree are broken by a stable ordering key and cost ties
    by lowest slot index, so previews and commits agree.
    """
    if num_slots < 0:
        raise ValueError("num_slots must be non-negative")
    if slot_capacity < 1:
        raise ValueError("slot_capacity must be at least 1")
    if slot_meta is not None and len(slot_meta) != num_slots:
        raise ValueError("slot_meta must have exactly num_slots entries")

    keys = [e.key for e in exams]
    if len(set(keys)) != len(keys):
        raise ValueError("exam keys must be unique")

    adjacency = _conflict_map(exams)
    exam_by_key = {e.key: e for e in exams}

    placements: dict[Hashable, int] = {}
    unscheduled: list[Hashable] = []
    # How many exams currently sit in each slot (for the capacity check).
    slot_load = [0] * num_slots

    # Stable ordering index so tie-breaks are deterministic and independent of
    # dict iteration order.
    order = {e.key: i for i, e in enumerate(exams)}

    def saturation(key: Hashable) -> int:
        """Number of distinct slots already used by this exam's neighbours."""
        used = {placements[n] for n in adjacency[key] if n in placements}
        return len(used)

    def slot_cost(exam: Exam, slot: int) -> int:
        """Weighted preference cost of a feasible slot (lower is better).

        Two terms, both scaled by weight so a neutral exam barely cares and a
        weight-10 exam cares a lot:
        - morning preference: weight * position-in-day;
        - rest gap: GAP_PENALTY * combined weight for each same-group exam
          already sitting on an adjacent day.
        """
        if slot_meta is None:
            return 0
        meta = slot_meta[slot]
        cost = exam.weight * meta.pos
        if exam.group is not None:
            for other_key in adjacency[exam.key]:
                other_slot = placements.get(other_key)
                if other_slot is None:
                    continue
                if abs(slot_meta[other_slot].day - meta.day) == 1:
                    cost += GAP_PENALTY * (exam.weight + exam_by_key[other_key].weight)
        return cost

    remaining = set(keys)
    while remaining:
        # Most-saturated first (colouring quality), then heaviest (so when the
        # window is tight, LIGHT exams are the ones that overflow), then
        # highest-degree, then stable input order.
        chosen = max(
            remaining,
            key=lambda k: (
                saturation(k), exam_by_key[k].weight, len(adjacency[k]), -order[k],
            ),
        )
        remaining.discard(chosen)

        forbidden = {placements[n] for n in adjacency[chosen] if n in placements}
        best_slot = None
        best_cost = None
        for slot in range(num_slots):
            if slot in forbidden:
                continue
            if slot_load[slot] >= slot_capacity:
                continue
            cost = slot_cost(exam_by_key[chosen], slot)
            if best_cost is None or cost < best_cost:
                best_slot, best_cost = slot, cost
                if slot_meta is None:
                    break   # no scoring signal → first fit, as before

        if best_slot is None:
            unscheduled.append(chosen)
        else:
            placements[chosen] = best_slot
            slot_load[best_slot] += 1

    # Preserve caller order in the unscheduled list for stable output.
    unscheduled.sort(key=lambda k: order[k])
    return ScheduleResult(placements=placements, unscheduled=unscheduled)
