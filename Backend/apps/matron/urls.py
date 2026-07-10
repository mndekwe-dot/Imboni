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

    # Health & Wellness
    path('matron/health/',                  views.MatronHealthView.as_view(),           name='matron-health'),
    path('matron/health/<uuid:pk>/',        views.MatronHealthRecordDetailView.as_view(), name='matron-health-detail'),

    # Parent Communications
    path('matron/parent-comms/',            views.MatronParentCommsView.as_view(),      name='matron-parent-comms'),

    # Boarding Schedule (standing weekly routine)
    path('matron/boarding-schedule/',       views.MatronBoardingScheduleView.as_view(), name='matron-boarding-schedule'),

    # Medication Schedule
    path('matron/medications/',                        views.MatronMedicationListView.as_view(),       name='matron-medications'),
    path('matron/medications/today/',                  views.MatronMedicationTodayView.as_view(),      name='matron-medications-today'),
    path('matron/medications/<uuid:pk>/',              views.MatronMedicationDetailView.as_view(),     name='matron-medication-detail'),
    path('matron/medications/<uuid:pk>/administer/',   views.MatronMedicationAdministerView.as_view(), name='matron-medication-administer'),
]
