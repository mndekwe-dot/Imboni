#!/usr/bin/env bash
set -e

# ---------------------------------------------------------------------------
# Wait for Postgres to accept connections before doing anything DB-related.
# ---------------------------------------------------------------------------
DB_HOST="${DATABASE_HOST:-127.0.0.1}"
DB_PORT="${DATABASE_PORT:-5432}"
DB_USER="${DATABASE_USER:-imboni}"

echo "Waiting for Postgres at ${DB_HOST}:${DB_PORT} (user=${DB_USER})..."
tries=0
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" >/dev/null 2>&1; do
    tries=$((tries + 1))
    if [ "$tries" -ge 30 ]; then
        echo "Postgres not reachable after ${tries} attempts; giving up." >&2
        exit 1
    fi
    echo "  Postgres unavailable - attempt ${tries}/30, retrying in 2s..."
    sleep 2
done
echo "Postgres is up."

# ---------------------------------------------------------------------------
# Apply migrations to the shared (public) schema. Tenant schemas come further
# down: they can only be enumerated once this registry exists.
# ---------------------------------------------------------------------------
echo "Running shared migrations..."
python manage.py migrate_schemas --shared

# ---------------------------------------------------------------------------
# Ensure the public tenant and a localhost domain exist (idempotent).
# ---------------------------------------------------------------------------
echo "Ensuring public tenant + localhost domain..."
python manage.py shell -c "
from django_tenants.utils import get_public_schema_name
from apps.tenants.models import Client, Domain

public_schema = get_public_schema_name()
client, created = Client.objects.get_or_create(
    schema_name=public_schema,
    defaults={'name': 'Public', 'on_trial': False},
)
if created:
    print('Created public tenant:', client)
else:
    print('Public tenant already exists:', client)

domain, dcreated = Domain.objects.get_or_create(
    domain='localhost',
    tenant=client,
    defaults={'is_primary': True},
)
if dcreated:
    print('Created localhost domain for public tenant.')
else:
    print('localhost domain already exists.')
"

# ---------------------------------------------------------------------------
# Apply migrations to EVERY school schema.
#
# A tenant schema is migrated once at provisioning time (Client.save() with
# auto_create_schema), and never again on its own. So any migration shipped in
# a TENANT_APPS app would leave every existing school running against stale
# tables until someone remembered to do this by hand. Running it on every boot
# makes a deploy self-healing.
#
# Idempotent: with nothing to apply this is a per-schema no-op, so the worker
# and beat containers (which run this same entrypoint after the backend is
# healthy) just re-confirm the work the backend already did. The cost grows
# with the number of schools, since each one is inspected — if that ever gets
# slow, split it into a one-shot migration container rather than skipping it.
# ---------------------------------------------------------------------------
echo "Running tenant migrations..."
python manage.py migrate_schemas --tenant

# ---------------------------------------------------------------------------
# Hand off to the container command (uvicorn / celery worker / celery beat).
# ---------------------------------------------------------------------------
exec "$@"
