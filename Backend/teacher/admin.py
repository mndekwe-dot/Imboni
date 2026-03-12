from django.contrib import admin
from .models import Class, ClassAssignment, SubjectTeacherAssignment, Timetable, Task, Reminder


class ClassAssignmentInline(admin.TabularInline):
    model = ClassAssignment
    extra = 0
    fields = ('student', 'term', 'assigned_date')
    readonly_fields = ('assigned_date',)


class TimetableInline(admin.TabularInline):
    model = Timetable
    extra = 0
    fields = ('subject', 'teacher', 'term', 'day', 'start_time', 'end_time', 'room_number')


@admin.register(Class)
class ClassAdmin(admin.ModelAdmin):
    inlines       = [ClassAssignmentInline, TimetableInline]
    list_display  = ('name', 'grade', 'section', 'class_teacher', 'max_students', 'room_number', 'is_active')
    list_filter   = ('grade', 'is_active')
    search_fields = ('name', 'class_teacher__email', 'room_number')
    ordering      = ('grade', 'section')


@admin.register(ClassAssignment)
class ClassAssignmentAdmin(admin.ModelAdmin):
    list_display  = ('student', 'class_obj', 'term', 'assigned_date')
    list_filter   = ('term', 'class_obj__grade')
    search_fields = ('student__user__last_name', 'student__student_id')
    readonly_fields = ('assigned_date',)


@admin.register(SubjectTeacherAssignment)
class SubjectTeacherAssignmentAdmin(admin.ModelAdmin):
    list_display  = ('teacher', 'subject', 'class_obj', 'term')
    list_filter   = ('term', 'subject')
    search_fields = ('teacher__email', 'subject__name', 'class_obj__name')


@admin.register(Timetable)
class TimetableAdmin(admin.ModelAdmin):
    list_display  = ('class_obj', 'subject', 'teacher', 'term', 'day', 'start_time', 'end_time', 'room_number')
    list_filter   = ('day', 'term', 'subject')
    search_fields = ('class_obj__name', 'subject__name', 'teacher__email')
    ordering      = ('day', 'start_time')


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display  = ('teacher', 'title', 'priority', 'due_date', 'is_completed')
    list_filter   = ('priority', 'is_completed')
    search_fields = ('teacher__email', 'title')
    ordering      = ('is_completed', 'due_date')


@admin.register(Reminder)
class ReminderAdmin(admin.ModelAdmin):
    list_display  = ('teacher', 'content', 'is_completed', 'created_at')
    list_filter   = ('is_completed',)
    search_fields = ('teacher__email', 'content')
    ordering      = ('-created_at',)
