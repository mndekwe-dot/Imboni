import uuid

from django.contrib.auth.hashers import check_password as _check_password, make_password
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


class PlatformUser(models.Model):
    """
    A platform/vendor operator — the person who runs Imboni across ALL schools
    (Phase 5). This is deliberately NOT the per-school `authentication.User`:

      * `authentication.User` lives inside each tenant schema and only exists
        within one school. There is no such thing as a user who spans schools.
      * A platform operator must sit ABOVE every tenant, so this model lives in
        the public schema (apps.tenants is a SHARED app) and authenticates
        against the platform API on the bare domain — never a school subdomain.

    Passwords are hashed with Django's hashers; auth + JWT issuance live in
    `apps.tenants.platform_auth`. Keep this account list tiny and trusted — it
    can suspend/reactivate any school.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    password = models.CharField(max_length=128)          # hashed, never plaintext
    name = models.CharField(max_length=120, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_login = models.DateTimeField(null=True, blank=True)

    # Enough of the Django/DRF auth surface for permission checks to treat an
    # authenticated PlatformUser as a real principal (see platform_auth.py).
    is_authenticated = True
    is_anonymous = False

    def set_password(self, raw_password):
        self.password = make_password(raw_password)

    def check_password(self, raw_password):
        return _check_password(raw_password, self.password)

    def __str__(self):
        return f'PlatformUser<{self.email}>'


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
