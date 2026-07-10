from rest_framework.views import APIView
from rest_framework.response import Response

from apps.authentication.permissions import IsAdminRole
from .models import AuditEntry


class AuditLogListView(APIView):
    """
    GET /imboni/admin/audit/?action=<prefix>&q=<search>&page=<n>

    Most recent administrative actions, newest first, 50 per page.
    Admin only.
    """
    permission_classes = [IsAdminRole]
    PAGE_SIZE = 50

    def get(self, request):
        qs = AuditEntry.objects.all()

        action = request.query_params.get('action', '').strip()
        if action:
            qs = qs.filter(action__startswith=action)

        q = request.query_params.get('q', '').strip()
        if q:
            from django.db.models import Q
            qs = qs.filter(Q(target__icontains=q) | Q(actor_name__icontains=q))

        try:
            page = max(1, int(request.query_params.get('page', 1)))
        except ValueError:
            page = 1

        total = qs.count()
        start = (page - 1) * self.PAGE_SIZE
        entries = qs[start:start + self.PAGE_SIZE]

        return Response({
            'total': total,
            'page': page,
            'page_size': self.PAGE_SIZE,
            'results': [
                {
                    'id':         str(e.id),
                    'actor_name': e.actor_name,
                    'actor_role': e.actor_role,
                    'action':     e.action,
                    'target':     e.target,
                    'detail':     e.detail,
                    'created_at': e.created_at.isoformat(),
                }
                for e in entries
            ],
        })
