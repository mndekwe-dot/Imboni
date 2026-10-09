"""Exeat (gate pass) register.

    GET|POST  /imboni/discipline/exeat/            list (?status=, ?student=) | request a pass
    PATCH     /imboni/discipline/exeat/<pk>/       body {action: ...}

Actions move a pass along requested -> approved -> out -> returned. Each one
refuses an out-of-order move, so the register cannot say a student is "out"
that nobody approved.
"""
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.permissions import IsDisciplineOrMatron
from apps.notifications.services import notify_parents_of

from .models import ExeatPass


class ExeatSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    student_code = serializers.CharField(source='student.student_id', read_only=True)
    class_name = serializers.SerializerMethodField()
    is_overdue = serializers.BooleanField(read_only=True)
    gate_verified_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ExeatPass
        fields = [
            'id', 'student', 'student_name', 'student_code', 'class_name',
            'reason_type', 'reason', 'departure_at', 'expected_return_at',
            'actual_return_at', 'status', 'parent_approval', 'parent_note',
            'gate_verified_by_name', 'gate_verified_at', 'is_overdue', 'created_at',
        ]
        read_only_fields = [
            'status', 'parent_approval', 'parent_note', 'actual_return_at',
            'gate_verified_at', 'created_at',
        ]

    def get_student_name(self, obj):
        return obj.student.user.get_full_name()

    def get_class_name(self, obj):
        return f"{obj.student.grade}{obj.student.section}"

    def get_gate_verified_by_name(self, obj):
        return obj.gate_verified_by.get_full_name() if obj.gate_verified_by else ''

    def validate(self, attrs):
        departure = attrs.get('departure_at')
        back = attrs.get('expected_return_at')
        if departure and back and back <= departure:
            raise serializers.ValidationError({'expected_return_at': 'The return must be after the departure.'})
        return attrs


class ExeatListCreateView(APIView):
    permission_classes = [IsDisciplineOrMatron]

    def get(self, request):
        qs = ExeatPass.objects.select_related('student__user', 'gate_verified_by')
        if request.query_params.get('status'):
            qs = qs.filter(status=request.query_params['status'])
        if request.query_params.get('student'):
            qs = qs.filter(student_id=request.query_params['student'])
        return Response(ExeatSerializer(qs[:300], many=True).data)

    def post(self, request):
        serializer = ExeatSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(created_by=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ExeatActionView(APIView):
    permission_classes = [IsDisciplineOrMatron]

    def patch(self, request, pk):
        try:
            exeat = ExeatPass.objects.select_related('student__user').get(pk=pk)
        except ExeatPass.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=404)

        action = request.data.get('action')
        handler = {
            'parent_approved': self._parent_approved,
            'parent_declined': self._parent_declined,
            'approve': self._approve,
            'decline': self._decline,
            'depart': self._depart,
            'return': self._return,
        }.get(action)
        if handler is None:
            return Response({'detail': 'Unknown action.'}, status=400)

        problem = handler(request, exeat)
        if problem:
            return Response({'detail': problem}, status=400)
        exeat.save()
        return Response(ExeatSerializer(exeat).data)

    # Each handler returns None on success, or the reason it cannot be done.

    def _parent_approved(self, request, exeat):
        if exeat.status not in ('requested', 'approved'):
            return 'This pass is already closed.'
        exeat.parent_approval = 'approved'
        exeat.parent_note = str(request.data.get('note', ''))[:200]

    def _parent_declined(self, request, exeat):
        if exeat.status not in ('requested', 'approved'):
            return 'This pass is already closed.'
        exeat.parent_approval = 'declined'
        exeat.parent_note = str(request.data.get('note', ''))[:200]
        exeat.status = 'declined'

    def _approve(self, request, exeat):
        if exeat.status != 'requested':
            return 'Only a requested pass can be approved.'
        if exeat.parent_approval != 'approved':
            return 'Record the parent’s approval first.'
        exeat.status = 'approved'
        notify_parents_of(
            exeat.student, 'Exeat approved',
            f"{exeat.student.user.get_full_name()} may leave on {exeat.departure_at:%d %b %H:%M} "
            f"and must be back by {exeat.expected_return_at:%d %b %H:%M}.",
            'attendance',
        )

    def _decline(self, request, exeat):
        if exeat.status not in ('requested', 'approved'):
            return 'Only an open pass can be declined.'
        exeat.status = 'declined'

    def _depart(self, request, exeat):
        if exeat.status != 'approved':
            return 'Only an approved pass can be used to leave.'
        exeat.status = 'out'
        exeat.gate_verified_by = request.user
        exeat.gate_verified_at = timezone.now()

    def _return(self, request, exeat):
        if exeat.status != 'out':
            return 'This student is not signed out.'
        exeat.status = 'returned'
        when = parse_datetime(str(request.data.get('returned_at', ''))) if request.data.get('returned_at') else None
        exeat.actual_return_at = when or timezone.now()
