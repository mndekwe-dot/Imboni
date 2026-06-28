import pytest
from rest_framework import status
from apps.authentication.factories import UserFactory, StudentFactory, ParentStudentRelationshipFactory
from .models import Announcement, AnnouncementRead


def make_announcement(author=None, **kwargs):
    defaults = {
        'title': 'Test Announcement',
        'content': 'Hello',
        'category': 'general',
        'target_audience': 'all',
        'status': 'published',
        'author': author,
    }
    defaults.update(kwargs)
    return Announcement.objects.create(**defaults)


@pytest.mark.django_db
class TestTeacherAnnouncementListCreateView:
    def test_teacher_can_create_announcement(self, make_authenticated_client):
        client, teacher = make_authenticated_client('teacher')

        response = client.post('/imboni/announcements/teacher/', {
            'title': 'Homework Due',
            'content': 'Submit by Friday',
            'category': 'academic',
            'target_audience': 'all',
            'status': 'draft',
        })

        assert response.status_code == status.HTTP_201_CREATED
        assert Announcement.objects.count() == 1
        announcement = Announcement.objects.first()
        assert announcement.author == teacher
        assert announcement.status == 'draft'

    def test_publishing_now_sets_published_at(self, make_authenticated_client):
        client, _teacher = make_authenticated_client('teacher')

        response = client.post('/imboni/announcements/teacher/', {
            'title': 'Urgent',
            'content': 'Read now',
            'category': 'urgent',
            'target_audience': 'all',
            'status': 'published',
        })

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['published_at'] is not None

    def test_list_only_returns_own_announcements(self, make_authenticated_client):
        client, teacher = make_authenticated_client('teacher')
        other_teacher = UserFactory(role='teacher')
        make_announcement(author=teacher, title='Mine')
        make_announcement(author=other_teacher, title='Not mine')

        response = client.get('/imboni/announcements/teacher/')

        assert response.status_code == status.HTTP_200_OK
        titles = [a['title'] for a in response.data['results']]
        assert titles == ['Mine']

    def test_drafts_tab_filters_to_draft_status(self, make_authenticated_client):
        client, teacher = make_authenticated_client('teacher')
        make_announcement(author=teacher, title='Draft one', status='draft')
        make_announcement(author=teacher, title='Published one', status='published')

        response = client.get('/imboni/announcements/teacher/?tab=drafts')

        assert response.status_code == status.HTTP_200_OK
        titles = [a['title'] for a in response.data['results']]
        assert titles == ['Draft one']
        assert response.data['draft_count'] == 1

    def test_academic_tab_filters_published_academic_only(self, make_authenticated_client):
        client, teacher = make_authenticated_client('teacher')
        make_announcement(author=teacher, title='Academic published', category='academic', status='published')
        make_announcement(author=teacher, title='Academic draft', category='academic', status='draft')
        make_announcement(author=teacher, title='General published', category='general', status='published')

        response = client.get('/imboni/announcements/teacher/?tab=academic')

        titles = [a['title'] for a in response.data['results']]
        assert titles == ['Academic published']


@pytest.mark.django_db
class TestTeacherAnnouncementDetailView:
    def test_teacher_can_retrieve_own_announcement(self, make_authenticated_client):
        client, teacher = make_authenticated_client('teacher')
        ann = make_announcement(author=teacher)

        response = client.get(f'/imboni/announcements/teacher/{ann.id}/')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['id'] == str(ann.id)

    def test_teacher_cannot_retrieve_others_announcement(self, make_authenticated_client):
        other_teacher = UserFactory(role='teacher')
        ann = make_announcement(author=other_teacher)
        client, _teacher = make_authenticated_client('teacher')

        response = client.get(f'/imboni/announcements/teacher/{ann.id}/')
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_teacher_can_update_own_draft(self, make_authenticated_client):
        client, teacher = make_authenticated_client('teacher')
        ann = make_announcement(author=teacher, status='draft', title='Old title')

        response = client.patch(f'/imboni/announcements/teacher/{ann.id}/', {'title': 'New title'})

        assert response.status_code == status.HTTP_200_OK
        ann.refresh_from_db()
        assert ann.title == 'New title'

    def test_teacher_can_delete_own_announcement(self, make_authenticated_client):
        client, teacher = make_authenticated_client('teacher')
        ann = make_announcement(author=teacher)

        response = client.delete(f'/imboni/announcements/teacher/{ann.id}/')

        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert Announcement.objects.filter(id=ann.id).count() == 0

    def test_unauthenticated_cannot_access_detail(self, api_client):
        teacher = UserFactory(role='teacher')
        ann = make_announcement(author=teacher)

        response = api_client.get(f'/imboni/announcements/teacher/{ann.id}/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestPublishedAnnouncementListView:
    def test_parent_sees_all_and_parents_audience_only(self, make_authenticated_client):
        client, _parent = make_authenticated_client('parent')
        make_announcement(title='For all', target_audience='all')
        make_announcement(title='For parents', target_audience='parents')
        make_announcement(title='For teachers', target_audience='teachers')
        make_announcement(title='For students', target_audience='students')

        response = client.get('/imboni/announcements/')

        titles = {a['title'] for a in response.data}
        assert titles == {'For all', 'For parents'}

    def test_student_sees_all_and_students_audience_only(self, make_authenticated_client):
        client, _student = make_authenticated_client('student')
        make_announcement(title='For all', target_audience='all')
        make_announcement(title='For students', target_audience='students')
        make_announcement(title='For parents', target_audience='parents')

        response = client.get('/imboni/announcements/')

        titles = {a['title'] for a in response.data}
        assert titles == {'For all', 'For students'}

    def test_draft_announcements_never_shown(self, make_authenticated_client):
        client, _parent = make_authenticated_client('parent')
        make_announcement(title='Draft', target_audience='all', status='draft')

        response = client.get('/imboni/announcements/')

        titles = {a['title'] for a in response.data}
        assert 'Draft' not in titles

    def test_is_read_flag_reflects_read_receipts(self, make_authenticated_client):
        client, parent = make_authenticated_client('parent')
        ann = make_announcement(title='Read me', target_audience='all')
        AnnouncementRead.objects.create(announcement=ann, user=parent)

        response = client.get('/imboni/announcements/')

        assert response.data[0]['is_read'] is True

    def test_student_in_matching_grade_sees_grade_specific_announcement(self, api_client):
        student = StudentFactory(grade='5', section='A')
        make_announcement(title='Grade 5 only', target_audience='grade_specific', target_grade='5')

        api_client.force_authenticate(student.user)
        response = api_client.get('/imboni/announcements/')

        titles = {a['title'] for a in response.data}
        assert 'Grade 5 only' in titles

    def test_student_in_different_grade_does_not_see_it(self, api_client):
        student = StudentFactory(grade='3', section='A')
        make_announcement(title='Grade 5 only', target_audience='grade_specific', target_grade='5')

        api_client.force_authenticate(student.user)
        response = api_client.get('/imboni/announcements/')

        titles = {a['title'] for a in response.data}
        assert 'Grade 5 only' not in titles

    def test_student_matches_grade_and_section_target(self, api_client):
        student = StudentFactory(grade='5', section='B')
        make_announcement(title='5B only', target_audience='grade_specific', target_grade='5B')

        api_client.force_authenticate(student.user)
        response = api_client.get('/imboni/announcements/')

        titles = {a['title'] for a in response.data}
        assert '5B only' in titles

    def test_parent_sees_grade_specific_announcement_for_their_childs_grade(self, api_client):
        parent = UserFactory(role='parent')
        child = StudentFactory(grade='2', section='A')
        ParentStudentRelationshipFactory(parent=parent, student=child)
        make_announcement(title='Grade 2 only', target_audience='grade_specific', target_grade='2')

        api_client.force_authenticate(parent)
        response = api_client.get('/imboni/announcements/')

        titles = {a['title'] for a in response.data}
        assert 'Grade 2 only' in titles

    def test_parent_does_not_see_grade_specific_announcement_for_other_grades(self, api_client):
        parent = UserFactory(role='parent')
        child = StudentFactory(grade='2', section='A')
        ParentStudentRelationshipFactory(parent=parent, student=child)
        make_announcement(title='Grade 6 only', target_audience='grade_specific', target_grade='6')

        api_client.force_authenticate(parent)
        response = api_client.get('/imboni/announcements/')

        titles = {a['title'] for a in response.data}
        assert 'Grade 6 only' not in titles


@pytest.mark.django_db
class TestAnnouncementMarkReadView:
    def test_mark_read_creates_receipt(self, make_authenticated_client):
        client, parent = make_authenticated_client('parent')
        ann = make_announcement(title='Mark me')

        response = client.post(f'/imboni/announcements/mark-read/{ann.id}/')

        assert response.status_code == status.HTTP_200_OK
        assert AnnouncementRead.objects.filter(announcement=ann, user=parent).exists()

    def test_mark_read_unauthenticated_returns_401(self, api_client):
        ann = make_announcement(title='Mark me')
        response = api_client.post(f'/imboni/announcements/mark-read/{ann.id}/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_mark_read_nonexistent_returns_404(self, make_authenticated_client):
        client, _parent = make_authenticated_client('parent')
        import uuid
        response = client.post(f'/imboni/announcements/mark-read/{uuid.uuid4()}/')
        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
class TestAnnouncementMarkAllReadView:
    def test_marks_all_unread_as_read(self, make_authenticated_client):
        client, parent = make_authenticated_client('parent')
        make_announcement(title='One')
        make_announcement(title='Two')

        response = client.post('/imboni/announcements/mark-all-read/')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['marked'] == 2
        assert AnnouncementRead.objects.filter(user=parent).count() == 2


@pytest.mark.django_db
class TestAnnouncementStatsView:
    def test_unread_count_for_authenticated_user(self, make_authenticated_client):
        client, parent = make_authenticated_client('parent')
        ann1 = make_announcement(title='One', target_audience='all')
        make_announcement(title='Two', target_audience='all')
        AnnouncementRead.objects.create(announcement=ann1, user=parent)

        response = client.get('/imboni/announcements/stats/')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['total_published'] == 2
        assert response.data['unread'] == 1
