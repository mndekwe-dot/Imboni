"""
The school's own structure: which year levels it teaches and which streams each
year has.

WHY THIS EXISTS
---------------
Imboni was built for Rwandan secondary schools and said so in its schema:
`Student.grade` accepted only '1'-'6' and `Student.section` only 'A'-'C'. A
primary school could not enrol a pupil at all, and a school with four streams
could not describe itself.

`SchoolSection` already stored a per-school structure and the settings UI already
edited it, but nothing validated against it. The two halves were bridged by
string surgery -- config emitted 'S1', storage held '1', and code stripped or
added the 'S' at the seam. This module removes that seam by making the config
authoritative and giving every caller one way to read it.

THE CANONICAL VALUE
-------------------
A year is stored as the school's own code: 'S1' for Rwandan secondary, 'P4' for
primary, 'Y9' or 'Grade 9' elsewhere. Whatever the school types into its own
settings is what lands in the database. There is no separate numeric form and no
parsing.

DEFAULTS
--------
A school that configures nothing gets `DEFAULT_STRUCTURE` below -- the Rwandan
government structure -- so the common case needs no setup. Everything here reads
the school's rows when they exist and falls back to that default when they do
not, which is also what keeps existing schools behaving exactly as before.
"""
from django.core.exceptions import ValidationError


# The Rwandan secondary structure, used when a school has configured nothing.
# O-Level streams are plain letters; A-Level streams are subject combinations,
# which is why streams are per-year rather than per-school.
DEFAULT_STRUCTURE = [
    {
        'name': 'O-Level',
        'years': [
            {'name': 'S1', 'streams': ['A', 'B', 'C']},
            {'name': 'S2', 'streams': ['A', 'B', 'C']},
            {'name': 'S3', 'streams': ['A', 'B', 'C']},
        ],
    },
    {
        'name': 'A-Level',
        'years': [
            {'name': 'S4', 'streams': ['MPG', 'PCB', 'MCE']},
            {'name': 'S5', 'streams': ['MPG', 'PCB', 'MCE']},
            {'name': 'S6', 'streams': ['MPG', 'PCB', 'HEG']},
        ],
    },
]


def _raw_sections():
    """
    The school's configured sections, or the default when it has none.

    Kept private because callers should ask for years or streams, not for the
    storage shape -- which has already changed once and may again.
    """
    from .models import SchoolSection

    try:
        rows = list(SchoolSection.objects.filter(is_active=True).order_by('name'))
    except Exception:
        # No table yet (during migrations) or no tenant schema selected. The
        # default keeps callers working rather than exploding on import.
        return DEFAULT_STRUCTURE

    if not rows:
        return DEFAULT_STRUCTURE

    return [
        {'name': row.name, 'years': row.years or [], 'streams': row.streams or []}
        for row in rows
    ]


def normalize_year(entry, fallback_streams=None):
    """
    Accept the several shapes a configured year has been written in.

    Historically a year has been stored as a bare string ('S1') and as a dict
    ({'name': 'S1', 'streams': [...]}), and the settings UI can still produce
    either. Normalising here means no caller has to care.
    """
    if isinstance(entry, str):
        return {'name': entry, 'streams': list(fallback_streams or [])}
    if isinstance(entry, dict):
        name = entry.get('name') or entry.get('year') or ''
        streams = entry.get('streams') or fallback_streams or []
        return {'name': str(name), 'streams': [str(s) for s in streams]}
    return {'name': '', 'streams': []}


def ordered_years():
    """
    Every year the school teaches, in teaching order.

    Order is the order they appear in the configuration -- explicitly NOT the
    sort order of the code. Sorting 'S1'..'S10' as strings puts S10 second,
    which is why several call sites used to break silently at ten years.
    """
    years = []
    for section in _raw_sections():
        section_streams = section.get('streams') or []
        for entry in section.get('years') or []:
            year = normalize_year(entry, section_streams)
            if year['name'] and year['name'] not in years:
                years.append(year['name'])
    return years


def year_codes():
    """Set of valid year codes, for membership tests."""
    return set(ordered_years())


def streams_for(year):
    """The streams configured for one year, in configured order."""
    for section in _raw_sections():
        section_streams = section.get('streams') or []
        for entry in section.get('years') or []:
            normalized = normalize_year(entry, section_streams)
            if normalized['name'] == year:
                return normalized['streams']
    return []


def all_streams():
    """Every stream used anywhere in the school."""
    streams = []
    for year in ordered_years():
        for stream in streams_for(year):
            if stream not in streams:
                streams.append(stream)
    return streams


def next_year(year):
    """
    The year a pupil moves into at rollover, or None if they graduate.

    Replaces `int(grade) + 1`, which assumed numeric codes, and
    `if grade == '6'`, which assumed a six-year school.
    """
    years = ordered_years()
    try:
        index = years.index(year)
    except ValueError:
        return None
    return years[index + 1] if index + 1 < len(years) else None


def year_index(year):
    """
    A year's position in teaching order, for sorting.

    Unknown years sort last rather than raising, so a stray code from before a
    configuration change still appears instead of breaking the page. Use this
    instead of `.order_by('grade')` -- sorting the codes as strings puts 'S10'
    between 'S1' and 'S2'.
    """
    years = ordered_years()
    try:
        return years.index(year)
    except ValueError:
        return len(years)


def is_final_year(year):
    """True when a pupil in this year graduates rather than progressing."""
    years = ordered_years()
    return bool(years) and year == years[-1]


def class_label(grade=None, section=None, class_obj=None):
    """
    How a class is written for a human.

    Prefers the class's own name, which is free-form and editable -- the pattern
    already used by report_views.py and the only one that survives a school
    naming its classes something other than year+stream. Falls back to
    concatenation.

    This replaces five different conventions that existed side by side:
    'Grade 3', 'S3', 'Secondary 3', 'Grade 3A' and 'S3A'. Because the stored
    year code is now self-describing ('S3', 'P3'), the label needs no prefix of
    its own.
    """
    if class_obj is not None:
        name = (getattr(class_obj, 'name', '') or '').strip()
        if name:
            return name
        grade = getattr(class_obj, 'grade', grade)
        section = getattr(class_obj, 'section', section)

    grade = '' if grade is None else str(grade)
    section = '' if section is None else str(section)
    return f'{grade}{section}'.strip()


def year_label(year):
    """A year on its own, e.g. for 'all classes in S3'."""
    return '' if year is None else str(year)


# ── Terms ─────────────────────────────────────────────────────────────────────
#
# How the school divides its academic year. Three terms was hard-coded in
# `AcademicTerm.TERM_CHOICES` and in a `('term1','term2','term3')` whitelist,
# which excluded semester (2) and quarter (4) systems.

def term_definitions():
    """
    The school's terms as [{code, label, order}], in order.

    Falls back to the Rwandan three-term year, which is what every existing
    school already has.
    """
    from .models import SchoolSetting, default_terms

    try:
        setting = SchoolSetting.objects.first()
    except Exception:
        # No table yet, or no tenant schema selected.
        return default_terms()

    terms = (setting.terms if setting else None) or default_terms()
    cleaned = []
    for index, entry in enumerate(terms, start=1):
        if not isinstance(entry, dict):
            continue
        code = str(entry.get('code') or '').strip()
        if not code:
            continue
        try:
            order = int(entry.get('order') or index)
        except (TypeError, ValueError):
            order = index
        cleaned.append({
            'code': code,
            'label': str(entry.get('label') or code),
            'order': order,
        })
    cleaned.sort(key=lambda t: t['order'])
    return cleaned or default_terms()


def term_codes():
    """Valid term codes, in order, for validation and dropdowns."""
    return [t['code'] for t in term_definitions()]


def term_order(code):
    """
    A term's position in the academic year, 1-based.

    Returns 0 for a code the school has not configured, which sorts it before
    everything rather than raising.
    """
    for term in term_definitions():
        if term['code'] == code:
            return term['order']
    return 0


def term_label(code):
    """The human-readable name the school gave this term."""
    for term in term_definitions():
        if term['code'] == code:
            return term['label']
    return str(code or '')


def validate_term(value):
    """Raise ValidationError unless the term is one this school runs."""
    valid = term_codes()
    if value not in valid:
        raise ValidationError(
            f'"{value}" is not a term at this school. '
            f'Configured terms: {", ".join(valid)}.'
        )
    return value


# ── Validation ────────────────────────────────────────────────────────────────
#
# Django's `choices` never enforced anything on save(), so unvalidated writes
# were already possible. These are called from serializers and views so the
# check happens where the data actually enters.

def validate_grade(value):
    """Raise ValidationError unless the year is one this school teaches."""
    valid = year_codes()
    if not valid:
        return value
    if value not in valid:
        raise ValidationError(
            f'"{value}" is not a year this school teaches. '
            f'Configured years: {", ".join(ordered_years())}.'
        )
    return value


def validate_section(value, grade=None):
    """
    Raise ValidationError unless the stream exists.

    When a year is supplied the stream is checked against THAT year, because
    streams are per-year: an A-Level combination is not valid in S1.
    """
    if grade:
        valid = streams_for(grade)
        if valid and value not in valid:
            raise ValidationError(
                f'"{value}" is not a stream in {grade}. '
                f'Configured streams: {", ".join(valid)}.'
            )
        return value

    valid = all_streams()
    if valid and value not in valid:
        raise ValidationError(
            f'"{value}" is not a stream at this school. '
            f'Configured streams: {", ".join(valid)}.'
        )
    return value


def validate_structure(sections):
    """
    Check a whole structure payload before it replaces the live configuration.

    The settings API used to accept any JSON and then delete the existing rows,
    so a malformed save could leave a school with no structure at all.
    """
    if not isinstance(sections, list):
        raise ValidationError('Expected a list of sections.')

    seen_years = set()
    for section in sections:
        if not isinstance(section, dict):
            raise ValidationError('Each section must be an object.')
        if not str(section.get('name') or '').strip():
            raise ValidationError('Every section needs a name.')

        years = section.get('years')
        if not isinstance(years, list) or not years:
            raise ValidationError(
                f'Section "{section.get("name")}" needs at least one year.'
            )

        for entry in years:
            year = normalize_year(entry, section.get('streams'))
            name = year['name'].strip()
            if not name:
                raise ValidationError('Every year needs a name.')
            if len(name) > 10:
                raise ValidationError(
                    f'Year "{name}" is too long (10 characters maximum).'
                )
            if name in seen_years:
                raise ValidationError(f'Year "{name}" appears more than once.')
            seen_years.add(name)

            for stream in year['streams']:
                if len(str(stream)) > 10:
                    raise ValidationError(
                        f'Stream "{stream}" is too long (10 characters maximum).'
                    )

    return sections


def proposed_years_and_streams(sections):
    """Flatten a structure payload into (years, {(year, stream)})."""
    years, streams = set(), set()
    for section in sections:
        section_streams = section.get('streams') if isinstance(section, dict) else None
        for entry in (section.get('years') if isinstance(section, dict) else None) or []:
            year = normalize_year(entry, section_streams)
            if not year['name']:
                continue
            years.add(year['name'])
            for stream in year['streams']:
                streams.add((year['name'], stream))
    return years, streams


def describe_removals(sections):
    """
    What saving this payload would take away from the school, as plain phrases.

    Editing the structure is one destructive PUT: the settings screen sends the
    whole thing, so an accidental click removes a year as silently as adding one
    creates it. The API asks for confirmation when this returns anything, which
    means the confirmation prompt and the check that triggers it are the same
    piece of code and cannot drift apart.
    """
    from .models import SchoolSection

    # Compare against what is actually STORED, not against `_raw_sections()`.
    # That falls back to DEFAULT_STRUCTURE when a school has no rows, which
    # would make a school's very first save look like it was deleting six years
    # it never had.
    try:
        stored = [
            {'name': row.name, 'years': row.years or [], 'streams': row.streams or []}
            for row in SchoolSection.objects.filter(is_active=True)
        ]
    except Exception:
        return []

    current_years, current_streams = proposed_years_and_streams(stored)
    new_years, new_streams = proposed_years_and_streams(sections)

    removals = []
    for year in sorted(current_years - new_years):
        removals.append(f'the year {year}')
    # A stream whose whole year is going is already covered by the line above.
    for year, stream in sorted(current_streams - new_streams):
        if year in new_years:
            removals.append(f'stream {stream} in {year}')
    return removals


def years_in_use():
    """
    Year codes that existing classes or pupils depend on.

    Used to refuse a configuration change that would orphan real records --
    previously the settings API deleted every section on save with no such check.
    """
    from apps.student.models import Student
    from apps.teacher.models import Class

    used = set()
    try:
        used |= set(Class.objects.values_list('grade', flat=True))
        used |= set(Student.objects.values_list('grade', flat=True))
    except Exception:
        return set()
    return {u for u in used if u}


def streams_in_use():
    """
    (year, stream) pairs that existing classes or pupils depend on.

    Streams need their own check: a school can remove stream 'A' from S1 while
    leaving S1 itself in place, and the year-level check above would not notice.
    Class S1A and every pupil in it would be left pointing at a stream the school
    no longer says it has.

    Pairs rather than bare stream names because streams are per-year -- dropping
    'MPG' from S6 must not be blocked by S5 still using it.
    """
    from apps.student.models import Student
    from apps.teacher.models import Class

    used = set()
    try:
        used |= set(Class.objects.values_list('grade', 'section'))
        used |= set(Student.objects.values_list('grade', 'section'))
    except Exception:
        return set()
    return {(g, s) for g, s in used if g and s}


def terms_in_use():
    """
    Term codes that recorded terms depend on.

    Results, attendance, timetables and conduct all hang off AcademicTerm, so
    removing a term a school has already run would strand every record filed
    under it.
    """
    from apps.results.models import AcademicTerm

    try:
        return {t for t in AcademicTerm.objects.values_list('term', flat=True) if t}
    except Exception:
        return set()
