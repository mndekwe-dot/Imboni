from datetime import date, time
from types import SimpleNamespace

from .exam_conflicts import find_conflicts


def exam(i, start, end, **kw):
    base = dict(id=i, title=f'Paper {i}', exam_date=date(2026, 11, 2), start_time=time(*start), end_time=time(*end),
                class_id=None, venue='', invigilator_id=None)
    base.update(kw)
    return SimpleNamespace(**base)


def kinds(result, i):
    return sorted(p['type'] for p in result.get(i, []))


def test_the_same_class_cannot_sit_two_overlapping_papers():
    a = exam(1, (9, 0), (11, 0), class_id='S4A')
    b = exam(2, (10, 0), (12, 0), class_id='S4A')
    r = find_conflicts([a, b])
    assert kinds(r, 1) == ['class'] and kinds(r, 2) == ['class']
    assert r[1][0]['with'] == ['Paper 2']


def test_back_to_back_papers_are_not_a_clash():
    a = exam(1, (9, 0), (11, 0), class_id='S4A', venue='Hall')
    b = exam(2, (11, 0), (13, 0), class_id='S4A', venue='Hall')
    assert find_conflicts([a, b]) == {}


def test_different_days_never_clash():
    a = exam(1, (9, 0), (11, 0), class_id='S4A')
    b = exam(2, (9, 0), (11, 0), class_id='S4A', exam_date=date(2026, 11, 3))
    assert find_conflicts([a, b]) == {}


def test_venue_and_invigilator_clashes_ignore_blank_values():
    a = exam(1, (9, 0), (11, 0), venue='Hall', invigilator_id='u1')
    b = exam(2, (10, 0), (12, 0), venue=' hall ', invigilator_id='u1')
    c = exam(3, (10, 0), (12, 0))            # no venue, no invigilator: nothing to clash on
    d = exam(4, (10, 0), (12, 0))
    r = find_conflicts([a, b, c, d])
    assert kinds(r, 1) == ['invigilator', 'venue']
    assert 3 not in r and 4 not in r


def test_capacity_counts_everyone_in_the_room_at_once():
    a = exam(1, (9, 0), (11, 0), class_id='S4A', venue='Hall')
    b = exam(2, (9, 30), (11, 0), class_id='S4B', venue='Hall')
    r = find_conflicts([a, b], seats_by_class={'S4A': 40, 'S4B': 35}, capacity_by_venue={'Hall': 60})
    assert [p for p in r[1] if p['type'] == 'capacity'][0]['needed'] == 75
    assert [p for p in r[1] if p['type'] == 'capacity'][0]['seats'] == 60


def test_a_room_of_unknown_size_is_never_over_capacity():
    a = exam(1, (9, 0), (11, 0), class_id='S4A', venue='Hall')
    assert find_conflicts([a], seats_by_class={'S4A': 400}, capacity_by_venue={}) == {}
