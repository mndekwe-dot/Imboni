from rest_framework import viewsets, generics, status, permissions
from rest_framework.response import Response
from django.db import transaction
from django.db.models import Avg
from django.shortcuts import get_object_or_404
from django.utils import timezone
from authentication.models import User, UserPreferences
from authentication.serializers import UserSerializer
from .models import Student, ParentStudentRelationship
from .serializers import (
    StudentSerializer, ParentStudentRelationshipSerializer,
    AddParentToStudentSerializer, MyChildrenSerializer,
)


class StudentViewSet(viewsets.ModelViewSet):
    queryset = Student.objects.all()
    serializer_class = StudentSerializer


class MyChildrenView(generics.ListAPIView):
    """
    GET /imboni/parents/my-children/
    Returns the list of students linked to the logged-in parent (used for child tabs).
    """
    serializer_class = MyChildrenSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return (
            ParentStudentRelationship.objects
            .filter(parent=self.request.user)
            .select_related('student__user')
        )


class StudentDashboardView(generics.RetrieveAPIView):
    """
    GET /imboni/students/<pk>/dashboard/
    Returns the 4 summary cards shown on the parent dashboard:
      - Overall Performance
      - Attendance Rate
      - Unread Announcements
      - Behaviour Reports
    """
    permission_classes = [permissions.IsAuthenticated]

    def retrieve(self, request, *_args, **_kwargs):
        student = get_object_or_404(Student, pk=self.kwargs['pk'])

        # --- Overall Performance ---
        from results.models import Result, AcademicTerm
        current_term = AcademicTerm.objects.filter(is_current=True).first()
        if current_term:
            avg = (
                Result.objects
                .filter(student=student, term=current_term)
                .aggregate(avg=Avg('final_score'))['avg']
            )
            performance_pct = round(float(avg or 0), 1)
        else:
            performance_pct = round(float(student.current_gpa or 0), 1)

        # --- Attendance ---
        from attendance.models import AttendanceSummary
        now = timezone.now()
        try:
            summary = AttendanceSummary.objects.get(
                student=student, month=now.month, year=now.year
            )
            attendance_pct = round(float(summary.attendance_percentage), 1)
            present_days = summary.present_days
            absent_days = summary.absent_days
        except AttendanceSummary.DoesNotExist:
            attendance_pct = round(float(student.attendance_percentage), 1)
            present_days = 0
            absent_days = 0

        # --- Unread Announcements ---
        from announcements.models import Announcement, AnnouncementRead
        published = Announcement.objects.filter(status='published')
        read_ids = AnnouncementRead.objects.filter(
            user=request.user
        ).values_list('announcement_id', flat=True)
        unread = published.exclude(id__in=read_ids)
        unread_count = unread.count()
        urgent_count = unread.filter(category='urgent').count()

        # --- Behaviour Reports ---
        from behavior.models import BehaviorReport
        positive_count = BehaviorReport.objects.filter(
            student=student, report_type='positive'
        ).count()

        return Response({
            'student_id': student.id,
            'overall_performance': {
                'percentage': performance_pct,
            },
            'attendance': {
                'percentage': attendance_pct,
                'present_days': present_days,
                'absent_days': absent_days,
            },
            'announcements': {
                'unread_count': unread_count,
                'urgent_count': urgent_count,
            },
            'behaviour': {
                'positive_count': positive_count,
            },
        })


class AddParentToStudentView(generics.CreateAPIView):
    """
    POST /imboni/students/<student_pk>/add_parent/
    Creates a parent user and links them to the student in one atomic operation.
    """
    serializer_class = AddParentToStudentSerializer

    def create(self, request, *_args, **_kwargs):
        try:
            student = Student.objects.get(pk=self.kwargs['student_pk'])
        except Student.DoesNotExist:
            return Response({'error': 'Student not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        with transaction.atomic():
            user = User.objects.create_user(
                username=data['username'],
                email=data['email'],
                password=data['password'],
                first_name=data['first_name'],
                last_name=data['last_name'],
                phone_number=data.get('phone_number', ''),
                date_of_birth=data.get('date_of_birth'),
                address=data.get('address', ''),
                emergency_contact=data.get('emergency_contact', ''),
                role='parent',
            )
            UserPreferences.objects.get_or_create(user=user)
            relationship = ParentStudentRelationship.objects.create(
                parent=user,
                student=student,
                relationship_type=data['relationship_type'],
                is_primary_contact=data['is_primary_contact'],
                can_pickup=data['can_pickup'],
            )

        return Response({
            'parent': UserSerializer(user).data,
            'relationship': ParentStudentRelationshipSerializer(relationship).data,
            'message': 'Parent created and linked to student successfully'
        }, status=status.HTTP_201_CREATED)


class ParentStudentRelationshipViewSet(viewsets.ModelViewSet):
    serializer_class = ParentStudentRelationshipSerializer

    def get_queryset(self):
        student_id = self.kwargs.get('student_pk')
        return ParentStudentRelationship.objects.filter(student__id=student_id)
