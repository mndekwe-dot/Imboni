"""Duty roster generation as fair round-robin assignment.

The problem
-----------
A school has recurring supervision duties (assembly, break, prep, dorm check).
Each duty runs on certain days and needs one or more staff. We must fill every
(day, post, seat) with a staff member so that:

* nobody supervises two duties whose times **overlap** on the same day,
* nobody exceeds ``max_per_day`` duties in one day,
* nobody holds the same post twice on one day,
* and — the point of the whole exercise — the workload is **fair**.

Why round-robin
---------------
Unlike exam colouring or timetabling, there is no combinatorial explosion here:
any staff member can cover any post, so a greedy pass suffices. The interesting
requirement is fairness, not feasibility. Naive "first eligible person" fills
the roster but hammers whoever sorts first.

Classic round-robin (a rotating pointer over the staff list) fixes that, but
drifts out of balance as soon as some people are skipped for being ineligible.
So we pick, for each seat, the eligible person with

1. the fewest duties so far  — equal *volume* of work,
2. then the fewest turns on **this particular post** — so the 6am duty
   rotates instead of landing on the same person every day,
3. then position after a rotating cursor, as a deterministic tie-break.

Criterion 1 alone balances counts but lets one person own the worst duty all
term; criterion 2 is what makes the roster feel fair rather than merely equal.

Seats that nobody can cover are reported rather than raising, matching the
other generators: the caller widens the staff pool or reduces duties.

Pure module: no Django, no ORM.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Hashable, Sequence


@dataclass(frozen=True)
class DutySeat:
    """One person-sized vacancy: post ``post_id`` on ``day``, seat ``index``."""

    key: Hashable
    day: Hashable
    post_id: Hashable
    start: int            # minutes from midnight, for overlap checks
    end: int
    index: int = 0        # 0..staff_required-1 within the post


@dataclass
class RosterResult:
    # seat key -> staff id
    assignments: dict[Hashable, Hashable] = field(default_factory=dict)
    # seat keys nobody could cover
    unfilled: list[Hashable] = field(default_factory=list)
    # staff id -> number of duties assigned
    load: dict[Hashable, int] = field(default_factory=dict)

    @property
    def is_complete(self) -> bool:
        return not self.unfilled

    @property
    def spread(self) -> int:
        """Difference between the busiest and quietest staff member."""
        if not self.load:
            return 0
        return max(self.load.values()) - min(self.load.values())


def _overlaps(a_start, a_end, b_start, b_end):
    """True when two [start, end) intervals intersect."""
    return a_start < b_end and b_start < a_end


def solve_duty_roster(
    seats: Sequence[DutySeat],
    staff: Sequence[Hashable],
    max_per_day: int = 1,
) -> RosterResult:
    """Fill every seat with a staff member, as evenly as possible.

    Parameters
    ----------
    seats:
        Vacancies to fill. ``key`` must be unique. Order is respected as the
        deterministic processing order.
    staff:
        The pool of people available for duty. Order provides the rotation.
    max_per_day:
        Most duties one person may hold on a single day (default 1).

    Returns
    -------
    RosterResult with the chosen person per seat, any seats left unfilled, and
    the resulting per-person load.

    Determinism: identical input yields identical output.
    """
    if max_per_day < 1:
        raise ValueError("max_per_day must be at least 1")
    keys = [s.key for s in seats]
    if len(set(keys)) != len(keys):
        raise ValueError("seat keys must be unique")

    staff = list(staff)
    assignments: dict[Hashable, Hashable] = {}
    unfilled: list[Hashable] = []
    load = {s: 0 for s in staff}

    # Per-person bookkeeping for the same-day constraints.
    day_count: dict[tuple, int] = {}          # (staff, day) -> duties that day
    day_intervals: dict[tuple, list] = {}     # (staff, day) -> [(start, end)]
    day_posts: dict[tuple, set] = {}          # (staff, day) -> {post_id}
    post_count: dict[tuple, int] = {}         # (staff, post_id) -> turns on it

    cursor = 0   # rotation pointer

    def eligible(person, seat):
        k = (person, seat.day)
        if day_count.get(k, 0) >= max_per_day:
            return False
        if seat.post_id in day_posts.get(k, ()):    # same post twice in a day
            return False
        for start, end in day_intervals.get(k, ()):
            if _overlaps(seat.start, seat.end, start, end):
                return False
        return True

    for seat in seats:
        if not staff:
            unfilled.append(seat.key)
            continue

        candidates = [p for p in staff if eligible(p, seat)]
        if not candidates:
            unfilled.append(seat.key)
            continue

        n = len(staff)
        pos = {p: (staff.index(p) - cursor) % n for p in candidates}
        # Fewest duties, then fewest turns on this post, then rotation order.
        chosen = min(
            candidates,
            key=lambda p: (load[p], post_count.get((p, seat.post_id), 0), pos[p]),
        )

        assignments[seat.key] = chosen
        load[chosen] += 1
        k = (chosen, seat.day)
        day_count[k] = day_count.get(k, 0) + 1
        day_intervals.setdefault(k, []).append((seat.start, seat.end))
        day_posts.setdefault(k, set()).add(seat.post_id)
        post_count[(chosen, seat.post_id)] = post_count.get((chosen, seat.post_id), 0) + 1
        cursor = (staff.index(chosen) + 1) % n

    return RosterResult(assignments=assignments, unfilled=unfilled, load=load)
