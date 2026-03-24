from django.urls import path
from . import views

urlpatterns = [
    # Dashboard
    path('matron/dashboard/',               views.MatronDashboardView.as_view(),       name='matron-dashboard'),

    # My Students
    path('matron/students/',                views.MatronStudentListView.as_view(),      name='matron-students'),
    path('matron/students/<uuid:pk>/',      views.MatronStudentDetailView.as_view(),    name='matron-student-detail'),

    # Incidents
    path('matron/incidents/',               views.MatronIncidentListView.as_view(),     name='matron-incidents'),
    path('matron/incidents/<uuid:pk>/',     views.MatronIncidentDetailView.as_view(),   name='matron-incident-detail'),

    # Schedule
    path('matron/schedule/',                views.MatronScheduleView.as_view(),         name='matron-schedule'),

    # Night Attendance Check
    path('matron/night-check/',             views.MatronNightCheckView.as_view(),       name='matron-night-check'),
]
