"""
How work comes back: uploaded, handed in physically, or sat online with no
going back.

Companion to test_assignment_lifecycle.py; the fixtures are in conftest.py.
"""
import datetime

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status

from apps.teacher.models import AssignmentSubmission
from apps.teacher.test_assignment_lifecycle import QUIZ_QUESTIONS, YESTERDAY, make_assignment

THREE_QUESTIONS = QUIZ_QUESTIONS + [
    {'id': 'q3', 'type': 'true_false', 'text': 'The sky is green.', 'correct': 1, 'points': 5},
]


# ── Paper: upload or hand in ────────────────────────────────────────────────

@pytest.mark.django_db
class TestSubmissionMethod:
    def test_an_upload_task_refuses_a_hand_in_with_no_file(
            self, make_authenticated_client, api_client, klass, subject, term, enrolled_student):
        """Marking an upload task "done" left the teacher nothing to mark."""
        _, teacher = make_authenticated_client('teacher')
        a = make_assignment(teacher, klass, subject, submission_method='upload')

        api_client.force_authenticate(enrolled_student.user)
        response = api_client.post(f'/imboni/student/assignments/{a.id}/submit/', {})

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert not AssignmentSubmission.objects.filter(assignment=a).exists()

    def test_an_upload_task_takes_the_file(
            self, make_authenticated_client, api_client, klass, subject, term, enrolled_student):
        _, teacher = make_authenticated_client('teacher')
        a = make_assignment(teacher, klass, subject, submission_method='upload')

        api_client.force_authenticate(enrolled_student.user)
        upload = SimpleUploadedFile('essay.pdf', b'%PDF-1.4 work', content_type='application/pdf')
        response = api_client.post(
            f'/imboni/student/assignments/{a.id}/submit/', {'file': upload}, format='multipart')

        assert response.status_code == status.HTTP_201_CREATED
        assert AssignmentSubmission.objects.get(assignment=a).file

    def test_a_physical_hand_in_needs_no_file(
            self, make_authenticated_client, api_client, klass, subject, term, enrolled_student):
        _, teacher = make_authenticated_client('teacher')
        a = make_assignment(teacher, klass, subject, submission_method='in_person')

        api_client.force_authenticate(enrolled_student.user)
        response = api_client.post(f'/imboni/student/assignments/{a.id}/submit/', {})

        assert response.status_code == status.HTTP_201_CREATED

    def test_a_late_hand_in_reads_as_handed_in_with_its_date(
            self, make_authenticated_client, api_client, klass, subject, term, enrolled_student):
        """
        A late hand-in comes back as `late`, which the student page read as
        overdue - so "Mark as done" appeared to do nothing at all.
        """
        _, teacher = make_authenticated_client('teacher')
        a = make_assignment(teacher, klass, subject, due_date=YESTERDAY)

        api_client.force_authenticate(enrolled_student.user)
        api_client.post(f'/imboni/student/assignments/{a.id}/submit/', {})
        row = api_client.get('/imboni/student/assignments/').json()[0]

        assert row['status'] == 'late'
        assert row['is_late'] is True
        assert row['submitted_at'] is not None
        assert row['submission_method'] == 'in_person'


# ── Online: no going back ───────────────────────────────────────────────────

@pytest.mark.django_db
class TestNoBacktracking:
    def _quiz(self, teacher, klass, subject, **kw):
        return make_assignment(teacher, klass, subject, mode='online', max_score=15,
                               questions=THREE_QUESTIONS, **kw)

    def _open(self, api_client, student, quiz):
        api_client.force_authenticate(student.user)
        return api_client.get(f'/imboni/quiz/{quiz.id}/').json()

    def test_the_quiz_says_whether_going_back_is_allowed(
            self, make_authenticated_client, api_client, klass, subject, term, enrolled_student):
        _, teacher = make_authenticated_client('teacher')
        quiz = self._quiz(teacher, klass, subject, allow_backtracking=False)

        paper = self._open(api_client, enrolled_student, quiz)

        assert paper['allow_backtracking'] is False
        assert paper['position'] == 0

    def test_moving_on_locks_the_answer(
            self, make_authenticated_client, api_client, klass, subject, term, enrolled_student):
        _, teacher = make_authenticated_client('teacher')
        quiz = self._quiz(teacher, klass, subject, allow_backtracking=False)
        paper = self._open(api_client, enrolled_student, quiz)
        first, second = paper['questions'][0]['id'], paper['questions'][1]['id']

        api_client.post(f'/imboni/quiz/{quiz.id}/answer/',
                        {'question_id': first, 'answer': 1}, format='json')
        api_client.post(f'/imboni/quiz/{quiz.id}/answer/',
                        {'question_id': second, 'answer': 'x'}, format='json')
        back = api_client.post(f'/imboni/quiz/{quiz.id}/answer/',
                               {'question_id': first, 'answer': 0}, format='json')

        assert back.status_code == status.HTTP_409_CONFLICT

    def test_a_reload_resumes_where_the_student_was_in_the_same_order(
            self, make_authenticated_client, api_client, klass, subject, term, enrolled_student):
        """A reload must neither reshuffle the paper nor reopen a locked question."""
        _, teacher = make_authenticated_client('teacher')
        quiz = self._quiz(teacher, klass, subject, allow_backtracking=False, shuffle_questions=True)
        paper = self._open(api_client, enrolled_student, quiz)
        api_client.post(f'/imboni/quiz/{quiz.id}/answer/',
                        {'question_id': paper['questions'][0]['id'], 'answer': 1}, format='json')

        again = self._open(api_client, enrolled_student, quiz)

        assert [q['id'] for q in again['questions']] == [q['id'] for q in paper['questions']]
        assert again['position'] == 1

    def test_the_final_submit_cannot_rewrite_a_locked_answer(
            self, make_authenticated_client, api_client, klass, subject, term, enrolled_student):
        _, teacher = make_authenticated_client('teacher')
        quiz = self._quiz(teacher, klass, subject, allow_backtracking=False)
        self._open(api_client, enrolled_student, quiz)
        # q1 locked wrong (0), then the submit body claims it right (1).
        api_client.post(f'/imboni/quiz/{quiz.id}/answer/',
                        {'question_id': 'q1', 'answer': 0}, format='json')

        response = api_client.post(f'/imboni/quiz/{quiz.id}/submit/', {'answers': [
            {'question_id': 'q1', 'answer': 1},
            {'question_id': 'q2', 'answer': '8cm'},
        ]}, format='json')

        assert response.status_code == status.HTTP_201_CREATED
        marked = {a['question_id']: a for a in response.json()['answers']}
        assert marked['q1']['is_correct'] is False
        assert marked['q2']['is_correct'] is True
        assert AssignmentSubmission.objects.get(assignment=quiz).progress == {}

    def test_a_quiz_that_allows_going_back_has_no_answer_endpoint(
            self, make_authenticated_client, api_client, klass, subject, term, enrolled_student):
        _, teacher = make_authenticated_client('teacher')
        quiz = self._quiz(teacher, klass, subject)
        self._open(api_client, enrolled_student, quiz)

        response = api_client.post(f'/imboni/quiz/{quiz.id}/answer/',
                                   {'question_id': 'q1', 'answer': 1}, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_a_retake_starts_a_new_clock(
            self, make_authenticated_client, api_client, klass, subject, term, enrolled_student):
        """A retake used to be timed from the first sitting and refused as over time."""
        from django.utils import timezone

        _, teacher = make_authenticated_client('teacher')
        quiz = self._quiz(teacher, klass, subject, max_attempts=2, time_limit_minutes=10)
        self._open(api_client, enrolled_student, quiz)
        api_client.post(f'/imboni/quiz/{quiz.id}/submit/',
                        {'answers': [{'question_id': 'q1', 'answer': 1}]}, format='json')
        sub = AssignmentSubmission.objects.get(assignment=quiz)
        sub.started_at = timezone.now() - datetime.timedelta(hours=3)
        sub.save(update_fields=['started_at'])

        self._open(api_client, enrolled_student, quiz)
        retake = api_client.post(f'/imboni/quiz/{quiz.id}/submit/',
                                 {'answers': [{'question_id': 'q1', 'answer': 1}]}, format='json')

        assert retake.status_code == status.HTTP_200_OK

    def test_an_opened_quiz_is_not_listed_as_completed(
            self, make_authenticated_client, api_client, klass, subject, term, enrolled_student):
        _, teacher = make_authenticated_client('teacher')
        quiz = self._quiz(teacher, klass, subject)
        self._open(api_client, enrolled_student, quiz)

        listed = api_client.get('/imboni/quiz/').json()

        assert listed[0]['submitted'] is False
