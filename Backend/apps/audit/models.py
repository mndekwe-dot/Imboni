import uuid
from django.db import models
from django.conf import settings


class AuditEntry(models.Model):
    """
    One row per sensitive administrative action: who did what, to whom, when.
    Written via apps.audit.services.audit() — never edited or deleted from
    application code.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='audit_entries',
    )
    # Snapshots survive the actor being deleted
    actor_name = models.CharField(max_length=200, blank=True)
    actor_role = models.CharField(max_length=20, blank=True)

    action = models.CharField(max_length=100)     # e.g. 'invitation.sent'
    target = models.CharField(max_length=255, blank=True)   # human-readable object
    detail = models.JSONField(default=dict, blank=True)      # extra structured context

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'audit_entries'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['action']),
            models.Index(fields=['-created_at']),
        ]
        verbose_name_plural = 'audit entries'

    def __str__(self):
        return f"{self.actor_name or 'system'}, {self.action}, {self.target}"
