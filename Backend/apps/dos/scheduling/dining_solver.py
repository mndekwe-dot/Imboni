"""Dining sittings as greedy capacity-constrained slot assignment.

The problem
-----------
A dining hall seats fewer students than the school has, so each meal runs in
several **sittings**. Every class must eat, exactly once per meal, in a sitting
whose remaining seats can hold it:

* a class is assigned to exactly one sitting per meal (they eat together),
* no sitting may exceed its seat ``capacity``,
* and the sittings should end up **evenly loaded** rather than one packed and
  the next half empty (queues, serving staff, and washing-up all scale with the
  busiest sitting, not the average).

Why greedy, not search
----------------------
This is a bin-packing variant — NP-hard in general — but the instance is tiny
(a handful of sittings, a few dozen classes) and, unlike timetabling, there are
no cross-constraints between classes: any class fits any sitting that has room.
A well-ordered greedy pass is therefore both sufficient and predictable.

The ordering is the classic **first-fit decreasing**: place the *largest* class
first. Large items placed late are the ones that don't fit anywhere, so
handling them while every sitting is still empty is what makes the packing
work. (Sorting ascending instead is the textbook way to waste capacity.)

Among sittings that can hold the class we pick the **emptiest**, which is what
turns "any valid packing" into "an even one". Ties break on the caller's
sitting order so the result is deterministic.

Classes that fit nowhere are reported with a reason rather than raising — the
caller adds a sitting, raises capacity, or splits the class.

Pure module: no Django, no ORM.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Hashable, Sequence


@dataclass(frozen=True)
class DiningGroup:
    """A group that eats together — for a school, one class."""

    key: Hashable
    size: int
    meal: Hashable = "lunch"


@dataclass(frozen=True)
class Sitting:
    """One seating of a meal."""

    key: Hashable
    capacity: int
    meal: Hashable = "lunch"


@dataclass
class DiningResult:
    # group key -> sitting key
    assignments: dict[Hashable, Hashable] = field(default_factory=dict)
    # (group key, reason) for groups that could not be seated
    unassigned: list[tuple] = field(default_factory=list)
    # sitting key -> seats used
    occupancy: dict[Hashable, int] = field(default_factory=dict)

    @property
    def is_complete(self) -> bool:
        return not self.unassigned

    def spread_for(self, sittings) -> int:
        """Busiest minus quietest sitting, over the given sitting keys."""
        used = [self.occupancy.get(k, 0) for k in sittings]
        return (max(used) - min(used)) if used else 0


def solve_dining_plan(
    groups: Sequence[DiningGroup],
    sittings: Sequence[Sitting],
) -> DiningResult:
    """Seat every group in a sitting of its meal, packing evenly.

    Parameters
    ----------
    groups:
        Groups to seat. ``key`` must be unique. ``size`` is the head count.
    sittings:
        Available sittings. ``key`` must be unique.

    Returns
    -------
    DiningResult with the chosen sitting per group, the resulting occupancy,
    and any groups that could not be seated (with a reason).

    Determinism: identical input yields identical output.
    """
    gkeys = [g.key for g in groups]
    if len(set(gkeys)) != len(gkeys):
        raise ValueError("group keys must be unique")
    skeys = [s.key for s in sittings]
    if len(set(skeys)) != len(skeys):
        raise ValueError("sitting keys must be unique")
    if any(g.size < 0 for g in groups):
        raise ValueError("group sizes must be non-negative")

    order = {s.key: i for i, s in enumerate(sittings)}
    by_meal: dict[Hashable, list[Sitting]] = {}
    for s in sittings:
        by_meal.setdefault(s.meal, []).append(s)

    remaining = {s.key: s.capacity for s in sittings}
    assignments: dict[Hashable, Hashable] = {}
    unassigned: list[tuple] = []

    # First-fit decreasing: largest groups first. Stable secondary key keeps the
    # output deterministic when sizes tie.
    group_order = {g.key: i for i, g in enumerate(groups)}
    for group in sorted(groups, key=lambda g: (-g.size, group_order[g.key])):
        candidates = by_meal.get(group.meal, [])
        if not candidates:
            unassigned.append((group.key, f"no sittings configured for {group.meal}"))
            continue

        fitting = [s for s in candidates if remaining[s.key] >= group.size]
        if not fitting:
            largest = max(s.capacity for s in candidates)
            reason = (
                f"group of {group.size} exceeds every {group.meal} sitting "
                f"(largest holds {largest})"
                if group.size > largest
                else f"no {group.meal} sitting has {group.size} seats left"
            )
            unassigned.append((group.key, reason))
            continue

        # Emptiest sitting that fits -> even load; sitting order breaks ties.
        chosen = min(fitting, key=lambda s: (-remaining[s.key], order[s.key]))
        assignments[group.key] = chosen.key
        remaining[chosen.key] -= group.size

    occupancy = {s.key: s.capacity - remaining[s.key] for s in sittings}
    unassigned.sort(key=lambda pair: group_order[pair[0]])
    return DiningResult(
        assignments=assignments, unassigned=unassigned, occupancy=occupancy,
    )
