from django.urls import path
from . import views

urlpatterns = [
    # Dashboard
    path('student/dashboard/',                      views.StudentDashboardView.as_view(),         name='student-dashboard'),

    # Timetable
    path('student/timetable/',                      views.StudentTimetableView.as_view(),          name='student-timetable'),
    path('student/timetable/today/',                views.StudentTodayScheduleView.as_view(),      name='student-timetable-today'),

    # Results
    path('student/results/',                        views.StudentResultsView.as_view(),            name='student-results'),

    # Attendance
    path('student/attendance/stats/',               views.StudentAttendanceStatsView.as_view(),    name='student-attendance-stats'),
    path('student/attendance/calendar/',            views.StudentAttendanceCalendarView.as_view(), name='student-attendance-calendar'),

    # Announcements
    path('student/announcements/',                  views.StudentAnnouncementsSimpleView.as_view(), name='student-announcements'),

    # Discipline / Conduct
    path('student/discipline/',                     views.StudentDisciplineView.as_view(),         name='student-discipline'),

    # Activities
    path('student/activities/',                     views.StudentActivitiesView.as_view(),         name='student-activities'),
    path('student/activities/events/',              views.StudentActivityEventsView.as_view(),     name='student-activity-events'),
    path('student/activities/<uuid:pk>/apply/',     views.StudentActivityApplyView.as_view(),      name='student-activity-apply'),
    path('student/activities/<uuid:pk>/withdraw/',  views.StudentActivityWithdrawView.as_view(),   name='student-activity-withdraw'),

    # Assignments
    path('student/assignments/',                    views.StudentAssignmentsView.as_view(),        name='student-assignments'),
    path('student/assignments/<uuid:pk>/submit/',   views.StudentAssignmentSubmitView.as_view(),   name='student-assignment-submit'),

    # Profile
    path('student/profile/',                        views.StudentProfileView.as_view(),            name='student-profile'),
]
