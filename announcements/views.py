from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Announcement
from .serializers import AnnouncementSerializer, AnnouncementWriteSerializer


def _get_teacher(request):
    """Return logged-in user, falling back to first teacher for dev."""
    from authentication.models import User
    if request.user.is_authenticated:
        return request.user
    return User.objects.filter(role='teacher').first()


# ---------------------------------------------------------------------------
# List + Create
# ---------------------------------------------------------------------------

class TeacherAnnouncementListCreateView(APIView):
    """
    GET  /imboni/announcements/teacher/
    POST /imboni/announcements/teacher/

    GET — Returns the teacher's announcements.
    Supports tab filtering via ?tab= :
        all       — all statuses (default)
        academic  — category=academic, published
        events    — category=event, published
        general   — category=general, published
        drafts    — status=draft

    Also returns draft_count for the tab badge.

    POST — Create an announcement.
    Body:
        title, content, category, target_audience, target_grade,
        status ('draft'|'published'),
        published_at (optional; future datetime = Schedule),
        expires_at (optional)
    """
    # permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        teacher = _get_teacher(request)
        tab     = request.query_params.get('tab', 'all').lower()

        qs = Announcement.objects.filter(author=teacher).order_by('-created_at')

        if tab == 'academic':
            qs = qs.filter(category='academic', status='published')
        elif tab == 'events':
            qs = qs.filter(category='event', status='published')
        elif tab == 'general':
            qs = qs.filter(category='general', status='published')
        elif tab == 'drafts':
            qs = qs.filter(status='draft')
        # 'all' — no extra filter

        draft_count = Announcement.objects.filter(author=teacher, status='draft').count()

        return Response({
            'draft_count': draft_count,
            'results':     AnnouncementSerializer(qs, many=True).data,
        })

    def post(self, request):
        teacher    = _get_teacher(request)
        serializer = AnnouncementWriteSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        announcement = serializer.save(author=teacher)
        return Response(
            AnnouncementSerializer(announcement).data,
            status=status.HTTP_201_CREATED,
        )


# ---------------------------------------------------------------------------
# Detail — Retrieve / Update / Delete
# ---------------------------------------------------------------------------

class TeacherAnnouncementDetailView(APIView):
    """
    GET    /imboni/announcements/teacher/<uuid:pk>/  — retrieve single
    PATCH  /imboni/announcements/teacher/<uuid:pk>/  — update / publish draft
    DELETE /imboni/announcements/teacher/<uuid:pk>/  — delete
    """
    # permission_classes = [permissions.IsAuthenticated]

    def _get_object(self, pk, teacher):
        try:
            return Announcement.objects.get(id=pk, author=teacher)
        except Announcement.DoesNotExist:
            return None

    def get(self, request, pk):
        obj = self._get_object(pk, _get_teacher(request))
        if not obj:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(AnnouncementSerializer(obj).data)

    def patch(self, request, pk):
        obj = self._get_object(pk, _get_teacher(request))
        if not obj:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = AnnouncementWriteSerializer(obj, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        return Response(AnnouncementSerializer(serializer.save()).data)

    def delete(self, request, pk):
        obj = self._get_object(pk, _get_teacher(request))
        if not obj:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Quick Templates  (hardcoded — matches the 6 chips in the UI)
# ---------------------------------------------------------------------------

_TEMPLATES = [
    {
        'key':      'homework_reminder',
        'label':    'Homework Reminder',
        'category': 'academic',
        'title':    'Homework Reminder',
        'content':  'Dear students, please remember to complete and submit your homework by the deadline. '
                    'Late submissions will not be accepted without a valid reason.',
    },
    {
        'key':      'exam_schedule',
        'label':    'Exam Schedule',
        'category': 'academic',
        'title':    'Upcoming Exam Schedule',
        'content':  'Please take note of the upcoming examination schedule. '
                    'Make sure you arrive at least 15 minutes before the exam starts. '
                    'Bring all required materials.',
    },
    {
        'key':      'class_canceled',
        'label':    'Class Canceled',
        'category': 'general',
        'title':    'Class Canceled',
        'content':  "Please be informed that today's class has been canceled. "
                    'We will reschedule to a later date. Apologies for any inconvenience caused.',
    },
    {
        'key':      'congratulations',
        'label':    'Congratulations',
        'category': 'general',
        'title':    'Congratulations!',
        'content':  'We would like to congratulate our students on their excellent performance. '
                    'Keep up the great work and continue striving for excellence!',
    },
    {
        'key':      'important_notice',
        'label':    'Important Notice',
        'category': 'urgent',
        'title':    'Important Notice',
        'content':  'This is an important notice for all students and parents. '
                    'Please read carefully and take the necessary action as required.',
    },
    {
        'key':      'reading_assignment',
        'label':    'Reading Assignment',
        'category': 'academic',
        'title':    'Reading Assignment',
        'content':  'Students are required to read the assigned chapters before the next class. '
                    'Be prepared for a brief discussion on the material covered.',
    },
]


class AnnouncementTemplatesView(APIView):
    """
    GET /imboni/announcements/teacher/templates/

    Returns the Quick Templates list. Each template provides pre-filled
    category, title, and content the frontend injects into the form.
    """
    # permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(_TEMPLATES)


# ---------------------------------------------------------------------------
# Target Audience Options  (teacher's classes + predefined options)
# ---------------------------------------------------------------------------

class AnnouncementAudienceOptionsView(APIView):
    """
    GET /imboni/announcements/teacher/audience-options/

    Returns the audience button list for the create form:
        All Classes   → target_audience='all'
        <Class Name>  → target_audience='grade_specific', target_grade=<name>
        Parents Only  → target_audience='parents'

    Class list is scoped to the teacher's current term.
    """
    # permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from teacher.models import SubjectTeacherAssignment
        from results.models import AcademicTerm

        teacher = _get_teacher(request)
        term    = AcademicTerm.objects.filter(is_current=True).first()

        options = [{'label': 'All Classes', 'target_audience': 'all', 'target_grade': ''}]

        if term:
            class_names = (
                SubjectTeacherAssignment.objects
                .filter(teacher=teacher, term=term)
                .select_related('class_obj')
                .values_list('class_obj__name', flat=True)
                .distinct()
                .order_by('class_obj__grade', 'class_obj__section')
            )
            for name in class_names:
                options.append({
                    'label':           name,
                    'target_audience': 'grade_specific',
                    'target_grade':    name,
                })

        options.append({'label': 'Parents Only', 'target_audience': 'parents', 'target_grade': ''})

        return Response(options)
