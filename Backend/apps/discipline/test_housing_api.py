"""Service + endpoint tests for the dormitory assignment generator. Needs the DB."""

import pytest

from apps.authentication.factories import BoardingStudentFactory, StudentFactory
from apps.discipline.housing_service import (
    HousingError, commit_housing, plan_housing,
)
from apps.discipline.models import BoardingStudent, Dormitory, DormRoom

pytestmark = pytest.mark.django_db

DORMS_URL = "/imboni/discipline/dormitories/"
ROOMS_URL = "/imboni/discipline/dorm-rooms/"
GEN_URL = "/imboni/discipline/housing/generate/"
COMMIT_URL = "/imboni/discipline/housing/generate/commit/"


def _dorm(name="Bisoke", gender="mixed", **kwargs):
    return Dormitory.objects.create(name=name, gender=gender, **kwargs)


def _room(dorm, number, capacity=4, **kwargs):
    return DormRoom.objects.create(
        dormitory=dorm, room_number=number, bed_capacity=capacity, **kwargs,
    )


def _boarders(grade, section, n, **kwargs):
    return [
        BoardingStudentFactory(
            student=StudentFactory(grade=grade, section=section), **kwargs,
        )
        for _ in range(n)
    ]


@pytest.fixture
def scenario():
    """Two 4-bed rooms and two classes of 4 — an exact fit."""
    dorm = _dorm()
    rooms = [_room(dorm, "101"), _room(dorm, "102")]
    students = _boarders("1", "A", 4) + _boarders("2", "B", 4)
    return {"dorm": dorm, "rooms": rooms, "students": students}


# ── service ──────────────────────────────────────────────────────────────────

def test_plan_places_everyone_within_capacity(scenario):
    plan = plan_housing()

    assert plan["summary"]["students"] == 8
    assert plan["summary"]["placed"] == 8
    assert plan["summary"]["unplaced"] == 0
    assert all(r["occupied"] <= r["capacity"] for r in plan["rooms"])


def test_plan_keeps_a_class_in_one_room(scenario):
    plan = plan_housing()
    rooms_per_group = {}
    for a in plan["assignments"]:
        rooms_per_group.setdefault(a["group"], set()).add(a["room_id"])
    assert all(len(v) == 1 for v in rooms_per_group.values())


def test_plan_is_side_effect_free(scenario):
    before = {b.id: (b.dormitory, b.room_number) for b in BoardingStudent.objects.all()}
    plan_housing()
    after = {b.id: (b.dormitory, b.room_number) for b in BoardingStudent.objects.all()}
    assert before == after


def test_plan_excludes_day_scholars(scenario):
    _boarders("3", "C", 2, boarding_type="day_scholar")
    plan = plan_housing()
    assert plan["summary"]["students"] == 8


def test_plan_excludes_inactive_boarders(scenario):
    _boarders("3", "C", 2, is_active=False)
    plan = plan_housing()
    assert plan["summary"]["students"] == 8


def test_plan_ignores_inactive_rooms_and_dorms(scenario):
    scenario["rooms"][1].is_active = False
    scenario["rooms"][1].save()
    plan = plan_housing()
    assert plan["summary"]["rooms"] == 1
    assert plan["summary"]["unplaced"] == 4


def test_plan_can_be_limited_to_chosen_dormitories(scenario):
    other = _dorm(name="Karisimbi")
    _room(other, "201", capacity=10)
    plan = plan_housing(dormitory_ids=[str(other.id)])
    assert {r["dormitory"] for r in plan["rooms"]} == {"Karisimbi"}


def test_plan_reports_overflow_instead_of_raising():
    dorm = _dorm()
    _room(dorm, "101", capacity=2)
    _boarders("1", "A", 5)
    plan = plan_housing()

    assert plan["summary"]["placed"] == 2
    assert plan["summary"]["unplaced"] == 3
    assert all(u["reason"] for u in plan["unplaced"])
    assert any("could not be given a bed" in w for w in plan["warnings"])


def test_plan_raises_without_rooms():
    _boarders("1", "A", 2)
    with pytest.raises(HousingError):
        plan_housing()


def test_plan_raises_without_boarders():
    _room(_dorm(), "101")
    with pytest.raises(HousingError):
        plan_housing()


def test_plan_summary_counts_free_beds(scenario):
    plan = plan_housing()
    assert plan["summary"]["capacity"] == 8
    assert plan["summary"]["free_beds"] == 0
    assert plan["summary"]["rooms_used"] == 2


def test_commit_writes_the_plan_and_is_idempotent(scenario):
    plan = plan_housing()
    result = commit_housing()

    assert result["updated"] == 8
    for a in plan["assignments"]:
        record = BoardingStudent.objects.get(id=a["boarding_id"])
        assert record.dormitory == a["dormitory"]
        assert record.room_number == a["room_number"]
        assert record.bed_number == a["bed_number"]

    # Regenerating must not drift or duplicate.
    again = commit_housing()
    assert again["updated"] == 8
    assert again["summary"] == result["summary"]
    assert again["rooms"] == result["rooms"]


def test_preview_equals_commit(scenario):
    plan = plan_housing()
    result = commit_housing()
    assert plan["summary"] == result["summary"]
    assert plan["rooms"] == result["rooms"]


def test_commit_clears_stale_details_for_unplaced_students():
    dorm = _dorm()
    _room(dorm, "101", capacity=1)
    _boarders("1", "A", 3)
    commit_housing()

    seated = BoardingStudent.objects.exclude(room_number="")
    assert seated.count() == 1
    assert BoardingStudent.objects.filter(room_number="").count() == 2


def test_bed_numbers_are_unique_within_a_room(scenario):
    plan = plan_housing()
    seen = set()
    for a in plan["assignments"]:
        key = (a["room_id"], a["bed_number"])
        assert key not in seen
        seen.add(key)


# ── endpoints ────────────────────────────────────────────────────────────────

def test_generate_endpoint_previews_without_persisting(make_authenticated_client, scenario):
    client, _ = make_authenticated_client("discipline")
    resp = client.post(GEN_URL, {}, format="json")

    assert resp.status_code == 200
    assert resp.data["summary"]["placed"] == 8
    # The factory leaves bed_number blank; a preview must not have filled any in.
    assert BoardingStudent.objects.exclude(bed_number="").count() == 0


def test_commit_endpoint_persists(make_authenticated_client, scenario):
    client, _ = make_authenticated_client("discipline")
    resp = client.post(COMMIT_URL, {}, format="json")

    assert resp.status_code == 201
    assert resp.data["updated"] == 8
    assert BoardingStudent.objects.filter(dormitory="Bisoke").count() == 8


def test_generate_without_rooms_returns_400(make_authenticated_client):
    client, _ = make_authenticated_client("discipline")
    _boarders("1", "A", 2)
    resp = client.post(GEN_URL, {}, format="json")
    assert resp.status_code == 400
    assert "detail" in resp.data


def test_generate_requires_discipline_or_matron(make_authenticated_client, scenario):
    client, _ = make_authenticated_client("teacher")
    assert client.post(GEN_URL, {}, format="json").status_code == 403


def test_matron_may_generate(make_authenticated_client, scenario):
    client, _ = make_authenticated_client("matron")
    assert client.post(GEN_URL, {}, format="json").status_code == 200


def test_dormitory_crud(make_authenticated_client):
    client, _ = make_authenticated_client("discipline")
    created = client.post(DORMS_URL, {"name": "Muhabura", "gender": "male"}, format="json")
    assert created.status_code == 201
    pk = created.data["id"]

    listed = client.get(DORMS_URL)
    assert listed.status_code == 200 and len(listed.data) == 1

    patched = client.patch(f"{DORMS_URL}{pk}/", {"gender": "mixed"}, format="json")
    assert patched.status_code == 200 and patched.data["gender"] == "mixed"

    assert client.delete(f"{DORMS_URL}{pk}/").status_code == 204
    assert Dormitory.objects.count() == 0


def test_dorm_room_crud(make_authenticated_client):
    client, _ = make_authenticated_client("discipline")
    dorm = _dorm()
    created = client.post(ROOMS_URL, {
        "dormitory": str(dorm.id), "room_number": "101", "bed_capacity": 6,
    }, format="json")
    assert created.status_code == 201
    pk = created.data["id"]
    assert created.data["dormitory_name"] == "Bisoke"

    listed = client.get(f"{ROOMS_URL}?dormitory_id={dorm.id}")
    assert listed.status_code == 200 and len(listed.data) == 1

    patched = client.patch(f"{ROOMS_URL}{pk}/", {"bed_capacity": 8}, format="json")
    assert patched.status_code == 200 and patched.data["bed_capacity"] == 8

    assert client.delete(f"{ROOMS_URL}{pk}/").status_code == 204
    assert DormRoom.objects.count() == 0


def test_room_detail_404_for_unknown_pk(make_authenticated_client):
    client, _ = make_authenticated_client("discipline")
    missing = "00000000-0000-0000-0000-000000000000"
    assert client.patch(f"{ROOMS_URL}{missing}/", {}, format="json").status_code == 404
    assert client.delete(f"{DORMS_URL}{missing}/").status_code == 404
