"""Health conditions a member of staff must be able to see at a glance.

Not a medical record: a short list of the conditions where someone not trained
to treat them still has to know, because the first minutes matter (an asthma
inhaler, an epileptic fit, insulin).
"""

MEDICAL_FLAGS = [
    'asthma',
    'epilepsy',
    'diabetes_insulin',
    'severe_allergy',
    'sickle_cell',
    'heart_condition',
    'other',
]


def clean_flags(value):
    """Keep only known codes, once each, in the order the list defines."""
    chosen = set(value or [])
    return [f for f in MEDICAL_FLAGS if f in chosen]
