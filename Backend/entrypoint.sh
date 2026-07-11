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
# Apply migrations to the shared (public) schema.
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
# Hand off to the container command (gunicorn / celery worker / celery beat).
# ---------------------------------------------------------------------------
exec "$@"
