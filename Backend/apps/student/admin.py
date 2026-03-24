from django.contrib import admin
from .models import (
    Student, Fee, StudentDocument,
    Activity, ActivityEnrollment, ActivityEvent, Assignment, AssignmentSubmission,
)


class FeeInline(admin.TabularInline):
    model = Fee
    extra = 0
    fields = ('category', 'amount', 'due_date', 'status', 'paid_date')
    readonly_fields = ('paid_date',)


class DocumentInline(admin.TabularInline):
    model = StudentDocument
    extra = 0
    fields = ('title', 'document_type', 'file', 'uploaded_by')
    readonly_fields = ('uploaded_by',)


@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    inlines       = [FeeInline, DocumentInline]
    list_display  = ('student_id', 'full_name', 'grade', 'section', 'status', 'enrollment_date')
    list_filter   = ('grade', 'section', 'status')
    search_fields = ('student_id', 'user__first_name', 'user__last_name', 'user__email')
    ordering      = ('grade', 'section', 'user__last_name')
    readonly_fields = ('created_at', 'updated_at')

    fieldsets = (
        ('Identity',   {'fields': ('user', 'student_id', 'grade', 'section', 'status', 'enrollment_date')}),
        ('Medical',    {'fields': ('blood_group', 'allergies', 'medical_conditions'), 'classes': ('collapse',)}),
        ('Academic',   {'fields': ('current_gpa', 'attendance_percentage')}),
        ('Timestamps', {'fields': ('created_at', 'updated_at'), 'classes': ('collapse',)}),
    )


@admin.register(Fee)
class FeeAdmin(admin.ModelAdmin):
    list_display  = ('student', 'category', 'amount', 'due_date', 'status')
    list_filter   = ('status', 'category', 'term')
    search_fields = ('student__user__last_name', 'student__student_id')
    ordering      = ('due_date',)


@admin.register(StudentDocument)
class StudentDocumentAdmin(admin.ModelAdmin):
    list_display  = ('student', 'title', 'document_type', 'created_at')
    list_filter   = ('document_type',)
    search_fields = ('student__user__last_name', 'title')


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
