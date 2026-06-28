from django.utils import timezone
from rest_framework import status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Announcement, AnnouncementRead
from .serializers import AnnouncementSerializer, AnnouncementWriteSerializer


def _get_teacher(request):
    """Return logged-in user, falling back to first teacher for dev."""
    from apps.authentication.models import User
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
    permission_classes = [permissions.IsAuthenticated]

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
    permission_classes = [permissions.IsAuthenticated]

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
        from apps.teacher.models import SubjectTeacherAssignment, Class
        from apps.results.models import AcademicTerm

        user      = _get_teacher(request)
        user_role = getattr(user, 'role', None)

        options = [{'label': 'All Classes', 'target_audience': 'all', 'target_grade': ''}]

        if user_role in ('admin', 'dos'):
            # Admins and DOS see every active class in the school
            class_names = (
                Class.objects
                .filter(is_active=True)
                .order_by('grade', 'section')
                .values_list('name', flat=True)
                .distinct()
            )
        else:
            # Teachers see only the classes they are assigned to in the current term
            term = AcademicTerm.objects.filter(is_current=True).first()
            class_names = (
                SubjectTeacherAssignment.objects
                .filter(teacher=user, term=term)
                .select_related('class_obj')
                .values_list('class_obj__name', flat=True)
                .distinct()
                .order_by('class_obj__grade', 'class_obj__section')
            ) if term else []

        for name in class_names:
            options.append({
                'label':           name,
                'target_audience': 'grade_specific',
                'target_grade':    name,
            })

        options.append({'label': 'Parents Only', 'target_audience': 'parents', 'target_grade': ''})

        return Response(options)


# ---------------------------------------------------------------------------
# Mark-Read + Stats
# ---------------------------------------------------------------------------

class PublishedAnnouncementListView(APIView):
    """
    GET /imboni/announcements/
    Returns published announcements filtered by the logged-in user's role:
      parent  → audience in (all, parents)
      student → audience in (all, students)
      others  → all published
    Also annotates each announcement with is_read (bool) for the current user.
    """
    def get(self, request):
        from django.db.models import Q

        role = getattr(request.user, 'role', None) if request.user.is_authenticated else None
        qs = Announcement.objects.filter(status='published')

        if role == 'parent':
            from apps.parents.models import ParentStudentRelationship
            grade_targets = set()
            for grade, section in ParentStudentRelationship.objects.filter(
                parent=request.user
            ).values_list('student__grade', 'student__section'):
                grade_targets.add(grade)
                grade_targets.add(f"{grade}{section}")
            qs = qs.filter(
                Q(target_audience__in=['all', 'parents']) |
                Q(target_audience='grade_specific', target_grade__in=grade_targets)
            )
        elif role == 'student':
            student = getattr(request.user, 'student_profile', None)
            grade_targets = set()
            if student:
                grade_targets = {student.grade, f"{student.grade}{student.section}"}
            qs = qs.filter(
                Q(target_audience__in=['all', 'students']) |
                Q(target_audience='grade_specific', target_grade__in=grade_targets)
            )

        # Materialize the IDs before reuse below — MySQL rejects a sliced
        # queryset reused inside another query's __in filter
        # ("LIMIT & IN/ALL/ANY/SOME subquery" NotSupportedError).
        qs = list(qs.order_by('-published_at', '-created_at')[:100])
        announcement_ids = [a.id for a in qs]

        read_ids = set()
        if request.user.is_authenticated:
            read_ids = set(
                AnnouncementRead.objects
                .filter(user=request.user, announcement_id__in=announcement_ids)
                .values_list('announcement_id', flat=True)
            )

        data = AnnouncementSerializer(qs, many=True).data
        for item in data:
            item['is_read'] = item['id'] in {str(r) for r in read_ids}

        return Response(data)


class AnnouncementMarkReadView(APIView):
    """POST /imboni/announcements/mark-read/<pk>/"""

    def post(self, request, pk):
        from .models import Announcement, AnnouncementRead
        try:
            ann = Announcement.objects.get(pk=pk)
        except Announcement.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=404)

        if not request.user.is_authenticated:
            return Response({'detail': 'Authentication required.'}, status=401)

        AnnouncementRead.objects.get_or_create(announcement=ann, user=request.user)
        return Response({'detail': 'Marked as read.'})


class AnnouncementMarkAllReadView(APIView):
    """POST /imboni/announcements/mark-all-read/"""

    def post(self, request):
        from .models import Announcement, AnnouncementRead
        if not request.user.is_authenticated:
            return Response({'detail': 'Authentication required.'}, status=401)

        unread = Announcement.objects.exclude(
            read_receipts__user=request.user
        )
        count = 0
        for ann in unread:
            AnnouncementRead.objects.get_or_create(announcement=ann, user=request.user)
            count += 1
        return Response({'marked': count})


class AnnouncementStatsView(APIView):
    """GET /imboni/announcements/stats/"""

    def get(self, request):
        from django.utils import timezone

        role  = getattr(request.user, 'role', None) if request.user.is_authenticated else None
        today = timezone.localdate()

        qs = Announcement.objects.filter(status='published')
        if role == 'parent':
            qs = qs.filter(target_audience__in=['all', 'parents'])
        elif role == 'student':
            qs = qs.filter(target_audience__in=['all', 'students'])

        total    = qs.count()
        today_ct = qs.filter(created_at__date=today).count()

        unread = 0
        if request.user.is_authenticated:
            unread = qs.exclude(read_receipts__user=request.user).count()

        return Response({
            'total_published': total,
            'published_today': today_ct,
            'unread':          unread,
        })
