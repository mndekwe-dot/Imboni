"""DB-aware orchestration for the duty-roster generator.

Expands active duty posts across the requested days into seats, asks the pure
round-robin solver to fill them fairly, then maps the answer back onto staff
records. `plan_duty_roster` is side-effect free; `commit_duty_roster` persists.
"""

from __future__ import annotations

from django.db import transaction

from apps.authentication.models import User
from ..models import DutyAssignment, DutyPost
from .duty_solver import DutySeat, solve_duty_roster

# Weekdays a roster covers by default (Mon-Fri). Saturday/Sunday are available
# for boarding schools that ask for them explicitly.
DEFAULT_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday"]
_DAY_ORDER = {d: i for i, d in enumerate(
    DEFAULT_DAYS + ["saturday", "sunday"]
)}

# Roles that can be put on supervision duty.
DUTY_ROLES = ["teacher", "discipline", "matron"]


class DutyRosterError(ValueError):
    """Input the DOS can fix (no posts configured, no staff, bad day)."""


def _minutes(t):
    return t.hour * 60 + t.minute


def build_seats(posts, days):
    """One :class:`DutySeat` per (day, post, required-staff-slot)."""
    seats = []
    for day in days:
        for post in posts:
            for i in range(max(post.staff_required, 1)):
                seats.append(DutySeat(
                    key=(day, str(post.id), i),
                    day=day,
                    post_id=str(post.id),
                    start=_minutes(post.start_time),
                    end=_minutes(post.end_time),
                    index=i,
                ))
    return seats


def gather_staff(role_filter=None):
    """Active staff eligible for duty, in a stable order."""
    roles = role_filter or DUTY_ROLES
    return list(
        User.objects.filter(role__in=roles, is_active=True)
        .order_by("first_name", "last_name", "id")
    )


def plan_duty_roster(term, *, days=None, max_per_day=1, roles=None):
    """Build a proposed duty roster without touching the database.

    Returns ``{assignments, unfilled, load, summary, warnings}``. Deterministic,
    so the preview a DOS approves is what commit persists.
    """
    days = list(days) if days else list(DEFAULT_DAYS)
    unknown = [d for d in days if d not in _DAY_ORDER]
    if unknown:
        raise DutyRosterError(f"Unknown day(s): {', '.join(unknown)}")
    days.sort(key=lambda d: _DAY_ORDER[d])

    posts = list(DutyPost.objects.filter(is_active=True).order_by("order", "start_time"))
    if not posts:
        raise DutyRosterError(
            "No active duty posts configured: add posts (name, times, staff "
            "needed) before generating a roster."
        )

    staff = gather_staff(roles)
    if not staff:
        raise DutyRosterError("No active staff available for duty.")

    seats = build_seats(posts, days)
    result = solve_duty_roster(
        seats, [str(s.id) for s in staff], max_per_day=max_per_day,
    )

    post_by_id = {str(p.id): p for p in posts}
    staff_by_id = {str(s.id): s for s in staff}

    assignments = []
    for seat in seats:
        staff_id = result.assignments.get(seat.key)
        if staff_id is None:
            continue
        post = post_by_id[seat.post_id]
        person = staff_by_id[staff_id]
        assignments.append({
            "day": seat.day,
            "post_id": seat.post_id,
            "post_name": post.name,
            "start_time": post.start_time.strftime("%H:%M"),
            "end_time": post.end_time.strftime("%H:%M"),
            "seat": seat.index,
            "staff_id": staff_id,
            "staff_name": person.full_name,
            "staff_role": person.role,
        })
    assignments.sort(key=lambda a: (_DAY_ORDER[a["day"]], a["start_time"], a["seat"]))

    unfilled = [{
        "day": key[0],
        "post_name": post_by_id[key[1]].name,
        "seat": key[2],
    } for key in result.unfilled]

    load = [{
        "staff_id": sid,
        "staff_name": staff_by_id[sid].full_name,
        "duties": count,
    } for sid, count in sorted(
        result.load.items(), key=lambda kv: (-kv[1], staff_by_id[kv[0]].full_name)
    )]

    warnings = []
    if unfilled:
        warnings.append(
            f"{len(unfilled)} duty slot(s) could not be filled: add staff, "
            "raise the per-day limit, or reduce the posts."
        )
    if result.spread > 1:
        warnings.append(
            f"Duty load is uneven (busiest staff has {result.spread} more than "
            "the quietest) because availability constraints forced it."
        )

    return {
        "assignments": assignments,
        "unfilled": unfilled,
        "load": load,
        "summary": {
            "days": len(days),
            "posts": len(posts),
            "seats": len(seats),
            "filled": len(assignments),
            "unfilled": len(unfilled),
            "staff": len(staff),
            "spread": result.spread,
        },
        "warnings": warnings,
    }


@transaction.atomic
def commit_duty_roster(term, *, replace=True, **plan_kwargs):
    """Persist a generated roster as DutyAssignment rows.

    With ``replace=True`` the term's existing roster for the covered days is
    cleared first, so regenerating is idempotent rather than duplicating.
    """
    plan = plan_duty_roster(term, **plan_kwargs)
    days = sorted({a["day"] for a in plan["assignments"]}, key=lambda d: _DAY_ORDER[d])

    if replace and days:
        DutyAssignment.objects.filter(term=term, day__in=days).delete()

    rows = [
        DutyAssignment(
            post_id=a["post_id"],
            term=term,
            day=a["day"],
            staff_id=a["staff_id"],
        )
        for a in plan["assignments"]
    ]
    DutyAssignment.objects.bulk_create(rows)

    return {
        "created": len(rows),
        "unfilled": plan["unfilled"],
        "load": plan["load"],
        "summary": plan["summary"],
        "warnings": plan["warnings"],
    }
