from django.urls import path
from . import views

urlpatterns = [
    # 4 stat cards: Positive Reports, Warnings, Conduct Grade, Achievements
    path('behavior/students/<uuid:pk>/stats/', views.StudentBehaviorStatsView.as_view(), name='behavior-stats'),
    # Recent Reports list — add ?type=positive|warning|incident|achievement to filter
    path('behavior/students/<uuid:pk>/reports/', views.StudentBehaviorReportsView.as_view(), name='behavior-reports'),
]
