from django.urls import path
from . import views

urlpatterns = [
    # Per-student views (student/parent portal)
    path('attendance/students/<uuid:pk>/stats/',    views.StudentAttendanceStatsView.as_view(),    name='attendance-stats'),
    path('attendance/students/<uuid:pk>/calendar/', views.StudentAttendanceCalendarView.as_view(), name='attendance-calendar'),

    # Teacher / DOS views
    path('attendance/class/',       views.ClassAttendanceView.as_view(),              name='attendance-class'),
    path('attendance/bulk-mark/',   views.BulkMarkAttendanceView.as_view(),           name='attendance-bulk-mark'),
    path('attendance/summaries/',   views.StudentAttendanceSummaryListView.as_view(), name='attendance-summaries'),
]
