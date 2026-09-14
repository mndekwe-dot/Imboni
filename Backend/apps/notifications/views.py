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
