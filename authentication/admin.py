from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, UserPreferences


class UserPreferencesInline(admin.StackedInline):
    model = UserPreferences
    can_delete = False
    verbose_name = 'Preferences'


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    inlines = [UserPreferencesInline]

    list_display   = ('email', 'get_full_name', 'role', 'employment_type', 'is_active', 'created_at')
    list_filter    = ('role', 'is_active', 'employment_type', 'email_verified')
    search_fields  = ('email', 'first_name', 'last_name', 'username')
    ordering       = ('role', 'last_name')

    fieldsets = BaseUserAdmin.fieldsets + (
        ('School Info', {
            'fields': ('role', 'employment_type', 'phone_number', 'avatar',
                       'date_of_birth', 'address', 'emergency_contact', 'email_verified'),
        }),
    )

    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ('School Info', {
            'fields': ('role', 'employment_type', 'phone_number'),
        }),
    )
