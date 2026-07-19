"""
python manage.py import_classes <path/to/classes.csv> [--dry-run]

Bulk-create (or update) the school's classes from a CSV, so a new pilot school
can set up its whole class structure in one step instead of adding rows by hand.

CSV columns (header row required; order doesn't matter, case-insensitive):
    grade               required — e.g. 1..6
    section             required — e.g. A/B/C
    name                optional — display name (default "Grade <grade><section>")
    room_number         optional
    max_students        optional — integer (default 40)
    class_teacher_email optional — email of an existing staff user to make class teacher

Re-running is safe: a class is matched on (grade, section) and updated in place,
so you can fix a spreadsheet and re-import without creating duplicates.

Run with --dry-run first to preview what would be created/updated.
"""
import csv
import io

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.audit.services import audit
from apps.authentication.models import User
from apps.teacher.models import Class


class Command(BaseCommand):
    help = 'Bulk-create/update classes from a CSV file.'

    def add_arguments(self, parser):
        parser.add_argument('csv_path', help='Path to the classes CSV file.')
        parser.add_argument('--dry-run', action='store_true',
                            help='Preview without writing anything.')

    def handle(self, *args, **options):
        rows = self._read_rows(options['csv_path'])
        dry_run = options['dry_run']

        created, updated, failed = 0, 0, []

        with transaction.atomic():
            for idx, row in enumerate(rows, start=2):   # row 1 is the header
                grade = row.get('grade', '').strip()
                section = row.get('section', '').strip().upper()

                if not grade or not section:
                    failed.append((idx, 'grade and section are required'))
                    continue

                teacher = None
                email = row.get('class_teacher_email', '').strip()
                if email:
                    teacher = User.objects.filter(email__iexact=email).first()
                    if teacher is None:
                        failed.append((idx, f'no user with email {email}'))
                        continue

                max_students = row.get('max_students', '').strip()
                try:
                    max_students = int(max_students) if max_students else 40
                except ValueError:
                    failed.append((idx, f'max_students "{max_students}" is not a number'))
                    continue

                defaults = {
                    'name': row.get('name', '').strip() or f'Grade {grade}{section}',
                    'room_number': row.get('room_number', '').strip(),
                    'max_students': max_students,
                }
                if teacher is not None:
                    defaults['class_teacher'] = teacher

                existing = Class.objects.filter(grade=grade, section=section).first()
                if dry_run:
                    self.stdout.write(
                        f'  row {idx}: would {"update" if existing else "create"} '
                        f'Grade {grade}{section}'
                    )
                    continue

                _, was_created = Class.objects.update_or_create(
                    grade=grade, section=section, defaults=defaults,
                )
                created += was_created
                updated += (not was_created)

        self._report(dry_run, created, updated, failed)

    def _read_rows(self, path):
        try:
            with open(path, encoding='utf-8-sig') as fh:
                content = fh.read()
        except FileNotFoundError:
            raise CommandError(f'File not found: {path}')
        except UnicodeDecodeError:
            raise CommandError('File must be UTF-8. Save the spreadsheet as CSV UTF-8.')

        reader = csv.DictReader(io.StringIO(content))
        reader.fieldnames = [h.strip().lower() for h in (reader.fieldnames or [])]
        return list(reader)

    def _report(self, dry_run, created, updated, failed):
        for idx, reason in failed:
            self.stdout.write(self.style.WARNING(f'  row {idx} skipped: {reason}'))
        if dry_run:
            self.stdout.write(self.style.WARNING('Dry run: no changes made.'))
            return
        if created or updated:
            audit(None, 'classes.imported', target='import_classes',
                  detail={'created': created, 'updated': updated, 'failed': len(failed)})
        self.stdout.write(self.style.SUCCESS(
            f'Classes: {created} created, {updated} updated, {len(failed)} skipped.'
        ))
