"""
Template filters for the printed exam paper.

Questions are stored the way the quiz builder stores them — an MCQ's answer is
the *index* of the right option, true/false is 0 or 1 — which is compact and
completely unreadable on a marking scheme. These turn stored values back into
what a person marking by hand needs to see.
"""

import re

from django import template
from django.utils.html import escape
from django.utils.safestring import mark_safe

register = template.Library()

LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'


@register.filter
def option_letter(index):
    """0 -> A. Falls back to the number if a paper somehow runs past Z."""
    try:
        index = int(index)
    except (TypeError, ValueError):
        return '?'
    return LETTERS[index] if 0 <= index < len(LETTERS) else str(index + 1)


@register.filter
def scheme_answer(question):
    """
    The correct answer, written out for whoever is marking.

    Returns a dash rather than an empty space when a question has no stored
    answer — an essay usually won't have one, and a blank line beside "Answer:"
    reads as a bug rather than as "marked by judgement".
    """
    if not isinstance(question, dict):
        return '—'

    # The quiz builder writes `correct`; the question bank stores
    # `correct_answer`. A paper can carry questions from either source, so read
    # both rather than silently printing a blank marking scheme.
    answer = question.get('correct_answer')
    if answer is None:
        answer = question.get('correct')
    qtype = question.get('type')

    if answer is None or answer == '':
        return '—'

    if qtype == 'true_false':
        # Stored as the index into [True, False], matching the quiz builder.
        try:
            return 'True' if int(answer) == 0 else 'False'
        except (TypeError, ValueError):
            return str(answer)

    if qtype == 'mcq':
        options = question.get('options') or []
        try:
            index = int(answer)
        except (TypeError, ValueError):
            return str(answer)
        if 0 <= index < len(options):
            return f'{option_letter(index)}) {options[index]}'
        return str(answer)

    if isinstance(answer, list):
        return ', '.join(str(a) for a in answer)

    return str(answer)


# ---------------------------------------------------------------------------
# Scientific notation
# ---------------------------------------------------------------------------

# A full LaTeX engine is more than a school needs and more than a teacher will
# type. These two are what a science or maths paper actually cannot do without:
# H_2O, x^2, m/s^2, CO_2. Braces are optional for a single character, so both
# `x^2` and `x^{10}` work.
_SUP = re.compile(r'\^(?:\{([^}]*)\}|(\w))')
_SUB = re.compile(r'_(?:\{([^}]*)\}|(\w))')


@register.filter
def scientific(text):
    """
    Render `x^2` and `H_2O` as real superscript and subscript.

    Escapes first and marks safe after, so a question containing `<` prints as
    a less-than sign rather than opening a tag — this text is written by
    teachers and goes straight into a PDF.
    """
    if not text:
        return ''
    out = escape(str(text))
    out = _SUP.sub(lambda m: f'<sup>{m.group(1) or m.group(2)}</sup>', out)
    out = _SUB.sub(lambda m: f'<sub>{m.group(1) or m.group(2)}</sub>', out)
    return mark_safe(out)


@register.filter
def part_letter(index):
    """0 -> a, for question parts."""
    try:
        index = int(index)
    except (TypeError, ValueError):
        return '?'
    return LETTERS[index].lower() if 0 <= index < len(LETTERS) else str(index + 1)


ROMAN = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x',
         'xi', 'xii', 'xiii', 'xiv', 'xv']


@register.filter
def roman(index):
    """0 -> i, for the sub-parts of a part."""
    try:
        index = int(index)
    except (TypeError, ValueError):
        return '?'
    return ROMAN[index] if 0 <= index < len(ROMAN) else str(index + 1)


@register.filter
def question_marks(question):
    """A structured question is worth the sum of its parts."""
    if not isinstance(question, dict):
        return 0
    parts = question.get('parts') or []
    if parts:
        return sum(int(p.get('points') or 0) for p in parts)
    return int(question.get('points') or 0)


@register.filter
def times(count):
    """`{% for _ in n|times %}` — ruled answer lines, which have no data."""
    try:
        return range(max(0, min(int(count or 0), 40)))
    except (TypeError, ValueError):
        return range(0)
