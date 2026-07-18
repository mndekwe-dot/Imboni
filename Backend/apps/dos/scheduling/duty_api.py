"""DRF endpoints for duty posts and the duty-roster generator.

    GET|POST         /imboni/dos/duty-posts/            -> configure posts
    PATCH|DELETE     /imboni/dos/duty-posts/<pk>/
    GET              /imboni/dos/duty-roster/?term_id=  -> current roster
    POST             /imboni/dos/duty-roster/generate/         -> preview
    POST             /imboni/dos/duty-roster/generate/commit/  -> persist
"""

from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.permissions import IsDOSOrAdmin
from apps.results.models import AcademicTerm
from ..models import DUTY_DAY_CHOICES, DutyAssignment, DutyPost
from .duty_service import (
    DEFAULT_DAYS,
    DUTY_ROLES,
    DutyRosterError,
    commit_duty_roster,
    plan_duty_roster,
)

_DAY_VALUES = [d[0] for d in DUTY_DAY_CHOICES]


class DutyPostSerializer(serializers.ModelSerializer):
    staff_required = serializers.IntegerField(min_value=1, max_value=20, required=False)

    class Meta:
        model = DutyPost
        fields = ['id', 'name', 'order', 'start_time', 'end_time',
                  'staff_required', 'is_active']


class DutyPostListView(APIView):
    """GET list | POST create a duty post."""
    permission_classes = [IsDOSOrAdmin]

    def get(self, request):
        qs = DutyPost.objects.all().order_by('order', 'start_time')
        return Response(DutyPostSerializer(qs, many=True).data)

    def post(self, request):
        serializer = DutyPostSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class DutyPostDetailView(APIView):
    """PATCH | DELETE a duty post."""
    permission_classes = [IsDOSOrAdmin]

    def _get(self, pk):
        return DutyPost.objects.filter(pk=pk).first()

    def patch(self, request, pk):
        post = self._get(pk)
        if post is None:
            return Response({'detail': 'Duty post not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = DutyPostSerializer(post, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk):
        post = self._get(pk)
        if post is None:
            return Response({'detail': 'Duty post not found.'}, status=status.HTTP_404_NOT_FOUND)
        post.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class DutyRosterListView(APIView):
    """GET the persisted roster for a term."""
    permission_classes = [IsDOSOrAdmin]

    def get(self, request):
        term_id = request.query_params.get('term_id')
        qs = (DutyAssignment.objects
              .select_related('post', 'staff')
              .order_by('day', 'post__order'))
        if term_id:
            qs = qs.filter(term_id=term_id)
        return Response([{
            'id': str(a.id),
            'day': a.day,
            'post_id': str(a.post_id),
            'post_name': a.post.name,
            'start_time': a.post.start_time.strftime('%H:%M'),
            'end_time': a.post.end_time.strftime('%H:%M'),
            'staff_id': str(a.staff_id),
            'staff_name': a.staff.full_name,
            'staff_role': a.staff.role,
        } for a in qs])


class DutyRosterGenerateRequestSerializer(serializers.Serializer):
    term_id = serializers.UUIDField()
    days = serializers.ListField(
        child=serializers.ChoiceField(choices=_DAY_VALUES),
        required=False, allow_empty=False,
    )
    max_per_day = serializers.IntegerField(min_value=1, max_value=10, default=1)
    roles = serializers.ListField(
        child=serializers.ChoiceField(choices=DUTY_ROLES),
        required=False, allow_empty=False,
    )

    def to_plan_kwargs(self):
        d = self.validated_data
        return {
            'days': list(d.get('days') or DEFAULT_DAYS),
            'max_per_day': d['max_per_day'],
            'roles': list(d['roles']) if d.get('roles') else None,
        }


class _DutyGenerateBase(APIView):
    permission_classes = [IsDOSOrAdmin]

    def _term_and_kwargs(self, request):
        serializer = DutyRosterGenerateRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        term = AcademicTerm.objects.filter(id=serializer.validated_data['term_id']).first()
        if term is None:
            raise DutyRosterError('Academic term not found.')
        return term, serializer.to_plan_kwargs()


class DutyRosterGenerateView(_DutyGenerateBase):
    """Preview a generated duty roster. Nothing is written."""

    def post(self, request):
        try:
            term, kwargs = self._term_and_kwargs(request)
            plan = plan_duty_roster(term, **kwargs)
        except DutyRosterError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(plan)


class DutyRosterGenerateCommitView(_DutyGenerateBase):
    """Generate and persist the duty roster (replaces the covered days)."""

    def post(self, request):
        try:
            term, kwargs = self._term_and_kwargs(request)
            replace = bool(request.data.get('replace', True))
            result = commit_duty_roster(term, replace=replace, **kwargs)
        except DutyRosterError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(result, status=status.HTTP_201_CREATED)
