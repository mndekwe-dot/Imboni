from django.urls import path
from . import views

urlpatterns = [
    path('results/students/<uuid:student_pk>/assessments/', views.StudentAssessmentListView.as_view(), name='student-assessments'),
]
