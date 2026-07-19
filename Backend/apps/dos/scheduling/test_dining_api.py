"""Service + endpoint tests for the dining planner. Needs the DB/tenant."""

import pytest

from apps.authentication.factories import AcademicTermFactory, StudentFactory
from apps.dos.models import DiningAssignment, DiningSitting
from apps.dos.scheduling.dining_service import (
    DiningPlanError, commit_dining, plan_dining,
)
from apps.results.models import AcademicTerm
from apps.teacher.models import Class, ClassAssignment

pytestmark = pytest.mark.django_db

SITTINGS_URL = "/imboni/dos/dining-sittings/"
PLAN_URL = "/imboni/dos/dining-plan/"
GEN_URL = "/imboni/dos/dining-plan/generate/"
COMMIT_URL = "/imboni/dos/dining-plan/generate/commit/"


def _sitting(name, meal, start, end, capacity, order=0):
    return DiningSitting.objects.create(
        name=name, meal=meal, start_time=start, end_time=end,
        capacity=capacity, order=order,
    )


def _class_with_students(grade, section, n, term):
    klass = Class.objects.create(name=f"S{grade}{section}", grade=grade, section=section)
    for _ in range(n):
        ClassAssignment.objects.create(
            class_obj=klass, student=StudentFactory(), term=term,
        )
    return klass


@pytest.fixture
def scenario():
    """Two classes of 3 students, two lunch sittings with room to spare."""
    term = AcademicTermFactory()
    _class_with_students("1", "A", 3, term)
    _class_with_students("2", "B", 3, term)
    _sitting("Lunch 1", "lunch", "12:00", "12:40", 50, order=1)
    _sitting("Lunch 2", "lunch", "12:45", "13:25", 50, order=2)
    return {"term": term}


# ── service ──────────────────────────────────────────────────────────────────

def test_plan_seats_every_class(scenario):
    plan = plan_dining(scenario["term"], meals=["lunch"])

    assert plan["summary"]["unassigned"] == 0
    assert plan["summary"]["seated"] == 2
    assert {a["class_name"] for a in plan["assignments"]} == {"S1A", "S2B"}


def test_plan_spreads_classes_across_sittings(scenario):
    plan = plan_dining(scenario["term"], meals=["lunch"])
    used = {a["sitting_name"] for a in plan["assignments"]}
    assert len(used) == 2   # emptiest-first put one class in each


def test_plan_never_exceeds_capacity(scenario):
    plan = plan_dining(scenario["term"], meals=["lunch"])
    for row in plan["occupancy"]:
        assert row["seated"] <= row["capacity"]


def test_plan_is_side_effect_free(scenario):
    plan_dining(scenario["term"], meals=["lunch"])
    assert DiningAssignment.objects.count() == 0


def test_class_too_big_for_any_sitting_is_reported():
    term = AcademicTermFactory()
    _class_with_students("3", "C", 4, term)
    _sitting("Tiny", "lunch", "12:00", "12:30", 2)
    plan = plan_dining(term, meals=["lunch"])

    assert plan["summary"]["unassigned"] == 1
    assert "exceeds every" in plan["unassigned"][0]["reason"]
    assert any("could not be seated" in w for w in plan["warnings"])


def test_plan_rejects_unknown_meal(scenario):
    with pytest.raises(DiningPlanError):
        plan_dining(scenario["term"], meals=["brunch"])


def test_plan_raises_without_sittings():
    term = AcademicTermFactory()
    _class_with_students("1", "A", 2, term)
    with pytest.raises(DiningPlanError):
        plan_dining(term, meals=["lunch"])


def test_plan_raises_without_classes():
    term = AcademicTermFactory()
    _sitting("Lunch 1", "lunch", "12:00", "12:40", 50)
    with pytest.raises(DiningPlanError):
        plan_dining(term, meals=["lunch"])


def test_commit_persists_and_replaces(scenario):
    term = scenario["term"]
    first = commit_dining(term, meals=["lunch"])
    assert first["created"] == 2
    assert DiningAssignment.objects.filter(term=term).count() == 2

    commit_dining(term, meals=["lunch"])
    assert DiningAssignment.objects.filter(term=term).count() == 2   # no duplicates


# ── endpoints ────────────────────────────────────────────────────────────────

def test_generate_endpoint_previews_without_persisting(make_authenticated_client, scenario):
    client, _ = make_authenticated_client("dos")
    resp = client.post(GEN_URL, {
        "term_id": str(scenario["term"].id), "meals": ["lunch"],
    }, format="json")

    assert resp.status_code == 200
    assert resp.data["summary"]["seated"] == 2
    assert DiningAssignment.objects.count() == 0


def test_commit_endpoint_creates_rows(make_authenticated_client, scenario):
    client, _ = make_authenticated_client("dos")
    resp = client.post(COMMIT_URL, {
        "term_id": str(scenario["term"].id), "meals": ["lunch"],
    }, format="json")

    assert resp.status_code == 201
    assert resp.data["created"] == 2
    assert DiningAssignment.objects.count() == 2


def test_plan_list_endpoint_returns_saved_plan(make_authenticated_client, scenario):
    client, _ = make_authenticated_client("dos")
    commit_dining(scenario["term"], meals=["lunch"])
    resp = client.get(f"{PLAN_URL}?term_id={scenario['term'].id}")

    assert resp.status_code == 200
    assert len(resp.data) == 2
    assert {r["class_name"] for r in resp.data} == {"S1A", "S2B"}


def test_sitting_crud(make_authenticated_client):
    client, _ = make_authenticated_client("dos")
    created = client.post(SITTINGS_URL, {
        "name": "Breakfast 1", "meal": "breakfast",
        "start_time": "07:00", "end_time": "07:30", "capacity": 120, "order": 1,
    }, format="json")
    assert created.status_code == 201
    pk = created.data["id"]

    assert len(client.get(SITTINGS_URL).data) == 1

    patched = client.patch(f"{SITTINGS_URL}{pk}/", {"capacity": 150}, format="json")
    assert patched.status_code == 200 and patched.data["capacity"] == 150

    assert client.delete(f"{SITTINGS_URL}{pk}/").status_code == 204
    assert DiningSitting.objects.count() == 0


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
