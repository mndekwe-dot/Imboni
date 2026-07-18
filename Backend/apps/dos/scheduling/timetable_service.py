"""DB-aware orchestration for the weekly class-timetable auto-generator.

Gathers the inputs (which lessons each class needs, which periods/rooms exist),
delegates the hard temporal placement to the pure backtracking CSP solver, then
greedily assigns a concrete room to each placed lesson.

`plan_timetable` is side-effect free (used by the preview endpoint).
`commit_timetable` persists the same plan as teacher.Timetable rows.
"""

from __future__ import annotations

from django.db import transaction

from apps.teacher.models import SubjectTeacherAssignment, Timetable
from ..models import Room, TimetablePeriod
from .timetable_solver import Lesson, solve_timetable

# The five teaching weekdays, in order. slot_days entries use these strings.
DEFAULT_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday"]
_DAY_ORDER = {day: i for i, day in enumerate(DEFAULT_DAYS)}


class TimetableError(ValueError):
    """Input the DOS can fix (no lessons to place, no periods configured, etc.)."""


# ── input helpers ────────────────────────────────────────────────────────────

def build_slots(days, periods):
    """Ordered list of schedulable (day, period) slots.

    The schedulable slots are the cartesian product of ``days`` (weekday
    strings) x ``periods`` (active, non-break :class:`TimetablePeriod` rows,
    already ordered by ``order``). Returns dicts
    ``{index, day, period, start_time, end_time}``; ``slot_days[i]`` is the
    day string of slot ``i``.
    """
    slots = []
    for day in days:
        for period in periods:
            slots.append({
                "index": len(slots),
                "day": day,
                "period": period,
                # Position within the day (0 = first period), so heavier
                # subjects can prefer earlier periods.
                "pos": len(slots) % max(len(periods), 1),
                "start_time": period.start_time,
                "end_time": period.end_time,
            })
    return slots


def gather_lessons(term, class_ids=None):
    """Expand each subject-teacher assignment into its weekly lessons.

    Every :class:`SubjectTeacherAssignment` with ``periods_per_week > 0`` in the
    term contributes that many :class:`Lesson` instances (one per weekly period),
    each keyed ``(class_id, subject_id, i)``. Returns ``(lessons, meta)`` where
    ``meta`` maps a lesson key -> ``{class_obj, subject, teacher}``.
    """
    qs = (SubjectTeacherAssignment.objects
          .filter(term=term, periods_per_week__gt=0)
          .select_related("subject", "class_obj", "teacher"))
    if class_ids:
        qs = qs.filter(class_obj_id__in=class_ids)

    lessons = []
    meta = {}
    for a in qs:
        if a.class_obj is None:
            continue
        for i in range(a.periods_per_week):
            key = (str(a.class_obj_id), str(a.subject_id), i)
            lessons.append(Lesson(
                key=key,
                class_id=str(a.class_obj_id),
                teacher_id=str(a.teacher_id),
                subject_id=str(a.subject_id),
                weight=a.subject.timetable_weight,
            ))
            meta[key] = {
                "class_obj": a.class_obj,
                "subject": a.subject,
                "teacher": a.teacher,
            }
    return lessons, meta


# ── planning ─────────────────────────────────────────────────────────────────

def _class_label(class_obj):
    return f"S{class_obj.grade}{class_obj.section}"


def plan_timetable(term, *, class_ids=None, days=None):
    """Build a proposed weekly timetable without touching the database.

    Returns ``{assignments, unscheduled, summary, warnings}``. Deterministic for
    a given input, so the preview a DOS approves matches what commit will
    persist.
    """
    days = days or list(DEFAULT_DAYS)

    periods = list(
        TimetablePeriod.objects.filter(is_active=True, is_break=False).order_by("order")
    )
    if not periods:
        raise TimetableError(
            "No schedulable periods configured — add active, non-break periods "
            "to the bell schedule and try again."
        )

    lessons, meta = gather_lessons(term, class_ids=class_ids)
    if not lessons:
        raise TimetableError(
            "No lessons to schedule — set a weekly period count on the "
            "subject-teacher assignments for this term and try again."
        )

    slots = build_slots(days, periods)

    rooms = list(Room.objects.filter(is_active=True).order_by("name"))
    # Each concurrent lesson needs a room; with no rooms configured we fall back
    # to one-lesson-per-slot and leave the room blank (surfaced as a warning).
    slot_capacity = len(rooms) if rooms else 1

    result = solve_timetable(
        lessons,
        num_slots=len(slots),
        slot_days=[s["day"] for s in slots],
        slot_capacity=slot_capacity,
        slot_positions=[s["pos"] for s in slots],
    )

    # Group placed lessons by slot so room assignment can dedupe within a slot.
    by_slot = {}
    for key, slot_index in result.placements.items():
        by_slot.setdefault(slot_index, []).append(key)

    assignments = []
    for slot_index in sorted(by_slot):
        slot = slots[slot_index]
        for i, key in enumerate(by_slot[slot_index]):
            info = meta[key]
            room = rooms[i].name if rooms else ""
            teacher = info["teacher"]
            assignments.append({
                "class_id": key[0],
                "class_name": _class_label(info["class_obj"]),
                "subject_id": key[1],
                "subject_name": info["subject"].name,
                "weight": info["subject"].timetable_weight,
                "teacher_id": str(teacher.id) if teacher else None,
                "teacher_name": teacher.full_name if teacher else None,
                "day": slot["day"],
                "start_time": slot["start_time"].strftime("%H:%M"),
                "end_time": slot["end_time"].strftime("%H:%M"),
                "room": room,
            })

    # Stable output order: by weekday, then time, then class.
    assignments.sort(key=lambda a: (_DAY_ORDER.get(a["day"], 99), a["start_time"], a["class_name"]))

    unscheduled = [{
        "class_name": _class_label(meta[key]["class_obj"]),
        "subject_name": meta[key]["subject"].name,
    } for key in result.unscheduled]

    warnings = []
    if not rooms:
        warnings.append("No active rooms configured — lessons were placed one at "
                        "a time and left without a room.")
    if unscheduled:
        warnings.append(f"{len(unscheduled)} lesson(s) did not fit — widen the grid "
                        "(more periods, days or rooms) and regenerate.")

    return {
        "assignments": assignments,
        "unscheduled": unscheduled,
        "summary": {
            "total_lessons": len(lessons),
            "scheduled": len(assignments),
            "unscheduled": len(unscheduled),
            "slots_available": len(slots),
            "venues": len(rooms),
        },
        "warnings": warnings,
    }


# ── commit ───────────────────────────────────────────────────────────────────

@transaction.atomic
def commit_timetable(term, *, replace=True, **plan_kwargs):
    """Persist a generated plan as teacher.Timetable rows.

    With ``replace=True`` (default) existing timetable rows for this term (and
    the given classes, if any) are cleared first, so regenerating is idempotent
    rather than duplicating.
    """
    class_ids = plan_kwargs.get("class_ids")
    plan = plan_timetable(term, **plan_kwargs)

    if replace:
        existing = Timetable.objects.filter(term=term)
        if class_ids:
            existing = existing.filter(class_obj_id__in=class_ids)
        existing.delete()

    rows = [
        Timetable(
            class_obj_id=a["class_id"],
            subject_id=a["subject_id"],
            teacher_id=a["teacher_id"],
            term=term,
            day=a["day"],
            start_time=a["start_time"],
            end_time=a["end_time"],
            room_number=a["room"],
        )
        for a in plan["assignments"]
    ]
    Timetable.objects.bulk_create(rows)

    return {
        "created": len(rows),
        "unscheduled": plan["unscheduled"],
        "summary": plan["summary"],
        "warnings": plan["warnings"],
    }
