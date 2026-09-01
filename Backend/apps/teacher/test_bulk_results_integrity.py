"""
Bulk grade entry: scores are bounded, and a batch is all-or-nothing.

Both properties were missing. score_obtained had a floor and no ceiling and was
never compared to max_score, so 150/100 was accepted and a large enough score
overflowed percentage's DecimalField into a 500 — after earlier rows in the
same batch had already been committed, because there was no transaction.
"""
import pytest
from rest_framework.test import APIClient

from apps.results.models import Assessment


BULK_URL = '/imboni/teacher/results/bulk-save/'


@pytest.mark.django_db
def test_a_score_above_the_maximum_is_rejected(teacher_user):
    client = APIClient()
    client.force_authenticate(teacher_user)

    resp = client.post(BULK_URL, {
        'class_id': '00000000-0000-0000-0000-000000000001',
        'subject_id': '00000000-0000-0000-0000-000000000002',
        'assessment_title': 'Mid-Term',
        'assessment_type': 'quiz',
        'date': '2026-01-15',
        'max_score': 100,
        'entries': [
            {'student_id': '00000000-0000-0000-0000-000000000003',
             'score_obtained': 150},
        ],
    }, format='json')

    assert resp.status_code == 400, resp.data
    assert 'entries' in resp.data


@pytest.mark.django_db
def test_a_score_that_would_overflow_percentage_is_rejected(teacher_user):
    """percentage is DecimalField(max_digits=5); 100000/1 is a DataError, not a mark."""
    client = APIClient()
    client.force_authenticate(teacher_user)

    resp = client.post(BULK_URL, {
        'class_id': '00000000-0000-0000-0000-000000000001',
        'subject_id': '00000000-0000-0000-0000-000000000002',
        'assessment_title': 'Mid-Term',
        'assessment_type': 'quiz',
        'date': '2026-01-15',
        'max_score': 1,
        'entries': [
            {'student_id': '00000000-0000-0000-0000-000000000003',
             'score_obtained': 100000},
        ],
    }, format='json')

    assert resp.status_code == 400, resp.data
    assert Assessment.objects.count() == 0


@pytest.mark.django_db
def test_one_bad_score_rejects_the_whole_batch(teacher_user):
    """Validation runs before any write, so a bad row cannot half-mark a class."""
    client = APIClient()
    client.force_authenticate(teacher_user)

    resp = client.post(BULK_URL, {
        'class_id': '00000000-0000-0000-0000-000000000001',
        'subject_id': '00000000-0000-0000-0000-000000000002',
        'assessment_title': 'Mid-Term',
        'assessment_type': 'quiz',
        'date': '2026-01-15',
        'max_score': 100,
        'entries': [
            {'student_id': '00000000-0000-0000-0000-000000000003', 'score_obtained': 80},
            {'student_id': '00000000-0000-0000-0000-000000000004', 'score_obtained': 900},
        ],
    }, format='json')

    assert resp.status_code == 400
    assert Assessment.objects.count() == 0, 'a rejected batch still wrote marks'


@pytest.mark.django_db
def test_assessment_has_a_unique_natural_key():
    """
    (student, subject, term, title) is what update_or_create keys on. Without a
    database constraint two concurrent saves both insert and the marks are
    double-counted in every average derived from them.
    """
    names = {c.name for c in Assessment._meta.constraints}
    assert 'uniq_assessment_student_subject_term_title' in names
