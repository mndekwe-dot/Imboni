"""
Tests for the school-structure service.

The point of `structure.py` is that a school defines its own year levels,
streams and terms instead of inheriting Imboni's. So the tests that matter are
the ones a Rwandan secondary school would never exercise: a six-year primary
school, a thirteen-year British school, a two-semester year.

The default path is tested just as hard, because an existing school must keep
behaving exactly as it did.
"""
import pytest
from django.core.exceptions import ValidationError

from apps.dos import structure
from apps.dos.models import SchoolSection, SchoolSetting


def configure(sections):
    """Replace the school's structure with the given sections."""
    SchoolSection.objects.all().delete()
    for section in sections:
        SchoolSection.objects.create(
            name=section['name'],
            years=section['years'],
            streams=section.get('streams', []),
        )


PRIMARY = [{
    'name': 'Primary',
    'years': [{'name': f'P{n}', 'streams': ['Red', 'Blue']} for n in range(1, 7)],
}]

BRITISH = [{
    'name': 'Secondary',
    'years': [{'name': f'Y{n}', 'streams': ['A']} for n in range(1, 14)],
}]


# ── Defaults ──────────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_school_with_no_configuration_gets_the_rwandan_default():
    """An existing school that has configured nothing must be unchanged."""
    SchoolSection.objects.all().delete()
    assert structure.ordered_years() == ['S1', 'S2', 'S3', 'S4', 'S5', 'S6']
    assert structure.streams_for('S1') == ['A', 'B', 'C']
    assert structure.streams_for('S4') == ['MPG', 'PCB', 'MCE']


@pytest.mark.django_db
def test_default_terms_are_the_three_rwandan_terms():
    SchoolSetting.objects.all().delete()
    assert structure.term_codes() == ['term1', 'term2', 'term3']


# ── A school that is not a Rwandan secondary school ───────────────────────────

@pytest.mark.django_db
def test_primary_school_years_and_streams():
    """The case that was impossible before: P1-P6 with colour streams."""
    configure(PRIMARY)
    assert structure.ordered_years() == ['P1', 'P2', 'P3', 'P4', 'P5', 'P6']
    assert structure.streams_for('P3') == ['Red', 'Blue']
    assert structure.all_streams() == ['Red', 'Blue']


@pytest.mark.django_db
def test_thirteen_year_school_orders_by_configuration_not_by_string():
    """
    Y10 comes after Y9. Sorting the codes as strings put it second, which is
    what broke `.order_by('-grade')` and `int(grade) + 1` at ten or more years.
    """
    configure(BRITISH)
    years = structure.ordered_years()
    assert years[8:11] == ['Y9', 'Y10', 'Y11']
    assert structure.year_index('Y10') > structure.year_index('Y9')


@pytest.mark.django_db
def test_streams_are_per_year():
    """An A-Level combination is not a stream in S1."""
    configure([
        {'name': 'O-Level', 'years': [{'name': 'S1', 'streams': ['A', 'B']}]},
        {'name': 'A-Level', 'years': [{'name': 'S4', 'streams': ['MPG']}]},
    ])
    assert structure.streams_for('S1') == ['A', 'B']
    assert structure.streams_for('S4') == ['MPG']
    with pytest.raises(ValidationError):
        structure.validate_section('MPG', grade='S1')


@pytest.mark.django_db
def test_a_year_written_as_a_bare_string_still_works():
    """The settings UI has historically saved years both ways."""
    SchoolSection.objects.all().delete()
    SchoolSection.objects.create(name='Primary', years=['P1', 'P2'], streams=['A'])
    assert structure.ordered_years() == ['P1', 'P2']
    assert structure.streams_for('P2') == ['A']


# ── Progression ───────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_rollover_progression_for_a_six_year_school():
    configure(PRIMARY)
    assert structure.next_year('P1') == 'P2'
    assert structure.next_year('P5') == 'P6'
    assert structure.next_year('P6') is None
    assert structure.is_final_year('P6')
    assert not structure.is_final_year('P5')


@pytest.mark.django_db
def test_rollover_progression_for_a_thirteen_year_school():
    """Y9 -> Y10, the step `int(grade) + 1` got right and string sorting did not."""
    configure(BRITISH)
    assert structure.next_year('Y9') == 'Y10'
    assert structure.next_year('Y13') is None
    assert structure.is_final_year('Y13')


@pytest.mark.django_db
def test_progression_spans_sections():
    """S3 (O-Level) must lead into S4 (A-Level), not stop at the section edge."""
    SchoolSection.objects.all().delete()
    assert structure.next_year('S3') == 'S4'


@pytest.mark.django_db
def test_next_year_of_an_unknown_code_is_none():
    configure(PRIMARY)
    assert structure.next_year('S3') is None


# ── Labels ────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_class_label_prefers_the_class_own_name():
    from apps.teacher.models import Class

    klass = Class(name='Sunflower', grade='P3', section='Red')
    assert structure.class_label(class_obj=klass) == 'Sunflower'


@pytest.mark.django_db
def test_class_label_falls_back_to_year_and_stream():
    from apps.teacher.models import Class

    klass = Class(name='', grade='P3', section='Red')
    assert structure.class_label(class_obj=klass) == 'P3Red'
    assert structure.class_label('S3', 'A') == 'S3A'


@pytest.mark.django_db
def test_class_label_adds_no_prefix_of_its_own():
    """'Grade S3A' and 'SS3' were both real outputs of the old label maps."""
    assert structure.class_label('S3', 'A') == 'S3A'
    assert structure.year_label('S3') == 'S3'


# ── Validation ────────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_a_year_this_school_does_not_teach_is_rejected():
    configure(PRIMARY)
    with pytest.raises(ValidationError):
        structure.validate_grade('S3')
    assert structure.validate_grade('P3') == 'P3'


@pytest.mark.django_db
def test_structure_payload_must_be_a_list_of_named_sections():
    with pytest.raises(ValidationError):
        structure.validate_structure({'name': 'Primary'})
    with pytest.raises(ValidationError):
        structure.validate_structure([{'years': [{'name': 'P1'}]}])


@pytest.mark.django_db
def test_a_section_with_no_years_is_rejected():
    with pytest.raises(ValidationError):
        structure.validate_structure([{'name': 'Primary', 'years': []}])


@pytest.mark.django_db
def test_a_duplicated_year_is_rejected():
    with pytest.raises(ValidationError):
        structure.validate_structure([
            {'name': 'Lower', 'years': [{'name': 'P1'}]},
            {'name': 'Upper', 'years': [{'name': 'P1'}]},
        ])


@pytest.mark.django_db
def test_a_year_code_longer_than_the_column_is_rejected():
    """Better a 400 than a database error or a silent truncation."""
    with pytest.raises(ValidationError):
        structure.validate_structure([
            {'name': 'Primary', 'years': [{'name': 'Reception Year'}]},
        ])


# ── Terms ─────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_a_two_semester_school_can_describe_itself():
    setting = SchoolSetting.get_setting()
    setting.terms = [
        {'code': 'fall', 'label': 'Fall Semester', 'order': 1},
        {'code': 'spring', 'label': 'Spring Semester', 'order': 2},
    ]
    setting.save()

    assert structure.term_codes() == ['fall', 'spring']
    assert structure.term_order('spring') == 2
    assert structure.term_label('fall') == 'Fall Semester'
    with pytest.raises(ValidationError):
        structure.validate_term('term3')


@pytest.mark.django_db
def test_terms_are_returned_in_configured_order_not_stored_order():
    setting = SchoolSetting.get_setting()
    setting.terms = [
        {'code': 'q4', 'label': 'Quarter 4', 'order': 4},
        {'code': 'q1', 'label': 'Quarter 1', 'order': 1},
        {'code': 'q3', 'label': 'Quarter 3', 'order': 3},
        {'code': 'q2', 'label': 'Quarter 2', 'order': 2},
    ]
    setting.save()

    assert structure.term_codes() == ['q1', 'q2', 'q3', 'q4']
