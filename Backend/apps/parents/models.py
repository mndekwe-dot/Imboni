import uuid
from django.db import models
from apps.authentication.models import User


class ParentStudentRelationship(models.Model):
    RELATIONSHIP_TYPES = [
        ('mother', 'Mother'),
        ('father', 'Father'),
        ('guardian', 'Legal Guardian'),
        ('other', 'Other'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    parent = models.ForeignKey(User, on_delete=models.CASCADE, related_name='children')
    student = models.ForeignKey('student.Student', on_delete=models.CASCADE, related_name='parents')
    relationship_type = models.CharField(max_length=20, choices=RELATIONSHIP_TYPES)
    is_primary_contact = models.BooleanField(default=False)
    can_pickup = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'parent_student_relationships'
        unique_together = ['parent', 'student']

    def __str__(self):
        return f"{self.parent.get_full_name()} -> {self.student.full_name} ({self.relationship_type})"
