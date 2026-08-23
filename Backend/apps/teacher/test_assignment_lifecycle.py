"""
The assignment lifecycle: closing, timing, attempts, marking and release.

Companion to test_assignment_workflow.py, which covers the teacher → student →
parent join. This file covers what happens to an assignment over its life —
the parts that were declared but never implemented, or implemented only in the
browser where nothing enforced them.
"""
import datetime

import pytest
from django.utils import timezone
from rest_framework import status

from apps.authentication.factories import UserFactory, StudentFactory
from apps.results.models import Subject, AcademicTerm, Assessment
from apps.teacher.models import Class, ClassAssignment, Assignment, AssignmentSubmission
from apps.announcements.models import Announcement

TODAY = datetime.date.today()
YESTERDAY = TODAY - datetime.timedelta(days=1)


@pytest.fixture
def term():
    return AcademicTerm.objects.create(
        name='Term 1 2025', term='term1', year=2025,
        start_date=datetime.date(2025, 1, 1),
        end_date=datetime.date(2025, 4, 1), is_current=True,
    )


@pytest.fixture
def subject():
    return Subject.objects.create(name='Mathematics', code='MATH101')


@pytest.fixture
def klass():
    return Class.objects.create(name='S4A', grade='S4', section='A')


@pytest.fixture
def enrolled_student(klass, term):
    student = StudentFactory(grade='S4', section='A')
    ClassAssignment.objects.create(student=student, class_obj=klass, term=term)
    return student


def as_user(client, user):
    """
    Re-authenticate the shared client.

    `make_authenticated_client` hands back the same APIClient the `api_client`
    fixture provides, so a test that logs in as a student is also logging the
    teacher out. Any test that switches roles has to say which one it means.
    """
    client.force_authenticate(user)
    return client


def make_assignment(teacher, klass, subject, **kwargs):
    defaults = dict(
        title='Chapter 6 Homework', teacher=teacher, class_obj=klass, subject=subject,
        due_date=TODAY + datetime.timedelta(days=7), max_score=20,
        mode='paper', status='active', instructions='Do it.',
    )
    defaults.update(kwargs)
    return Assignment.objects.create(**defaults)


QUIZ_QUESTIONS = [
    {'id': 'q1', 'type': 'mcq', 'text': '2+2?', 'options': ['3', '4'], 'correct': 1, 'points': 5},
    {'id': 'q2', 'type': 'short_answer', 'text': 'Length?', 'correct': '8cm', 'points': 5},
]


# ── 1. Closing ───────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestClosingAnAssignment:
    def test_a_teacher_can_close_an_active_assignment(
            self, make_authenticated_client, klass, subject, term):
        """`closed` was a status the model declared but nothing could set."""
        client, teacher = make_authenticated_client('teacher')
        a = make_assignment(teacher, klass, subject)

        response = client.post(f'/imboni/teacher/assignments/{a.id}/close/')

        assert response.status_code == status.HTTP_200_OK
        a.refresh_from_db()
        assert a.status == 'closed'

    def test_a_closed_assignment_refuses_new_work(
            self, make_authenticated_client, api_client, klass, subject, term, enrolled_student):
        client, teacher = make_authenticated_client('teacher')
        a = make_assignment(teacher, klass, subject)
        client.post(f'/imboni/teacher/assignments/{a.id}/close/')

        api_client.force_authenticate(enrolled_student.user)
        response = api_client.post(f'/imboni/student/assignments/{a.id}/submit/', {})

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_a_closed_assignment_is_still_visible_with_its_marks(
            self, make_authenticated_client, api_client, klass, subject, term, enrolled_student):
        """Closing stops new work; it does not hide what has already happened."""
        client, teacher = make_authenticated_client('teacher')
        a = make_assignment(teacher, klass, subject)
        client.post(f'/imboni/teacher/assignments/{a.id}/close/')

        api_client.force_authenticate(enrolled_student.user)
        titles = [x['title'] for x in api_client.get('/imboni/student/assignments/').json()]

        assert 'Chapter 6 Homework' in titles

    def test_a_draft_cannot_be_closed(
            self, make_authenticated_client, klass, subject, term):
        client, teacher = make_authenticated_client('teacher')
        a = make_assignment(teacher, klass, subject, status='draft')

        response = client.post(f'/imboni/teacher/assignments/{a.id}/close/')

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_a_closed_assignment_can_be_reopened(
            self, make_authenticated_client, klass, subject, term):
        """A deadline extended, or a close by mistake."""
        client, teacher = make_authenticated_client('teacher')
        a = make_assignment(teacher, klass, subject, status='closed')

        response = client.post(f'/imboni/teacher/assignments/{a.id}/reopen/')

        assert response.status_code == status.HTTP_200_OK
        a.refresh_from_db()
        assert a.status == 'active'

    def test_the_nightly_command_closes_only_what_refuses_late_work(
            self, make_authenticated_client, klass, subject, term):
        """
        accept_late_submissions=True is the default and means what it says, so
        those stay open until a teacher closes them by hand.
        """
        from django.core.management import call_command
        from io import StringIO

        client, teacher = make_authenticated_client('teacher')
        strict = make_assignment(teacher, klass, subject, title='Strict',
                                 due_date=YESTERDAY, accept_late_submissions=False)
        lenient = make_assignment(teacher, klass, subject, title='Lenient',
                                  due_date=YESTERDAY, accept_late_submissions=True)

        call_command('close_overdue_assignments', stdout=StringIO())

        strict.refresh_from_db()
        lenient.refresh_from_db()
        assert strict.status == 'closed'
        assert lenient.status == 'active'

    def test_late_work_is_refused_when_the_teacher_turned_it_off(
            self, make_authenticated_client, api_client, klass, subject, term, enrolled_student):
        client, teacher = make_authenticated_client('teacher')
        a = make_assignment(teacher, klass, subject,
                            due_date=YESTERDAY, accept_late_submissions=False)

        api_client.force_authenticate(enrolled_student.user)
        response = api_client.post(f'/imboni/student/assignments/{a.id}/submit/', {})

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_late_work_is_still_taken_by_default(
            self, make_authenticated_client, api_client, klass, subject, term, enrolled_student):
        client, teacher = make_authenticated_client('teacher')
        a = make_assignment(teacher, klass, subject, due_date=YESTERDAY)

        api_client.force_authenticate(enrolled_student.user)
        response = api_client.post(f'/imboni/student/assignments/{a.id}/submit/', {})

        assert response.status_code == status.HTTP_201_CREATED
        assert response.json()['status'] == 'late'


# ── 2 & 3. Quiz timing and attempts ──────────────────────────────────────────

@pytest.mark.django_db
class TestQuizTimingAndAttempts:
    def _quiz(self, teacher, klass, subject, **kw):
        return make_assignment(teacher, klass, subject, mode='online', max_score=10,
                               questions=QUIZ_QUESTIONS, **kw)

    def test_opening_a_quiz_starts_the_clock_on_the_server(
            self, make_authenticated_client, api_client, klass, subject, term, enrolled_student):
        """
        The time limit used to be a browser countdown and nothing else - close
        the tab, or POST straight to submit, and it never applied.
        """
        _, teacher = make_authenticated_client('teacher')
        quiz = self._quiz(teacher, klass, subject, time_limit_minutes=10)

        api_client.force_authenticate(enrolled_student.user)
        api_client.get(f'/imboni/quiz/{quiz.id}/')

        sub = AssignmentSubmission.objects.get(assignment=quiz, student=enrolled_student)
        assert sub.started_at is not None

    def test_merely_opening_a_quiz_is_not_a_submission(
            self, make_authenticated_client, api_client, klass, subject, term, enrolled_student):
        """
        The start row must not make the student look like they have handed in -
        not in their own list, not in the teacher's count.
        """
        _, teacher = make_authenticated_client('teacher')
        quiz = self._quiz(teacher, klass, subject, time_limit_minutes=10)

        api_client.force_authenticate(enrolled_student.user)
        api_client.get(f'/imboni/quiz/{quiz.id}/')

        listed = api_client.get('/imboni/student/assignments/').json()
        assert listed[0]['status'] == 'pending'

    def test_reopening_does_not_restart_the_clock(
            self, make_authenticated_client, api_client, klass, subject, term, enrolled_student):
        """Otherwise a refresh buys another full sitting."""
        _, teacher = make_authenticated_client('teacher')
        quiz = self._quiz(teacher, klass, subject, time_limit_minutes=10)

        api_client.force_authenticate(enrolled_student.user)
        api_client.get(f'/imboni/quiz/{quiz.id}/')
        first = AssignmentSubmission.objects.get(assignment=quiz, student=enrolled_student).started_at

        api_client.get(f'/imboni/quiz/{quiz.id}/')
        second = AssignmentSubmission.objects.get(assignment=quiz, student=enrolled_student).started_at

        assert first == second

    def test_a_submission_after_the_time_limit_is_refused(
            self, make_authenticated_client, api_client, klass, subject, term, enrolled_student):
        _, teacher = make_authenticated_client('teacher')
        quiz = self._quiz(teacher, klass, subject, time_limit_minutes=10)

        api_client.force_authenticate(enrolled_student.user)
        api_client.get(f'/imboni/quiz/{quiz.id}/')

        # Wind the recorded start back beyond the limit.
        sub = AssignmentSubmission.objects.get(assignment=quiz, student=enrolled_student)
        sub.started_at = timezone.now() - datetime.timedelta(minutes=11)
        sub.save(update_fields=['started_at'])

        response = api_client.post(
            f'/imboni/quiz/{quiz.id}/submit/',
            {'answers': [{'question_id': 'q1', 'answer': 1}]}, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'time' in response.json()['error'].lower()

    def test_a_quiz_with_no_limit_is_never_timed_out(
            self, make_authenticated_client, api_client, klass, subject, term, enrolled_student):
        _, teacher = make_authenticated_client('teacher')
        quiz = self._quiz(teacher, klass, subject, time_limit_minutes=None)

        api_client.force_authenticate(enrolled_student.user)
        api_client.get(f'/imboni/quiz/{quiz.id}/')
        sub = AssignmentSubmission.objects.get(assignment=quiz, student=enrolled_student)
        sub.started_at = timezone.now() - datetime.timedelta(days=2)
        sub.save(update_fields=['started_at'])

        response = api_client.post(
            f'/imboni/quiz/{quiz.id}/submit/',
            {'answers': [{'question_id': 'q1', 'answer': 1}]}, format='json')

        assert response.status_code == status.HTTP_201_CREATED

    def test_a_quiz_cannot_be_retaken_by_default(
            self, make_authenticated_client, api_client, klass, subject, term, enrolled_student):
        """
        The review screen hands back the correct answers, so an unlimited
        retake was a free full mark. update_or_create silently allowed it.
        """
        _, teacher = make_authenticated_client('teacher')
        quiz = self._quiz(teacher, klass, subject)

        api_client.force_authenticate(enrolled_student.user)
        payload = {'answers': [{'question_id': 'q1', 'answer': 0}]}
        first = api_client.post(f'/imboni/quiz/{quiz.id}/submit/', payload, format='json')
        assert first.status_code == status.HTTP_201_CREATED

        second = api_client.post(f'/imboni/quiz/{quiz.id}/submit/', payload, format='json')

        assert second.status_code == status.HTTP_400_BAD_REQUEST
        assert AssignmentSubmission.objects.filter(assignment=quiz).count() == 1

    def test_a_teacher_can_allow_more_than_one_attempt(
            self, make_authenticated_client, api_client, klass, subject, term, enrolled_student):
        """A practice quiz is a legitimate thing to set."""
        _, teacher = make_authenticated_client('teacher')
        quiz = self._quiz(teacher, klass, subject, max_attempts=2)

        api_client.force_authenticate(enrolled_student.user)
        payload = {'answers': [{'question_id': 'q1', 'answer': 1}]}
        api_client.post(f'/imboni/quiz/{quiz.id}/submit/', payload, format='json')
        second = api_client.post(f'/imboni/quiz/{quiz.id}/submit/', payload, format='json')

        assert second.status_code == status.HTTP_200_OK
        sub = AssignmentSubmission.objects.get(assignment=quiz, student=enrolled_student)
        assert sub.attempt_count == 2

        third = api_client.post(f'/imboni/quiz/{quiz.id}/submit/', payload, format='json')
        assert third.status_code == status.HTTP_400_BAD_REQUEST

    def test_time_spent_is_recorded(
            self, make_authenticated_client, api_client, klass, subject, term, enrolled_student):
        """It was accepted from the client and thrown away."""
        _, teacher = make_authenticated_client('teacher')
        quiz = self._quiz(teacher, klass, subject)

        api_client.force_authenticate(enrolled_student.user)
        api_client.get(f'/imboni/quiz/{quiz.id}/')
        sub = AssignmentSubmission.objects.get(assignment=quiz, student=enrolled_student)
        sub.started_at = timezone.now() - datetime.timedelta(seconds=90)
        sub.save(update_fields=['started_at'])

        api_client.post(f'/imboni/quiz/{quiz.id}/submit/',
                        {'answers': [{'question_id': 'q1', 'answer': 1}]}, format='json')

        sub.refresh_from_db()
        assert sub.time_spent_seconds >= 90


# ── 4. Overriding an auto-mark ───────────────────────────────────────────────

@pytest.mark.django_db
class TestOverridingAnAutoMark:
    def _submitted_quiz(self, make_authenticated_client, api_client, klass, subject, student):
        client, teacher = make_authenticated_client('teacher')
        quiz = make_assignment(teacher, klass, subject, mode='online', max_score=10,
                               questions=QUIZ_QUESTIONS)
        as_user(api_client, student.user)
        api_client.post(f'/imboni/quiz/{quiz.id}/submit/', {'answers': [
            {'question_id': 'q1', 'answer': 1},        # right
            {'question_id': 'q2', 'answer': '8 cm'},   # right, but not an exact match
        ]}, format='json')
        sub = AssignmentSubmission.objects.get(assignment=quiz, student=student)
        as_user(client, teacher)          # the caller marks as the teacher
        return client, quiz, sub

    def test_exact_matching_marks_a_correct_answer_wrong(
            self, make_authenticated_client, api_client, klass, subject, term, enrolled_student):
        """The premise: "8 cm" against a stored "8cm" scores zero."""
        _, _, sub = self._submitted_quiz(
            make_authenticated_client, api_client, klass, subject, enrolled_student)

        q2 = next(a for a in sub.answers if a['question_id'] == 'q2')
        assert q2['is_correct'] is False
        assert float(sub.score) == 5

    def test_a_teacher_can_see_what_the_student_actually_wrote(
            self, make_authenticated_client, api_client, klass, subject, term, enrolled_student):
        """No screen in the product showed this before."""
        client, _, sub = self._submitted_quiz(
            make_authenticated_client, api_client, klass, subject, enrolled_student)

        response = client.get(f'/imboni/teacher/submissions/{sub.id}/')

        assert response.status_code == status.HTTP_200_OK
        answers = response.json()['answers']
        assert next(a for a in answers if a['question_id'] == 'q2')['answer'] == '8 cm'
        assert response.json()['questions']          # the correct answers, to compare against

    def test_a_teacher_can_correct_the_mark(
            self, make_authenticated_client, api_client, klass, subject, term, enrolled_student):
        client, _, sub = self._submitted_quiz(
            make_authenticated_client, api_client, klass, subject, enrolled_student)

        response = client.patch(
            f'/imboni/teacher/submissions/{sub.id}/',
            {'answers': [{'question_id': 'q2', 'is_correct': True}],
             'feedback': 'Accepted - the space does not matter.'},
            format='json')

        assert response.status_code == status.HTTP_200_OK
        sub.refresh_from_db()
        assert float(sub.score) == 10
        assert float(sub.percentage) == 100
        assert sub.feedback.startswith('Accepted')

    def test_a_partial_mark_can_be_given(
            self, make_authenticated_client, api_client, klass, subject, term, enrolled_student):
        client, _, sub = self._submitted_quiz(
            make_authenticated_client, api_client, klass, subject, enrolled_student)

        client.patch(f'/imboni/teacher/submissions/{sub.id}/',
                     {'answers': [{'question_id': 'q2', 'points_earned': 3}]}, format='json')

        sub.refresh_from_db()
        assert float(sub.score) == 8

    def test_a_mark_above_the_question_maximum_is_refused(
            self, make_authenticated_client, api_client, klass, subject, term, enrolled_student):
        client, _, sub = self._submitted_quiz(
            make_authenticated_client, api_client, klass, subject, enrolled_student)

        response = client.patch(
            f'/imboni/teacher/submissions/{sub.id}/',
            {'answers': [{'question_id': 'q2', 'points_earned': 99}]}, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_another_teacher_cannot_touch_it(
            self, make_authenticated_client, api_client, klass, subject, term, enrolled_student):
        _, _, sub = self._submitted_quiz(
            make_authenticated_client, api_client, klass, subject, enrolled_student)

        other = UserFactory(role='teacher')
        api_client.force_authenticate(other)

        assert api_client.get(f'/imboni/teacher/submissions/{sub.id}/').status_code == 404
        assert api_client.patch(f'/imboni/teacher/submissions/{sub.id}/',
                                {'answers': []}, format='json').status_code == 404


# ── 5. The gradebook ─────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestMarksReachTheGradebook:
    def test_marking_a_paper_assignment_creates_an_assessment(
            self, make_authenticated_client, klass, subject, term, enrolled_student):
        """
        Assignment marks used to live only on the assignment, so the term
        report's continuous-assessment column was retyped by hand.
        """
        client, teacher = make_authenticated_client('teacher')
        a = make_assignment(teacher, klass, subject)

        client.post(f'/imboni/teacher/assignments/{a.id}/grade/',
                    {'records': [{'student_id': str(enrolled_student.id), 'score': 16}]},
                    format='json')

        assessment = Assessment.objects.get(student=enrolled_student, title=a.title)
        assert float(assessment.score_obtained) == 16
        assert float(assessment.max_score) == 20
        assert float(assessment.percentage) == 80
        assert assessment.assessment_type == 'homework'

    def test_a_quiz_is_recorded_as_a_quiz(
            self, make_authenticated_client, api_client, klass, subject, term, enrolled_student):
        _, teacher = make_authenticated_client('teacher')
        quiz = make_assignment(teacher, klass, subject, mode='online', max_score=10,
                               questions=QUIZ_QUESTIONS)

        api_client.force_authenticate(enrolled_student.user)
        api_client.post(f'/imboni/quiz/{quiz.id}/submit/',
                        {'answers': [{'question_id': 'q1', 'answer': 1}]}, format='json')

        assessment = Assessment.objects.get(student=enrolled_student, title=quiz.title)
        assert assessment.assessment_type == 'quiz'

    def test_re_marking_updates_rather_than_duplicating(
            self, make_authenticated_client, klass, subject, term, enrolled_student):
        client, teacher = make_authenticated_client('teacher')
        a = make_assignment(teacher, klass, subject)
        url = f'/imboni/teacher/assignments/{a.id}/grade/'

        client.post(url, {'records': [{'student_id': str(enrolled_student.id), 'score': 10}]},
                    format='json')
        client.post(url, {'records': [{'student_id': str(enrolled_student.id), 'score': 18}]},
                    format='json')

        assessments = Assessment.objects.filter(student=enrolled_student, title=a.title)
        assert assessments.count() == 1
        assert float(assessments.first().score_obtained) == 18


# ── 6. Attachments ───────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestAttachments:
    def test_a_teacher_can_attach_a_worksheet(
            self, make_authenticated_client, klass, subject, term):
        """Set work often IS a document; there was no field for one."""
        from django.core.files.uploadedfile import SimpleUploadedFile

        client, teacher = make_authenticated_client('teacher')
        a = make_assignment(teacher, klass, subject)
        a.attachment = SimpleUploadedFile('worksheet.pdf', b'%PDF-1.4 fake')
        a.save()

        body = client.get(f'/imboni/teacher/assignments/{a.id}/').json()
        assert body['attachment']

    def test_the_student_is_given_the_worksheet(
            self, make_authenticated_client, api_client, klass, subject, term, enrolled_student):
        from django.core.files.uploadedfile import SimpleUploadedFile

        _, teacher = make_authenticated_client('teacher')
        a = make_assignment(teacher, klass, subject)
        a.attachment = SimpleUploadedFile('worksheet.pdf', b'%PDF-1.4 fake')
        a.save()

        api_client.force_authenticate(enrolled_student.user)
        listed = api_client.get('/imboni/student/assignments/').json()

        assert listed[0]['attachment']

    def test_the_teacher_can_reach_what_the_student_handed_in(
            self, make_authenticated_client, api_client, klass, subject, term, enrolled_student):
        """
        The file field existed on the model but was never serialised, so a
        teacher could not open the work they were meant to be marking.
        """
        from django.core.files.uploadedfile import SimpleUploadedFile

        client, teacher = make_authenticated_client('teacher')
        a = make_assignment(teacher, klass, subject)

        as_user(api_client, enrolled_student.user)
        api_client.post(f'/imboni/student/assignments/{a.id}/submit/',
                        {'file': SimpleUploadedFile('essay.txt', b'my essay'),
                         'notes': 'Sorry it is late.'},
                        format='multipart')

        as_user(client, teacher)
        body = client.get(f'/imboni/teacher/assignments/{a.id}/submissions/').json()
        assert body[0]['file']
        assert body[0]['notes'] == 'Sorry it is late.'


# ── 7. Analytics ─────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestAssignmentStatistics:
    def test_it_summarises_how_the_class_did(
            self, make_authenticated_client, klass, subject, term, enrolled_student):
        """A teacher could see every mark and no summary at all."""
        client, teacher = make_authenticated_client('teacher')
        other = StudentFactory(grade='S4', section='A')
        ClassAssignment.objects.create(student=other, class_obj=klass, term=term)
        a = make_assignment(teacher, klass, subject)

        client.post(f'/imboni/teacher/assignments/{a.id}/grade/', {'records': [
            {'student_id': str(enrolled_student.id), 'score': 18},
            {'student_id': str(other.id), 'score': 8},
        ]}, format='json')

        body = client.get(f'/imboni/teacher/assignments/{a.id}/stats/').json()

        assert body['marked'] == 2
        assert body['total_students'] == 2
        assert body['highest'] == 18
        assert body['lowest'] == 8
        assert body['average'] == 65.0        # (90 + 40) / 2
        assert body['pass_rate'] == 50.0
        assert sum(b['count'] for b in body['distribution']) == 2

    def test_it_names_the_question_the_class_found_hardest(
            self, make_authenticated_client, api_client, klass, subject, term, enrolled_student):
        """
        Every graded answer is stored, so this was computable all along and
        simply never aggregated.
        """
        client, teacher = make_authenticated_client('teacher')
        quiz = make_assignment(teacher, klass, subject, mode='online', max_score=10,
                               questions=QUIZ_QUESTIONS)

        as_user(api_client, enrolled_student.user)
        api_client.post(f'/imboni/quiz/{quiz.id}/submit/', {'answers': [
            {'question_id': 'q1', 'answer': 1},          # right
            {'question_id': 'q2', 'answer': 'wrong'},    # wrong
        ]}, format='json')

        as_user(client, teacher)
        questions = client.get(f'/imboni/teacher/assignments/{quiz.id}/stats/').json()['questions']

        by_id = {q['question_id']: q for q in questions}
        assert by_id['q1']['percent_correct'] == 100.0
        assert by_id['q2']['percent_correct'] == 0.0

    def test_a_paper_assignment_reports_no_question_breakdown(
            self, make_authenticated_client, klass, subject, term):
        client, teacher = make_authenticated_client('teacher')
        a = make_assignment(teacher, klass, subject)

        assert client.get(f'/imboni/teacher/assignments/{a.id}/stats/').json()['questions'] == []


# ── 8. Edit and delete safety ────────────────────────────────────────────────

@pytest.mark.django_db
class TestDeleteSafety:
    def test_an_assignment_with_submissions_cannot_be_deleted(
            self, make_authenticated_client, api_client, klass, subject, term, enrolled_student):
        """
        The FK cascades, so deleting used to destroy every student's work and
        mark silently, from an unconfirmed trash icon.
        """
        client, teacher = make_authenticated_client('teacher')
        a = make_assignment(teacher, klass, subject)

        as_user(api_client, enrolled_student.user)
        api_client.post(f'/imboni/student/assignments/{a.id}/submit/', {})

        as_user(client, teacher)
        response = client.delete(f'/imboni/teacher/assignments/{a.id}/')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert Assignment.objects.filter(pk=a.id).exists()
        assert AssignmentSubmission.objects.filter(assignment=a).count() == 1

    def test_an_untouched_assignment_can_still_be_deleted(
            self, make_authenticated_client, klass, subject, term):
        client, teacher = make_authenticated_client('teacher')
        a = make_assignment(teacher, klass, subject)

        response = client.delete(f'/imboni/teacher/assignments/{a.id}/')

        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not Assignment.objects.filter(pk=a.id).exists()

    def test_deleting_takes_its_noticeboard_post_with_it(
            self, make_authenticated_client, klass, subject, term):
        """An orphaned notice advertises work that no longer exists."""
        client, teacher = make_authenticated_client('teacher')
        created = client.post('/imboni/teacher/assignments/', {
            'title': 'Doomed', 'class_obj': str(klass.id), 'subject': str(subject.id),
            'due_date': str(TODAY), 'max_score': 10, 'status': 'active',
            'mode': 'paper', 'questions': [],
        }, format='json').json()

        assert Announcement.objects.filter(title__contains='Doomed').exists()

        client.delete(f"/imboni/teacher/assignments/{created['id']}/")

        assert not Announcement.objects.filter(title__contains='Doomed').exists()

    def test_republishing_does_not_post_a_second_notice(
            self, make_authenticated_client, klass, subject, term):
        """active → draft → active used to leave two identical announcements."""
        client, teacher = make_authenticated_client('teacher')
        created = client.post('/imboni/teacher/assignments/', {
            'title': 'Repeated', 'class_obj': str(klass.id), 'subject': str(subject.id),
            'due_date': str(TODAY), 'max_score': 10, 'status': 'active',
            'mode': 'paper', 'questions': [],
        }, format='json').json()
        url = f"/imboni/teacher/assignments/{created['id']}/"

        client.patch(url, {'status': 'draft'}, format='json')
        client.patch(url, {'status': 'active'}, format='json')

        assert Announcement.objects.filter(title__contains='Repeated').count() == 1


# ── 9. Returning marked work ─────────────────────────────────────────────────

@pytest.mark.django_db
class TestReleasingMarks:
    def test_marks_reach_the_student_immediately_by_default(
            self, make_authenticated_client, api_client, klass, subject, term, enrolled_student):
        """The existing behaviour, which must not change without being asked."""
        client, teacher = make_authenticated_client('teacher')
        a = make_assignment(teacher, klass, subject)

        client.post(f'/imboni/teacher/assignments/{a.id}/grade/',
                    {'records': [{'student_id': str(enrolled_student.id), 'score': 15}]},
                    format='json')

        api_client.force_authenticate(enrolled_student.user)
        listed = api_client.get('/imboni/student/assignments/').json()
        assert listed[0]['status'] == 'graded'
        assert listed[0]['grade'] == 15.0

    def test_a_held_mark_is_hidden_until_released(
            self, make_authenticated_client, api_client, klass, subject, term, enrolled_student):
        """Mark the whole class in your own time, then hand them back at once."""
        client, teacher = make_authenticated_client('teacher')
        a = make_assignment(teacher, klass, subject, release_marks_immediately=False)

        client.post(f'/imboni/teacher/assignments/{a.id}/grade/',
                    {'records': [{'student_id': str(enrolled_student.id), 'score': 15}]},
                    format='json')

        api_client.force_authenticate(enrolled_student.user)
        listed = api_client.get('/imboni/student/assignments/').json()
        assert listed[0]['grade'] is None
        assert listed[0]['status'] != 'graded'

    def test_releasing_reveals_the_mark_and_the_feedback(
            self, make_authenticated_client, api_client, klass, subject, term, enrolled_student):
        client, teacher = make_authenticated_client('teacher')
        a = make_assignment(teacher, klass, subject, release_marks_immediately=False)
        client.post(f'/imboni/teacher/assignments/{a.id}/grade/',
                    {'records': [{'student_id': str(enrolled_student.id),
                                  'score': 15, 'feedback': 'Good work.'}]}, format='json')

        released = client.post(f'/imboni/teacher/assignments/{a.id}/release/')
        assert released.json()['released'] == 1

        api_client.force_authenticate(enrolled_student.user)
        listed = api_client.get('/imboni/student/assignments/').json()
        assert listed[0]['grade'] == 15.0
        assert listed[0]['feedback'] == 'Good work.'

    def test_a_parent_cannot_see_a_mark_before_their_child(
            self, api_client, make_authenticated_client, klass, subject, term, enrolled_student):
        from apps.parents.models import ParentStudentRelationship

        parent = UserFactory(role='parent')
        ParentStudentRelationship.objects.create(parent=parent, student=enrolled_student)

        client, teacher = make_authenticated_client('teacher')
        a = make_assignment(teacher, klass, subject, release_marks_immediately=False)
        client.post(f'/imboni/teacher/assignments/{a.id}/grade/',
                    {'records': [{'student_id': str(enrolled_student.id), 'score': 15}]},
                    format='json')

        api_client.force_authenticate(parent)
        body = api_client.get(f'/imboni/parents/{enrolled_student.id}/assignments/').json()

        assert body[0]['score'] is None

    def test_the_teachers_comment_reaches_the_student(
            self, make_authenticated_client, api_client, klass, subject, term, enrolled_student):
        """
        The feedback panel used to read `notes`, which is the student's own
        submission note - so it showed them their own words back.
        """
        client, teacher = make_authenticated_client('teacher')
        a = make_assignment(teacher, klass, subject)

        as_user(api_client, enrolled_student.user)
        api_client.post(f'/imboni/student/assignments/{a.id}/submit/',
                        {'notes': 'I found question 3 hard.'})

        as_user(client, teacher)
        client.post(f'/imboni/teacher/assignments/{a.id}/grade/',
                    {'records': [{'student_id': str(enrolled_student.id),
                                  'score': 15, 'feedback': 'Question 3 needs more working.'}]},
                    format='json')

        as_user(api_client, enrolled_student.user)
        listed = api_client.get('/imboni/student/assignments/').json()
        assert listed[0]['feedback'] == 'Question 3 needs more working.'

    def test_holding_marks_back_stays_quiet(
            self, make_authenticated_client, klass, subject, term, enrolled_student):
        """
        Telling a student their work is marked while withholding the mark is
        worse than saying nothing.
        """
        from apps.notifications.models import Notification

        client, teacher = make_authenticated_client('teacher')
        a = make_assignment(teacher, klass, subject, release_marks_immediately=False)

        client.post(f'/imboni/teacher/assignments/{a.id}/grade/',
                    {'records': [{'student_id': str(enrolled_student.id), 'score': 15}]},
                    format='json')

        assert not Notification.objects.filter(
            user=enrolled_student.user, title='Assignment marked').exists()

        client.post(f'/imboni/teacher/assignments/{a.id}/release/')

        assert Notification.objects.filter(
            user=enrolled_student.user, title='Assignment marked').exists()


# ── The access-control fix ───────────────────────────────────────────────────

@pytest.mark.django_db
class TestSubmissionsAreScopedToTheirTeacher:
    def test_another_teacher_cannot_read_the_class_list(
            self, make_authenticated_client, api_client, klass, subject, term, enrolled_student):
        """
        The endpoint filtered on the assignment id alone, so any authenticated
        teacher holding a UUID could read another teacher's students, codes
        and marks.
        """
        client, teacher = make_authenticated_client('teacher')
        a = make_assignment(teacher, klass, subject)

        api_client.force_authenticate(enrolled_student.user)
        api_client.post(f'/imboni/student/assignments/{a.id}/submit/', {})

        other = UserFactory(role='teacher')
        api_client.force_authenticate(other)
        response = api_client.get(f'/imboni/teacher/assignments/{a.id}/submissions/')

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_the_owning_teacher_still_can(
            self, make_authenticated_client, klass, subject, term):
        client, teacher = make_authenticated_client('teacher')
        a = make_assignment(teacher, klass, subject)

        response = client.get(f'/imboni/teacher/assignments/{a.id}/submissions/')

        assert response.status_code == status.HTTP_200_OK
