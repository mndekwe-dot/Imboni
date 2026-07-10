"""
python manage.py import_timetable <path/to/timetable.csv> [--term-id UUID] [--dry-run]

Bulk-import a class timetable from a CSV so a new school starts with a full
schedule instead of building it slot-by-slot in the DOS portal.

CSV columns (header row required; case-insensitive):
    grade         required — the class's grade (must already exist; run import_classes first)
    section       required — the class's section
    day           required — monday..friday
    start_time    required — HH:MM (24h), e.g. 08:00
    end_time      required — HH:MM
    subject       required — the subject CODE (preferred) or exact name
    teacher_email optional — email of an existing teacher for this period
    room_number   optional

Term: the current AcademicTerm (is_current=True) unless --term-id is given.

Safety:
  * A slot is matched on (class, day, start_time, term) and updated in place, so
    re-importing a corrected sheet won't create duplicates.
  * A teacher already booked for a DIFFERENT class at the same day/time is a
    clash — that row is skipped and reported, never silently double-booked.
  * --dry-run previews everything and writes nothing.
"""
import csv
import io
from datetime import datetime

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.audit.services import audit
from apps.authentication.models import User
from apps.results.models import Subject, AcademicTerm
from apps.teacher.models import Class, Timetable

VALID_DAYS = {'monday', 'tuesday', 'wednesday', 'thursday', 'friday'}


def parse_time(value):
    """Accept '8:00' or '08:00' → a time object, or None if unparseable."""
    value = (value or '').strip()
    for fmt in ('%H:%M', '%H:%M:%S'):
        try:
            return datetime.strptime(value, fmt).time()
        except ValueError:
            continue
    return None


class Command(BaseCommand):
    help = 'Bulk-import a class timetable from a CSV file.'

    def add_arguments(self, parser):
        parser.add_argument('csv_path', help='Path to the timetable CSV file.')
        parser.add_argument('--term-id', help='AcademicTerm id (default: the current term).')
        parser.add_argument('--dry-run', action='store_true',
                            help='Preview without writing anything.')

    def handle(self, *args, **options):
        term = self._resolve_term(options.get('term_id'))
        rows = self._read_rows(options['csv_path'])
        dry_run = options['dry_run']

        created, updated, failed = 0, 0, []
        # Track teacher bookings we've seen this run, so two rows in the same file
        # can't double-book a teacher either.
        seen_teacher_slots = set()

        with transaction.atomic():
            for idx, row in enumerate(rows, start=2):
                parsed = self._parse_row(idx, row, term, seen_teacher_slots)
                if isinstance(parsed, str):
                    failed.append((idx, parsed))
                    continue

                keys, defaults, teacher_slot = parsed
                if teacher_slot:
                    seen_teacher_slots.add(teacher_slot)

                if dry_run:
                    exists = Timetable.objects.filter(**keys).exists()
                    self.stdout.write(f'  row {idx}: would {"update" if exists else "create"} '
                                      f'{keys["class_obj"]} {keys["day"]} {keys["start_time"]}')
                    continue

                _, was_created = Timetable.objects.update_or_create(**keys, defaults=defaults)
                created += was_created
                updated += (not was_created)

        self._report(dry_run, created, updated, failed)

    # ── row parsing ─────────────────────────────────────────────────────────────

    def _parse_row(self, idx, row, term, seen_teacher_slots):
        """Return (keys, defaults, teacher_slot) or an error string."""
        grade = row.get('grade', '').strip()
        section = row.get('section', '').strip().upper()
        day = row.get('day', '').strip().lower()

        if not grade or not section:
            return 'grade and section are required'
        if day not in VALID_DAYS:
            return f'day "{day}" must be one of monday..friday'

        start = parse_time(row.get('start_time'))
        end = parse_time(row.get('end_time'))
        if start is None or end is None:
            return 'start_time and end_time must be HH:MM'
        if end <= start:
            return 'end_time must be after start_time'

        class_obj = Class.objects.filter(grade=grade, section=section).first()
        if class_obj is None:
            return f'class Grade {grade}{section} not found (run import_classes first)'

        subject_key = row.get('subject', '').strip()
        subject = (Subject.objects.filter(code__iexact=subject_key).first()
                   or Subject.objects.filter(name__iexact=subject_key).first())
        if subject is None:
            return f'subject "{subject_key}" not found'

        teacher = None
        teacher_slot = None
        email = row.get('teacher_email', '').strip()
        if email:
            teacher = User.objects.filter(email__iexact=email).first()
            if teacher is None:
                return f'no user with email {email}'
            teacher_slot = (teacher.id, day, start)
            # Clash within this import file
            if teacher_slot in seen_teacher_slots:
                return f'teacher {email} already booked at {day} {start:%H:%M} in this file'
            # Clash with an existing slot for a DIFFERENT class
            clash = (Timetable.objects
                     .filter(teacher=teacher, day=day, start_time=start, term=term)
                     .exclude(class_obj=class_obj).exists())
            if clash:
                return f'teacher {email} already booked at {day} {start:%H:%M} for another class'

        keys = {'class_obj': class_obj, 'day': day, 'start_time': start, 'term': term}
        defaults = {
            'subject': subject,
            'teacher': teacher,
            'end_time': end,
            'room_number': row.get('room_number', '').strip(),
        }
        return keys, defaults, teacher_slot

    # ── helpers ─────────────────────────────────────────────────────────────────

    def _resolve_term(self, term_id):
        if term_id:
            term = AcademicTerm.objects.filter(id=term_id).first()
            if term is None:
                raise CommandError(f'No AcademicTerm with id {term_id}.')
            return term
        term = AcademicTerm.objects.filter(is_current=True).first()
        if term is None:
            raise CommandError(
                'No current AcademicTerm found. Set one as current or pass --term-id.'
            )
        return term

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
            self.stdout.write(self.style.WARNING('Dry run — no changes made.'))
            return
        if created or updated:
            audit(None, 'timetable.imported', target='import_timetable',
                  detail={'created': created, 'updated': updated, 'failed': len(failed)})
        self.stdout.write(self.style.SUCCESS(
            f'Timetable: {created} created, {updated} updated, {len(failed)} skipped.'
        ))
