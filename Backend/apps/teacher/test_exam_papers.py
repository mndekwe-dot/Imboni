"""
The exam-paper workflow, end to end and across two portals.

A teacher writes the paper, hands it up, and the DOS approves it or sends it
back. The tests deliberately write through the teacher API and read through the
DOS API, because a suite confined to one app is exactly what let the two
Assignment tables diverge for months.
"""

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.audit.models import AuditEntry
from apps.authentication.factories import (
    UserFactory, SubjectFactory, AcademicTermFactory,
)
from apps.notifications.models import Notification
from apps.teacher.models import Class, ExamPaper

pytestmark = pytest.mark.django_db


def as_user(user):
    """One client per role — the shared fixture would log the first one out."""
    client = APIClient()
    client.force_authenticate(user)
    return client


@pytest.fixture
def teacher():
    return UserFactory(role='teacher')


@pytest.fixture
def dos():
    return UserFactory(role='dos')


@pytest.fixture
def klass():
    return Class.objects.create(name='S4 MCB', grade='S4', section='MCB')


def q(text, points, **extra):
    return {'id': text[:8], 'type': 'short_answer', 'text': text,
            'options': [], 'correct_answer': None, 'points': points, **extra}


@pytest.fixture
def paper(teacher, klass):
    return ExamPaper.objects.create(
        teacher=teacher, subject=SubjectFactory(), class_obj=klass,
        term=AcademicTermFactory(), title='Biology End of Term',
        duration_minutes=120,
        sections=[{'title': 'Section A', 'choose_count': 0,
                   'questions': [q('Define osmosis.', 5), q('Name two organelles.', 5)]}],
    )


# --------------------------------------------------------------------------
# Marks — the rule the format actually turns on
# --------------------------------------------------------------------------

def test_total_marks_sums_a_compulsory_section(paper):
    assert paper.total_marks == 10


def test_choose_count_counts_only_the_questions_answered(teacher, klass):
    """
    "Answer any three of six" is worth three questions, not six. Counting all
    six would overstate the paper and quietly break every percentage taken
    from it.
    """
    paper = ExamPaper.objects.create(
        teacher=teacher, subject=SubjectFactory(), class_obj=klass,
        term=AcademicTermFactory(), title='Geography',
        sections=[{'title': 'Section B', 'choose_count': 3,
                   'questions': [q(f'Question {i}', 15) for i in range(6)]}],
    )
    assert paper.total_marks == 45


def test_choose_count_takes_the_highest_scoring_questions(teacher, klass):
    """The most a candidate could score, so the paper is never understated."""
    paper = ExamPaper.objects.create(
        teacher=teacher, subject=SubjectFactory(), class_obj=klass,
        term=AcademicTermFactory(), title='Mixed',
        sections=[{'choose_count': 2, 'questions': [q('a', 5), q('b', 20), q('c', 10)]}],
    )
    assert paper.total_marks == 30


def test_a_section_asking_for_more_than_it_offers_is_refused(teacher, klass, paper):
    response = as_user(teacher).patch(
        reverse('exam-paper-detail', args=[paper.id]),
        {'sections': [{'choose_count': 5, 'questions': [q('only one', 3)]}]},
        format='json')
    assert response.status_code == 400


# --------------------------------------------------------------------------
# The paper belongs to its author while they are writing it
# --------------------------------------------------------------------------

def test_a_teacher_does_not_see_another_teachers_paper(paper):
    other = UserFactory(role='teacher')
    response = as_user(other).get(reverse('exam-paper-detail', args=[paper.id]))
    assert response.status_code == 404


def test_a_teacher_sees_their_own_papers(teacher, paper):
    response = as_user(teacher).get(reverse('exam-paper-list'))
    assert response.status_code == 200
    assert response.data['count'] == 1


def test_creating_a_paper_makes_the_caller_its_author(teacher, klass):
    response = as_user(teacher).post(reverse('exam-paper-list'), {
        'title': 'Physics Mock', 'subject': str(SubjectFactory().id),
        'class_obj': str(klass.id), 'term': str(AcademicTermFactory().id),
        'duration_minutes': 90, 'sections': [],
    }, format='json')
    assert response.status_code == 201
    assert ExamPaper.objects.get(id=response.data['id']).teacher == teacher


# --------------------------------------------------------------------------
# Handing it up
# --------------------------------------------------------------------------

def test_submitting_moves_it_to_the_dos(teacher, paper):
    response = as_user(teacher).post(reverse('exam-paper-submit', args=[paper.id]))
    assert response.status_code == 200
    paper.refresh_from_db()
    assert paper.status == 'submitted'
    assert paper.submitted_at is not None


def test_submitting_notifies_the_dos(teacher, dos, paper):
    """Vetting should not be gated on the DOS happening to look."""
    as_user(teacher).post(reverse('exam-paper-submit', args=[paper.id]))
    assert Notification.objects.filter(user=dos).exists()


def test_an_empty_paper_cannot_be_submitted(teacher, klass):
    empty = ExamPaper.objects.create(
        teacher=teacher, subject=SubjectFactory(), class_obj=klass,
        term=AcademicTermFactory(), title='Nothing yet', sections=[])
    response = as_user(teacher).post(reverse('exam-paper-submit', args=[empty.id]))
    assert response.status_code == 400


def test_a_submitted_paper_cannot_be_edited_by_its_author(teacher, paper):
    """
    Otherwise the DOS approves one paper and a different one gets printed.
    """
    as_user(teacher).post(reverse('exam-paper-submit', args=[paper.id]))
    response = as_user(teacher).patch(
        reverse('exam-paper-detail', args=[paper.id]),
        {'title': 'Sneaky rewrite'}, format='json')
    assert response.status_code == 409
    paper.refresh_from_db()
    assert paper.title == 'Biology End of Term'


# --------------------------------------------------------------------------
# The DOS vets it
# --------------------------------------------------------------------------

def test_dos_sees_every_paper_in_the_school(teacher, dos, paper):
    as_user(teacher).post(reverse('exam-paper-submit', args=[paper.id]))
    response = as_user(dos).get(reverse('dos-exam-papers'))
    assert response.status_code == 200
    assert len(response.data['results']) == 1
    assert response.data['counts']['submitted'] == 1


def test_dos_approves_a_submitted_paper(teacher, dos, paper):
    as_user(teacher).post(reverse('exam-paper-submit', args=[paper.id]))
    response = as_user(dos).post(reverse('dos-exam-paper-approve', args=[paper.id]))
    assert response.status_code == 200
    paper.refresh_from_db()
    assert paper.status == 'approved'
    assert paper.approved_by == dos


def test_approving_is_audited(teacher, dos, paper):
    as_user(teacher).post(reverse('exam-paper-submit', args=[paper.id]))
    as_user(dos).post(reverse('dos-exam-paper-approve', args=[paper.id]))
    assert AuditEntry.objects.filter(action='exam_paper.approved').exists()


def test_a_draft_cannot_be_approved(dos, paper):
    """Approving a draft approves something its author has not finished."""
    response = as_user(dos).post(reverse('dos-exam-paper-approve', args=[paper.id]))
    assert response.status_code == 409


def test_sending_a_paper_back_requires_a_reason(teacher, dos, paper):
    as_user(teacher).post(reverse('exam-paper-submit', args=[paper.id]))
    response = as_user(dos).post(reverse('dos-exam-paper-reject', args=[paper.id]),
                                 {'reason': '   '}, format='json')
    assert response.status_code == 400


def test_sending_it_back_returns_control_to_the_author(teacher, dos, paper):
    as_user(teacher).post(reverse('exam-paper-submit', args=[paper.id]))
    as_user(dos).post(reverse('dos-exam-paper-reject', args=[paper.id]),
                      {'reason': 'Section B is out of syllabus.'}, format='json')
    paper.refresh_from_db()
    assert paper.status == 'rejected'
    assert paper.is_editable

    edit = as_user(teacher).patch(reverse('exam-paper-detail', args=[paper.id]),
                                  {'title': 'Biology End of Term (v2)'}, format='json')
    assert edit.status_code == 200


def test_resubmitting_clears_the_old_refusal(teacher, dos, paper):
    """The teacher should not still be reading why a rewritten version failed."""
    as_user(teacher).post(reverse('exam-paper-submit', args=[paper.id]))
    as_user(dos).post(reverse('dos-exam-paper-reject', args=[paper.id]),
                      {'reason': 'Too short.'}, format='json')
    as_user(teacher).post(reverse('exam-paper-submit', args=[paper.id]))
    paper.refresh_from_db()
    assert paper.rejection_reason == ''


def test_an_approved_paper_cannot_be_deleted(teacher, dos, paper):
    as_user(teacher).post(reverse('exam-paper-submit', args=[paper.id]))
    as_user(dos).post(reverse('dos-exam-paper-approve', args=[paper.id]))
    response = as_user(teacher).delete(reverse('exam-paper-detail', args=[paper.id]))
    assert response.status_code == 409


# --------------------------------------------------------------------------
# Printing
# --------------------------------------------------------------------------

def test_dos_prints_the_paper_as_a_pdf(teacher, dos, paper):
    as_user(teacher).post(reverse('exam-paper-submit', args=[paper.id]))
    as_user(dos).post(reverse('dos-exam-paper-approve', args=[paper.id]))
    response = as_user(dos).get(reverse('dos-exam-paper-print', args=[paper.id]))
    assert response.status_code == 200
    assert response['Content-Type'] == 'application/pdf'
    assert response.content[:4] == b'%PDF'


def test_the_marking_scheme_is_a_different_document(teacher, dos, paper):
    as_user(teacher).post(reverse('exam-paper-submit', args=[paper.id]))
    as_user(dos).post(reverse('dos-exam-paper-approve', args=[paper.id]))
    plain  = as_user(dos).get(reverse('dos-exam-paper-print', args=[paper.id]))
    scheme = as_user(dos).get(reverse('dos-exam-paper-print', args=[paper.id]) + '?scheme=1')
    assert scheme.status_code == 200
    assert scheme.content[:4] == b'%PDF'
    assert scheme.content != plain.content
    assert 'marking-scheme' in scheme['Content-Disposition']


def test_an_unapproved_paper_still_prints(dos, paper):
    """The DOS reads on paper too — it is watermarked rather than withheld."""
    response = as_user(dos).get(reverse('dos-exam-paper-print', args=[paper.id]))
    assert response.status_code == 200
    assert response.content[:4] == b'%PDF'


# --------------------------------------------------------------------------
# Who may do what
# --------------------------------------------------------------------------

@pytest.mark.parametrize('role', ['student', 'parent', 'teacher'])
def test_only_staff_may_approve(role, teacher, paper):
    as_user(teacher).post(reverse('exam-paper-submit', args=[paper.id]))
    response = as_user(UserFactory(role=role)).post(
        reverse('dos-exam-paper-approve', args=[paper.id]))
    assert response.status_code == 403


@pytest.mark.parametrize('role', ['student', 'parent', 'teacher'])
def test_only_staff_may_print(role, paper):
    response = as_user(UserFactory(role=role)).get(
        reverse('dos-exam-paper-print', args=[paper.id]))
    assert response.status_code == 403


@pytest.mark.parametrize('role', ['student', 'parent', 'dos'])
def test_only_teachers_reach_the_authoring_endpoints(role):
    response = as_user(UserFactory(role=role)).get(reverse('exam-paper-list'))
    assert response.status_code == 403


# --------------------------------------------------------------------------
# Cross-domain question shapes
#
# A maths paper, a comprehension, a history source question and a computer
# science paper are all "an exam", and a teacher should not have to pretend
# any of them is a quiz.
# --------------------------------------------------------------------------

def structured(text, parts):
    return {'id': text[:8], 'type': 'structured', 'text': text,
            'options': [], 'points': 0, 'parts': parts}


def test_a_structured_question_is_worth_the_sum_of_its_parts(teacher, klass):
    """
    Marks are earned on the parts, so the number beside the stem has to be
    their sum. Storing both would let them disagree.
    """
    paper = ExamPaper.objects.create(
        teacher=teacher, subject=SubjectFactory(), class_obj=klass,
        term=AcademicTermFactory(), title='Physics',
        sections=[{'choose_count': 0, 'questions': [
            structured('A trolley accelerates.', [
                {'text': 'State Newton\u2019s second law.', 'points': 2},
                {'text': 'Calculate the force.', 'points': 3, 'answer_space': 'working'},
            ]),
        ]}],
    )
    assert paper.total_marks == 5


def test_the_stem_points_are_ignored_once_parts_exist(teacher, klass):
    paper = ExamPaper.objects.create(
        teacher=teacher, subject=SubjectFactory(), class_obj=klass,
        term=AcademicTermFactory(), title='Physics',
        sections=[{'choose_count': 0, 'questions': [
            {**structured('Stem', [{'text': 'a', 'points': 4}]), 'points': 99},
        ]}],
    )
    assert paper.total_marks == 4


def test_choose_count_uses_the_rolled_up_part_marks(teacher, klass):
    """The two rules have to compose: pick the best three *structured* questions."""
    q = lambda n: structured(f'Q{n}', [{'text': 'a', 'points': n}])
    paper = ExamPaper.objects.create(
        teacher=teacher, subject=SubjectFactory(), class_obj=klass,
        term=AcademicTermFactory(), title='Mixed',
        sections=[{'choose_count': 2, 'questions': [q(5), q(20), q(10)]}],
    )
    assert paper.total_marks == 30


def test_a_structured_question_counts_as_one_question(teacher, klass):
    paper = ExamPaper.objects.create(
        teacher=teacher, subject=SubjectFactory(), class_obj=klass,
        term=AcademicTermFactory(), title='Physics',
        sections=[{'choose_count': 0, 'questions': [
            structured('Stem', [{'text': 'a', 'points': 1}, {'text': 'b', 'points': 1}]),
        ]}],
    )
    assert paper.question_count == 1


def test_a_paper_with_a_passage_and_parts_prints(teacher, dos, klass):
    """
    The shapes a language, history or science paper actually needs, all in one
    document: a shared passage, sub-questions, a code block and matching pairs.
    """
    paper = ExamPaper.objects.create(
        teacher=teacher, subject=SubjectFactory(), class_obj=klass,
        term=AcademicTermFactory(), title='Cross domain',
        sections=[{
            'title': 'Section A', 'choose_count': 0,
            'stimulus': {
                'title': 'Passage',
                'text': 'Read the passage. Water is H_2O and energy is E = mc^2.',
                'source_note': 'Adapted from a textbook',
            },
            'questions': [
                structured('Refer to the passage.', [
                    {'text': 'What is the writer\u2019s tone?', 'points': 2, 'lines': 3},
                    {'text': 'Show your working.', 'points': 3, 'answer_space': 'working'},
                    {'text': 'Sketch the graph.', 'points': 5, 'answer_space': 'grid'},
                ]),
                {'id': 'code1', 'type': 'code', 'text': 'What does this print?',
                 'code': 'for i in range(3):\n    print(i)', 'points': 4, 'options': []},
                {'id': 'm1', 'type': 'matching', 'text': 'Match the terms.', 'points': 4,
                 'options': [], 'pairs': [{'left': 'Mitochondrion', 'right': 'Respiration'},
                                          {'left': 'Ribosome', 'right': 'Protein synthesis'}]},
            ],
        }],
    )
    as_user(teacher).post(reverse('exam-paper-submit', args=[paper.id]))
    response = as_user(dos).get(reverse('dos-exam-paper-print', args=[paper.id]))
    assert response.status_code == 200
    assert response.content[:4] == b'%PDF'
    # 10 from the parts + 4 + 4
    paper.refresh_from_db()
    assert paper.total_marks == 18


def test_the_marking_scheme_renders_part_answers(teacher, dos, klass):
    paper = ExamPaper.objects.create(
        teacher=teacher, subject=SubjectFactory(), class_obj=klass,
        term=AcademicTermFactory(), title='With answers',
        sections=[{'choose_count': 0, 'questions': [
            structured('Stem', [{'text': 'a', 'points': 2, 'answer': 'Because of osmosis'}]),
        ]}],
    )
    scheme = as_user(dos).get(reverse('dos-exam-paper-print', args=[paper.id]) + '?scheme=1')
    plain  = as_user(dos).get(reverse('dos-exam-paper-print', args=[paper.id]))
    assert scheme.status_code == 200
    assert scheme.content != plain.content


def test_no_template_scaffolding_reaches_the_printed_paper(teacher, dos, klass):
    """
    Django's `{# #}` is single-line only, so a comment spanning two lines is
    not a comment - it is text, and it printed onto the exam paper between the
    question and its parts. Nothing a candidate sees should contain template
    syntax.
    """
    from pypdf import PdfReader
    import io as _io

    paper = ExamPaper.objects.create(
        teacher=teacher, subject=SubjectFactory(), class_obj=klass,
        term=AcademicTermFactory(), title='Scaffolding check',
        sections=[{
            'title': 'Section A', 'choose_count': 0,
            'stimulus': {'title': 'Passage', 'text': 'Read this.'},
            'questions': [
                structured('Stem', [{'text': 'a', 'points': 2}]),
                {'id': 'm', 'type': 'matching', 'text': 'Match', 'points': 2, 'options': [],
                 'pairs': [{'left': 'A', 'right': 'B'}]},
            ],
        }],
    )
    for suffix in ('', '?scheme=1'):
        response = as_user(dos).get(
            reverse('dos-exam-paper-print', args=[paper.id]) + suffix)
        text = '\n'.join(
            page.extract_text() or ''
            for page in PdfReader(_io.BytesIO(response.content)).pages)
        for token in ('{#', '#}', '{%', '%}', '{{', '}}'):
            assert token not in text, f'{token!r} rendered into the PDF ({suffix or "paper"})'
