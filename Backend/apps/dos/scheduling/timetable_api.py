"""DRF endpoints for the weekly class-timetable auto-generator.

    POST /imboni/dos/timetable/generate/         -> preview (persists nothing)
    POST /imboni/dos/timetable/generate/commit/  -> persist teacher.Timetable rows

Both accept the same body; commit runs the identical deterministic plan and
saves it, so the preview a DOS approves is exactly what gets written.
"""

from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.permissions import IsDOSOrAdmin
from apps.results.models import AcademicTerm
from .timetable_service import (
    DEFAULT_DAYS,
    TimetableError,
    commit_timetable,
    plan_timetable,
)


class TimetableGenerateRequestSerializer(serializers.Serializer):
    term_id = serializers.UUIDField()
    class_ids = serializers.ListField(
        child=serializers.UUIDField(), required=False, allow_empty=True
    )
    days = serializers.ListField(
        child=serializers.ChoiceField(choices=DEFAULT_DAYS),
        required=False,
        allow_empty=False,
    )

    def to_plan_kwargs(self):
        d = self.validated_data
        return {
            "class_ids": [str(c) for c in d.get("class_ids", [])] or None,
            "days": list(d["days"]) if d.get("days") else None,
        }


class _TimetableGenerateBase(APIView):
    permission_classes = [IsDOSOrAdmin]

    def _term_and_kwargs(self, request):
        serializer = TimetableGenerateRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        term = AcademicTerm.objects.filter(id=serializer.validated_data["term_id"]).first()
        if term is None:
            raise TimetableError("Academic term not found.")
        return term, serializer.to_plan_kwargs()


class TimetableGenerateView(_TimetableGenerateBase):
    """Preview a generated weekly timetable. Nothing is written."""

    def post(self, request):
        try:
            term, kwargs = self._term_and_kwargs(request)
            plan = plan_timetable(term, **kwargs)
        except TimetableError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(plan)


class TimetableGenerateCommitView(_TimetableGenerateBase):
    """Generate and persist the weekly timetable (replaces existing rows)."""

    def post(self, request):
        try:
            term, kwargs = self._term_and_kwargs(request)
            replace = bool(request.data.get("replace", True))
            result = commit_timetable(term, replace=replace, **kwargs)
        except TimetableError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(result, status=status.HTTP_201_CREATED)
