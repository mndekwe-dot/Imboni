from django.urls import path
from . import views

urlpatterns = [
    # Per-student views (student/parent portal)
    path('attendance/students/<uuid:pk>/stats/',    views.StudentAttendanceStatsView.as_view(),    name='attendance-stats'),
    path('attendance/students/<uuid:pk>/calendar/', views.StudentAttendanceCalendarView.as_view(), name='attendance-calendar'),

    # Teacher / DOS views
    path('attendance/class/',         views.ClassAttendanceView.as_view(),                  name='attendance-class'),
    path('attendance/class/weekly/',  views.DosClassWeeklyAttendanceView.as_view(),         name='attendance-class-weekly'),
    path('attendance/bulk-mark/',     views.BulkMarkAttendanceView.as_view(),               name='attendance-bulk-mark'),
    path('attendance/summaries/',     views.StudentAttendanceSummaryListView.as_view(),     name='attendance-summaries'),

    # DOS teacher attendance
    path('attendance/teacher/weekly/', views.DosTeacherWeeklyAttendanceView.as_view(), name='attendance-teacher-weekly'),
    path('attendance/teacher/mark/',   views.MarkTeacherAttendanceView.as_view(),      name='attendance-teacher-mark'),
]
