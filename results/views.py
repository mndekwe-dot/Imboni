from rest_framework import generics, viewsets, permissions
from .models import Assessment
from .serializers import AssessmentSerializer, AssessmentCreateSerializer


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
    Parent views their child's graded assessments.

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
