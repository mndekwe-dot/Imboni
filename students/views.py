from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from authentication.models import User
from .models import Student, ParentStudentRelationship
from .serializers import (
    StudentSerializer, StudentCreateSerializer,
    ParentStudentRelationshipSerializer, UserSerializer
)


class StudentViewSet(viewsets.ModelViewSet):
    """
    Student management viewset
    """
    queryset = Student.objects.select_related('user').all()
    serializer_class = StudentSerializer
    # Permissions disabled for development - enable later
    # permission_classes = [permissions.IsAuthenticated]
    permission_classes = [permissions.AllowAny]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['grade', 'section', 'status']
    search_fields = ['student_id', 'user__first_name', 'user__last_name', 'user__email']
    ordering_fields = ['grade', 'section', 'created_at', 'current_gpa']
    ordering = ['grade', 'section', 'user__last_name']
    
    def get_serializer_class(self):
        if self.action == 'create':
            return StudentCreateSerializer
        return StudentSerializer
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Role-based filtering disabled for development
        # user = self.request.user
        # if user.role == 'admin' or user.role == 'dos':
        #     return queryset
        # elif user.role == 'teacher':
        #     return queryset
        # elif user.role == 'parent':
        #     return queryset.filter(parents__parent=user).distinct()
        # elif user.role == 'student':
        #     return queryset.filter(user=user)
        # return queryset.none()
        
        return queryset
    
    @action(detail=True, methods=['get'])
    def attendance(self, request, pk=None):
        """Get attendance records for a student"""
        student = self.get_object()
        from attendance.models import AttendanceRecord
        records = AttendanceRecord.objects.filter(student=student)
        return Response({
            'student': student.student_id,
            'records_count': records.count()
        })
    
    @action(detail=True, methods=['get'])
    def results(self, request, pk=None):
        """Get academic results for a student"""
        student = self.get_object()
        from results.models import Result
        results = Result.objects.filter(student=student)
        return Response({
            'student': student.student_id,
            'results_count': results.count()
        })
    
    @action(detail=True, methods=['get'])
    def behavior(self, request, pk=None):
        """Get behavior reports for a student"""
        student = self.get_object()
        from behavior.models import BehaviorReport
        reports = BehaviorReport.objects.filter(student=student)
        return Response({
            'student': student.student_id,
            'reports_count': reports.count()
        })


class ParentStudentRelationshipViewSet(viewsets.ModelViewSet):
    """
    Parent-Student relationship management
    """
    queryset = ParentStudentRelationship.objects.select_related('parent', 'student').all()
    serializer_class = ParentStudentRelationshipSerializer
    # Permissions disabled for development - enable later
    # permission_classes = [permissions.IsAuthenticated]
    permission_classes = [permissions.AllowAny]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['parent', 'student', 'relationship_type', 'is_primary_contact']
    
    def get_queryset(self):
        return super().get_queryset()
    
    def perform_create(self, serializer):
        serializer.save()
