from django.urls import path
from . import views

urlpatterns = [
    # 4 stat cards: Overall Rate, Days Present, Days Absent, Late Arrivals
    path('attendance/students/<uuid:pk>/stats/', views.StudentAttendanceStatsView.as_view(), name='attendance-stats'),
    # Monthly calendar grid — add ?month=2&year=2026 to filter
    path('attendance/students/<uuid:pk>/calendar/', views.StudentAttendanceCalendarView.as_view(), name='attendance-calendar'),
]
