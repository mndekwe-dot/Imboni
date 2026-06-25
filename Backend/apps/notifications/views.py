from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions
from django.utils import timezone
from .models import Notification
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
