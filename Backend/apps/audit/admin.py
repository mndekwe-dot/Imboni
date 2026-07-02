from django.contrib import admin
from .models import AuditEntry


@admin.register(AuditEntry)
class AuditEntryAdmin(admin.ModelAdmin):
    list_display = ('created_at', 'actor_name', 'actor_role', 'action', 'target')
    list_filter = ('action', 'actor_role')
    search_fields = ('actor_name', 'target')
    readonly_fields = ('id', 'actor', 'actor_name', 'actor_role', 'action', 'target', 'detail', 'created_at')

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
