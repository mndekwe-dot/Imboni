from django.contrib import admin
from .models import Student, ParentStudentRelationship, Fee, StudentDocument


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


@admin.register(ParentStudentRelationship)
class ParentStudentRelationshipAdmin(admin.ModelAdmin):
    list_display  = ('parent', 'student', 'relationship_type', 'is_primary_contact', 'can_pickup')
    list_filter   = ('relationship_type', 'is_primary_contact', 'can_pickup')
    search_fields = ('parent__email', 'student__user__last_name', 'student__student_id')


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
