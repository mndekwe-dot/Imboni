from django.urls import path
from rest_framework_nested.routers import DefaultRouter, NestedDefaultRouter
from . import views

# Main router
router = DefaultRouter()
router.register(r'students', views.StudentViewSet, basename='student')
router.register(r'relationships', views.ParentStudentRelationshipViewSet, basename='relationship')


# Nested router (child of students)
students_router = NestedDefaultRouter(router, r'students', lookup='student')
students_router.register(
    r'relationships',
    views.ParentStudentRelationshipViewSet,
    basename='student-relationships'
)

urlpatterns = router.urls + students_router.urls + [
    path('students/<uuid:student_pk>/add_parent/', views.AddParentToStudentView.as_view(), name='student-add-parent'),
    path('students/<uuid:pk>/dashboard/', views.StudentDashboardView.as_view(), name='student-dashboard'),
    path('parents/my-children/', views.MyChildrenView.as_view(), name='parent-my-children'),
    path('students/<uuid:pk>/card/', views.StudentCardView.as_view(), name='student-card'),
    path('students/<uuid:pk>/fees/', views.StudentFeeListView.as_view(), name='student-fees'),
    path('students/<uuid:pk>/documents/', views.StudentDocumentListView.as_view(), name='student-documents'),
    path('students/<uuid:pk>/schedule/today/', views.StudentTodayScheduleView.as_view(), name='student-schedule-today'),
]