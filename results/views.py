from rest_framework import generics, viewsets, permissions
from .models import Assessment, Result
from .serializers import (
    AssessmentSerializer, AssessmentCreateSerializer,
    ResultSerializer, TeacherReviewSerializer,
)


class AssessmentViewSet(viewsets.ModelViewSet):
    """
    Teacher CRUD for assessments (posting and managing grades).

    GET    /imboni/results/assessments/          — list all assessments
    POST   /imboni/results/assessments/          — post a grade for a student
    GET    /imboni/results/assessments/{id}/     — get single assessment
    PATCH  /imboni/results/assessments/{id}/     — update a grade
    DELETE /imboni/results/assessments/{id}/     — delete an assessment
    """
    #permission_classes = [permissions.IsAuthenticated]
    serializer_class = AssessmentCreateSerializer

    def get_queryset(self):
        return (
            Assessment.objects
            .select_related('student__user', 'subject', 'term')
            .order_by('-date')
        )


class StudentAssessmentListView(generics.ListAPIView):
    """
    Recent individual assessment scores for a student.
    Powers the "Recent Results" table: Subject, Type, Score, Grade, Date.

    GET /imboni/results/students/<student_pk>/assessments/
    """
    serializer_class = AssessmentSerializer
    #permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return (
            Assessment.objects
            .filter(student_id=self.kwargs['student_pk'])
            .select_related('subject')
            .order_by('-date')
        )


class StudentResultListView(generics.ListAPIView):
    """
    Summative (term) results per subject for a student.
    Powers the "Summative Performance" table: Subject | Avg Quiz | Group Work | Exam | Final | Grade.

    GET /imboni/results/students/<student_pk>/summative/
    """
    serializer_class = ResultSerializer
    #permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return (
            Result.objects
            .filter(student_id=self.kwargs['student_pk'])
            .select_related('subject')
            .order_by('subject__name')
        )


class StudentTeacherReviewsView(generics.ListAPIView):
    """
    Teacher comments written on a student's term results.
    Powers the "Teacher Reviews" panel: teacher name, subject role, comment, date.
    Only returns results that have a non-empty teacher_comment.

    GET /imboni/results/students/<student_pk>/reviews/
    """
    serializer_class = TeacherReviewSerializer
    #permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return (
            Result.objects
            .filter(
                student_id=self.kwargs['student_pk'],
                teacher_comment__gt='',   # exclude empty comments
                teacher__isnull=False,
            )
            .select_related('subject', 'teacher')
            .order_by('-updated_at')
        )
