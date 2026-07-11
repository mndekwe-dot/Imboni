"""
Serializers for the platform super-admin API (Phase 5).

These serialize the tenant-registry models (``Client`` and ``Domain``) which
live ONLY in the public schema. They are consumed by the vendor-facing views in
``apps.tenants.views`` and are not exposed inside any per-school schema.
"""
from rest_framework import serializers

from .models import Client, Domain


class ClientSerializer(serializers.ModelSerializer):
    """
    A school (tenant) as seen by the platform vendor.

    ``schema_name`` and ``created_on`` are read-only: the Postgres schema is
    created once, at provisioning time, by the ``provision_school`` management
    command — it must never change afterwards (renaming a live schema would
    orphan every school's data). Editable operational fields (plan, status,
    paid_until, on_trial) may be updated by the platform admin.
    """
    class Meta:
        model = Client
        fields = [
            'id',
            'name',
            'schema_name',
            'plan',
            'status',
            'paid_until',
            'on_trial',
            'created_on',
        ]
        read_only_fields = ['id', 'schema_name', 'created_on']


class DomainSerializer(serializers.ModelSerializer):
    """A domain/subdomain that routes to a given tenant schema."""
    class Meta:
        model = Domain
        fields = ['id', 'domain', 'tenant', 'is_primary']
