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
    # My Classes grid — supports ?search= ?grade_filter=1-2|3-4 ?high_performers=true
    path('teacher/my-classes/',                    views.MyClassesView.as_view(),                  name='teacher-my-classes'),
    # Homework Submission Status progress bars
    path('teacher/my-classes/homework-status/',    views.HomeworkSubmissionStatusView.as_view(),   name='teacher-homework-status'),
    # Class Performance progress bars
    path('teacher/class-performance/',    views.TeacherClassPerformanceView.as_view(), name='teacher-class-performance'),
    # Recent Activities feed
    path('teacher/recent-activities/',    views.TeacherRecentActivitiesView.as_view(), name='teacher-recent-activities'),
    # Upcoming Deadlines calendar — add ?month=2&year=2026 to filter
    path('teacher/deadlines/',            views.TeacherUpcomingDeadlinesView.as_view(), name='teacher-deadlines'),
    # Students page — list with ?search= ?class_id= ?performance= ?attendance=
    path('teacher/students/',             views.TeacherStudentListView.as_view(),             name='teacher-students'),
    # Performance Distribution histogram
    path('teacher/students/performance-distribution/', views.StudentPerformanceDistributionView.as_view(), name='teacher-students-perf-dist'),
    # Attendance Trends last 4 weeks
    path('teacher/students/attendance-trends/',        views.StudentAttendanceTrendsView.as_view(),        name='teacher-students-att-trends'),
]
