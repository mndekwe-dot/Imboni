import uuid

from django.contrib.auth.hashers import check_password as _check_password, make_password
from django.db import models
from django.utils import timezone
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


# ── Platform operations (Phase 6) — all public-schema, operator-facing ──────────

class PlatformExpense(models.Model):
    """
    A service/bill the VENDOR pays to run the platform (money OUT): hosting,
    Stripe fees, domains, email, SaaS tools, etc. Tracked by the operator with a
    due date so upcoming/overdue bills are visible. Public schema only.
    """
    CATEGORY_CHOICES = [
        ('hosting', 'Hosting / Infrastructure'),
        ('payments', 'Payment processing'),
        ('domain', 'Domain / DNS'),
        ('email', 'Email / Messaging'),
        ('saas', 'SaaS / Tools'),
        ('other', 'Other'),
    ]
    RECURRENCE_CHOICES = [
        ('one_time', 'One-time'),
        ('monthly', 'Monthly'),
        ('quarterly', 'Quarterly'),
        ('yearly', 'Yearly'),
    ]
    STATUS_CHOICES = [('due', 'Due'), ('paid', 'Paid')]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=120)
    vendor = models.CharField(max_length=120, blank=True)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='other')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, default='USD')
    recurrence = models.CharField(max_length=12, choices=RECURRENCE_CHOICES, default='monthly')
    due_date = models.DateField()
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='due')
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['due_date']

    @property
    def is_overdue(self):
        return self.status == 'due' and self.due_date < timezone.localdate()

    def __str__(self):
        return f'{self.name} ({self.amount} {self.currency}, due {self.due_date})'


class Payment(models.Model):
    """
    A payment RECEIVED from a school (money IN / revenue). Populated by the Stripe
    webhook when live keys are configured, and addable manually meanwhile. Public
    schema only (the tenant registry + billing all live here).
    """
    STATUS_CHOICES = [
        ('succeeded', 'Succeeded'),
        ('pending', 'Pending'),
        ('failed', 'Failed'),
        ('refunded', 'Refunded'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    client = models.ForeignKey('Client', on_delete=models.SET_NULL, null=True, blank=True,
                               related_name='payments')
    school_name = models.CharField(max_length=120, blank=True)   # snapshot for display
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, default='USD')
    plan = models.CharField(max_length=20, blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='succeeded')
    stripe_payment_id = models.CharField(max_length=120, blank=True, default='')
    received_at = models.DateTimeField(default=timezone.now)
    note = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-received_at']

    def __str__(self):
        return f'{self.school_name or self.client_id} — {self.amount} {self.currency} ({self.status})'


class SupportTicket(models.Model):
    """
    A support ticket raised by a school user, surfaced to the platform operator.
    Lives in the PUBLIC schema so one inbox spans all schools: the tenant-side
    view (apps/tenants/support.py) writes here via schema_context(public), and the
    operator console reads/answers here.
    """
    PRIORITY_CHOICES = [('low', 'Low'), ('normal', 'Normal'), ('high', 'High'), ('urgent', 'Urgent')]
    STATUS_CHOICES = [
        ('open', 'Open'),
        ('in_progress', 'In progress'),
        ('resolved', 'Resolved'),
        ('closed', 'Closed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    client = models.ForeignKey('Client', on_delete=models.SET_NULL, null=True, blank=True,
                               related_name='tickets')
    school_name = models.CharField(max_length=120, blank=True)   # snapshot for display
    schema_name = models.CharField(max_length=63, blank=True)    # tenant it came from
    raised_by_email = models.EmailField(blank=True)
    raised_by_name = models.CharField(max_length=150, blank=True)
    raised_by_role = models.CharField(max_length=20, blank=True)
    subject = models.CharField(max_length=200)
    body = models.TextField()
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='normal')
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default='open')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'#{str(self.id)[:8]} {self.subject} ({self.status})'


class TicketReply(models.Model):
    """A message on a support ticket, from either the school or the operator."""
    AUTHOR_CHOICES = [('school', 'School'), ('operator', 'Operator')]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ticket = models.ForeignKey(SupportTicket, on_delete=models.CASCADE, related_name='replies')
    author_type = models.CharField(max_length=10, choices=AUTHOR_CHOICES)
    author_name = models.CharField(max_length=150, blank=True)
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f'Reply({self.author_type}) on {self.ticket_id}'


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
