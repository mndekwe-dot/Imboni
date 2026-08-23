"""
The assignment workflow across portals.

A teacher sets an assignment; the students in that class have to see it; when
it is marked, the student and their parents have to be told. Those three
portals each read their own tables, and the join between them was broken:
the teacher portal wrote apps.teacher.Assignment while the student portal read
apps.student.Assignment - a different table, written only by the demo seeder.
So a student's list showed seeded homework and nothing else: every assignment a
teacher actually published was invisible to the class it was set for, which is
the worst version of the bug, because the demo looked like it worked.

These tests are the guard on that join. They deliberately assert across app
boundaries - write through the teacher's API, read through the student's -
because a test that stayed inside one app is exactly what missed the bug.
"""
import datetime

import pytest
from rest_framework import status

from apps.authentication.factories import UserFactory, StudentFactory
from apps.results.models import Subject, AcademicTerm
from apps.teacher.models import (
    Class, ClassAssignment, Assignment, AssignmentSubmission,
    SubjectTeacherAssignment,
)
from apps.notifications.models import Notification
from apps.parents.models import ParentStudentRelationship

TODAY = datetime.date.today()


@pytest.fixture
def term():
    return AcademicTerm.objects.create(
        name='Term 1 2025', term='term1', year=2025,
        start_date=datetime.date(2025, 1, 1),
        end_date=datetime.date(2025, 4, 1),
        is_current=True,
    )


@pytest.fixture
def subject():
    return Subject.objects.create(name='Mathematics', code='MATH101')


@pytest.fixture
def klass():
    return Class.objects.create(name='S4A', grade='S4', section='A')


@pytest.fixture
def enrolled_student(klass, term):
    """A student actually placed in the class, which is what makes them see it."""
    student = StudentFactory(grade='S4', section='A')
    ClassAssignment.objects.create(student=student, class_obj=klass, term=term)
    return student


def _publish(client, klass, subject, **overrides):
    """Create an assignment through the teacher's own API."""
    payload = {
        'title':        'Chapter 6 Homework',
        'class_obj':    str(klass.id),
        'subject':      str(subject.id),
        'due_date':     str(TODAY + datetime.timedelta(days=7)),
        'max_score':    30,
        'instructions': 'Questions 1 to 10.',
        'status':       'active',
        'mode':         'paper',
        'questions':    [],
    }
    payload.update(overrides)
    return client.post('/imboni/teacher/assignments/', payload, format='json')


@pytest.mark.django_db
class TestAPublishedAssignmentReachesTheStudent:
    def test_a_paper_assignment_appears_in_the_students_list(
            self, make_authenticated_client, api_client, klass, subject, term, enrolled_student):
        """
        The bug this file exists for. A teacher publishes; the student in that
        class must see it. This failed before: the student's endpoint read a
        table the teacher portal never writes, so the list came back empty.
        """
        teacher_client, teacher = make_authenticated_client('teacher')
        SubjectTeacherAssignment.objects.create(
            teacher=teacher, subject=subject, class_obj=klass, term=term)
        assert _publish(teacher_client, klass, subject).status_code == status.HTTP_201_CREATED

        api_client.force_authenticate(enrolled_student.user)
        response = api_client.get('/imboni/student/assignments/')

        assert response.status_code == status.HTTP_200_OK
        titles = [a['title'] for a in response.json()]
        assert 'Chapter 6 Homework' in titles

    def test_an_online_quiz_appears_there_too(
            self, make_authenticated_client, api_client, klass, subject, term, enrolled_student):
        """Both modes go in one list - a student has one pile of homework."""
        teacher_client, _ = make_authenticated_client('teacher')
        _publish(teacher_client, klass, subject,
                 title='Chapter 6 Quiz', mode='online', max_score=2,
                 questions=[{'id': 'q1', 'type': 'mcq', 'text': '2+2?',
                             'options': ['3', '4'], 'correct': 1, 'points': 2}])

        api_client.force_authenticate(enrolled_student.user)
        body = api_client.get('/imboni/student/assignments/').json()

        quiz = next(a for a in body if a['title'] == 'Chapter 6 Quiz')
        assert quiz['mode'] == 'online'
        assert quiz['question_count'] == 1

    def test_a_draft_stays_hidden(
            self, make_authenticated_client, api_client, klass, subject, term, enrolled_student):
        """A draft is unfinished by definition; showing it would be a leak."""
        teacher_client, _ = make_authenticated_client('teacher')
        _publish(teacher_client, klass, subject, title='Not ready', status='draft')

        api_client.force_authenticate(enrolled_student.user)
        titles = [a['title'] for a in api_client.get('/imboni/student/assignments/').json()]

        assert 'Not ready' not in titles

    def test_a_student_in_another_class_does_not_see_it(
            self, make_authenticated_client, api_client, klass, subject, term):
        teacher_client, _ = make_authenticated_client('teacher')
        _publish(teacher_client, klass, subject)

        other_class = Class.objects.create(name='S4B', grade='S4', section='B')
        outsider = StudentFactory(grade='S4', section='B')
        ClassAssignment.objects.create(student=outsider, class_obj=other_class, term=term)

        api_client.force_authenticate(outsider.user)

        assert api_client.get('/imboni/student/assignments/').json() == []

    def test_publishing_notifies_the_class(
            self, make_authenticated_client, klass, subject, term, enrolled_student):
        """
        The bell, not just the noticeboard. Publishing used to create only an
        announcement, which made a new assignment quieter than an absence mark.
        """
        teacher_client, _ = make_authenticated_client('teacher')
        _publish(teacher_client, klass, subject)

        assert Notification.objects.filter(
            user=enrolled_student.user, type='assignment').exists()

    def test_publishing_a_draft_later_still_notifies(
            self, make_authenticated_client, klass, subject, term, enrolled_student):
        """Most assignments are written as a draft and published afterwards."""
        teacher_client, _ = make_authenticated_client('teacher')
        created = _publish(teacher_client, klass, subject, status='draft').json()
        assert not Notification.objects.filter(user=enrolled_student.user).exists()

        teacher_client.patch(f"/imboni/teacher/assignments/{created['id']}/",
                             {'status': 'active'}, format='json')

        assert Notification.objects.filter(
            user=enrolled_student.user, type='assignment').exists()


@pytest.mark.django_db
class TestHandingInAPaperAssignment:
    def test_a_student_can_hand_in_and_the_status_follows(
            self, make_authenticated_client, api_client, klass, subject, term, enrolled_student):
        teacher_client, _ = make_authenticated_client('teacher')
        created = _publish(teacher_client, klass, subject).json()

        api_client.force_authenticate(enrolled_student.user)
        response = api_client.post(
            f"/imboni/student/assignments/{created['id']}/submit/", {'notes': 'Done.'})

        assert response.status_code == status.HTTP_201_CREATED
        assert response.json()['status'] == 'submitted'

        listed = api_client.get('/imboni/student/assignments/').json()
        assert listed[0]['status'] == 'submitted'

    def test_handing_in_after_the_due_date_is_marked_late(
            self, make_authenticated_client, api_client, klass, subject, term, enrolled_student):
        teacher_client, _ = make_authenticated_client('teacher')
        created = _publish(
            teacher_client, klass, subject,
            due_date=str(TODAY - datetime.timedelta(days=1))).json()

        api_client.force_authenticate(enrolled_student.user)
        response = api_client.post(f"/imboni/student/assignments/{created['id']}/submit/", {})

        assert response.json()['status'] == 'late'

    def test_the_same_work_cannot_be_handed_in_twice(
            self, make_authenticated_client, api_client, klass, subject, term, enrolled_student):
        teacher_client, _ = make_authenticated_client('teacher')
        created = _publish(teacher_client, klass, subject).json()

        api_client.force_authenticate(enrolled_student.user)
        url = f"/imboni/student/assignments/{created['id']}/submit/"
        api_client.post(url, {})

        assert api_client.post(url, {}).status_code == status.HTTP_400_BAD_REQUEST

    def test_an_online_quiz_is_refused_here(
            self, make_authenticated_client, api_client, klass, subject, term, enrolled_student):
        """A quiz is answered on the quiz page, which also records the score."""
        teacher_client, _ = make_authenticated_client('teacher')
        created = _publish(teacher_client, klass, subject, mode='online', max_score=1,
                           questions=[{'id': 'q1', 'type': 'mcq', 'text': '?',
                                       'options': ['a', 'b'], 'correct': 0, 'points': 1}]).json()

        api_client.force_authenticate(enrolled_student.user)
        response = api_client.post(f"/imboni/student/assignments/{created['id']}/submit/", {})

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_a_draft_cannot_be_handed_in_against(
            self, make_authenticated_client, api_client, klass, subject, term, enrolled_student):
        teacher_client, _ = make_authenticated_client('teacher')
        created = _publish(teacher_client, klass, subject, status='draft').json()

        api_client.force_authenticate(enrolled_student.user)
        response = api_client.post(f"/imboni/student/assignments/{created['id']}/submit/", {})

        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestMarkingTellsTheStudentAndTheirParents:
    def _graded(self, teacher_client, klass, subject, student, score=25):
        created = _publish(teacher_client, klass, subject).json()
        teacher_client.post(
            f"/imboni/teacher/assignments/{created['id']}/grade/",
            {'records': [{'student_id': str(student.id), 'score': score}]},
            format='json',
        )
        return created

    def test_the_mark_reaches_the_students_list(
            self, make_authenticated_client, api_client, klass, subject, term, enrolled_student):
        teacher_client, _ = make_authenticated_client('teacher')
        self._graded(teacher_client, klass, subject, enrolled_student)

        api_client.force_authenticate(enrolled_student.user)
        listed = api_client.get('/imboni/student/assignments/').json()

        assert listed[0]['status'] == 'graded'
        assert listed[0]['grade'] == 25.0
        assert listed[0]['max_score'] == 30

    def test_the_student_is_notified(
            self, make_authenticated_client, klass, subject, term, enrolled_student):
        """Marking used to be silent - the score landed and nobody was told."""
        teacher_client, _ = make_authenticated_client('teacher')
        self._graded(teacher_client, klass, subject, enrolled_student)

        assert Notification.objects.filter(
            user=enrolled_student.user, title='Assignment marked').exists()

    def test_the_parents_are_notified(
            self, make_authenticated_client, klass, subject, term, enrolled_student):
        parent = UserFactory(role='parent')
        ParentStudentRelationship.objects.create(parent=parent, student=enrolled_student)

        teacher_client, _ = make_authenticated_client('teacher')
        self._graded(teacher_client, klass, subject, enrolled_student)

        assert Notification.objects.filter(user=parent, type='assignment').exists()

    def test_a_submitted_but_unmarked_assignment_reports_no_mark(
            self, make_authenticated_client, api_client, klass, subject, term, enrolled_student):
        """Awaiting a mark is not the same as scoring zero."""
        teacher_client, _ = make_authenticated_client('teacher')
        created = _publish(teacher_client, klass, subject).json()

        api_client.force_authenticate(enrolled_student.user)
        api_client.post(f"/imboni/student/assignments/{created['id']}/submit/", {})
        listed = api_client.get('/imboni/student/assignments/').json()

        assert listed[0]['status'] == 'submitted'
        assert listed[0]['grade'] is None


@pytest.mark.django_db
class TestParentsCanSeeTheirChildsAssignments:
    def test_a_parent_sees_the_assignment_and_the_mark(
            self, api_client, make_authenticated_client, klass, subject, term, enrolled_student):
        parent = UserFactory(role='parent')
        ParentStudentRelationship.objects.create(parent=parent, student=enrolled_student)

        teacher_client, _ = make_authenticated_client('teacher')
        created = _publish(teacher_client, klass, subject).json()
        teacher_client.post(
            f"/imboni/teacher/assignments/{created['id']}/grade/",
            {'records': [{'student_id': str(enrolled_student.id), 'score': 27}]},
            format='json')

        api_client.force_authenticate(parent)
        response = api_client.get(f'/imboni/parents/{enrolled_student.id}/assignments/')

        assert response.status_code == status.HTTP_200_OK
        body = response.json()
        assert body[0]['title'] == 'Chapter 6 Homework'
        assert body[0]['score'] == 27.0
        assert body[0]['status'] == 'graded'

    def test_a_parent_cannot_read_another_familys_child(
            self, api_client, make_authenticated_client, klass, subject, term, enrolled_student):
        """The access rule every child-scoped parent endpoint follows."""
        stranger = UserFactory(role='parent')
        teacher_client, _ = make_authenticated_client('teacher')
        _publish(teacher_client, klass, subject)

        api_client.force_authenticate(stranger)
        response = api_client.get(f'/imboni/parents/{enrolled_student.id}/assignments/')

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_drafts_are_hidden_from_parents_too(
            self, api_client, klass, subject, term, enrolled_student, make_authenticated_client):
        parent = UserFactory(role='parent')
        ParentStudentRelationship.objects.create(parent=parent, student=enrolled_student)

        teacher_client, _ = make_authenticated_client('teacher')
        _publish(teacher_client, klass, subject, title='Not ready', status='draft')

        api_client.force_authenticate(parent)
        titles = [a['title'] for a in
                  api_client.get(f'/imboni/parents/{enrolled_student.id}/assignments/').json()]

        assert 'Not ready' not in titles


@pytest.mark.django_db
class TestThereIsOnlyOneAssignmentModel:
    def test_the_student_app_no_longer_defines_its_own(self):
        """
        apps.student used to carry a second Assignment / AssignmentSubmission
        pair with the same names and a similar shape. Reads and writes ended up
        pointed at different tables, and published homework never reached the
        class it was set for.

        Both are dropped (student migration 0006). This asserts they stay gone:
        re-adding a model by these names in that app is how the bug returns.
        """
        import apps.student.models as student_models

        assert not hasattr(student_models, 'Assignment')
        assert not hasattr(student_models, 'AssignmentSubmission')

    def test_the_work_lands_in_the_teacher_tables(
            self, make_authenticated_client, api_client, klass, subject, term, enrolled_student):
        """The other half: the surviving models are the ones being written."""
        teacher_client, _ = make_authenticated_client('teacher')
        created = _publish(teacher_client, klass, subject).json()

        api_client.force_authenticate(enrolled_student.user)
        api_client.post(f"/imboni/student/assignments/{created['id']}/submit/", {})

        assert Assignment.objects.count() == 1
        assert AssignmentSubmission.objects.count() == 1
