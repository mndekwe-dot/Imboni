from django.urls import path
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'results/assessments', views.AssessmentViewSet, basename='assessment')

urlpatterns = router.urls + [
    path('results/students/<uuid:student_pk>/assessments/', views.StudentAssessmentListView.as_view(), name='student-assessments'),
]
