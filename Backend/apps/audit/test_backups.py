"""
Tests for the backup freshness check: `backups.backup_freshness`, the
`check_backup` command and the hourly Celery task. Files only — no pg_dump,
no database.
"""
import logging
import os
from datetime import datetime, timedelta, timezone

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from apps.audit.backups import backup_freshness, latest_backup
from apps.audit.tasks import check_backup_freshness_task

NOW = datetime(2026, 9, 15, 6, 0, tzinfo=timezone.utc)


def _backup(directory, name, hours_old, now=NOW):
    path = directory / name
    path.write_bytes(b'x')
    ts = (now - timedelta(hours=hours_old)).timestamp()
    os.utime(path, (ts, ts))
    return path


class TestLatestBackup:
    def test_picks_the_newest_by_modification_time(self, tmp_path):
        _backup(tmp_path, 'imboni-a.sql.gz', hours_old=30)
        newest = _backup(tmp_path, 'imboni-b.sql.gz', hours_old=4)
        assert latest_backup(tmp_path) == newest

    def test_ignores_files_that_are_not_backups(self, tmp_path):
        _backup(tmp_path, 'notes.txt', hours_old=1)
        assert latest_backup(tmp_path) is None

    def test_a_missing_directory_is_no_backup_not_a_crash(self, tmp_path):
        assert latest_backup(tmp_path / 'nope') is None


class TestBackupFreshness:
    def test_fresh_backup_is_ok(self, tmp_path):
        _backup(tmp_path, 'imboni-x.sql.gz', hours_old=4)
        status = backup_freshness(tmp_path, max_age_hours=24, now=NOW)
        assert status['ok'] is True
        assert status['age_hours'] == 4
        assert status['detail'] == 'Last backup 4.0 h ago'

    def test_exactly_the_limit_still_counts_as_recent(self, tmp_path):
        _backup(tmp_path, 'imboni-x.sql.gz', hours_old=24)
        assert backup_freshness(tmp_path, max_age_hours=24, now=NOW)['ok'] is True

    def test_past_the_limit_is_stale(self, tmp_path):
        _backup(tmp_path, 'imboni-x.sql.gz', hours_old=24.5)
        status = backup_freshness(tmp_path, max_age_hours=24, now=NOW)
        assert status['ok'] is False
        assert status['detail'] == 'Last backup 24.5 h ago (limit 24 h)'

    def test_no_backup_at_all_is_stale(self, tmp_path):
        status = backup_freshness(tmp_path, max_age_hours=24, now=NOW)
        assert status['ok'] is False
        assert status['path'] is None
        assert 'No backup found' in status['detail']

    def test_limit_defaults_to_the_setting(self, tmp_path, settings):
        settings.BACKUP_MAX_AGE_HOURS = 2
        _backup(tmp_path, 'imboni-x.sql.gz', hours_old=3)
        status = backup_freshness(tmp_path, now=NOW)
        assert status['ok'] is False
        assert status['max_age_hours'] == 2

    def test_directory_defaults_to_backup_dir(self, tmp_path, settings):
        settings.BACKUP_DIR = str(tmp_path)
        path = _backup(tmp_path, 'imboni-x.sql.gz', hours_old=1)
        assert backup_freshness(max_age_hours=24, now=NOW)['path'] == str(path)


class TestCheckBackupCommand:
    def test_passes_on_a_recent_backup(self, tmp_path, capsys):
        _backup(tmp_path, 'imboni-x.sql.gz', hours_old=1, now=datetime.now(timezone.utc))
        call_command('check_backup', '--output-dir', str(tmp_path), '--max-age-hours', '24')
        assert 'Last backup' in capsys.readouterr().out

    def test_fails_on_a_stale_backup(self, tmp_path):
        _backup(tmp_path, 'imboni-x.sql.gz', hours_old=48, now=datetime.now(timezone.utc))
        with pytest.raises(CommandError, match='limit 24 h'):
            call_command('check_backup', '--output-dir', str(tmp_path), '--max-age-hours', '24')

    def test_fails_when_there_is_no_backup(self, tmp_path):
        with pytest.raises(CommandError, match='No backup found'):
            call_command('check_backup', '--output-dir', str(tmp_path))


class TestCheckBackupFreshnessTask:
    def test_logs_an_error_when_stale(self, tmp_path, settings, caplog):
        settings.BACKUP_DIR = str(tmp_path)
        with caplog.at_level(logging.ERROR, logger='apps.audit.tasks'):
            status = check_backup_freshness_task()
        assert status['ok'] is False
        assert 'Database backup is stale' in caplog.text

    def test_stays_quiet_when_fresh(self, tmp_path, settings, caplog):
        settings.BACKUP_DIR = str(tmp_path)
        _backup(tmp_path, 'imboni-x.sql.gz', hours_old=1, now=datetime.now(timezone.utc))
        with caplog.at_level(logging.ERROR, logger='apps.audit.tasks'):
            status = check_backup_freshness_task()
        assert status['ok'] is True
        assert caplog.text == ''
