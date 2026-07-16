"""Service + endpoint tests for the timetable auto-generator. Needs the DB/tenant."""

import pytest

from apps.authentication.factories import (
    AcademicTermFactory, SubjectFactory, UserFactory,
)
from apps.dos.models import Room, TimetablePeriod
from apps.dos.scheduling.timetable_service import (
    TimetableError, commit_timetable, plan_timetable,
)
from apps.teacher.models import Class, SubjectTeacherAssignment, Timetable

pytestmark = pytest.mark.django_db

GEN_URL = "/imboni/dos/timetable/generate/"
COMMIT_URL = "/imboni/dos/timetable/generate/commit/"


def _make_class(grade, section):
    return Class.objects.create(name=f"S{grade}{section}", grade=grade, section=section)


def _assign(term, klass, subject, teacher, periods_per_week):
    return SubjectTeacherAssignment.objects.create(
        teacher=teacher, subject=subject, class_obj=klass, term=term,
        periods_per_week=periods_per_week,
    )


def _make_periods(times):
    for i, (start, end) in enumerate(times, start=1):
        TimetablePeriod.objects.create(
            order=i, label=f"P{i}", start_time=start, end_time=end, is_break=False,
        )


@pytest.fixture
def scenario():
    """One class taught three subjects, a five-period day and two rooms."""
    term = AcademicTermFactory()
    klass = _make_class("1", "A")
    teachers = [UserFactory(role="teacher") for _ in range(3)]
    subjects = [SubjectFactory() for _ in range(3)]
    for subj, tch in zip(subjects, teachers):
        _assign(term, klass, subj, tch, periods_per_week=2)
    _make_periods([
        ("08:00", "08:40"), ("08:40", "09:20"), ("09:20", "10:00"),
        ("10:20", "11:00"), ("11:00", "11:40"),
    ])
    Room.objects.create(name="Room 1")
    Room.objects.create(name="Room 2")
    return {"term": term, "klass": klass, "teachers": teachers, "subjects": subjects}


# ── service ──────────────────────────────────────────────────────────────────

def test_plan_places_all_lessons_in_distinct_slots(scenario):
    plan = plan_timetable(scenario["term"])

    # 3 subjects x 2 periods each = 6 lessons, all placed.
    assert plan["summary"]["scheduled"] == 6
    assert plan["unscheduled"] == []
    # One class -> every lesson lands in a different (day, start_time) slot.
    slots = {(a["day"], a["start_time"]) for a in plan["assignments"]}
    assert len(slots) == 6


def test_plan_never_double_books_a_shared_teacher(scenario):
    # A second class shares a teacher with the first -> that teacher can never
    # appear twice in the same (day, start_time) slot.
    term = scenario["term"]
    other = _make_class("2", "B")
    _assign(term, other, scenario["subjects"][0], scenario["teachers"][0],
            periods_per_week=2)

    plan = plan_timetable(term)
    by_slot = {}
    for a in plan["assignments"]:
        by_slot.setdefault((a["day"], a["start_time"]), []).append(a)
    for group in by_slot.values():
        teachers = [a["teacher_id"] for a in group]
        assert len(teachers) == len(set(teachers))  # no double-booked teacher


def test_plan_is_side_effect_free(scenario):
    plan_timetable(scenario["term"])
    assert Timetable.objects.count() == 0


def test_plan_raises_when_no_lessons():
    term = AcademicTermFactory()
    _make_periods([("08:00", "08:40")])
    klass = _make_class("3", "C")
    # periods_per_week=0 -> nothing to schedule.
    _assign(term, klass, SubjectFactory(), UserFactory(role="teacher"),
            periods_per_week=0)
    with pytest.raises(TimetableError):
        plan_timetable(term)


def test_plan_raises_when_no_periods_configured():
    term = AcademicTermFactory()
    klass = _make_class("4", "D")
    _assign(term, klass, SubjectFactory(), UserFactory(role="teacher"),
            periods_per_week=2)
    with pytest.raises(TimetableError):
        plan_timetable(term)


def test_no_rooms_warns_and_uses_blank_room():
    term = AcademicTermFactory()
    _make_periods([("08:00", "08:40"), ("08:40", "09:20")])
    klass = _make_class("5", "E")
    _assign(term, klass, SubjectFactory(), UserFactory(role="teacher"),
            periods_per_week=2)
    plan = plan_timetable(term)

    assert plan["summary"]["venues"] == 0
    assert any("room" in w.lower() for w in plan["warnings"])
    assert plan["assignments"][0]["room"] == ""


def test_commit_persists_and_replaces(scenario):
    term = scenario["term"]
    first = commit_timetable(term)
    assert first["created"] == 6
    assert Timetable.objects.filter(term=term).count() == 6

    # Regenerating with replace=True must not duplicate.
    commit_timetable(term)
    assert Timetable.objects.filter(term=term).count() == 6


# ── endpoints ────────────────────────────────────────────────────────────────

def test_generate_endpoint_previews_without_persisting(make_authenticated_client, scenario):
    client, _ = make_authenticated_client("dos")
    resp = client.post(GEN_URL, {
        "term_id": str(scenario["term"].id),
    }, format="json")

    assert resp.status_code == 200
    assert resp.data["summary"]["scheduled"] == 6
    assert Timetable.objects.count() == 0


def test_commit_endpoint_creates_rows(make_authenticated_client, scenario):
    client, _ = make_authenticated_client("dos")
    resp = client.post(COMMIT_URL, {
        "term_id": str(scenario["term"].id),
    }, format="json")

    assert resp.status_code == 201
    assert resp.data["created"] == 6
    assert Timetable.objects.filter(term=scenario["term"]).count() == 6


def test_generate_requires_dos_or_admin(make_authenticated_client, scenario):
    client, _ = make_authenticated_client("teacher")
    resp = client.post(GEN_URL, {
        "term_id": str(scenario["term"].id),
    }, format="json")
    assert resp.status_code == 403


def test_generate_bad_term_returns_400(make_authenticated_client):
    client, _ = make_authenticated_client("dos")
    resp = client.post(GEN_URL, {
        "term_id": "00000000-0000-0000-0000-000000000000",
    }, format="json")
    assert resp.status_code == 400
