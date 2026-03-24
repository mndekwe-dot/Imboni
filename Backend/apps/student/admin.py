from django.contrib import admin
from .models import Activity, ActivityEnrollment, ActivityEvent, Assignment, AssignmentSubmission


class ActivityEnrollmentInline(admin.TabularInline):
    model = ActivityEnrollment
    extra = 0
    readonly_fields = ('enrolled_at',)


class ActivityEventInline(admin.TabularInline):
    model = ActivityEvent
    extra = 0


@admin.register(Activity)
class ActivityAdmin(admin.ModelAdmin):
    list_display  = ('name', 'category', 'enrolled_count', 'max_members', 'teacher_in_charge', 'is_active')
    list_filter   = ('category', 'is_active')
    search_fields = ('name',)
    inlines       = [ActivityEnrollmentInline, ActivityEventInline]

    def enrolled_count(self, obj):
        return obj.enrollments.filter(status='active').count()
    enrolled_count.short_description = 'Enrolled'


@admin.register(ActivityEnrollment)
class ActivityEnrollmentAdmin(admin.ModelAdmin):
    list_display  = ('student', 'activity', 'status', 'enrolled_at')
    list_filter   = ('status', 'activity')
    search_fields = ('student__user__first_name', 'student__user__last_name', 'activity__name')


class AssignmentSubmissionInline(admin.TabularInline):
    model = AssignmentSubmission
    extra = 0
    readonly_fields = ('submitted_at',)


@admin.register(Assignment)
class AssignmentAdmin(admin.ModelAdmin):
    list_display  = ('title', 'subject', 'class_obj', 'teacher', 'due_date', 'term')
    list_filter   = ('term', 'subject', 'class_obj')
    search_fields = ('title',)
    inlines       = [AssignmentSubmissionInline]


@admin.register(AssignmentSubmission)
class AssignmentSubmissionAdmin(admin.ModelAdmin):
    list_display  = ('student', 'assignment', 'status', 'grade', 'submitted_at')
    list_filter   = ('status',)
    search_fields = ('student__user__first_name', 'student__user__last_name')
