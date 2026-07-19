"""DRF endpoints for dining sittings and the dining planner.

    GET|POST      /imboni/dos/dining-sittings/            -> configure sittings
    PATCH|DELETE  /imboni/dos/dining-sittings/<pk>/
    GET           /imboni/dos/dining-plan/?term_id=       -> saved plan
    POST          /imboni/dos/dining-plan/generate/       -> preview
    POST          /imboni/dos/dining-plan/generate/commit/-> persist
"""

from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.permissions import IsDOSOrAdmin
from apps.results.models import AcademicTerm
from ..models import MEAL_CHOICES, DiningAssignment, DiningSitting
from .dining_service import (
    DEFAULT_MEALS,
    DiningPlanError,
    commit_dining,
    plan_dining,
)

_MEAL_VALUES = [m[0] for m in MEAL_CHOICES]


class DiningSittingSerializer(serializers.ModelSerializer):
    capacity = serializers.IntegerField(min_value=1, max_value=10000, required=False)

    class Meta:
        model = DiningSitting
        fields = ['id', 'name', 'meal', 'order', 'start_time', 'end_time',
                  'capacity', 'is_active']


class DiningSittingListView(APIView):
    """GET list | POST create a dining sitting."""
    permission_classes = [IsDOSOrAdmin]

    def get(self, request):
        qs = DiningSitting.objects.all().order_by('meal', 'order', 'start_time')
        return Response(DiningSittingSerializer(qs, many=True).data)

    def post(self, request):
        serializer = DiningSittingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class DiningSittingDetailView(APIView):
    """PATCH | DELETE a dining sitting."""
    permission_classes = [IsDOSOrAdmin]

    def _get(self, pk):
        return DiningSitting.objects.filter(pk=pk).first()

    def patch(self, request, pk):
        sitting = self._get(pk)
        if sitting is None:
            return Response({'detail': 'Sitting not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = DiningSittingSerializer(sitting, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk):
        sitting = self._get(pk)
        if sitting is None:
            return Response({'detail': 'Sitting not found.'}, status=status.HTTP_404_NOT_FOUND)
        sitting.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class DiningPlanListView(APIView):
    """GET the persisted dining plan for a term."""
    permission_classes = [IsDOSOrAdmin]

    def get(self, request):
        term_id = request.query_params.get('term_id')
        qs = (DiningAssignment.objects
              .select_related('sitting', 'class_obj')
              .order_by('sitting__meal', 'sitting__order'))
        if term_id:
            qs = qs.filter(term_id=term_id)
        return Response([{
            'id': str(a.id),
            'meal': a.sitting.meal,
            'sitting_id': str(a.sitting_id),
            'sitting_name': a.sitting.name,
            'start_time': a.sitting.start_time.strftime('%H:%M'),
            'end_time': a.sitting.end_time.strftime('%H:%M'),
            'class_id': str(a.class_obj_id),
            'class_name': f"S{a.class_obj.grade}{a.class_obj.section}",
        } for a in qs])


class DiningGenerateRequestSerializer(serializers.Serializer):
    term_id = serializers.UUIDField()
    meals = serializers.ListField(
        child=serializers.ChoiceField(choices=_MEAL_VALUES),
        required=False, allow_empty=False,
    )
    class_ids = serializers.ListField(
        child=serializers.UUIDField(), required=False, allow_empty=True,
    )

    def to_plan_kwargs(self):
        d = self.validated_data
        return {
            'meals': list(d.get('meals') or DEFAULT_MEALS),
            'class_ids': [str(c) for c in d.get('class_ids', [])] or None,
        }


class _DiningGenerateBase(APIView):
    permission_classes = [IsDOSOrAdmin]

    def _term_and_kwargs(self, request):
        serializer = DiningGenerateRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        term = AcademicTerm.objects.filter(id=serializer.validated_data['term_id']).first()
        if term is None:
            raise DiningPlanError('Academic term not found.')
        return term, serializer.to_plan_kwargs()


class DiningGenerateView(_DiningGenerateBase):
    """Preview a generated dining plan. Nothing is written."""

    def post(self, request):
        try:
            term, kwargs = self._term_and_kwargs(request)
            plan = plan_dining(term, **kwargs)
        except DiningPlanError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(plan)


class DiningGenerateCommitView(_DiningGenerateBase):
    """Generate and persist the dining plan (replaces the covered meals)."""

    def post(self, request):
        try:
            term, kwargs = self._term_and_kwargs(request)
            replace = bool(request.data.get('replace', True))
            result = commit_dining(term, replace=replace, **kwargs)
        except DiningPlanError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(result, status=status.HTTP_201_CREATED)
