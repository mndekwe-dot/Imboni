from django.contrib import admin
from .models import AttendanceRecord, AttendanceSummary


@admin.register(AttendanceRecord)
class AttendanceRecordAdmin(admin.ModelAdmin):
    list_display   = ('student', 'date', 'status', 'minutes_late', 'marked_by')
    list_filter    = ('status', 'date')
    search_fields  = ('student__user__last_name', 'student__student_id')
    ordering       = ('-date',)
    date_hierarchy = 'date'
    readonly_fields = ('created_at', 'updated_at')


@admin.register(AttendanceSummary)
class AttendanceSummaryAdmin(admin.ModelAdmin):
    list_display  = ('student', 'month', 'year', 'total_days', 'present_days',
                     'absent_days', 'late_days', 'attendance_percentage')
    list_filter   = ('year', 'month')
    search_fields = ('student__user__last_name', 'student__student_id')
    ordering      = ('-year', '-month')
    readonly_fields = ('attendance_percentage', 'updated_at')
