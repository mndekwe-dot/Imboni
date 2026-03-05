from django.contrib import admin
from django.utils import timezone
from .models import Subject, AcademicTerm, Result, Assessment


@admin.register(Subject)
class SubjectAdmin(admin.ModelAdmin):
    list_display  = ('name', 'code', 'credit_hours', 'is_active')
    list_filter   = ('is_active',)
    search_fields = ('name', 'code')
    ordering      = ('name',)


@admin.register(AcademicTerm)
class AcademicTermAdmin(admin.ModelAdmin):
    list_display  = ('name', 'term', 'year', 'start_date', 'end_date', 'is_current')
    list_filter   = ('term', 'year', 'is_current')
    ordering      = ('-year', '-term')


def approve_results(modeladmin, request, queryset):
    queryset.filter(status='submitted').update(
        status='approved',
        approved_by=request.user,
        approved_at=timezone.now(),
    )
approve_results.short_description = 'Approve selected submitted results'


def reject_results(modeladmin, request, queryset):
    queryset.filter(status='submitted').update(status='rejected')
reject_results.short_description = 'Reject selected submitted results'


@admin.register(Result)
class ResultAdmin(admin.ModelAdmin):
    actions       = [approve_results, reject_results]
    list_display  = ('student', 'subject', 'term', 'final_score', 'grade', 'status', 'teacher')
    list_filter   = ('status', 'grade', 'term', 'subject')
    search_fields = ('student__user__last_name', 'student__student_id', 'subject__name')
    ordering      = ('-term__year', '-term__term', 'student__user__last_name')
    readonly_fields = ('approved_at', 'approved_by', 'submitted_at', 'created_at', 'updated_at')

    fieldsets = (
        ('Student & Subject', {'fields': ('student', 'subject', 'term', 'teacher')}),
        ('Scores',    {'fields': ('quiz_average', 'group_work', 'exam_score', 'final_score', 'grade')}),
        ('Comments',  {'fields': ('teacher_comment', 'dos_comment')}),
        ('Approval',  {'fields': ('status', 'submitted_at', 'approved_by', 'approved_at', 'rejection_reason')}),
        ('Timestamps',{'fields': ('created_at', 'updated_at'), 'classes': ('collapse',)}),
    )


@admin.register(Assessment)
class AssessmentAdmin(admin.ModelAdmin):
    list_display  = ('student', 'title', 'assessment_type', 'subject', 'date', 'score_obtained', 'max_score', 'percentage')
    list_filter   = ('assessment_type', 'subject', 'term')
    search_fields = ('student__user__last_name', 'title', 'subject__name')
    ordering      = ('-date',)
