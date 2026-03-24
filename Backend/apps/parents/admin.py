from django.contrib import admin
from .models import ParentStudentRelationship


@admin.register(ParentStudentRelationship)
class ParentStudentRelationshipAdmin(admin.ModelAdmin):
    list_display  = ('parent', 'student', 'relationship_type', 'is_primary_contact', 'can_pickup')
    list_filter   = ('relationship_type', 'is_primary_contact', 'can_pickup')
    search_fields = ('parent__email', 'student__user__last_name', 'student__student_id')
