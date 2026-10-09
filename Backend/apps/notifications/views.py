from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions
from django.utils import timezone
from .models import Notification, PushSubscription
from .serializers import NotificationSerializer


class NotificationListView(APIView):
    """
    GET /imboni/notifications/
    Returns the current user's 20 most recent notifications, any portal.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = Notification.objects.filter(user=request.user)[:20]
        return Response(NotificationSerializer(qs, many=True).data)


class NotificationMarkReadView(APIView):
    """PATCH /imboni/notifications/<uuid:pk>/read/"""
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        try:
            n = Notification.objects.get(pk=pk, user=request.user)
        except Notification.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=404)
        n.is_read = True
        n.read_at = timezone.now()
        n.save(update_fields=['is_read', 'read_at'])
        return Response({'detail': 'Marked as read.'})


class NotificationMarkAllReadView(APIView):
    """PATCH /imboni/notifications/read-all/"""
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request):
        updated = Notification.objects.filter(user=request.user, is_read=False).update(
            is_read=True, read_at=timezone.now()
        )
        return Response({'updated': updated})


class PushPublicKeyView(APIView):
    """
    GET /imboni/notifications/push/key/

    The VAPID public key the browser needs before it can subscribe. Returns
    `configured: false` rather than 404 when no keypair is set, so the frontend
    can hide the "enable push" control instead of showing a button that errors.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from .push import is_configured, public_key
        return Response({'configured': is_configured(), 'public_key': public_key()})


class PushSubscribeView(APIView):
    """
    POST   /imboni/notifications/push/subscribe/    body: browser PushSubscription JSON
    DELETE /imboni/notifications/push/subscribe/    body: {"endpoint": "..."}

    Re-subscribing the same browser updates the existing row instead of
    creating a duplicate — `endpoint` is unique, and a browser that re-registers
    (after a service worker update, say) would otherwise accumulate rows that
    each deliver the same notice.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        endpoint = (request.data.get('endpoint') or '').strip()
        keys = request.data.get('keys') or {}
        p256dh = (keys.get('p256dh') or '').strip()
        auth = (keys.get('auth') or '').strip()

        if not endpoint or not p256dh or not auth:
            return Response(
                {'detail': 'endpoint, keys.p256dh and keys.auth are all required.'},
                status=400,
            )

        subscription, created = PushSubscription.objects.update_or_create(
            endpoint=endpoint,
            defaults={
                'user': request.user,
                'p256dh': p256dh,
                'auth': auth,
                'user_agent': request.META.get('HTTP_USER_AGENT', '')[:300],
            },
        )
        return Response(
            {'detail': 'Subscribed.', 'id': str(subscription.id)},
            status=201 if created else 200,
        )

    def delete(self, request):
        endpoint = (request.data.get('endpoint') or '').strip()
        if not endpoint:
            return Response({'detail': 'endpoint is required.'}, status=400)

        # Scoped to request.user: one account must not be able to unsubscribe
        # another's browser by guessing an endpoint.
        deleted, _ = PushSubscription.objects.filter(
            endpoint=endpoint, user=request.user
        ).delete()
        return Response({'deleted': deleted})


class NavBadgesView(APIView):
    """
    GET /imboni/nav-badges/

    The small numbers beside sidebar entries, in one cheap call instead of one
    request per entry. Every key is a count of things waiting on this user:

        messages       unread messages from other people
        announcements  published announcements they have not opened
        assignments    (students) open work still to hand in
        grading        (teachers) hand-ins waiting for a mark
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        role = getattr(user, 'role', None)
        data = {'messages': self._messages(user), 'announcements': self._announcements(user, role)}
        if role == 'student':
            data['assignments'] = self._open_assignments(user)
        elif role == 'teacher':
            data['grading'] = self._to_grade(user)
        return Response(data)

    @staticmethod
    def _messages(user):
        from apps.messages.models import Message
        return (
            Message.objects
            .filter(conversation__participants=user, is_read=False)
            .exclude(sender=user)
            .count()
        )

    @staticmethod
    def _announcements(user, role):
        from apps.announcements.models import Announcement
        qs = Announcement.objects.filter(status='published')
        if role == 'parent':
            qs = qs.filter(target_audience__in=['all', 'parents'])
        elif role == 'student':
            qs = qs.filter(target_audience__in=['all', 'students'])
        return qs.exclude(read_receipts__user=user).count()

    @staticmethod
    def _open_assignments(user):
        """Active work for the student's class, still open, not yet handed in."""
        from apps.results.models import AcademicTerm
        from apps.teacher.models import Assignment, AssignmentSubmission, ClassAssignment
        student = getattr(user, 'student_profile', None)
        term = AcademicTerm.objects.filter(is_current=True).first()
        if not student or not term:
            return 0
        placement = ClassAssignment.objects.filter(student=student, term=term).first()
        if not placement:
            return 0
        open_work = Assignment.objects.filter(
            class_obj=placement.class_obj, status='active', due_date__gte=timezone.localdate(),
        )
        handed_in = {
            sub.assignment_id
            for sub in AssignmentSubmission.objects.filter(student=student, assignment__in=open_work)
            if sub.is_submitted
        }
        return open_work.exclude(id__in=handed_in).count()

    @staticmethod
    def _to_grade(user):
        """Hand-ins to this teacher's assignments that have no mark yet."""
        from apps.teacher.models import AssignmentSubmission
        return sum(
            1 for sub in AssignmentSubmission.objects.filter(assignment__teacher=user, is_graded=False)
            if sub.is_submitted
        )

