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

    # The lifecycle a school moves through. `read_only` sits deliberately
    # between past_due and suspended: a school that has not paid can still open
    # the register, read a report card and export its data, but cannot write
    # anything new. Locking a school out mid-term with no warning is how you
    # lose the renewal AND the reputation; taking the pen away is enough.
    STATUS_CHOICES = [
        ('trial', 'Trial'),
        ('active', 'Active'),
        ('past_due', 'Past Due'),
        ('read_only', 'Read Only'),
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

    # Self-serve signup creates a DEMO tenant, not a school. It expires on its
    # own so an unreviewed stranger can try the product without a real school
    # existing forever on the strength of a filled-in form. A demo becomes a
    # real school the ordinary way: through an application an operator reviews.
    is_demo = models.BooleanField(default=False)
    demo_expires_on = models.DateField(null=True, blank=True)

    @property
    def is_expired_demo(self):
        return bool(self.is_demo and self.demo_expires_on
                    and timezone.localdate() > self.demo_expires_on)

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
    `apps.tenants.platform_auth`. Keep this account list tiny and trusted — an
    operations operator can suspend or reactivate any school.
    """

    # Three jobs, not one login. The person who answers "I forgot my password"
    # should not also be able to switch a school off, and the person who edits a
    # contract should not need the power to provision a tenant. Roles are
    # ordered by blast radius, and each one CONTAINS the ones before it:
    #
    #   support     — the ticket desk. Read a school, answer its questions.
    #   commercial  — contracts, payments, plans. Money, no infrastructure.
    #   operations  — provisioning, suspension, operator accounts. Smallest
    #                 group; MFA is required to hold it.
    ROLE_SUPPORT = 'support'
    ROLE_COMMERCIAL = 'commercial'
    ROLE_OPERATIONS = 'operations'
    ROLE_CHOICES = [
        (ROLE_SUPPORT, 'Support'),
        (ROLE_COMMERCIAL, 'Commercial'),
        (ROLE_OPERATIONS, 'Operations'),
    ]
    # Least privilege by default: a new operator answers tickets until someone
    # deliberately gives them more.
    ROLE_RANK = {ROLE_SUPPORT: 0, ROLE_COMMERCIAL: 1, ROLE_OPERATIONS: 2}

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    password = models.CharField(max_length=128)          # hashed, never plaintext
    name = models.CharField(max_length=120, blank=True)
    role = models.CharField(max_length=12, choices=ROLE_CHOICES, default=ROLE_SUPPORT)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_login = models.DateTimeField(null=True, blank=True)

    # TOTP second factor. `mfa_secret` is the shared secret in base32;
    # `mfa_enabled` only goes true once the operator has proved they can read a
    # code off it, so a half-finished enrolment can never lock anybody out.
    mfa_secret = models.CharField(max_length=64, blank=True, default='')
    mfa_enabled = models.BooleanField(default=False)
    # The last TOTP time-step this operator successfully spent. A code is valid
    # for a 30s step and we accept one step either side, so without this a code
    # observed over someone's shoulder — or read out of a proxy log — stays
    # usable for about 90 seconds. Recording the step makes each code good once.
    mfa_last_step = models.BigIntegerField(null=True, blank=True)

    def has_role(self, required):
        """True if this operator's role is `required` or stronger."""
        return self.ROLE_RANK.get(self.role, -1) >= self.ROLE_RANK[required]

    @property
    def mfa_required(self):
        """Operations is the role that can switch a school off. It needs MFA."""
        return self.role == self.ROLE_OPERATIONS

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
        return f'{self.school_name or self.client_id}, {self.amount} {self.currency} ({self.status})'


class StripeEvent(models.Model):
    """
    One row per Stripe event we have finished processing.

    Stripe delivers at-least-once: a redelivery after a network hiccup, or a
    manual resend from the dashboard, arrives as the same event id. Claiming the
    id before handling makes the webhook idempotent for the handlers that are
    not naturally so — a status flip is harmless twice, recording revenue is
    not.

    The row is only kept when handling SUCCEEDED. On failure it is deleted so
    that Stripe's retry is allowed to do its job.
    """
    event_id = models.CharField(max_length=255, primary_key=True)
    event_type = models.CharField(max_length=120, blank=True, default='')
    received_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-received_at']

    def __str__(self):
        return f'{self.event_id} ({self.event_type})'


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


class SchoolApplication(models.Model):
    """
    A school's request to join Imboni (Phase 7). Public prospects apply; the
    platform operator reviews and approves/rejects, then provisions the tenant
    as a separate step. Public schema.
    """
    STATUS_CHOICES = [
        ('pending', 'Pending review'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('provisioned', 'Provisioned'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school_name = models.CharField(max_length=150)
    desired_subdomain = models.CharField(max_length=63)
    contact_name = models.CharField(max_length=150)
    contact_email = models.EmailField()
    contact_phone = models.CharField(max_length=30, blank=True)
    country = models.CharField(max_length=80, blank=True)
    city = models.CharField(max_length=80, blank=True)
    student_estimate = models.PositiveIntegerField(null=True, blank=True)
    plan_interest = models.CharField(max_length=20, blank=True)
    message = models.TextField(blank=True)
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default='pending')
    review_notes = models.TextField(blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    # Set once the approved application is turned into a live school.
    provisioned_client = models.ForeignKey('Client', on_delete=models.SET_NULL,
                                            null=True, blank=True, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.school_name} ({self.status})'


class Contract(models.Model):
    """
    A subscription contract between Imboni and a school (Phase 7): its terms and
    its lifecycle (start → end, renewal, expiry, termination). Public schema.

    Expiry policy (chosen): warn as the end date approaches, and auto-suspend the
    school `grace_days` after the end date if the contract is still active and
    unrenewed — enforced by `enforce_contract_lifecycle` (management command +
    Celery beat).
    """
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('active', 'Active'),
        ('expired', 'Expired'),
        ('terminated', 'Terminated'),
    ]
    INTERVAL_CHOICES = [
        ('monthly', 'Monthly'), ('quarterly', 'Quarterly'),
        ('yearly', 'Yearly'), ('one_time', 'One-time'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    client = models.ForeignKey('Client', on_delete=models.CASCADE, related_name='contracts')
    title = models.CharField(max_length=150)
    plan = models.CharField(max_length=20, blank=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    currency = models.CharField(max_length=3, default='USD')
    billing_interval = models.CharField(max_length=12, choices=INTERVAL_CHOICES, default='yearly')
    start_date = models.DateField()
    end_date = models.DateField()
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default='draft')
    auto_renew = models.BooleanField(default=False)
    grace_days = models.PositiveIntegerField(default=14)
    signed_at = models.DateTimeField(null=True, blank=True)
    signed_by = models.CharField(max_length=150, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-start_date']

    @property
    def days_remaining(self):
        return (self.end_date - timezone.localdate()).days

    @property
    def is_expired(self):
        return timezone.localdate() > self.end_date

    @property
    def is_expiring_soon(self):
        return self.status == 'active' and 0 <= self.days_remaining <= 30

    def __str__(self):
        return f'{self.title}, {self.client_id} ({self.status})'


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


class PlatformAuditLog(models.Model):
    """
    What an operator did, in the public schema.

    `apps.audit` is a TENANT app: it records what happens inside a school. That
    left the actions with the largest blast radius — approving an application,
    provisioning a tenant, suspending a school, signing a contract, recording a
    payment — with no record of who performed them at all. This is that record.

    Deliberately append-only in practice: there is no update path and no delete
    endpoint. `actor_email` is denormalised so the entry still reads correctly
    after an operator account is removed.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    actor = models.ForeignKey('PlatformUser', on_delete=models.SET_NULL, null=True,
                              blank=True, related_name='audit_entries')
    actor_email = models.EmailField(blank=True)      # snapshot; survives deletion
    actor_role = models.CharField(max_length=12, blank=True)
    action = models.CharField(max_length=60)         # 'school.suspend', 'contract.sign', ...
    target_type = models.CharField(max_length=40, blank=True)
    target_id = models.CharField(max_length=64, blank=True)
    target_label = models.CharField(max_length=150, blank=True)
    client = models.ForeignKey('Client', on_delete=models.SET_NULL, null=True, blank=True,
                               related_name='audit_entries')
    # What changed, as {'field': [before, after]}. Empty for actions that aren't
    # a field edit (a provision, a reply). Never holds a secret — see
    # platform_audit.record(), which strips them.
    changes = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['-created_at']),
            models.Index(fields=['action', '-created_at']),
        ]

    def __str__(self):
        return f'{self.actor_email or "system"} {self.action} {self.target_label}'


class SchoolInvitation(models.Model):
    """
    A one-time link that lets a newly provisioned school set its own password.

    Provisioning used to mint a temporary password and hand it to the operator
    to relay by hand. That made onboarding depend on someone pasting a secret
    into a chat thread — where it does not expire, is not revoked, and is read
    by whoever else is in the conversation.

    So the school's first admin is created with an UNUSABLE password and gets a
    link instead. The token is single-use and expires. The operator sees that an
    invitation was sent and when; they never see a credential.

    Lives in the public schema, but is looked up from the school's own domain
    when the link is opened — django-tenants puts `public` on the search path of
    every tenant connection, so the row is reachable from either side.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    client = models.ForeignKey('Client', on_delete=models.CASCADE, related_name='invitations')
    email = models.EmailField()
    # Stored hashed, for the same reason a password is: a leaked database should
    # not hand over live invitation links.
    token_hash = models.CharField(max_length=128, unique=True)
    login_url = models.CharField(max_length=255, blank=True)
    expires_at = models.DateTimeField()
    accepted_at = models.DateTimeField(null=True, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    delivery_error = models.CharField(max_length=255, blank=True)
    created_by = models.ForeignKey('PlatformUser', on_delete=models.SET_NULL,
                                   null=True, blank=True, related_name='invitations_sent')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    @property
    def is_expired(self):
        return timezone.now() > self.expires_at

    @property
    def is_usable(self):
        return self.accepted_at is None and not self.is_expired

    @property
    def state(self):
        if self.accepted_at:
            return 'accepted'
        if self.is_expired:
            return 'expired'
        return 'sent' if self.sent_at else 'pending'

    def __str__(self):
        return f'Invitation<{self.email} -> {self.client_id} ({self.state})>'
