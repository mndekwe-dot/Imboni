"""The demerit escalation ladder.

Discipline staff deduct marks from a 40-mark conduct budget (see
``BehaviorReport.marks_deducted``). Without agreed thresholds two staff can
respond to the same total in two different ways, so the steps are written down
once and every screen reads them from here.
"""

LADDER = [
    # (marks deducted this term at or above, code)
    (10, 'detention'),
    (20, 'parent_summons'),
    (30, 'suspension_warning'),
]


def step_for(marks_deducted):
    """The highest step reached, or None below the first threshold."""
    reached = None
    for threshold, code in LADDER:
        if (marks_deducted or 0) >= threshold:
            reached = code
    return reached


def ladder_payload():
    return [{'threshold': t, 'code': c} for t, c in LADDER]
