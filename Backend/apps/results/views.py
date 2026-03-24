from django.utils import timezone
from rest_framework import generics, viewsets, status
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.authentication.permissions import IsTeacher, IsDOSOrAdmin, IsTeacherOrDOS
from .models import Assessment, Result
from .serializers import (
    AssessmentSerializer, AssessmentCreateSerializer,
    ResultSerializer, ResultCreateUpdateSerializer, TeacherReviewSerializer,
)


class AssessmentViewSet(viewsets.ModelViewSet):
    """
    Teacher CRUD for assessments.

    GET    /imboni/results/assessments/       — list
    POST   /imboni/results/assessments/       — create
    GET    /imboni/results/assessments/{id}/  — detail
    PATCH  /imboni/results/assessments/{id}/  — update
    DELETE /imboni/results/assessments/{id}/  — delete
    """
    permission_classes = [IsTeacherOrDOS]
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

    GET /imboni/results/students/<student_pk>/assessments/
    """
    serializer_class = AssessmentSerializer
    permission_classes = [IsTeacherOrDOS]

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

    GET /imboni/results/students/<student_pk>/summative/?term_id=<uuid>
    """
    serializer_class = ResultSerializer
    permission_classes = [IsTeacherOrDOS]

    def get_queryset(self):
        qs = (
            Result.objects
            .filter(student_id=self.kwargs['student_pk'])
            .select_related('subject')
        )
        term_id = self.request.query_params.get('term_id')
        if term_id:
            qs = qs.filter(term_id=term_id)
        return qs.order_by('subject__name')


class StudentTeacherReviewsView(generics.ListAPIView):
    """
    Teacher comments on a student's term results.

    GET /imboni/results/students/<student_pk>/reviews/
    """
    serializer_class = TeacherReviewSerializer
    permission_classes = [IsTeacherOrDOS]

    def get_queryset(self):
        return (
            Result.objects
            .filter(
                student_id=self.kwargs['student_pk'],
                teacher_comment__gt='',
                teacher__isnull=False,
            )
            .select_related('subject', 'teacher')
            .order_by('-updated_at')
        )


class ResultCreateUpdateView(APIView):
    """
    Teacher creates or updates a result entry (stays as draft).

    POST  /imboni/results/             — create
    PATCH /imboni/results/<pk>/        — update (draft only)
    """
    permission_classes = [IsTeacher]

    def post(self, request):
        serializer = ResultCreateUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        result, created = Result.objects.get_or_create(
            student=data['student'],
            subject=data['subject'],
            term=data['term'],
            defaults={
                'teacher':          request.user,
                'class_test_marks': data.get('class_test_marks'),
                'exam_score':       data['exam_score'],
                'final_score':      0,
                'grade':            'F',
                'teacher_comment':  data.get('teacher_comment', ''),
                'status':           'draft',
            },
        )

        if not created:
            if result.status not in ('draft', 'rejected'):
                return Response(
                    {'detail': 'Cannot edit a result with status "%s".' % result.status},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            result.class_test_marks = data.get('class_test_marks', result.class_test_marks)
            result.exam_score       = data.get('exam_score', result.exam_score)
            result.teacher_comment  = data.get('teacher_comment', result.teacher_comment)
            result.teacher          = request.user

        result.calculate_final_score()
        result.calculate_grade()
        result.save()

        return Response(
            ResultSerializer(result).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class ResultSubmitView(APIView):
    """
    Teacher submits a draft result for DOS approval.

    POST /imboni/results/<pk>/submit/
    """
    permission_classes = [IsTeacher]

    def post(self, request, pk):
        try:
            result = Result.objects.get(pk=pk)
        except Result.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        if result.teacher != request.user:
            return Response({'detail': 'You can only submit your own results.'}, status=status.HTTP_403_FORBIDDEN)

        if result.status not in ('draft', 'rejected'):
            return Response(
                {'detail': 'Only draft or rejected results can be submitted.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        result.status       = 'submitted'
        result.submitted_at = timezone.now()
        result.save(update_fields=['status', 'submitted_at'])
        return Response({'detail': 'Result submitted for approval.'})


class ResultBulkSubmitView(APIView):
    """
    Submit multiple draft results at once.

    POST /imboni/results/bulk-submit/   body: { ids: [uuid, ...] }
    """
    permission_classes = [IsTeacher]

    def post(self, request):
        ids = request.data.get('ids', [])
        if not ids:
            return Response({'detail': 'No ids provided.'}, status=status.HTTP_400_BAD_REQUEST)

        updated = (
            Result.objects
            .filter(id__in=ids, teacher=request.user, status__in=['draft', 'rejected'])
            .update(status='submitted', submitted_at=timezone.now())
        )
        return Response({'submitted': updated})
