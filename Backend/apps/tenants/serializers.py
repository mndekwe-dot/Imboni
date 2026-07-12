"""
Serializers for the platform super-admin API (Phase 5).

These serialize the tenant-registry models (``Client`` and ``Domain``) which
live ONLY in the public schema. They are consumed by the vendor-facing views in
``apps.tenants.views`` and are not exposed inside any per-school schema.
"""
from django.db import transaction
from django_tenants.utils import schema_context
from rest_framework import serializers

from .models import Client, Domain, PlatformExpense, Payment, SupportTicket, TicketReply


def _tenant_usage(schema_name):
    """
    Live student/staff head-count inside one school's schema, for the platform
    console. Switches into the tenant schema to count its own `users` table.
    Returns None counts if the schema can't be read (never break the list over
    one bad tenant).

    The counts run inside a savepoint (`transaction.atomic`): if a tenant's
    schema is missing/broken the failing query rolls back only the savepoint,
    leaving the surrounding request transaction usable for the next school.
    """
    from apps.authentication.models import User
    from apps.tenants.plans import STAFF_ROLES
    try:
        with transaction.atomic(), schema_context(schema_name):
            students = User.objects.filter(role='student', is_active=True).count()
            staff = User.objects.filter(role__in=STAFF_ROLES, is_active=True).count()
        return {'students': students, 'staff': staff}
    except Exception:  # noqa: BLE001 - a broken tenant must not 500 the whole list
        return {'students': None, 'staff': None}


class ClientSerializer(serializers.ModelSerializer):
    """
    A school (tenant) as seen by the platform vendor.

    ``schema_name`` and ``created_on`` are read-only: the Postgres schema is
    created once, at provisioning time, by the ``provision_school`` management
    command — it must never change afterwards (renaming a live schema would
    orphan every school's data). Editable operational fields (plan, status,
    paid_until, on_trial) may be updated by the platform admin.
    """
    primary_domain = serializers.SerializerMethodField()
    usage = serializers.SerializerMethodField()

    class Meta:
        model = Client
        fields = [
            'id',
            'name',
            'schema_name',
            'primary_domain',
            'plan',
            'status',
            'paid_until',
            'on_trial',
            'created_on',
            'usage',
        ]
        read_only_fields = ['id', 'schema_name', 'created_on']

    def get_primary_domain(self, obj):
        domain = obj.domains.filter(is_primary=True).first() or obj.domains.first()
        return domain.domain if domain else None

    def get_usage(self, obj):
        return _tenant_usage(obj.schema_name)


class DomainSerializer(serializers.ModelSerializer):
    """A domain/subdomain that routes to a given tenant schema."""
    class Meta:
        model = Domain
        fields = ['id', 'domain', 'tenant', 'is_primary']


# ── Platform operations (Phase 6) ───────────────────────────────────────────────

class PlatformExpenseSerializer(serializers.ModelSerializer):
    """A vendor service/bill (money out) — full CRUD for the operator."""
    is_overdue = serializers.BooleanField(read_only=True)

    class Meta:
        model = PlatformExpense
        fields = [
            'id', 'name', 'vendor', 'category', 'amount', 'currency', 'recurrence',
            'due_date', 'status', 'notes', 'is_overdue', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'is_overdue', 'created_at', 'updated_at']


class PaymentSerializer(serializers.ModelSerializer):
    """A payment received from a school (money in)."""
    class Meta:
        model = Payment
        fields = [
            'id', 'client', 'school_name', 'amount', 'currency', 'plan', 'status',
            'stripe_payment_id', 'received_at', 'note', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def validate(self, attrs):
        # Snapshot the school name from the linked client when not given, so the
        # payment row is still readable if the client is later removed.
        if not attrs.get('school_name') and attrs.get('client'):
            attrs['school_name'] = attrs['client'].name
        return attrs


class TicketReplySerializer(serializers.ModelSerializer):
    class Meta:
        model = TicketReply
        fields = ['id', 'author_type', 'author_name', 'body', 'created_at']
        read_only_fields = ['id', 'created_at']


class SupportTicketListSerializer(serializers.ModelSerializer):
    """Lightweight row for the inbox — no message bodies."""
    reply_count = serializers.IntegerField(source='replies.count', read_only=True)

    class Meta:
        model = SupportTicket
        fields = [
            'id', 'school_name', 'schema_name', 'raised_by_email', 'raised_by_name',
            'raised_by_role', 'subject', 'priority', 'status', 'reply_count',
            'created_at', 'updated_at',
        ]


class SupportTicketDetailSerializer(serializers.ModelSerializer):
    """Full ticket with its thread of replies."""
    replies = TicketReplySerializer(many=True, read_only=True)

    class Meta:
        model = SupportTicket
        fields = [
            'id', 'school_name', 'schema_name', 'raised_by_email', 'raised_by_name',
            'raised_by_role', 'subject', 'body', 'priority', 'status',
            'created_at', 'updated_at', 'replies',
        ]
