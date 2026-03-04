from django.urls import path
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'teacher',           views.TeacherViewSet,        basename='teacher')
router.register(r'teacher/tasks',     views.TeacherTaskViewSet,    basename='teacher-task')
router.register(r'teacher/reminders', views.TeacherReminderViewSet, basename='teacher-reminder')

urlpatterns = router.urls + [
    # Weekly timetable
    path('teacher/my-timetable/',         views.MyTimetableView.as_view(),             name='teacher-my-timetable'),
    # Today's schedule with Completed / In Progress / Upcoming status
    path('teacher/my-timetable/today/',   views.MyTodayScheduleView.as_view(),         name='teacher-today-schedule'),
    # Dashboard stat cards (both rows)
    path('teacher/dashboard/stats/',      views.TeacherDashboardStatsView.as_view(),   name='teacher-dashboard-stats'),
    # My Classes cards (student count + next period)
    path('teacher/my-classes/',           views.MyClassesView.as_view(),               name='teacher-my-classes'),
    # Class Performance progress bars
    path('teacher/class-performance/',    views.TeacherClassPerformanceView.as_view(), name='teacher-class-performance'),
    # Recent Activities feed
    path('teacher/recent-activities/',    views.TeacherRecentActivitiesView.as_view(), name='teacher-recent-activities'),
    # Upcoming Deadlines calendar — add ?month=2&year=2026 to filter
    path('teacher/deadlines/',            views.TeacherUpcomingDeadlinesView.as_view(), name='teacher-deadlines'),
]
