from .bed_layout import place_occupants


def test_a_numbered_bed_is_kept_and_the_rest_fill_the_gaps():
    beds, over = place_occupants(4, [('Amina', '3'), ('Eric', ''), ('Joy', None)])
    assert [b['occupant'] for b in beds] == ['Eric', 'Joy', 'Amina', None]
    assert over == []


def test_two_students_claiming_one_bed_do_not_overwrite_each_other():
    beds, over = place_occupants(2, [('A', '1'), ('B', '1')])
    assert [b['occupant'] for b in beds] == ['A', 'B']
    assert over == []


def test_a_bed_number_beyond_capacity_is_treated_as_unassigned():
    beds, over = place_occupants(2, [('A', '9')])
    assert beds[0]['occupant'] == 'A'


def test_an_over_full_room_reports_who_did_not_fit():
    beds, over = place_occupants(1, [('A', ''), ('B', ''), ('C', '')])
    assert beds[0]['occupant'] == 'A'
    assert over == ['B', 'C']
