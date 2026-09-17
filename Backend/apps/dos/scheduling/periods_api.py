"""
The school's bell schedule: the periods every class's week is laid out on.

    GET /imboni/dos/timetable/periods/  — DOS, admin, teachers
    PUT /imboni/dos/timetable/periods/  — DOS, admin: replace the whole schedule

The timetable generator places lessons into these periods and the DOS grid
draws its rows from them. Before this endpoint existed there was no way to set
them, so the generator refused to run and the grid used a fixed list of times
that the school's real lessons did not line up with.

A school that has saved nothing still gets rows: GET falls back to the distinct
lesson times already in the current term's timetable (`source: "lessons"`), so
existing lessons show up before anyone opens the period editor.
"""
from datetime import time

from django.db import transaction
from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.permissions import IsDOSOrAdmin, IsTeacherOrDOS

from ..models import TimetablePeriod


class PeriodSerializer(serializers.Serializer):
    label = serializers.CharField(max_length=50, allow_blank=True, required=False, default='')
    start_time = serializers.TimeField(format='%H:%M')
    end_time = serializers.TimeField(format='%H:%M')
    is_break = serializers.BooleanField(required=False, default=False)

    def validate(self, attrs):
        if attrs['end_time'] <= attrs['start_time']:
            raise serializers.ValidationError('A period must end after it starts.')
        return attrs


class ScheduleSerializer(serializers.Serializer):
    periods = PeriodSerializer(many=True)

    def validate_periods(self, periods):
        ordered = sorted(periods, key=lambda p: p['start_time'])
        for earlier, later in zip(ordered, ordered[1:]):
            if later['start_time'] < earlier['end_time']:
                name = lambda p: p['label'] or p['start_time'].strftime('%H:%M')  # noqa: E731
                raise serializers.ValidationError(f'{name(earlier)} overlaps {name(later)}.')
        return ordered


def _row(label, start, end, is_break):
    return {
        'label': label,
        'start_time': start.strftime('%H:%M'),
        'end_time': end.strftime('%H:%M'),
        'is_break': is_break,
    }


def _from_lessons():
    """Distinct lesson times in the current term, as unsaved periods."""
    from apps.results.models import AcademicTerm
    from apps.teacher.models import Timetable

    term = AcademicTerm.objects.filter(is_current=True).first()
    if not term:
        return []
    times = sorted(set(
        Timetable.objects.filter(term=term).values_list('start_time', 'end_time')
    ))
    rows, n = [], 0
    for start, end in times:
        if rows and start < time.fromisoformat(rows[-1]['end_time']):
            continue  # an odd overlapping lesson must not add a clashing row
        if rows and start > time.fromisoformat(rows[-1]['end_time']):
            rows.append(_row('Break', time.fromisoformat(rows[-1]['end_time']), start, True))
        n += 1
        rows.append(_row(f'Period {n}', start, end, False))
    return rows


class TimetablePeriodsView(APIView):
    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsTeacherOrDOS()]
        return [IsDOSOrAdmin()]

    def get(self, request):
        saved = TimetablePeriod.objects.filter(is_active=True).order_by('order')
        if saved.exists():
            return Response({
                'source': 'school',
                'periods': [_row(p.label, p.start_time, p.end_time, p.is_break) for p in saved],
            })
        derived = _from_lessons()
        return Response({'source': 'lessons' if derived else 'none', 'periods': derived})

    def put(self, request):
        serializer = ScheduleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        periods = serializer.validated_data['periods']
        with transaction.atomic():
            TimetablePeriod.objects.all().delete()
            TimetablePeriod.objects.bulk_create([
                TimetablePeriod(order=i + 1, label=p['label'], start_time=p['start_time'],
                                end_time=p['end_time'], is_break=p['is_break'])
                for i, p in enumerate(periods)
            ])
        return Response({
            'source': 'school',
            'periods': [_row(p['label'], p['start_time'], p['end_time'], p['is_break']) for p in periods],
        })
