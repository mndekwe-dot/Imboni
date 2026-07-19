"""DRF endpoints for dormitories, rooms, and the housing generator.

    GET|POST      /imboni/discipline/dormitories/            -> configure dorms
    PATCH|DELETE  /imboni/discipline/dormitories/<pk>/
    GET|POST      /imboni/discipline/dorm-rooms/             -> configure rooms
    PATCH|DELETE  /imboni/discipline/dorm-rooms/<pk>/
    POST          /imboni/discipline/housing/generate/       -> preview
    POST          /imboni/discipline/housing/generate/commit/ -> persist
"""

from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.permissions import IsDisciplineOrMatron

from .housing_service import HousingError, commit_housing, plan_housing
from .models import Dormitory, DormRoom


class DormitorySerializer(serializers.ModelSerializer):
    room_count = serializers.SerializerMethodField()
    bed_count = serializers.SerializerMethodField()

    class Meta:
        model = Dormitory
        fields = ['id', 'name', 'gender', 'is_active', 'room_count', 'bed_count']

    def get_room_count(self, obj):
        return obj.rooms.count()

    def get_bed_count(self, obj):
        return sum(r.bed_capacity for r in obj.rooms.all() if r.is_active)


class DormRoomSerializer(serializers.ModelSerializer):
    dormitory_name = serializers.CharField(source='dormitory.name', read_only=True)
    bed_capacity = serializers.IntegerField(min_value=1, max_value=100, required=False)

    class Meta:
        model = DormRoom
        fields = ['id', 'dormitory', 'dormitory_name', 'room_number',
                  'bed_capacity', 'is_active']


class DormitoryListView(APIView):
    """GET list | POST create a dormitory."""
    permission_classes = [IsDisciplineOrMatron]

    def get(self, request):
        qs = Dormitory.objects.all().prefetch_related('rooms')
        return Response(DormitorySerializer(qs, many=True).data)

    def post(self, request):
        serializer = DormitorySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class DormitoryDetailView(APIView):
    """PATCH | DELETE a dormitory."""
    permission_classes = [IsDisciplineOrMatron]

    def patch(self, request, pk):
        dorm = Dormitory.objects.filter(pk=pk).first()
        if dorm is None:
            return Response({'detail': 'Dormitory not found.'},
                            status=status.HTTP_404_NOT_FOUND)
        serializer = DormitorySerializer(dorm, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk):
        dorm = Dormitory.objects.filter(pk=pk).first()
        if dorm is None:
            return Response({'detail': 'Dormitory not found.'},
                            status=status.HTTP_404_NOT_FOUND)
        dorm.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class DormRoomListView(APIView):
    """GET list (optionally ?dormitory_id=) | POST create a room."""
    permission_classes = [IsDisciplineOrMatron]

    def get(self, request):
        qs = DormRoom.objects.select_related('dormitory').all()
        dormitory_id = request.query_params.get('dormitory_id')
        if dormitory_id:
            qs = qs.filter(dormitory_id=dormitory_id)
        return Response(DormRoomSerializer(qs, many=True).data)

    def post(self, request):
        serializer = DormRoomSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class DormRoomDetailView(APIView):
    """PATCH | DELETE a room."""
    permission_classes = [IsDisciplineOrMatron]

    def patch(self, request, pk):
        room = DormRoom.objects.filter(pk=pk).first()
        if room is None:
            return Response({'detail': 'Room not found.'},
                            status=status.HTTP_404_NOT_FOUND)
        serializer = DormRoomSerializer(room, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk):
        room = DormRoom.objects.filter(pk=pk).first()
        if room is None:
            return Response({'detail': 'Room not found.'},
                            status=status.HTTP_404_NOT_FOUND)
        room.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class HousingGenerateRequestSerializer(serializers.Serializer):
    dormitory_ids = serializers.ListField(
        child=serializers.UUIDField(), required=False, allow_empty=False,
    )

    def to_plan_kwargs(self):
        ids = self.validated_data.get('dormitory_ids')
        return {'dormitory_ids': [str(i) for i in ids] if ids else None}


class _HousingGenerateBase(APIView):
    permission_classes = [IsDisciplineOrMatron]

    def _kwargs(self, request):
        serializer = HousingGenerateRequestSerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)
        return serializer.to_plan_kwargs()


class HousingGenerateView(_HousingGenerateBase):
    """Preview a generated dormitory assignment. Nothing is written."""

    def post(self, request):
        try:
            plan = plan_housing(**self._kwargs(request))
        except HousingError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(plan)


class HousingGenerateCommitView(_HousingGenerateBase):
    """Generate and persist the assignment onto the boarding records."""

    def post(self, request):
        try:
            clear_unplaced = bool(request.data.get('clear_unplaced', True))
            result = commit_housing(clear_unplaced=clear_unplaced,
                                    **self._kwargs(request))
        except HousingError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(result, status=status.HTTP_201_CREATED)
