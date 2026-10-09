"""Dietary flags a kitchen needs to see at a glance."""

DIETARY_FLAGS = [
    'peanut_allergy',
    'nut_allergy',
    'lactose_intolerant',
    'gluten_free',
    'diabetic',
    'vegetarian',
    'halal',
    'other',
]


def clean_flags(value):
    """Keep only known codes, once each, in the order the list defines."""
    chosen = set(value or [])
    return [f for f in DIETARY_FLAGS if f in chosen]
