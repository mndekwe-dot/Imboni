"""
    GET|POST  /imboni/matron/pharmacy/               the cupboard | add an item
    PATCH     /imboni/matron/pharmacy/<pk>/          rename, reorder level, expiry, retire
    POST      /imboni/matron/pharmacy/<pk>/move/     {change, reason, note?, student?}
    GET       /imboni/matron/pharmacy/<pk>/history/  the logbook for one item
"""
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.permissions import IsMatron
from apps.student.models import Student

from . import pharmacy
from .models import PharmacyItem, PharmacyMovement


class PharmacyItemSerializer(serializers.ModelSerializer):
    status = serializers.SerializerMethodField()

    class Meta:
        model = PharmacyItem
        fields = ['id', 'name', 'unit', 'quantity', 'reorder_level', 'expiry_date', 'notes', 'is_active', 'status']
        read_only_fields = ['quantity']   # changed only through a movement, never typed over

    def get_status(self, obj):
        return pharmacy.status_of(obj.quantity, obj.reorder_level, obj.expiry_date)


class MovementSerializer(serializers.ModelSerializer):
    by_name = serializers.SerializerMethodField()
    student_name = serializers.SerializerMethodField()

    class Meta:
        model = PharmacyMovement
        fields = ['id', 'change', 'reason', 'note', 'by_name', 'student_name', 'at']

    def get_by_name(self, obj):
        return obj.by.get_full_name() if obj.by else ''

    def get_student_name(self, obj):
        return obj.student.user.get_full_name() if obj.student else ''


# The worst first, so the cupboard reads as a to-do list.
_ORDER = {'expired': 0, 'out': 1, 'low': 2, 'expiring': 3, 'ok': 4}


class PharmacyListView(APIView):
    permission_classes = [IsMatron]

    def get(self, request):
        items = PharmacyItem.objects.filter(is_active=True)
        data = PharmacyItemSerializer(items, many=True).data
        data.sort(key=lambda r: (_ORDER[r['status']], r['name'].lower()))
        return Response(data)

    def post(self, request):
        serializer = PharmacyItemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        item = serializer.save()
        opening = request.data.get('quantity')
        if opening not in (None, '', 0, '0'):
            try:
                pharmacy.move(item, int(opening), 'received', by=request.user, note='Opening stock')
            except (ValueError, pharmacy.PharmacyError) as exc:
                item.delete()
                return Response({'detail': str(exc)}, status=400)
            item.refresh_from_db()
        return Response(PharmacyItemSerializer(item).data, status=201)


class PharmacyDetailView(APIView):
    permission_classes = [IsMatron]

    def patch(self, request, pk):
        item = get_object_or_404(PharmacyItem, pk=pk)
        serializer = PharmacyItemSerializer(item, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class PharmacyMoveView(APIView):
    permission_classes = [IsMatron]

    def post(self, request, pk):
        item = get_object_or_404(PharmacyItem, pk=pk)
        reason = request.data.get('reason')
        if reason not in dict(PharmacyMovement.REASON_CHOICES):
            return Response({'detail': 'Choose why the stock is changing.'}, status=400)
        try:
            change = int(request.data.get('change'))
        except (TypeError, ValueError):
            return Response({'detail': 'How many? Use a whole number.'}, status=400)
        student = None
        if request.data.get('student'):
            student = get_object_or_404(Student, pk=request.data['student'])
        try:
            pharmacy.move(item, change, reason, by=request.user,
                          note=str(request.data.get('note') or ''), student=student)
        except pharmacy.PharmacyError as exc:
            return Response({'detail': str(exc)}, status=400)
        item.refresh_from_db()
        return Response(PharmacyItemSerializer(item).data)


class PharmacyHistoryView(APIView):
    permission_classes = [IsMatron]

    def get(self, request, pk):
        item = get_object_or_404(PharmacyItem, pk=pk)
        moves = item.movements.select_related('by', 'student__user')[:100]
        return Response(MovementSerializer(moves, many=True).data)
