"""Service + endpoint tests for the duty-roster generator. Needs the DB/tenant."""

import pytest

from apps.authentication.factories import AcademicTermFactory, UserFactory
from apps.dos.models import DutyAssignment, DutyPost
from apps.dos.scheduling.duty_service import (
    DutyRosterError, commit_duty_roster, plan_duty_roster,
)

pytestmark = pytest.mark.django_db

POSTS_URL = "/imboni/dos/duty-posts/"
ROSTER_URL = "/imboni/dos/duty-roster/"
GEN_URL = "/imboni/dos/duty-roster/generate/"
COMMIT_URL = "/imboni/dos/duty-roster/generate/commit/"


def _post(name, start, end, required=1, order=0):
    return DutyPost.objects.create(
        name=name, start_time=start, end_time=end,
        staff_required=required, order=order,
    )


@pytest.fixture
def scenario():
    """Two duty posts and five teachers."""
    term = AcademicTermFactory()
    _post("Morning Assembly", "07:30", "08:00", order=1)
    _post("Break Supervision", "10:00", "10:30", order=2)
    staff = [UserFactory(role="teacher") for _ in range(5)]
    return {"term": term, "staff": staff}


# ── service ──────────────────────────────────────────────────────────────────

def test_plan_fills_every_seat_and_spreads_load(scenario):
    plan = plan_duty_roster(scenario["term"])

    # 2 posts x 5 weekdays = 10 seats, 5 staff, max 1 duty/day.
    assert plan["summary"]["seats"] == 10
    assert plan["summary"]["unfilled"] == 0
    assert plan["summary"]["spread"] <= 1


def test_plan_respects_max_per_day(scenario):
    plan = plan_duty_roster(scenario["term"], max_per_day=1)
    by_day_staff = {}
    for a in plan["assignments"]:
        key = (a["day"], a["staff_id"])
        by_day_staff[key] = by_day_staff.get(key, 0) + 1
    assert all(v == 1 for v in by_day_staff.values())


def test_plan_is_side_effect_free(scenario):
    plan_duty_roster(scenario["term"])
    assert DutyAssignment.objects.count() == 0


def test_plan_honours_requested_days(scenario):
    plan = plan_duty_roster(scenario["term"], days=["monday", "tuesday"])
    assert plan["summary"]["days"] == 2
    assert {a["day"] for a in plan["assignments"]} == {"monday", "tuesday"}


def test_plan_rejects_unknown_day(scenario):
    with pytest.raises(DutyRosterError):
        plan_duty_roster(scenario["term"], days=["funday"])


def test_plan_raises_without_posts():
    term = AcademicTermFactory()
    UserFactory(role="teacher")
    with pytest.raises(DutyRosterError):
        plan_duty_roster(term)


def test_plan_raises_without_staff():
    term = AcademicTermFactory()
    _post("Assembly", "07:30", "08:00")
    with pytest.raises(DutyRosterError):
        plan_duty_roster(term)


def test_understaffed_roster_reports_unfilled():
    term = AcademicTermFactory()
    _post("Assembly", "07:30", "08:00")
    _post("Break", "10:00", "10:30")
    UserFactory(role="teacher")   # one person, two posts a day, max 1/day
    plan = plan_duty_roster(term, days=["monday"], max_per_day=1)

    assert plan["summary"]["unfilled"] == 1
    assert any("could not be filled" in w for w in plan["warnings"])


def test_commit_persists_and_replaces(scenario):
    term = scenario["term"]
    first = commit_duty_roster(term, days=["monday"])
    assert first["created"] == 2
    assert DutyAssignment.objects.filter(term=term).count() == 2

    commit_duty_roster(term, days=["monday"])
    assert DutyAssignment.objects.filter(term=term).count() == 2   # no duplicates


# ── endpoints ────────────────────────────────────────────────────────────────

def test_generate_endpoint_previews_without_persisting(make_authenticated_client, scenario):
    client, _ = make_authenticated_client("dos")
    resp = client.post(GEN_URL, {"term_id": str(scenario["term"].id)}, format="json")

    assert resp.status_code == 200
    assert resp.data["summary"]["filled"] == 10
    assert DutyAssignment.objects.count() == 0


def test_commit_endpoint_creates_rows(make_authenticated_client, scenario):
    client, _ = make_authenticated_client("dos")
    resp = client.post(COMMIT_URL, {
        "term_id": str(scenario["term"].id), "days": ["monday", "tuesday"],
    }, format="json")

    assert resp.status_code == 201
    assert resp.data["created"] == 4
    assert DutyAssignment.objects.count() == 4


def test_roster_list_endpoint_returns_saved_roster(make_authenticated_client, scenario):
    client, _ = make_authenticated_client("dos")
    commit_duty_roster(scenario["term"], days=["monday"])
    resp = client.get(f"{ROSTER_URL}?term_id={scenario['term'].id}")

    assert resp.status_code == 200
    assert len(resp.data) == 2
    assert {r["post_name"] for r in resp.data} == {"Morning Assembly", "Break Supervision"}


def test_duty_post_crud(make_authenticated_client):
    client, _ = make_authenticated_client("dos")
    created = client.post(POSTS_URL, {
        "name": "Evening Prep", "start_time": "18:00", "end_time": "19:30",
        "staff_required": 2, "order": 3,
    }, format="json")
    assert created.status_code == 201
    pk = created.data["id"]

    listed = client.get(POSTS_URL)
    assert listed.status_code == 200 and len(listed.data) == 1

    patched = client.patch(f"{POSTS_URL}{pk}/", {"staff_required": 3}, format="json")
    assert patched.status_code == 200 and patched.data["staff_required"] == 3

    assert client.delete(f"{POSTS_URL}{pk}/").status_code == 204
    assert DutyPost.objects.count() == 0


def test_generate_requires_dos_or_admin(make_authenticated_client, scenario):
    client, _ = make_authenticated_client("teacher")
    resp = client.post(GEN_URL, {"term_id": str(scenario["term"].id)}, format="json")
    assert resp.status_code == 403


def test_generate_bad_term_returns_400(make_authenticated_client, scenario):
    client, _ = make_authenticated_client("dos")
    resp = client.post(GEN_URL, {
        "term_id": "00000000-0000-0000-0000-000000000000",
    }, format="json")
    assert resp.status_code == 400
