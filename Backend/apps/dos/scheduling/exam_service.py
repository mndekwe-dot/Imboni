"""DB-aware orchestration for the exam auto-scheduler.

Gathers the inputs (which exams to run, which venues/invigilators exist),
delegates the hard temporal placement to the pure DSatur solver, then greedily
assigns a concrete venue and invigilator to each placed exam.

`plan_exam_schedule` is side-effect free (used by the preview endpoint).
`commit_exam_schedule` persists the same plan as ExamSchedule rows.
"""

from __future__ import annotations

from datetime import date, datetime, time, timedelta

from django.db import transaction

from apps.authentication.models import User
from apps.results.models import AcademicTerm
from apps.teacher.models import SubjectTeacherAssignment
from ..models import ExamSchedule, Room
from .exam_solver import Exam, solve_exam_schedule

# Sensible defaults if the caller doesn't specify a bell pattern for exam days.
DEFAULT_DAILY_SLOTS = [("09:00", "11:00"), ("13:00", "15:00")]
DEFAULT_NUM_DAYS = 5


class ExamScheduleError(ValueError):
    """Input the DOS can fix (no exams to place, bad date, etc.)."""


# ── input helpers ────────────────────────────────────────────────────────────

def _parse_date(value) -> date:
    if isinstance(value, date):
        return value
    try:
        return datetime.strptime(str(value), "%Y-%m-%d").date()
    except (ValueError, TypeError):
        raise ExamScheduleError(f"Invalid date: {value!r} (expected YYYY-MM-DD)")


def _parse_time(value) -> time:
    if isinstance(value, time):
        return value
    for fmt in ("%H:%M", "%H:%M:%S"):
        try:
            return datetime.strptime(str(value), fmt).time()
        except ValueError:
            continue
    raise ExamScheduleError(f"Invalid time: {value!r} (expected HH:MM)")


def build_slots(start_date, num_days, daily_slots, skip_weekends=True):
    """Ordered list of concrete time-slots.

    Returns dicts ``{index, date, start_time, end_time}`` in chronological order.
    Weekends are skipped by default so exams land on school days.
    """
    start = _parse_date(start_date)
    periods = [(_parse_time(s), _parse_time(e)) for s, e in daily_slots]
    if not periods:
        raise ExamScheduleError("At least one daily slot is required.")

    slots = []
    day = start
    days_used = 0
    # Guard against an infinite loop if num_days is absurd.
    while days_used < num_days and (day - start).days < 366:
        if skip_weekends and day.weekday() >= 5:  # 5=Sat, 6=Sun
            day += timedelta(days=1)
            continue
        for start_time, end_time in periods:
            slots.append({
                "index": len(slots),
                "date": day,
                "start_time": start_time,
                "end_time": end_time,
            })
        days_used += 1
        day += timedelta(days=1)
    return slots


def gather_exam_units(term, class_ids=None):
    """One exam per (class, subject) taught in the term.

    Derived from SubjectTeacherAssignment so we schedule exactly the subjects
    each class is actually taught. The assignment's teacher is remembered as the
    preferred invigilator.
    """
    qs = (SubjectTeacherAssignment.objects
          .filter(term=term)
          .select_related("subject", "class_obj", "teacher"))
    if class_ids:
        qs = qs.filter(class_obj_id__in=class_ids)

    units = {}
    for a in qs:
        if a.class_obj is None:
            continue
        key = (str(a.class_obj_id), str(a.subject_id))
        # First assignment wins as the preferred invigilator; dedupe co-teachers.
        units.setdefault(key, {
            "class_obj": a.class_obj,
            "subject": a.subject,
            "preferred_invigilator": a.teacher,
        })
    return units


# ── planning ─────────────────────────────────────────────────────────────────

def _class_label(class_obj):
    return f"S{class_obj.grade}{class_obj.section}"


def plan_exam_schedule(
    term,
    *,
    exam_type="midterm",
    start_date,
    num_days=DEFAULT_NUM_DAYS,
    daily_slots=None,
    skip_weekends=True,
    class_ids=None,
    title_template="{subject} Exam",
):
    """Build a proposed exam timetable without touching the database.

    Returns ``{assignments, unscheduled, summary}``. Deterministic for a given
    input, so the preview a DOS approves matches what commit will persist.
    """
    daily_slots = daily_slots or DEFAULT_DAILY_SLOTS
    units = gather_exam_units(term, class_ids=class_ids)
    if not units:
        raise ExamScheduleError(
            "No subject-teacher assignments found for this term, so there are "
            "no exams to schedule."
        )

    slots = build_slots(start_date, num_days, daily_slots, skip_weekends)

    rooms = list(Room.objects.filter(is_active=True).order_by("name"))
    # Each concurrent exam needs a venue; with no rooms configured we fall back
    # to one-exam-per-slot and leave the venue blank (surfaced as a warning).
    slot_capacity = len(rooms) if rooms else 1

    teachers = list(
        User.objects.filter(role="teacher", is_active=True)
        .order_by("first_name", "last_name", "id")
    )

    exams = [Exam(key=key, group=key[0]) for key in units]  # group = class id
    result = solve_exam_schedule(exams, num_slots=len(slots), slot_capacity=slot_capacity)

    # Group placed exams by slot so venue/invigilator assignment can dedupe
    # within a slot.
    by_slot = {}
    for key, slot_index in result.placements.items():
        by_slot.setdefault(slot_index, []).append(key)

    assignments = []
    for slot_index in sorted(by_slot):
        slot = slots[slot_index]
        used_invigilators = set()
        for i, key in enumerate(by_slot[slot_index]):
            unit = units[key]
            venue = rooms[i].name if rooms else ""

            invig = _pick_invigilator(unit["preferred_invigilator"], teachers, used_invigilators)
            if invig is not None:
                used_invigilators.add(invig.id)

            assignments.append({
                "class_id": key[0],
                "class_name": _class_label(unit["class_obj"]),
                "subject_id": key[1],
                "subject_name": unit["subject"].name,
                "title": title_template.format(subject=unit["subject"].name,
                                               klass=_class_label(unit["class_obj"])),
                "exam_type": exam_type,
                "exam_date": slot["date"].isoformat(),
                "start_time": slot["start_time"].strftime("%H:%M"),
                "end_time": slot["end_time"].strftime("%H:%M"),
                "venue": venue,
                "invigilator_id": str(invig.id) if invig else None,
                "invigilator_name": invig.full_name if invig else None,
            })

    # Stable output order: by date, then time, then class.
    assignments.sort(key=lambda a: (a["exam_date"], a["start_time"], a["class_name"]))

    unscheduled = [{
        "class_name": _class_label(units[key]["class_obj"]),
        "subject_name": units[key]["subject"].name,
    } for key in result.unscheduled]

    warnings = []
    if not rooms:
        warnings.append("No active venues configured — exams were placed one at "
                        "a time and left without a venue.")
    if unscheduled:
        warnings.append(f"{len(unscheduled)} exam(s) did not fit — widen the exam "
                        "window (more days or slots) and regenerate.")

    return {
        "assignments": assignments,
        "unscheduled": unscheduled,
        "summary": {
            "total_exams": len(units),
            "scheduled": len(assignments),
            "unscheduled": len(unscheduled),
            "slots_available": len(slots),
            "venues": len(rooms),
        },
        "warnings": warnings,
    }


def _pick_invigilator(preferred, teachers, used_in_slot):
    """Prefer the subject teacher; otherwise the first teacher free this slot."""
    if preferred is not None and preferred.id not in used_in_slot:
        return preferred
    for t in teachers:
        if t.id not in used_in_slot:
            return t
    return None


# ── commit ───────────────────────────────────────────────────────────────────

@transaction.atomic
def commit_exam_schedule(term, *, replace=True, **plan_kwargs):
    """Persist a generated plan as ExamSchedule rows.

    With ``replace=True`` (default) existing exams for this term + exam_type are
    cleared first, so regenerating is idempotent rather than duplicating.
    """
    exam_type = plan_kwargs.get("exam_type", "midterm")
    plan = plan_exam_schedule(term, **plan_kwargs)

    if replace:
        ExamSchedule.objects.filter(term=term, exam_type=exam_type).delete()

    rows = [
        ExamSchedule(
            title=a["title"],
            subject_id=a["subject_id"],
            class_obj_id=a["class_id"],
            term=term,
            exam_date=a["exam_date"],
            start_time=a["start_time"],
            end_time=a["end_time"],
            venue=a["venue"],
            exam_type=exam_type,
            invigilator_id=a["invigilator_id"],
            notes="Auto-generated",
        )
        for a in plan["assignments"]
    ]
    ExamSchedule.objects.bulk_create(rows)

    return {
        "created": len(rows),
        "unscheduled": plan["unscheduled"],
        "summary": plan["summary"],
        "warnings": plan["warnings"],
    }
