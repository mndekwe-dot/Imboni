from django.contrib import admin
from .models import BehaviorReport, ConductGrade


@admin.register(BehaviorReport)
class BehaviorReportAdmin(admin.ModelAdmin):
    list_display   = ('student', 'title', 'report_type', 'severity', 'date',
                      'follow_up_required', 'parents_notified', 'reported_by')
    list_filter    = ('report_type', 'severity', 'follow_up_required',
                      'follow_up_completed', 'parents_notified')
    search_fields  = ('student__user__last_name', 'student__student_id', 'title')
    ordering       = ('-date',)
    date_hierarchy = 'date'
    readonly_fields = ('created_at', 'updated_at', 'parent_notification_date')

    fieldsets = (
        ('Incident',       {'fields': ('student', 'report_type', 'severity', 'title',
                                       'description', 'date', 'location')}),
        ('People',         {'fields': ('reported_by', 'witnesses')}),
        ('Action',         {'fields': ('action_taken', 'follow_up_required',
                                       'follow_up_date', 'follow_up_completed')}),
        ('Parent Contact', {'fields': ('parents_notified', 'parent_notification_date')}),
        ('Timestamps',     {'fields': ('created_at', 'updated_at'), 'classes': ('collapse',)}),
    )


@admin.register(ConductGrade)
class ConductGradeAdmin(admin.ModelAdmin):
    list_display  = ('student', 'term', 'grade', 'positive_count',
                     'warning_count', 'incident_count', 'achievement_count')
    list_filter   = ('grade', 'term')
    search_fields = ('student__user__last_name', 'student__student_id')
    ordering      = ('-term__year', '-term__term')
