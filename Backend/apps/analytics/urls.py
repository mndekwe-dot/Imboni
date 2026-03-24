from django.urls import path
from . import views

urlpatterns = [
    # Academic Performance
    path('analytics/performance/overview/',        views.PerformanceOverviewView.as_view(),       name='analytics-performance-overview'),
    path('analytics/performance/by-grade/',        views.PerformanceByGradeView.as_view(),        name='analytics-performance-by-grade'),
    path('analytics/performance/by-subject/',      views.PerformanceBysubjectView.as_view(),      name='analytics-performance-by-subject'),
    path('analytics/performance/top-students/',    views.TopStudentsView.as_view(),               name='analytics-top-students'),
    path('analytics/performance/at-risk/',         views.AtRiskStudentsView.as_view(),            name='analytics-at-risk'),

    # Attendance
    path('analytics/attendance/overview/',         views.AttendanceOverviewView.as_view(),        name='analytics-attendance-overview'),
    path('analytics/attendance/by-grade/',         views.AttendanceByGradeView.as_view(),         name='analytics-attendance-by-grade'),
    path('analytics/attendance/chronic-absence/',  views.ChronicAbsenceView.as_view(),            name='analytics-chronic-absence'),

    # Behavior
    path('analytics/behavior/overview/',           views.BehaviorOverviewView.as_view(),          name='analytics-behavior-overview'),
    path('analytics/behavior/by-type/',            views.BehaviorByTypeView.as_view(),            name='analytics-behavior-by-type'),
    path('analytics/behavior/repeated-offenders/', views.RepeatedOffendersView.as_view(),         name='analytics-repeated-offenders'),

    # Enrollment
    path('analytics/enrollment/overview/',         views.EnrollmentOverviewView.as_view(),        name='analytics-enrollment-overview'),
    path('analytics/enrollment/by-grade/',         views.EnrollmentByGradeView.as_view(),         name='analytics-enrollment-by-grade'),

    # Fees
    path('analytics/fees/overview/',               views.FeesOverviewView.as_view(),              name='analytics-fees-overview'),
    path('analytics/fees/outstanding/',            views.OutstandingFeesView.as_view(),           name='analytics-fees-outstanding'),

    # Teachers
    path('analytics/teachers/overview/',           views.TeacherOverviewView.as_view(),           name='analytics-teachers-overview'),
    path('analytics/teachers/results-submission/', views.TeacherResultsSubmissionView.as_view(),  name='analytics-teacher-results-submission'),
]
