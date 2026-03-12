from django.contrib import admin
from .models import DisciplineStaff, StudentLeader, BoardingStudent, DiningPlan


@admin.register(DisciplineStaff)
class DisciplineStaffAdmin(admin.ModelAdmin):
    list_display  = ('user', 'staff_type', 'assigned_dormitory', 'assigned_grade', 'is_active')
    list_filter   = ('staff_type', 'is_active')
    search_fields = ('user__first_name', 'user__last_name', 'user__email')


@admin.register(StudentLeader)
class StudentLeaderAdmin(admin.ModelAdmin):
    list_display  = ('student', 'role', 'term', 'appointed_date', 'is_active')
    list_filter   = ('role', 'term', 'is_active')
    search_fields = ('student__user__first_name', 'student__user__last_name', 'student__student_id')


@admin.register(BoardingStudent)
class BoardingStudentAdmin(admin.ModelAdmin):
    list_display  = ('student', 'dormitory', 'room_number', 'boarding_type', 'check_in_date', 'is_active')
    list_filter   = ('boarding_type', 'dormitory', 'is_active')
    search_fields = ('student__user__first_name', 'student__user__last_name', 'student__student_id')


@admin.register(DiningPlan)
class DiningPlanAdmin(admin.ModelAdmin):
    list_display  = ('student', 'term', 'plan_type', 'is_active')
    list_filter   = ('plan_type', 'term', 'is_active')
    search_fields = ('student__user__first_name', 'student__user__last_name')
