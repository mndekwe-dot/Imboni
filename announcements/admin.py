from django.contrib import admin
from django.utils import timezone
from .models import Announcement, AnnouncementRead


def publish_announcements(modeladmin, request, queryset):
    queryset.filter(status='draft').update(
        status='published',
        published_at=timezone.now(),
    )
publish_announcements.short_description = 'Publish selected draft announcements'


def archive_announcements(modeladmin, request, queryset):
    queryset.update(status='archived')
archive_announcements.short_description = 'Archive selected announcements'


class AnnouncementReadInline(admin.TabularInline):
    model = AnnouncementRead
    extra = 0
    readonly_fields = ('user', 'read_at')
    can_delete = False


@admin.register(Announcement)
class AnnouncementAdmin(admin.ModelAdmin):
    actions  = [publish_announcements, archive_announcements]
    inlines  = [AnnouncementReadInline]

    list_display  = ('title', 'category', 'target_audience', 'status', 'author', 'published_at')
    list_filter   = ('status', 'category', 'target_audience')
    search_fields = ('title', 'content', 'author__email')
    ordering      = ('-published_at', '-created_at')
    readonly_fields = ('created_at', 'updated_at')

    fieldsets = (
        ('Content',    {'fields': ('title', 'content', 'category', 'attachment')}),
        ('Audience',   {'fields': ('target_audience', 'target_grade')}),
        ('Publishing', {'fields': ('status', 'author', 'published_at', 'expires_at')}),
        ('Timestamps', {'fields': ('created_at', 'updated_at'), 'classes': ('collapse',)}),
    )


@admin.register(AnnouncementRead)
class AnnouncementReadAdmin(admin.ModelAdmin):
    list_display  = ('announcement', 'user', 'read_at')
    list_filter   = ('read_at',)
    search_fields = ('user__email', 'announcement__title')
    readonly_fields = ('read_at',)
