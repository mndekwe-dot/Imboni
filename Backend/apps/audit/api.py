"""The school's audit trail, for its administrator to read.

    GET /imboni/audit/   ?action=<prefix> ?actor=<name> ?q=<text in the target>
                         ?from=YYYY-MM-DD ?to=YYYY-MM-DD ?offset= ?format=csv

Read-only by route as well as by policy: there is no endpoint that writes,
edits or deletes an entry.
"""
from datetime import datetime, time, timedelta

from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.permissions import IsAdminRole
from apps.common import documents

from .models import AuditEntry

PAGE = 100
CSV_CAP = 5000


def _day_start(value):
    try:
        d = datetime.strptime(value, '%Y-%m-%d').date()
    except (TypeError, ValueError):
        return None
    return timezone.make_aware(datetime.combine(d, time.min))


class AuditLogView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        q = request.query_params
        entries = AuditEntry.objects.all()
        if q.get('action'):
            entries = entries.filter(action__startswith=q['action'])
        if q.get('actor'):
            entries = entries.filter(actor_name__icontains=q['actor'])
        if q.get('q'):
            entries = entries.filter(target__icontains=q['q'])
        start = _day_start(q.get('from'))
        if start:
            entries = entries.filter(created_at__gte=start)
        end = _day_start(q.get('to'))
        if end:
            # "to" is a day, and that whole day counts.
            entries = entries.filter(created_at__lt=end + timedelta(days=1))

        if documents.wants(request, 'csv'):
            return documents.csv_response(
                'audit-log', ['When', 'Who', 'Role', 'Action', 'Target', 'Detail'],
                ([timezone.localtime(e.created_at).strftime('%Y-%m-%d %H:%M'), e.actor_name,
                  e.actor_role, e.action, e.target, e.detail] for e in entries[:CSV_CAP]))

        try:
            offset = max(int(q.get('offset', 0)), 0)
        except ValueError:
            offset = 0
        total = entries.count()
        rows = entries[offset:offset + PAGE]
        return Response({
            'count': total,
            'results': [{
                'id': str(e.id), 'when': e.created_at, 'actor_name': e.actor_name or '-',
                'actor_role': e.actor_role, 'action': e.action, 'target': e.target, 'detail': e.detail,
            } for e in rows],
            'actions': list(AuditEntry.objects.order_by().values_list('action', flat=True).distinct()),
        })
