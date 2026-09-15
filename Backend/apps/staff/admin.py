from django.contrib import admin

from .models import Department, StaffMember


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'is_active', 'sort_order')


@admin.register(StaffMember)
class StaffMemberAdmin(admin.ModelAdmin):
    list_display = ('first_name', 'last_name', 'job_title', 'department', 'employment_type', 'is_active')
    list_filter = ('department', 'employment_type', 'is_active')
    search_fields = ('first_name', 'last_name', 'staff_no')
