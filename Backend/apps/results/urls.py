from django.urls import path
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'results/assessments', views.AssessmentViewSet, basename='assessment')

urlpatterns = router.urls + [
    # Recent individual assessment scores (Recent Results table)
    path('results/students/<uuid:student_pk>/assessments/', views.StudentAssessmentListView.as_view(), name='student-assessments'),
    # Term summary per subject (Summative Performance table)
    path('results/students/<uuid:student_pk>/summative/', views.StudentResultListView.as_view(), name='student-summative'),
    # Teacher written comments (Teacher Reviews panel)
    path('results/students/<uuid:student_pk>/reviews/', views.StudentTeacherReviewsView.as_view(), name='student-reviews'),
]
