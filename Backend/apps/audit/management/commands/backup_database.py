"""
python manage.py backup_database [--output-dir DIR] [--retention-days N] [--dry-run]

Take a compressed, timestamped snapshot of the PostgreSQL database with `pg_dump`
and prune snapshots older than the retention window. Designed to be run on a
schedule (see apps/audit/tasks.py + the Celery beat entry) so the pilot always
has a recent off-the-cuff restore point.

Under django-tenants every school is a separate Postgres schema in the one
database, so a plain `pg_dump <db>` captures the public schema AND every tenant
schema in a single consistent snapshot. (Per-tenant selective backups are a
later, Phase-6 concern — see MULTI_TENANCY_GUIDE.md.)

The dump is streamed straight into a gzip file, so nothing large is held in
memory. The DB password is passed to pg_dump via the PGPASSWORD environment
variable, never on the argv (which would be visible in `ps`).

A restore drill is documented in Guides/Backend/DEPLOYMENT_GUIDE.md — a backup
you have never restored is only a guess.
"""
import gzip
import os
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.audit.services import audit


def default_backup_dir():
    """Where backups land unless overridden — settings.BACKUP_DIR or <BASE_DIR>/backups."""
    return Path(getattr(settings, 'BACKUP_DIR', Path(settings.BASE_DIR) / 'backups'))


def build_dump_command(db):
    """
    Build the pg_dump argv for the given DATABASES['default'] dict.
    The password is NOT included here — it is passed via PGPASSWORD in the env.
    """
    return [
        'pg_dump',
        f'--host={db.get("HOST") or "127.0.0.1"}',
        f'--port={db.get("PORT") or 5432}',
        f'--username={db["USER"]}',
        '--no-password',   # never prompt interactively; rely on PGPASSWORD
        '--no-owner',      # restore under whatever role runs the restore
        '--no-privileges', # skip GRANT/REVOKE — not portable across environments
        db['NAME'],        # dumps all schemas (public + every tenant) in one snapshot
    ]


def prune_old_backups(directory, retention_days, now=None):
    """Delete *.sql.gz files older than retention_days. Returns the deleted paths."""
    now = now or datetime.now(timezone.utc)
    cutoff = now.timestamp() - retention_days * 86400
    deleted = []
    for path in Path(directory).glob('*.sql.gz'):
        if path.stat().st_mtime < cutoff:
            path.unlink()
            deleted.append(path)
    return deleted


class Command(BaseCommand):
    help = 'Create a gzipped pg_dump backup of the database and prune old ones.'

    def add_arguments(self, parser):
        parser.add_argument('--output-dir', help='Directory to write the backup into.')
        parser.add_argument(
            '--retention-days', type=int,
            default=getattr(settings, 'BACKUP_RETENTION_DAYS', 14),
            help='Delete backups older than this many days (default 14).',
        )
        parser.add_argument(
            '--dry-run', action='store_true',
            help='Show what would be done without writing or deleting anything.',
        )

    def handle(self, *args, **options):
        db = settings.DATABASES['default']
        if 'postgresql' not in db['ENGINE']:
            raise CommandError(f'backup_database only supports PostgreSQL (got {db["ENGINE"]}).')

        out_dir = Path(options['output_dir']) if options['output_dir'] else default_backup_dir()
        retention = options['retention_days']
        stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
        target = out_dir / f'imboni-{db["NAME"]}-{stamp}.sql.gz'
        cmd = build_dump_command(db)

        if options['dry_run']:
            self.stdout.write('Dry run: nothing written.')
            self.stdout.write(f'  Would run: {" ".join(cmd)}')
            self.stdout.write(f'  Would write: {target}')
            self.stdout.write(f'  Would prune *.sql.gz older than {retention} days in {out_dir}')
            return

        if not shutil.which('pg_dump'):
            raise CommandError('pg_dump not found on PATH. Install the PostgreSQL client tools.')

        out_dir.mkdir(parents=True, exist_ok=True)

        env = {**os.environ, 'PGPASSWORD': db['PASSWORD']}
        try:
            with gzip.open(target, 'wb') as gz:
                proc = subprocess.run(cmd, stdout=gz, stderr=subprocess.PIPE, env=env, check=False)
        except OSError as exc:
            raise CommandError(f'Failed to run pg_dump: {exc}')

        if proc.returncode != 0:
            # Don't leave a truncated/empty file behind.
            target.unlink(missing_ok=True)
            raise CommandError(f'pg_dump failed: {proc.stderr.decode(errors="replace").strip()}')

        size = target.stat().st_size
        deleted = prune_old_backups(out_dir, retention)

        audit(None, 'database.backup', target=str(target),
              detail={'bytes': size, 'pruned': len(deleted)})

        self.stdout.write(self.style.SUCCESS(
            f'Backup written: {target} ({size:,} bytes). Pruned {len(deleted)} old backup(s).'
        ))
