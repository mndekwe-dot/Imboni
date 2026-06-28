import pytest
import datetime
from rest_framework import status
from apps.authentication.factories import UserFactory, StudentFactory
from apps.results.models import Subject, AcademicTerm
from apps.teacher.models import Class, ClassAssignment, Timetable, Assignment, SubjectTeacherAssignment


def _assign_teacher(teacher, subject, class_obj, term):
    """Link a teacher to a class/subject for a term — required for the
    class-ownership check on attendance/results views to allow access."""
    return SubjectTeacherAssignment.objects.create(
        teacher=teacher, subject=subject, class_obj=class_obj, term=term,
    )


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
        client, teacher = make_authenticated_client('teacher')
        term = _make_term()
        subject = _make_subject()
        class_obj = _make_class()
        _assign_teacher(teacher, subject, class_obj, term)
        student = StudentFactory(grade='4', section='A')
        ClassAssignment.objects.create(class_obj=class_obj, student=student, term=term)

        response = client.get('/imboni/teacher/attendance/students/', {'class_id': str(class_obj.id)})

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]['student_code'] == student.student_id

    def test_teacher_cannot_view_roster_for_a_class_they_do_not_teach(self, make_authenticated_client):
        # Was a real gap: this view had no check that the requesting teacher
        # actually teaches the class_id given. Now enforced via
        # _teacher_teaches_class().
        client, _teacher = make_authenticated_client('teacher')
        term = _make_term()
        class_obj = _make_class()
        student = StudentFactory(grade='4', section='A')
        ClassAssignment.objects.create(class_obj=class_obj, student=student, term=term)

        response = client.get('/imboni/teacher/attendance/students/', {'class_id': str(class_obj.id)})

        assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
class TestMarkAttendanceView:
    def test_non_teacher_role_is_rejected(self, make_authenticated_client):
        client, _user = make_authenticated_client('dos')
        response = client.post('/imboni/teacher/attendance/mark/', {}, format='json')
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_teacher_can_mark_attendance(self, make_authenticated_client):
        client, teacher = make_authenticated_client('teacher')
        term = _make_term()
        subject = _make_subject()
        class_obj = _make_class()
        _assign_teacher(teacher, subject, class_obj, term)
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

    def test_teacher_cannot_mark_attendance_for_a_class_they_do_not_teach(self, make_authenticated_client):
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

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_cannot_mark_attendance_for_a_student_not_enrolled_in_the_class(self, make_authenticated_client):
        # class_id was always required by the serializer but previously never
        # used — any student_id could be marked regardless of class. Now the
        # records list is filtered down to students actually enrolled.
        client, teacher = make_authenticated_client('teacher')
        term = _make_term()
        subject = _make_subject()
        class_obj = _make_class()
        _assign_teacher(teacher, subject, class_obj, term)
        outside_student = StudentFactory(grade='6', section='B')  # not enrolled in class_obj

        response = client.post('/imboni/teacher/attendance/mark/', {
            'class_id': str(class_obj.id),
            'date': '2025-02-03',
            'records': [
                {'student_id': str(outside_student.id), 'status': 'present', 'notes': ''},
            ],
        }, format='json')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['saved'] == 0


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
        client, teacher = make_authenticated_client('teacher')
        term = _make_term()
        subject = _make_subject()
        class_obj = _make_class()
        _assign_teacher(teacher, subject, class_obj, term)
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

    def test_teacher_cannot_bulk_save_results_for_a_class_they_do_not_teach(self, make_authenticated_client):
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

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_teacher_can_list_results_for_class(self, make_authenticated_client):
        client, teacher = make_authenticated_client('teacher')
        term = _make_term()
        subject = _make_subject()
        class_obj = _make_class()
        _assign_teacher(teacher, subject, class_obj, term)
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

    def test_teacher_cannot_list_results_for_a_class_they_do_not_teach(self, make_authenticated_client):
        client, _teacher = make_authenticated_client('teacher')
        term = _make_term()
        class_obj = _make_class()
        student = StudentFactory(grade='4', section='A')
        ClassAssignment.objects.create(class_obj=class_obj, student=student, term=term)

        response = client.get('/imboni/teacher/results/list/', {'class_id': str(class_obj.id)})

        assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
class TestAssignmentViewSet:
    """
    Was a real routing bug: apps/teacher/urls.py registered the bare 'teacher'
    prefix (TeacherViewSet) before the more specific 'teacher/assignments' (and
    'teacher/tasks', 'teacher/reminders', 'teacher/question-bank') prefixes.
    DRF's DefaultRouter concatenates patterns in registration order, so
    TeacherViewSet's detail route `^teacher/(?P<pk>...)/$` matched
    /imboni/teacher/assignments/ first, treating "assignments" as a pk and
    making AssignmentViewSet completely unreachable. Fixed by registering the
    specific prefixes first.
    """

    def test_non_teacher_role_is_rejected(self, make_authenticated_client):
        client, _user = make_authenticated_client('dos')
        response = client.get('/imboni/teacher/assignments/')
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_assignments_list_only_returns_own_assignments(self, make_authenticated_client):
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

        assert response.status_code == status.HTTP_200_OK
        results = response.data['results'] if isinstance(response.data, dict) else response.data
        titles = {a['title'] for a in results}
        assert titles == {'Mine'}

    def test_teacher_can_create_assignment(self, make_authenticated_client):
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

        assert response.status_code == status.HTTP_201_CREATED
        assert Assignment.objects.filter(title='Homework 1').exists()


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
