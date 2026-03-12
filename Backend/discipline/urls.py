from django.urls import path
from . import views

urlpatterns = [
    # Dashboard
    path('discipline/dashboard/',                           views.DisciplineDashboardView.as_view(),         name='discipline-dashboard'),

    # Behavior Reports
    path('discipline/reports/',                             views.DisciplineReportListView.as_view(),        name='discipline-reports'),
    path('discipline/reports/<uuid:pk>/',                   views.DisciplineReportDetailView.as_view(),      name='discipline-report-detail'),

    # Student Conduct
    path('discipline/students/',                            views.DisciplineStudentListView.as_view(),       name='discipline-students'),
    path('discipline/students/<uuid:pk>/',                  views.DisciplineStudentDetailView.as_view(),     name='discipline-student-detail'),

    # Discipline Staff
    path('discipline/staff/',                               views.DisciplineStaffListView.as_view(),         name='discipline-staff'),
    path('discipline/staff/<uuid:pk>/',                     views.DisciplineStaffDetailView.as_view(),       name='discipline-staff-detail'),

    # Student Leaders
    path('discipline/student-leaders/',                     views.StudentLeaderListView.as_view(),           name='discipline-student-leaders'),
    path('discipline/student-leaders/<uuid:pk>/',           views.StudentLeaderDetailView.as_view(),         name='discipline-student-leader-detail'),

    # Boarding
    path('discipline/boarding/',                            views.BoardingStudentListView.as_view(),         name='discipline-boarding'),
    path('discipline/boarding/<uuid:pk>/',                  views.BoardingStudentDetailView.as_view(),       name='discipline-boarding-detail'),

    # Dining
    path('discipline/dining/',                              views.DiningPlanListView.as_view(),              name='discipline-dining'),

    # Activities
    path('discipline/activities/',                          views.DisciplineActivityListView.as_view(),      name='discipline-activities'),
    path('discipline/activities/<uuid:pk>/',                views.DisciplineActivityDetailView.as_view(),    name='discipline-activity-detail'),
    path('discipline/activities/<uuid:pk>/events/',         views.DisciplineActivityEventCreateView.as_view(), name='discipline-activity-events'),
]
