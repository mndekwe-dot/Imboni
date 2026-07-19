"""DB-aware orchestration for the dining-sitting planner.

Turns active classes into groups sized by their roster, asks the pure greedy
solver to seat them within each sitting's capacity, and maps the answer back.
`plan_dining` is side-effect free; `commit_dining` persists.
"""

from __future__ import annotations

from django.db import transaction

from apps.teacher.models import Class
from ..models import DiningAssignment, DiningSitting
from .dining_solver import DiningGroup, Sitting, solve_dining_plan

DEFAULT_MEALS = ["breakfast", "lunch", "supper"]


class DiningPlanError(ValueError):
    """Input the DOS can fix (no sittings, no classes, unknown meal)."""


def _class_label(class_obj):
    return f"S{class_obj.grade}{class_obj.section}"


def gather_groups(meals, class_ids=None):
    """One group per (class, meal): the class eats together at every meal."""
    qs = Class.objects.filter(is_active=True).order_by("grade", "section")
    if class_ids:
        qs = qs.filter(id__in=class_ids)

    classes = list(qs)
    groups, meta = [], {}
    for c in classes:
        size = c.student_count
        for meal in meals:
            key = (str(c.id), meal)
            groups.append(DiningGroup(key=key, size=size, meal=meal))
            meta[key] = {"class_obj": c, "size": size, "meal": meal}
    return groups, meta, classes


def plan_dining(term, *, meals=None, class_ids=None):
    """Build a proposed dining plan without touching the database.

    Returns ``{assignments, unassigned, occupancy, summary, warnings}``.
    Deterministic, so the preview a DOS approves is what commit persists.
    """
    meals = list(meals) if meals else list(DEFAULT_MEALS)
    unknown = [m for m in meals if m not in DEFAULT_MEALS]
    if unknown:
        raise DiningPlanError(f"Unknown meal(s): {', '.join(unknown)}")

    sitting_rows = list(
        DiningSitting.objects.filter(is_active=True, meal__in=meals)
        .order_by("meal", "order", "start_time")
    )
    if not sitting_rows:
        raise DiningPlanError(
            "No active dining sittings configured for the selected meal(s): "
            "add sittings (name, meal, times, seats) first."
        )

    groups, meta, classes = gather_groups(meals, class_ids=class_ids)
    if not classes:
        raise DiningPlanError("No active classes to seat.")

    sittings = [
        Sitting(key=str(s.id), capacity=s.capacity, meal=s.meal) for s in sitting_rows
    ]
    result = solve_dining_plan(groups, sittings)

    sitting_by_id = {str(s.id): s for s in sitting_rows}

    assignments = []
    for group in groups:
        sid = result.assignments.get(group.key)
        if sid is None:
            continue
        info = meta[group.key]
        sitting = sitting_by_id[sid]
        assignments.append({
            "class_id": group.key[0],
            "class_name": _class_label(info["class_obj"]),
            "students": info["size"],
            "meal": group.meal,
            "sitting_id": sid,
            "sitting_name": sitting.name,
            "start_time": sitting.start_time.strftime("%H:%M"),
            "end_time": sitting.end_time.strftime("%H:%M"),
        })
    assignments.sort(key=lambda a: (a["meal"], a["start_time"], a["class_name"]))

    unassigned = [{
        "class_name": _class_label(meta[key]["class_obj"]),
        "meal": meta[key]["meal"],
        "students": meta[key]["size"],
        "reason": reason,
    } for key, reason in result.unassigned]

    occupancy = [{
        "sitting_id": str(s.id),
        "sitting_name": s.name,
        "meal": s.meal,
        "seated": result.occupancy.get(str(s.id), 0),
        "capacity": s.capacity,
        "free": s.capacity - result.occupancy.get(str(s.id), 0),
    } for s in sitting_rows]

    warnings = []
    if unassigned:
        warnings.append(
            f"{len(unassigned)} class-meal(s) could not be seated: add a "
            "sitting or raise capacity."
        )
    for meal in meals:
        keys = [str(s.id) for s in sitting_rows if s.meal == meal]
        if len(keys) > 1 and result.spread_for(keys) > max(
            (meta[g.key]["size"] for g in groups if g.meal == meal), default=0
        ):
            warnings.append(f"{meal.title()} sittings are unevenly loaded.")

    total_students = sum(c.student_count for c in classes)
    return {
        "assignments": assignments,
        "unassigned": unassigned,
        "occupancy": occupancy,
        "summary": {
            "meals": len(meals),
            "classes": len(classes),
            "students": total_students,
            "sittings": len(sitting_rows),
            "seated": len(assignments),
            "unassigned": len(unassigned),
        },
        "warnings": warnings,
    }


@transaction.atomic
def commit_dining(term, *, replace=True, **plan_kwargs):
    """Persist a generated dining plan as DiningAssignment rows.

    With ``replace=True`` the term's assignments for the covered meals are
    cleared first, so regenerating is idempotent rather than duplicating.
    """
    plan = plan_dining(term, **plan_kwargs)
    meals = sorted({a["meal"] for a in plan["assignments"]})

    if replace and meals:
        DiningAssignment.objects.filter(
            term=term, sitting__meal__in=meals,
        ).delete()

    rows = [
        DiningAssignment(
            sitting_id=a["sitting_id"], term=term, class_obj_id=a["class_id"],
        )
        for a in plan["assignments"]
    ]
    DiningAssignment.objects.bulk_create(rows)

    return {
        "created": len(rows),
        "unassigned": plan["unassigned"],
        "occupancy": plan["occupancy"],
        "summary": plan["summary"],
        "warnings": plan["warnings"],
    }
