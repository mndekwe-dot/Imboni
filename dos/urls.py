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
]
