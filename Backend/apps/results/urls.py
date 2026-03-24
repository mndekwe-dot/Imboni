from django.urls import path
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'results/assessments', views.AssessmentViewSet, basename='assessment')

urlpatterns = router.urls + [
    # Student read views
    path('results/students/<uuid:student_pk>/assessments/', views.StudentAssessmentListView.as_view(),  name='student-assessments'),
    path('results/students/<uuid:student_pk>/summative/',   views.StudentResultListView.as_view(),      name='student-summative'),
    path('results/students/<uuid:student_pk>/reviews/',     views.StudentTeacherReviewsView.as_view(),  name='student-reviews'),

    # Teacher result entry
    path('results/',                          views.ResultCreateUpdateView.as_view(),  name='result-create'),
    path('results/<uuid:pk>/submit/',         views.ResultSubmitView.as_view(),        name='result-submit'),
    path('results/bulk-submit/',              views.ResultBulkSubmitView.as_view(),    name='result-bulk-submit'),
]
