"""DB-aware orchestration for the dormitory assignment generator.

Reads active rooms and active boarders out of the ORM, flattens them into the
plain dataclasses the pure solver understands, then maps the packing back onto
records the matron can read. ``plan_housing`` is side-effect free;
``commit_housing`` persists.

Note on gender: the Student model records no gender (nor does the User model),
so every boarder is handed to the solver with ``gender=None`` and the solver's
gender rule is permissive by design — a girls' dormitory will currently accept
anyone. ``Dormitory.gender`` is stored and displayed, and the constraint turns
itself on the moment a gender field exists on Student.
"""

from __future__ import annotations

from django.db import transaction

from .housing_solver import Boarder, RoomSlot, solve_housing
from .models import BoardingStudent, DormRoom

# Boarding types that need a bed. Day scholars go home at night.
RESIDENT_TYPES = ['full_boarder', 'weekly_boarder']


class HousingError(ValueError):
    """Input the discipline office can fix (no rooms, no boarders)."""


def _student_gender(student) -> str | None:
    """The student's gender, or None when the school does not record one.

    Written as a lookup rather than an attribute access so that adding a
    ``gender`` field to Student (or its User) switches the hard constraint on
    without touching the solver or this module's callers.
    """
    for obj in (student, getattr(student, 'user', None)):
        value = getattr(obj, 'gender', None)
        if value:
            return str(value).lower()
    return None


def gather_rooms():
    """Active rooms in active dormitories, in a stable order."""
    return list(
        DormRoom.objects
        .filter(is_active=True, dormitory__is_active=True)
        .select_related('dormitory')
        .order_by('dormitory__name', 'room_number', 'id')
    )


def gather_boarders():
    """Active boarders who need a bed, in a stable order."""
    return list(
        BoardingStudent.objects
        .filter(is_active=True, boarding_type__in=RESIDENT_TYPES)
        .select_related('student', 'student__user')
        .order_by('student__grade', 'student__section',
                  'student__user__last_name', 'id')
    )


def _group_label(student) -> str:
    return f"{student.grade}{student.section}"


def plan_housing(*, dormitory_ids=None):
    """Build a proposed dormitory assignment without touching the database.

    Returns ``{assignments, rooms, unplaced, summary, warnings}``. Deterministic,
    so the preview a matron approves is exactly what commit persists.
    """
    rooms = gather_rooms()
    if dormitory_ids:
        wanted = {str(d) for d in dormitory_ids}
        rooms = [r for r in rooms if str(r.dormitory_id) in wanted]
    if not rooms:
        raise HousingError(
            "No active dormitory rooms configured: add dormitories and rooms "
            "(with bed capacity) before generating an assignment."
        )

    boarders = gather_boarders()
    if not boarders:
        raise HousingError(
            "No active boarding students to place; day scholars are excluded."
        )

    slots = [
        RoomSlot(
            key=str(r.id),
            dormitory_id=str(r.dormitory_id),
            dormitory_name=r.dormitory.name,
            room_number=r.room_number,
            capacity=r.bed_capacity,
            gender=r.dormitory.gender,
        )
        for r in rooms
    ]
    items = [
        Boarder(
            key=str(b.id),
            group=_group_label(b.student),
            gender=_student_gender(b.student),
        )
        for b in boarders
    ]

    result = solve_housing(slots, items)

    boarder_by_key = {str(b.id): b for b in boarders}

    assignments = []
    for slot in slots:
        seated = result.occupancy.get(slot.key, [])
        for bed, student_key in enumerate(seated, start=1):
            b = boarder_by_key[student_key]
            assignments.append({
                'boarding_id': student_key,
                'student_id': str(b.student_id),
                'student_name': b.student.full_name,
                'group': _group_label(b.student),
                'dormitory_id': slot.dormitory_id,
                'dormitory': slot.dormitory_name,
                'room_id': slot.key,
                'room_number': slot.room_number,
                'bed_number': str(bed),
            })

    room_rows = []
    for slot in slots:
        seated = result.occupancy.get(slot.key, [])
        groups = sorted({
            _group_label(boarder_by_key[k].student) for k in seated
        })
        room_rows.append({
            'room_id': slot.key,
            'dormitory': slot.dormitory_name,
            'room_number': slot.room_number,
            'gender': slot.gender,
            'capacity': slot.capacity,
            'occupied': len(seated),
            'free': slot.capacity - len(seated),
            'groups': groups,
        })

    unplaced = [{
        'boarding_id': key,
        'student_name': boarder_by_key[key].student.full_name,
        'group': _group_label(boarder_by_key[key].student),
        'reason': reason,
    } for key, reason in result.unplaced]

    rooms_used = sum(1 for r in room_rows if r['occupied'])
    free_beds = sum(r['free'] for r in room_rows)

    warnings = []
    if unplaced:
        warnings.append(
            f"{len(unplaced)} student(s) could not be given a bed: add rooms, "
            "raise bed capacity, or move students to day scholar."
        )
    split = sum(1 for count in _group_room_counts(assignments).values() if count > 1)
    if split:
        warnings.append(
            f"{split} class group(s) had to be split across rooms because no "
            "single room was large enough."
        )

    return {
        'assignments': assignments,
        'rooms': room_rows,
        'unplaced': unplaced,
        'summary': {
            'students': len(boarders),
            'placed': len(assignments),
            'unplaced': len(unplaced),
            'rooms': len(room_rows),
            'rooms_used': rooms_used,
            'free_beds': free_beds,
            'capacity': sum(r['capacity'] for r in room_rows),
        },
        'warnings': warnings,
    }


def _group_room_counts(assignments):
    """group label -> how many distinct rooms it ended up spread over."""
    seen: dict[str, set] = {}
    for a in assignments:
        seen.setdefault(a['group'], set()).add(a['room_id'])
    return {g: len(rooms) for g, rooms in seen.items()}


@transaction.atomic
def commit_housing(*, clear_unplaced=True, **plan_kwargs):
    """Persist a generated assignment onto the BoardingStudent records.

    Every eligible boarder's dormitory / room / bed is overwritten from the
    plan, so regenerating is idempotent rather than additive. With
    ``clear_unplaced`` the students the solver could not seat have their stale
    dormitory details blanked, so nobody is shown a bed they do not have.
    """
    plan = plan_housing(**plan_kwargs)
    by_id = {a['boarding_id']: a for a in plan['assignments']}
    ids = list(by_id)
    if clear_unplaced:
        ids += [u['boarding_id'] for u in plan['unplaced']]

    records = list(BoardingStudent.objects.filter(id__in=ids))
    for record in records:
        assignment = by_id.get(str(record.id))
        if assignment:
            record.dormitory = assignment['dormitory']
            record.room_number = assignment['room_number']
            record.bed_number = assignment['bed_number']
        else:
            record.dormitory = ''
            record.room_number = ''
            record.bed_number = ''

    BoardingStudent.objects.bulk_update(
        records, ['dormitory', 'room_number', 'bed_number'],
    )

    return {
        'updated': len(by_id),
        'cleared': len(records) - len(by_id),
        'rooms': plan['rooms'],
        'unplaced': plan['unplaced'],
        'summary': plan['summary'],
        'warnings': plan['warnings'],
    }
