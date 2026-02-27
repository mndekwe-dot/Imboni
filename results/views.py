from rest_framework import generics, permissions
from .models import Assessment
from .serializers import AssessmentSerializer


class StudentAssessmentListView(generics.ListAPIView):
    """
    GET /imboni/results/students/<student_pk>/assessments/
    Returns recent assessments for a student (the list shown on the parent dashboard).
    """
    serializer_class = AssessmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return (
            Assessment.objects
            .filter(student_id=self.kwargs['student_pk'])
            .select_related('subject')
            .order_by('-date')
        )
