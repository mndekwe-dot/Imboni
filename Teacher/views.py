from rest_framework import generics, viewsets, permissions
from authentication.models import User
from results.models import AcademicTerm
from .models import Timetable
from .serializers import TimetableSerializer, TeacherSerializer


class TeacherViewSet(viewsets.ReadOnlyModelViewSet):
    """
    GET /imboni/teacher/         — list all teachers
    GET /imboni/teacher/<uuid>/  — single teacher detail
    Both endpoints from one class via ReadOnlyModelViewSet + router.
    """
    queryset = User.objects.filter(role='teacher').order_by('last_name', 'first_name')
    serializer_class = TeacherSerializer
    #permission_classes = [permissions.IsAuthenticated]


class MyTimetableView(generics.ListAPIView):
    """
    GET /imboni/teacher/my-timetable/
    Returns the full weekly timetable for the logged-in teacher,
    grouped naturally by day and ordered by start time.

    Each entry shows: day, start/end time, room, subject, class (grade+section).
    """
    serializer_class = TimetableSerializer
    #permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        current_term = AcademicTerm.objects.filter(is_current=True).first()
        if not current_term:
            return Timetable.objects.none()

        return (
            Timetable.objects
            .filter(teacher=self.request.user, term=current_term)
            .select_related('subject', 'class_obj', 'teacher')
            .order_by('day', 'start_time')
        )


class MyTodayScheduleView(generics.ListAPIView):
    """
    GET /imboni/teacher/my-timetable/today/
    Returns only today's periods for the logged-in teacher.
    """
    serializer_class = TimetableSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        from django.utils import timezone
        today = timezone.now().date().strftime('%A').lower()  # e.g. 'monday'
        current_term = AcademicTerm.objects.filter(is_current=True).first()
        if not current_term:
            return Timetable.objects.none()

        return (
            Timetable.objects
            .filter(teacher=self.request.user, term=current_term, day=today)
            .select_related('subject', 'class_obj', 'teacher')
            .order_by('start_time')
        )
