"""
Teaching materials: a teacher shares a file or a link with a class they teach,
and that class's students - and their parents - can find it.
"""
import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status

from apps.authentication.factories import StudentFactory, UserFactory
from apps.parents.models import ParentStudentRelationship
from apps.teacher.models import Class, SubjectTeacherAssignment, TeachingMaterial

URL = '/imboni/teacher/materials/'


@pytest.fixture(autouse=True)
def _media(settings, tmp_path):
    settings.MEDIA_ROOT = str(tmp_path)


@pytest.fixture
def teaching(make_authenticated_client, klass, subject, term):
    client, teacher = make_authenticated_client('teacher')
    SubjectTeacherAssignment.objects.create(teacher=teacher, class_obj=klass, subject=subject, term=term)
    return client, teacher


def pdf(name='notes.pdf', size=100):
    return SimpleUploadedFile(name, b'%PDF' + b'0' * size, content_type='application/pdf')


def link_body(klass, subject, **extra):
    return {'title': 'Fractions explained', 'class_obj': str(klass.id), 'subject': str(subject.id),
            'url': 'https://www.youtube.com/watch?v=abc', **extra}


@pytest.mark.django_db
class TestTeacherSharesMaterials:
    def test_a_file_is_shared_with_the_class(self, teaching, klass, subject):
        client, _ = teaching
        response = client.post(URL, {'title': 'Week 3 notes', 'class_obj': str(klass.id),
                                      'subject': str(subject.id), 'file': pdf()},
                               format='multipart')

        assert response.status_code == status.HTTP_201_CREATED, response.data
        assert response.data['kind'] == 'file'
        assert response.data['file_name'] == 'notes.pdf'
        assert response.data['class_name'] == 'S4A'
        assert response.data['subject_name'] == 'Mathematics'

    def test_a_youtube_link_is_a_video_and_a_plain_link_is_a_link(self, teaching, klass, subject):
        client, _ = teaching
        video = client.post(URL, link_body(klass, subject), format='json')
        page = client.post(URL, link_body(klass, subject, url='https://en.wikipedia.org/wiki/Fraction'),
                           format='json')

        assert video.data['kind'] == 'video'
        assert page.data['kind'] == 'link'

    def test_a_lookalike_host_is_not_a_video(self, teaching, klass, subject):
        client, _ = teaching
        response = client.post(URL, link_body(klass, subject, url='https://notyoutube.com/x'), format='json')
        assert response.data['kind'] == 'link'

    def test_nothing_to_share_is_refused(self, teaching, klass, subject):
        client, _ = teaching
        response = client.post(URL, link_body(klass, subject, url=''), format='json')
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_a_file_type_that_cannot_be_opened_safely_is_refused(self, teaching, klass, subject):
        client, _ = teaching
        response = client.post(URL, {'title': 'Setup', 'class_obj': str(klass.id), 'subject': str(subject.id),
                                      'file': SimpleUploadedFile('setup.exe', b'MZ')},
                               format='multipart')
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'file' in response.data

    def test_a_file_over_25_mb_is_refused(self, teaching, klass, subject):
        client, _ = teaching
        response = client.post(URL, {'title': 'Huge', 'class_obj': str(klass.id), 'subject': str(subject.id),
                                      'file': pdf(size=25 * 1024 * 1024)},
                               format='multipart')
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_a_class_the_teacher_does_not_teach_is_refused(self, teaching, subject, term):
        client, _ = teaching
        other = Class.objects.create(name='S1B', grade='S1', section='B')
        response = client.post(URL, link_body(other, subject), format='json')
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert not TeachingMaterial.objects.exists()

    def test_switching_a_file_to_a_link_removes_the_file(self, teaching, klass, subject, tmp_path):
        client, _ = teaching
        created = client.post(URL, {'title': 'Notes', 'class_obj': str(klass.id), 'subject': str(subject.id),
                                     'file': pdf()}, format='multipart').data
        stored = TeachingMaterial.objects.get(pk=created['id']).file.path

        response = client.patch(f"{URL}{created['id']}/", {'url': 'https://example.com/notes'}, format='json')

        assert response.status_code == status.HTTP_200_OK, response.data
        assert response.data['kind'] == 'link'
        assert response.data['file'] is None
        assert not (tmp_path / stored).exists()

    def test_a_teacher_sees_and_deletes_only_their_own(self, teaching, make_authenticated_client,
                                                       api_client, klass, subject, term):
        client, teacher = teaching
        mine = client.post(URL, link_body(klass, subject), format='json').data

        other_teacher = UserFactory(role='teacher')
        theirs = TeachingMaterial.objects.create(
            teacher=other_teacher, class_obj=klass, subject=subject, term=term,
            title='Theirs', url='https://example.com')

        client.force_authenticate(teacher)
        listed = client.get(URL).data
        assert [m['id'] for m in listed] == [mine['id']]
        assert client.delete(f'{URL}{theirs.id}/').status_code == status.HTTP_404_NOT_FOUND
        assert client.delete(f"{URL}{mine['id']}/").status_code == status.HTTP_204_NO_CONTENT

    def test_the_class_is_notified(self, teaching, klass, subject, enrolled_student):
        from apps.notifications.models import Notification

        client, _ = teaching
        client.post(URL, link_body(klass, subject), format='json')

        note = Notification.objects.get(user=enrolled_student.user)
        assert note.title == 'New material: Fractions explained'
        assert note.path == '/student/materials'


@pytest.mark.django_db
class TestStudentsAndParentsFindThem:
    def test_a_student_sees_their_class_materials_this_term(self, api_client, klass, subject, term,
                                                           enrolled_student):
        teacher = UserFactory(role='teacher')
        TeachingMaterial.objects.create(teacher=teacher, class_obj=klass, subject=subject, term=term,
                                        title='Ours', url='https://example.com/a')
        other = Class.objects.create(name='S1B', grade='S1', section='B')
        TeachingMaterial.objects.create(teacher=teacher, class_obj=other, subject=subject, term=term,
                                        title='Not ours', url='https://example.com/b')

        api_client.force_authenticate(enrolled_student.user)
        response = api_client.get('/imboni/student/materials/')

        assert response.status_code == status.HTTP_200_OK
        assert [m['title'] for m in response.data] == ['Ours']
        assert response.data[0]['teacher_name'] == teacher.full_name

    def test_a_parent_sees_their_own_childs_materials_only(self, api_client, klass, subject, term,
                                                           enrolled_student):
        TeachingMaterial.objects.create(teacher=UserFactory(role='teacher'), class_obj=klass,
                                        subject=subject, term=term, title='Ours',
                                        url='https://example.com/a')
        parent = UserFactory(role='parent')
        ParentStudentRelationship.objects.create(parent=parent, student=enrolled_student,
                                                 relationship_type='mother')
        stranger = StudentFactory()

        api_client.force_authenticate(parent)
        own = api_client.get(f'/imboni/parents/{enrolled_student.id}/materials/')
        other = api_client.get(f'/imboni/parents/{stranger.id}/materials/')

        assert [m['title'] for m in own.data] == ['Ours']
        assert other.status_code == status.HTTP_404_NOT_FOUND

    def test_a_student_cannot_post(self, api_client, klass, subject, enrolled_student):
        api_client.force_authenticate(enrolled_student.user)
        response = api_client.post(URL, link_body(klass, subject), format='json')
        assert response.status_code == status.HTTP_403_FORBIDDEN
