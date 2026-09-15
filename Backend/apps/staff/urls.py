from django.urls import path

from . import views

urlpatterns = [
    path('staff/departments/', views.DepartmentListView.as_view(), name='staff-departments'),
    path('staff/departments/<uuid:pk>/', views.DepartmentDetailView.as_view(),
         name='staff-department'),
    path('staff/members/', views.StaffMemberListView.as_view(), name='staff-members'),
    path('staff/members/<uuid:pk>/', views.StaffMemberDetailView.as_view(), name='staff-member'),
]
