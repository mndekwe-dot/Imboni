from django.urls import path
from . import views

urlpatterns = [
    # Current term
    path('discipline/current-term/',                          views.DisciplineCurrentTermView.as_view(),       name='discipline-current-term'),

    # Dashboard
    path('discipline/dashboard/',                           views.DisciplineDashboardView.as_view(),         name='discipline-dashboard'),

    # Behavior Reports
    path('discipline/reports/',                             views.DisciplineReportListView.as_view(),        name='discipline-reports'),
    path('discipline/reports/<uuid:pk>/',                   views.DisciplineReportDetailView.as_view(),      name='discipline-report-detail'),
    path('discipline/reports/<uuid:pk>/review/',            views.DisciplineReportReviewView.as_view(),      name='discipline-report-review'),

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
    path('discipline/dining/<uuid:pk>/',                    views.DiningPlanDetailView.as_view(),            name='discipline-dining-detail'),

    # Activities
    path('discipline/activities/',                          views.DisciplineActivityListView.as_view(),      name='discipline-activities'),
    path('discipline/activities/<uuid:pk>/',                views.DisciplineActivityDetailView.as_view(),    name='discipline-activity-detail'),
    path('discipline/activities/<uuid:pk>/events/',         views.DisciplineActivityEventCreateView.as_view(), name='discipline-activity-events'),

    # Timetable
    path('discipline/timetable/',                           views.DisciplineTimetableView.as_view(),         name='discipline-timetable'),

    # Extracurricular schedule CRUD
    path('discipline/extracurricular/',                     views.ExtracurricularEntryListView.as_view(),    name='discipline-extracurricular'),
    path('discipline/extracurricular/<uuid:pk>/',           views.ExtracurricularEntryDetailView.as_view(),  name='discipline-extracurricular-detail'),

    # Facilities (dormitories, dining halls, rooms)
    path('discipline/facilities/occupancy/',          views.DisFacilityOccupancyView.as_view(),      name='discipline-facility-occupancy'),
    path('discipline/facilities/',                   views.DisFacilityListView.as_view(),           name='discipline-facilities'),
    path('discipline/facilities/<uuid:pk>/',          views.DisFacilityDetailView.as_view(),         name='discipline-facility-detail'),
    path('discipline/facility-sections/',             views.DisFacilitySectionListView.as_view(),    name='discipline-facility-sections'),
    path('discipline/facility-sections/<uuid:pk>/',   views.DisFacilitySectionDetailView.as_view(),  name='discipline-facility-section-detail'),

    # Announcements
    path('discipline/announcements/',                       views.DisciplineAnnouncementView.as_view(),       name='discipline-announcements'),
    path('discipline/announcements/<uuid:pk>/',             views.DisciplineAnnouncementDetailView.as_view(), name='discipline-announcement-detail'),
]
