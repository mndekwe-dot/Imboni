from django.urls import path
from . import views
from . import report_views

urlpatterns = [
    # ── Bulk enrollment (term-start) ─────────────────────────────────────────
    # JSON list of students
    path('dos/students/bulk-create/',  views.BulkCreateStudentsView.as_view(),  name='dos-students-bulk-create'),
    # CSV file upload
    path('dos/students/import-csv/',   views.ImportStudentsCSVView.as_view(),   name='dos-students-import-csv'),

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

    # ── Student Management ──────────────────────────────────────────────────
    # Stat cards (Total, Active, New Admissions, Avg Performance)
    path('dos/students/stats/',                    views.StudentManagementStatsView.as_view(),      name='dos-student-stats'),
    # Student list (?search= ?grade= ?status=) + Add Student (POST)
    path('dos/students/',                          views.StudentListCreateView.as_view(),            name='dos-students'),
    # Enrollment by Grade progress bars
    path('dos/students/enrollment-by-grade/',      views.StudentEnrollmentByGradeView.as_view(),    name='dos-enrollment-by-grade'),
    # Performance Distribution donut chart
    path('dos/students/performance-distribution/', views.StudentPerformanceDistributionView.as_view(), name='dos-student-perf-dist'),
    # Enrollment Trends line chart (by year)
    path('dos/students/enrollment-trends/',        views.StudentEnrollmentTrendsView.as_view(),     name='dos-enrollment-trends'),

    # ── Results Approval ────────────────────────────────────────────────────
    path('dos/results/',                    views.DOSResultsListView.as_view(),       name='dos-results-list'),
    path('dos/results/bulk-approve/',       views.DOSResultBulkApproveView.as_view(), name='dos-results-bulk-approve'),
    path('dos/results/<uuid:pk>/approve/',  views.DOSResultApproveView.as_view(),     name='dos-result-approve'),
    path('dos/results/<uuid:pk>/reject/',   views.DOSResultRejectView.as_view(),      name='dos-result-reject'),

    # ── Exam Schedule ───────────────────────────────────────────────────────
    path('dos/exam-schedule/',             views.ExamScheduleListView.as_view(),   name='dos-exam-schedule-list'),
    path('dos/exam-schedule/<uuid:pk>/',   views.ExamScheduleDetailView.as_view(), name='dos-exam-schedule-detail'),

    # ── Attendance Overview ─────────────────────────────────────────────────
    path('dos/attendance/overview/',       views.DOSAttendanceOverviewView.as_view(), name='dos-attendance-overview'),

    # ── Announcements ───────────────────────────────────────────────────────
    path('dos/announcements/',             views.DOSAnnouncementsView.as_view(), name='dos-announcements'),

    # ── Student Leaders ─────────────────────────────────────────────────────
    path('dos/student-leaders/',           views.DOSStudentLeadersView.as_view(), name='dos-student-leaders'),

    # ── Analytics ───────────────────────────────────────────────────────────
    path('dos/analytics/',                 views.DOSAnalyticsView.as_view(), name='dos-analytics'),

     # ── Report Generation ────────────────────────────────────────────────────
    path('dos/reports/student/<uuid:pk>/',         report_views.StudentReportCardView.as_view(),  name='dos-student-report'),
    path('dos/reports/class/<uuid:class_id>/',     report_views.ClassReportCardsView.as_view(),   name='dos-class-reports'),
    path('dos/reports/export/results/',            report_views.ExportResultsCSVView.as_view(),   name='dos-export-results-csv'),
]
