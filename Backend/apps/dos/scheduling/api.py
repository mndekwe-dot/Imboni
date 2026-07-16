"""DRF endpoints for the exam auto-scheduler.

    POST /imboni/dos/exam-schedule/generate/         -> preview (persists nothing)
    POST /imboni/dos/exam-schedule/generate/commit/  -> persist ExamSchedule rows

Both accept the same body; commit runs the identical deterministic plan and
saves it, so the preview a DOS approves is exactly what gets written.
"""

from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.permissions import IsDOSOrAdmin
from apps.results.models import AcademicTerm
from ..models import ExamSchedule
from .exam_service import (
    DEFAULT_DAILY_SLOTS,
    DEFAULT_NUM_DAYS,
    ExamScheduleError,
    commit_exam_schedule,
    plan_exam_schedule,
)


class _DailySlotSerializer(serializers.Serializer):
    start = serializers.CharField()
    end = serializers.CharField()


class ExamGenerateRequestSerializer(serializers.Serializer):
    term_id = serializers.UUIDField()
    exam_type = serializers.ChoiceField(
        choices=[c[0] for c in ExamSchedule.EXAM_TYPE_CHOICES],
        default="midterm",
    )
    start_date = serializers.DateField()
    num_days = serializers.IntegerField(min_value=1, max_value=60, default=DEFAULT_NUM_DAYS)
    daily_slots = _DailySlotSerializer(many=True, required=False)
    skip_weekends = serializers.BooleanField(default=True)
    class_ids = serializers.ListField(
        child=serializers.UUIDField(), required=False, allow_empty=True
    )
    title_template = serializers.CharField(required=False, default="{subject} Exam")

    def to_plan_kwargs(self):
        d = self.validated_data
        slots = d.get("daily_slots")
        return {
            "exam_type": d["exam_type"],
            "start_date": d["start_date"],
            "num_days": d["num_days"],
            "daily_slots": [(s["start"], s["end"]) for s in slots] if slots else list(DEFAULT_DAILY_SLOTS),
            "skip_weekends": d["skip_weekends"],
            "class_ids": [str(c) for c in d.get("class_ids", [])] or None,
            "title_template": d.get("title_template") or "{subject} Exam",
        }


class _ExamGenerateBase(APIView):
    permission_classes = [IsDOSOrAdmin]

    def _term_and_kwargs(self, request):
        serializer = ExamGenerateRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        term = AcademicTerm.objects.filter(id=serializer.validated_data["term_id"]).first()
        if term is None:
            raise ExamScheduleError("Academic term not found.")
        return term, serializer.to_plan_kwargs()


class ExamScheduleGenerateView(_ExamGenerateBase):
    """Preview a generated exam timetable. Nothing is written."""

    def post(self, request):
        try:
            term, kwargs = self._term_and_kwargs(request)
            plan = plan_exam_schedule(term, **kwargs)
        except ExamScheduleError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(plan)


class ExamScheduleGenerateCommitView(_ExamGenerateBase):
    """Generate and persist the exam timetable (replaces same-type exams)."""

    def post(self, request):
        try:
            term, kwargs = self._term_and_kwargs(request)
            replace = bool(request.data.get("replace", True))
            result = commit_exam_schedule(term, replace=replace, **kwargs)
        except ExamScheduleError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(result, status=status.HTTP_201_CREATED)
