from django.urls import path
from . import views

urlpatterns = [
    # Stat cards — Total Students, Teaching Staff, Avg Performance, Pending Approvals
    path('dos/dashboard/stats/',               views.DOSDashboardStatsView.as_view(),      name='dos-dashboard-stats'),
    # Recent Activity feed
    path('dos/dashboard/recent-activity/',     views.DOSRecentActivityView.as_view(),      name='dos-recent-activity'),
    # Performance Overview progress bars (School Average + Attendance Rate)
    path('dos/dashboard/performance-overview/', views.DOSPerformanceOverviewView.as_view(), name='dos-performance-overview'),
    # Performance by Grade bar chart
    path('dos/dashboard/performance-by-grade/', views.DOSPerformanceByGradeView.as_view(), name='dos-performance-by-grade'),

    # ── Teacher Management ──────────────────────────────────────────────────
    # Stat cards (Total Teachers, Full-Time, Part-Time, Student-Teacher Ratio)
    path('dos/teachers/stats/',                  views.TeacherManagementStatsView.as_view(),    name='dos-teacher-stats'),
    # Teacher list (?search= ?employment_type= ?subject_id=) + Add Teacher (POST)
    path('dos/teachers/',                        views.TeacherListCreateView.as_view(),         name='dos-teachers'),
    # Teachers by Subject progress bars
    path('dos/teachers/by-subject/',             views.TeachersBySubjectView.as_view(),         name='dos-teachers-by-subject'),
    # Workload Distribution chart (1-2, 3-4, 5+ classes)
    path('dos/teachers/workload-distribution/',  views.TeacherWorkloadDistributionView.as_view(), name='dos-workload-dist'),
    # Performance Ratings chart (Excellent / Good / Average / Needs Improvement)
    path('dos/teachers/performance-ratings/',    views.TeacherPerformanceRatingsView.as_view(), name='dos-perf-ratings'),
]
