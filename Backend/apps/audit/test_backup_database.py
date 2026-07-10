"""
Tests for the `backup_database` management command.

These cover the pure logic (argv construction, retention pruning, dry-run,
guardrails) without invoking a real `mysqldump` or MySQL server.
"""
from datetime import datetime, timezone, timedelta

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from apps.audit.management.commands.backup_database import (
    build_dump_command, prune_old_backups,
)


class TestBuildDumpCommand:
    def test_includes_connection_flags_but_never_the_password(self):
        db = {
            'NAME': 'imboni', 'USER': 'imboni', 'PASSWORD': 'super-secret',
            'HOST': 'db.internal', 'PORT': 3307,
        }
        cmd = build_dump_command(db)

        assert cmd[0] == 'mysqldump'
        assert '--host=db.internal' in cmd
        assert '--port=3307' in cmd
        assert '--user=imboni' in cmd
        assert cmd[-1] == 'imboni'                       # database name is last
        assert '--single-transaction' in cmd            # consistent InnoDB snapshot
        # The password must never appear on the argv (visible in `ps`).
        assert not any('super-secret' in part for part in cmd)

    def test_defaults_host_and_port_when_absent(self):
        cmd = build_dump_command({'NAME': 'imboni', 'USER': 'u', 'PASSWORD': ''})
        assert '--host=127.0.0.1' in cmd
        assert '--port=3306' in cmd


class TestPruneOldBackups:
    def _touch(self, path, days_old):
        path.write_bytes(b'x')
        ts = (datetime.now(timezone.utc) - timedelta(days=days_old)).timestamp()
        import os
        os.utime(path, (ts, ts))

    def test_deletes_only_files_past_the_retention_window(self, tmp_path):
        old = tmp_path / 'imboni-old.sql.gz'
        recent = tmp_path / 'imboni-recent.sql.gz'
        self._touch(old, days_old=30)
        self._touch(recent, days_old=2)

        deleted = prune_old_backups(tmp_path, retention_days=14)

        assert old in deleted
        assert recent not in deleted
        assert not old.exists()
        assert recent.exists()

    def test_ignores_non_backup_files(self, tmp_path):
        note = tmp_path / 'readme.txt'
        self._touch(note, days_old=90)
        deleted = prune_old_backups(tmp_path, retention_days=14)
        assert deleted == []
        assert note.exists()


@pytest.mark.django_db
class TestBackupCommand:
    def test_dry_run_writes_nothing(self, tmp_path, capsys):
        call_command('backup_database', '--dry-run', '--output-dir', str(tmp_path))
        out = capsys.readouterr().out
        assert 'Dry run' in out
        assert list(tmp_path.glob('*.sql.gz')) == []

    def test_missing_mysqldump_raises_clear_error(self, tmp_path, monkeypatch):
        # Simulate mysqldump not being installed on PATH.
        monkeypatch.setattr(
            'apps.audit.management.commands.backup_database.shutil.which',
            lambda _: None,
        )
        with pytest.raises(CommandError, match='mysqldump not found'):
            call_command('backup_database', '--output-dir', str(tmp_path))
