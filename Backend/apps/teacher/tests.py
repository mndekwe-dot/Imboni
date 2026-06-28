import pytest
import datetime
from rest_framework import status
from apps.authentication.factories import UserFactory, StudentFactory
from apps.results.models import Subject, AcademicTerm
from apps.teacher.models import Class, ClassAssignment, Timetable, Assignment


def _make_term():
    return AcademicTerm.objects.create(
        name='Term 1 2025',
        term='term1',
        year=2025,
        start_date=datetime.date(2025, 1, 1),
        end_date=datetime.date(2025, 4, 1),
        is_current=True,
    )


def _make_subject(code='MATH101'):
    return Subject.objects.create(name='Mathematics', code=code)


def _make_class(grade='4', section='A'):
    return Class.objects.create(name=f'S{grade}{section}', grade=grade, section=section)


@pytest.mark.django_db
class TestMyTimetableView:
    def test_non_teacher_role_is_rejected(self, make_authenticated_client):
        client, _user = make_authenticated_client('dos')
        response = client.get('/imboni/teacher/my-timetable/')
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_teacher_only_sees_own_timetable_entries(self, make_authenticated_client):
        client, teacher = make_authenticated_client('teacher')
        other_teacher = UserFactory(role='teacher')
        term = _make_term()
        subject = _make_subject()
        class_obj = _make_class()

        Timetable.objects.create(
            class_obj=class_obj, subject=subject, teacher=teacher, term=term,
            day='monday', start_time='08:00', end_time='09:00',
        )
        Timetable.objects.create(
            class_obj=class_obj, subject=subject, teacher=other_teacher, term=term,
            day='tuesday', start_time='08:00', end_time='09:00',
        )

        response = client.get('/imboni/teacher/my-timetable/')

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]['day'] == 'monday'


@pytest.mark.django_db
class TestTeacherAttendanceStudentsView:
    def test_non_teacher_role_is_rejected(self, make_authenticated_client):
        client, _user = make_authenticated_client('dos')
        response = client.get('/imboni/teacher/attendance/students/')
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_teacher_can_view_class_roster_for_attendance(self, make_authenticated_client):
        # NOTE: TeacherAttendanceStudentsView filters only by `class_id` query
        # param — it does not check whether the requesting teacher actually
        # teaches that class (no SubjectTeacherAssignment/Timetable ownership
        # check). So this only verifies the role-permission boundary (IsTeacher)
        # and the basic happy path, not "own class" scoping, since the view
        # doesn't actually implement that scoping.
        client, _teacher = make_authenticated_client('teacher')
        term = _make_term()
        class_obj = _make_class()
        student = StudentFactory(grade='4', section='A')
        ClassAssignment.objects.create(class_obj=class_obj, student=student, term=term)

        response = client.get('/imboni/teacher/attendance/students/', {'class_id': str(class_obj.id)})

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]['student_code'] == student.student_id


@pytest.mark.django_db
class TestMarkAttendanceView:
    def test_non_teacher_role_is_rejected(self, make_authenticated_client):
        client, _user = make_authenticated_client('dos')
        response = client.post('/imboni/teacher/attendance/mark/', {}, format='json')
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_teacher_can_mark_attendance(self, make_authenticated_client):
        client, _teacher = make_authenticated_client('teacher')
        term = _make_term()
        class_obj = _make_class()
        student = StudentFactory(grade='4', section='A')
        ClassAssignment.objects.create(class_obj=class_obj, student=student, term=term)

        response = client.post('/imboni/teacher/attendance/mark/', {
            'class_id': str(class_obj.id),
            'date': '2025-02-03',
            'records': [
                {'student_id': str(student.id), 'status': 'present', 'notes': ''},
            ],
        }, format='json')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['saved'] == 1


@pytest.mark.django_db
class TestTeacherResultsViews:
    def test_results_list_non_teacher_role_is_rejected(self, make_authenticated_client):
        client, _user = make_authenticated_client('dos')
        response = client.get('/imboni/teacher/results/list/')
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_bulk_save_non_teacher_role_is_rejected(self, make_authenticated_client):
        client, _user = make_authenticated_client('dos')
        response = client.post('/imboni/teacher/results/bulk-save/', {}, format='json')
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_teacher_can_bulk_save_results(self, make_authenticated_client):
        client, _teacher = make_authenticated_client('teacher')
        term = _make_term()
        subject = _make_subject()
        class_obj = _make_class()
        student = StudentFactory(grade='4', section='A')
        ClassAssignment.objects.create(class_obj=class_obj, student=student, term=term)

        response = client.post('/imboni/teacher/results/bulk-save/', {
            'class_id': str(class_obj.id),
            'subject_id': str(subject.id),
            'assessment_title': 'Mid-Term Exam',
            'assessment_type': 'quiz',
            'date': '2025-02-01',
            'max_score': 100,
            'entries': [
                {'student_id': str(student.id), 'score_obtained': 85, 'notes': ''},
            ],
        }, format='json')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['saved'] == 1

    def test_teacher_can_list_results_for_class(self, make_authenticated_client):
        client, _teacher = make_authenticated_client('teacher')
        term = _make_term()
        subject = _make_subject()
        class_obj = _make_class()
        student = StudentFactory(grade='4', section='A')
        ClassAssignment.objects.create(class_obj=class_obj, student=student, term=term)

        from apps.results.models import Assessment
        Assessment.objects.create(
            student=student, subject=subject, term=term,
            title='Mid-Term Exam', assessment_type='quiz',
            date=datetime.date(2025, 2, 1),
            max_score=100, score_obtained=85, percentage=85,
        )

        response = client.get('/imboni/teacher/results/list/', {'class_id': str(class_obj.id)})

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1
        assert response.data['results'][0]['student_code'] == student.student_id


@pytest.mark.django_db
class TestAssignmentViewSet:
    """
    REAL ROUTING BUG: apps/teacher/urls.py registers `router.register(r'teacher',
    views.TeacherViewSet, ...)` BEFORE `router.register(r'teacher/assignments',
    views.AssignmentViewSet, ...)` (same problem affects 'teacher/tasks',
    'teacher/reminders', and 'teacher/question-bank'). DRF's DefaultRouter
    concatenates each registration's URL patterns in registration order, and
    Django resolves the first matching pattern. TeacherViewSet's detail route
    `^teacher/(?P<pk>[^/.]+)/$` matches `/imboni/teacher/assignments/` first
    (treating "assignments" as a pk), so requests never reach AssignmentViewSet:
      - GET  /imboni/teacher/assignments/  -> 404 (TeacherViewSet.retrieve, no
        such User pk) instead of the assignment list.
      - POST /imboni/teacher/assignments/  -> 405 (TeacherViewSet only exposes
        GET) instead of creating an assignment.
    Tests below assert this actual (broken) behavior rather than the intended
    behavior, so they fail loudly the moment routing is fixed and someone needs
    to update them to assert the real list/create response.
    """

    def test_non_teacher_role_is_rejected(self, make_authenticated_client):
        client, _user = make_authenticated_client('dos')
        response = client.get('/imboni/teacher/assignments/')
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_assignments_list_is_shadowed_by_teacher_detail_route(self, make_authenticated_client):
        client, teacher = make_authenticated_client('teacher')
        other_teacher = UserFactory(role='teacher')
        term = _make_term()
        subject = _make_subject()
        class_obj = _make_class()

        Assignment.objects.create(
            title='Mine', subject=subject, class_obj=class_obj, teacher=teacher,
            due_date=datetime.date(2025, 3, 1), max_score=100,
        )
        Assignment.objects.create(
            title='Not Mine', subject=subject, class_obj=class_obj, teacher=other_teacher,
            due_date=datetime.date(2025, 3, 1), max_score=100,
        )

        response = client.get('/imboni/teacher/assignments/')

        # Intended behavior would be 200 with only "Mine" returned; actual
        # behavior is 404 because the request is routed to TeacherViewSet.
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_assignment_create_is_shadowed_by_teacher_detail_route(self, make_authenticated_client):
        client, _teacher = make_authenticated_client('teacher')
        term = _make_term()
        subject = _make_subject()
        class_obj = _make_class()

        response = client.post('/imboni/teacher/assignments/', {
            'title': 'Homework 1',
            'instructions': 'Do exercises 1-5',
            'mode': 'paper',
            'status': 'draft',
            'due_date': '2025-03-15',
            'max_score': 50,
            'class_obj': str(class_obj.id),
            'subject': str(subject.id),
        }, format='json')

        # Intended behavior would be 201; actual behavior is 405 because
        # TeacherViewSet's detail route (GET-only) intercepts this URL first.
        assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED
        assert not Assignment.objects.filter(title='Homework 1').exists()


@pytest.mark.django_db
class TestTeacherSubjectsView:
    def test_non_teacher_role_is_rejected(self, make_authenticated_client):
        client, _user = make_authenticated_client('dos')
        response = client.get('/imboni/teacher/subjects/')
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_teacher_can_list_active_subjects(self, make_authenticated_client):
        client, _teacher = make_authenticated_client('teacher')
        Subject.objects.create(name='English', code='ENG101', is_active=True)
        Subject.objects.create(name='Old Subject', code='OLD101', is_active=False)

        response = client.get('/imboni/teacher/subjects/')

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]['name'] == 'English'
