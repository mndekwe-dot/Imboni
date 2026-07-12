import uuid

from django.db import models
from django_tenants.models import TenantMixin, DomainMixin


class Client(TenantMixin):
    PLAN_CHOICES = [
        ('free', 'Free'),
        ('basic', 'Basic'),
        ('premium', 'Premium'),
    ]

    STATUS_CHOICES = [
        ('trial', 'Trial'),
        ('active', 'Active'),
        ('past_due', 'Past Due'),
        ('suspended', 'Suspended'),
    ]

    name = models.CharField(max_length=120)
    plan = models.CharField(max_length=20, choices=PLAN_CHOICES, default='free')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='trial')
    paid_until = models.DateField(null=True, blank=True)
    on_trial = models.BooleanField(default=True)
    created_on = models.DateField(auto_now_add=True)

    # Stripe billing links (Phase 3) — set when the school subscribes.
    stripe_customer_id = models.CharField(max_length=64, blank=True, default='')
    stripe_subscription_id = models.CharField(max_length=64, blank=True, default='')

    # django-tenants uses this to auto-create the Postgres schema on save.
    auto_create_schema = True

    def __str__(self):
        return f"{self.name} ({self.schema_name})"


class Domain(DomainMixin):
    pass


class TenantProvision(models.Model):
    """
    Tracks an asynchronous self-serve signup so the frontend can poll for
    progress. Lives in the public schema (apps.tenants is a SHARED app).

    Deliberately holds NO password — the signup view hashes the chosen password
    and passes the hash straight to the Celery task, so a secret never lands here.
    """
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('ready', 'Ready'),
        ('failed', 'Failed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school_name = models.CharField(max_length=120)
    subdomain = models.CharField(max_length=63)
    admin_email = models.EmailField()
    admin_first_name = models.CharField(max_length=150, blank=True)
    admin_last_name = models.CharField(max_length=150, blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    detail = models.TextField(blank=True)   # error message when status='failed'
    url = models.CharField(max_length=255, blank=True)  # set when status='ready'
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.subdomain} ({self.status})"
