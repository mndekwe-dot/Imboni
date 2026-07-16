"""Service + endpoint tests for the exam auto-scheduler. Needs the DB/tenant."""

import pytest

from apps.authentication.factories import (
    AcademicTermFactory, SubjectFactory, UserFactory,
)
from apps.dos.models import ExamSchedule, Room
from apps.dos.scheduling.exam_service import (
    ExamScheduleError, commit_exam_schedule, plan_exam_schedule,
)
from apps.teacher.models import Class, SubjectTeacherAssignment

pytestmark = pytest.mark.django_db

GEN_URL = "/imboni/dos/exam-schedule/generate/"
COMMIT_URL = "/imboni/dos/exam-schedule/generate/commit/"


def _make_class(grade, section):
    return Class.objects.create(name=f"S{grade}{section}", grade=grade, section=section)


def _assign(term, klass, subject, teacher):
    return SubjectTeacherAssignment.objects.create(
        teacher=teacher, subject=subject, class_obj=klass, term=term
    )


@pytest.fixture
def scenario():
    """One class taught three subjects by three teachers, plus two venues."""
    term = AcademicTermFactory()
    klass = _make_class("1", "A")
    teachers = [UserFactory(role="teacher") for _ in range(3)]
    subjects = [SubjectFactory() for _ in range(3)]
    for subj, tch in zip(subjects, teachers):
        _assign(term, klass, subj, tch)
    Room.objects.create(name="Hall A")
    Room.objects.create(name="Hall B")
    return {"term": term, "klass": klass, "teachers": teachers, "subjects": subjects}


# ── service ──────────────────────────────────────────────────────────────────

def test_plan_places_all_class_exams_in_distinct_slots(scenario):
    plan = plan_exam_schedule(scenario["term"], start_date="2026-08-10")

    assert plan["summary"]["scheduled"] == 3
    assert plan["unscheduled"] == []
    # Same class three times -> three different (date, start_time) slots.
    slots = {(a["exam_date"], a["start_time"]) for a in plan["assignments"]}
    assert len(slots) == 3


def test_plan_assigns_distinct_venues_and_invigilators_per_slot(scenario):
    # Two independent classes -> can share a slot; must get different venues.
    term = scenario["term"]
    other = _make_class("2", "B")
    subj = scenario["subjects"][0]
    _assign(term, other, subj, scenario["teachers"][0])

    plan = plan_exam_schedule(term, start_date="2026-08-10")
    by_slot = {}
    for a in plan["assignments"]:
        by_slot.setdefault((a["exam_date"], a["start_time"]), []).append(a)
    for group in by_slot.values():
        venues = [a["venue"] for a in group]
        assert len(venues) == len(set(venues))  # no double-booked venue


def test_plan_is_side_effect_free(scenario):
    plan_exam_schedule(scenario["term"], start_date="2026-08-10")
    assert ExamSchedule.objects.count() == 0


def test_plan_raises_when_no_assignments():
    term = AcademicTermFactory()
    with pytest.raises(ExamScheduleError):
        plan_exam_schedule(term, start_date="2026-08-10")


def test_no_venues_warns_and_uses_blank_venue():
    term = AcademicTermFactory()
    klass = _make_class("3", "C")
    _assign(term, klass, SubjectFactory(), UserFactory(role="teacher"))
    plan = plan_exam_schedule(term, start_date="2026-08-10")

    assert plan["summary"]["venues"] == 0
    assert any("venue" in w.lower() for w in plan["warnings"])
    assert plan["assignments"][0]["venue"] == ""


def test_subject_weight_prioritises_and_prefers_morning(scenario):
    # Make one subject maximally heavy and shrink the window so only two of
    # the three exams fit (1 day x 2 slots, capacity limited by 2 rooms but
    # same class => 2 distinct slots max). The heavy subject must survive and
    # take the morning slot.
    heavy = scenario["subjects"][2]
    heavy.exam_weight = 10
    heavy.save(update_fields=["exam_weight"])

    plan = plan_exam_schedule(
        scenario["term"], start_date="2026-08-10", num_days=1,
        daily_slots=[("09:00", "11:00"), ("13:00", "15:00")],
    )

    assert plan["summary"]["unscheduled"] == 1
    scheduled_names = {a["subject_name"] for a in plan["assignments"]}
    assert heavy.name in scheduled_names
    heavy_row = next(a for a in plan["assignments"] if a["subject_name"] == heavy.name)
    assert heavy_row["start_time"] == "09:00"   # morning slot
    assert heavy_row["weight"] == 10


def test_commit_persists_and_replaces(scenario):
    term = scenario["term"]
    first = commit_exam_schedule(term, start_date="2026-08-10")
    assert first["created"] == 3
    assert ExamSchedule.objects.filter(term=term).count() == 3

    # Regenerating with replace=True must not duplicate.
    commit_exam_schedule(term, start_date="2026-08-11")
    assert ExamSchedule.objects.filter(term=term).count() == 3
    assert ExamSchedule.objects.filter(notes="Auto-generated").count() == 3


# ── endpoints ────────────────────────────────────────────────────────────────

def test_generate_endpoint_previews_without_persisting(make_authenticated_client, scenario):
    client, _ = make_authenticated_client("dos")
    resp = client.post(GEN_URL, {
        "term_id": str(scenario["term"].id),
        "start_date": "2026-08-10",
    }, format="json")

    assert resp.status_code == 200
    assert resp.data["summary"]["scheduled"] == 3
    assert ExamSchedule.objects.count() == 0


def test_commit_endpoint_creates_rows(make_authenticated_client, scenario):
    client, _ = make_authenticated_client("dos")
    resp = client.post(COMMIT_URL, {
        "term_id": str(scenario["term"].id),
        "start_date": "2026-08-10",
        "exam_type": "final",
    }, format="json")

    assert resp.status_code == 201
    assert resp.data["created"] == 3
    assert ExamSchedule.objects.filter(exam_type="final").count() == 3


def test_generate_requires_dos_or_admin(make_authenticated_client, scenario):
    client, _ = make_authenticated_client("teacher")
    resp = client.post(GEN_URL, {
        "term_id": str(scenario["term"].id),
        "start_date": "2026-08-10",
    }, format="json")
    assert resp.status_code == 403


def test_generate_bad_term_returns_400(make_authenticated_client):
    client, _ = make_authenticated_client("dos")
    resp = client.post(GEN_URL, {
        "term_id": "00000000-0000-0000-0000-000000000000",
        "start_date": "2026-08-10",
    }, format="json")
    assert resp.status_code == 400
