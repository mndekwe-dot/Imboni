"""Which bed in which room is taken, for the dormitory floor plan.

Pure, so the placement rules can be tested without a database. A boarder with a
valid bed number keeps that bed; those without one (or whose number is taken or
out of range) take the next free bed in the room. Anyone beyond the room's
capacity is returned separately - the plan should show an over-full room, not
hide it.
"""


def place_occupants(capacity, occupants):
    """``occupants`` is [(name, bed_number_or_blank)]. Returns (beds, overflow).

    ``beds`` is a list of ``capacity`` slots: each ``{'bed': 1-based, 'occupant': name|None}``.
    """
    beds = [{'bed': i + 1, 'occupant': None} for i in range(capacity)]
    waiting = []
    for name, wanted in occupants:
        try:
            n = int(str(wanted).strip())
        except (TypeError, ValueError):
            n = 0
        if 1 <= n <= capacity and beds[n - 1]['occupant'] is None:
            beds[n - 1]['occupant'] = name
        else:
            waiting.append(name)
    overflow = []
    for name in waiting:
        free = next((b for b in beds if b['occupant'] is None), None)
        if free:
            free['occupant'] = name
        else:
            overflow.append(name)
    return beds, overflow
