"""
python manage.py seed_timetable

Creates sample timetable entries for the first teacher in the DB so the
Teacher Timetable page has real data to display.

The command finds whatever SubjectTeacherAssignment rows the teacher already
has and spreads their lessons across Mon-Fri using standard school periods.
"""
from django.core.management.base import BaseCommand
from datetime import time


PERIODS = [
    ('08:00', '09:00'),
    ('09:00', '10:00'),
    ('10:30', '11:30'),
    ('11:30', '12:30'),
    ('13:30', '14:30'),
    ('14:30', '15:30'),
]

DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']

ROOMS = ['Room 101', 'Room 102', 'Room 103', 'Lab 1', 'Room 201', 'Room 202']


class Command(BaseCommand):
    help = 'Seed sample timetable slots for a teacher (--name "First Last" or first teacher)'

    def add_arguments(self, parser):
        parser.add_argument('--name', type=str, help='Full name or part of name to match')

    def handle(self, *args, **options):
        from apps.authentication.models import User
        from apps.results.models import AcademicTerm
        from apps.teacher.models import Timetable, SubjectTeacherAssignment

        term = AcademicTerm.objects.filter(is_current=True).first()
        if not term:
            self.stderr.write('No current academic term. Create one first.')
            return

        name = options.get('name')
        if name:
            parts = name.strip().split()
            qs = User.objects.filter(role='teacher')
            for part in parts:
                qs = qs.filter(first_name__icontains=part) | User.objects.filter(role='teacher', last_name__icontains=part)
            # simpler: search across full name
            qs = User.objects.filter(role='teacher')
            for part in parts:
                qs = qs.filter(first_name__icontains=part) | qs.filter(last_name__icontains=part)
            qs = User.objects.filter(role='teacher')
            teacher = None
            for u in qs:
                if all(p.lower() in u.get_full_name().lower() for p in parts):
                    teacher = u
                    break
            if not teacher:
                self.stderr.write(f'No teacher found matching "{name}".')
                return
        else:
            teacher = User.objects.filter(role='teacher').first()

        if not teacher:
            self.stderr.write('No teacher user found.')
            return

        assignments = list(
            SubjectTeacherAssignment.objects
            .filter(teacher=teacher, term=term)
            .select_related('class_obj', 'subject')
        )

        if not assignments:
            self.stderr.write(
                f'Teacher {teacher.get_full_name()} has no subject assignments for the current term. '
                f'Run seed_assignments first or add SubjectTeacherAssignment rows.'
            )
            return

        self.stdout.write(
            f'Seeding timetable for: {teacher.get_full_name()} '
            f'({len(assignments)} subject assignment(s))'
        )

        # Build a set of already-taken (class_obj_id, day, start_time) slots
        taken = set(
            Timetable.objects.filter(term=term)
            .values_list('class_obj_id', 'day', 'start_time')
        )

        created = 0

        for i, sta in enumerate(assignments):
            lessons_added = 0
            room_idx = i
            # Stagger starting day per assignment so lessons spread across the week
            day_offset = i % len(DAYS)

            for d_idx in range(len(DAYS)):
                if lessons_added >= 2:
                    break
                day = DAYS[(day_offset + d_idx) % len(DAYS)]
                # On the second lesson try a day at least 2 apart
                if lessons_added == 1:
                    day = DAYS[(day_offset + d_idx + 2) % len(DAYS)]

                for period in PERIODS:
                    if lessons_added >= 2:
                        break
                    start = time(*[int(x) for x in period[0].split(':')])
                    end   = time(*[int(x) for x in period[1].split(':')])
                    key   = (sta.class_obj.id, day, start)

                    if key in taken:
                        continue

                    room = ROOMS[room_idx % len(ROOMS)]
                    Timetable.objects.create(
                        teacher     = teacher,
                        class_obj   = sta.class_obj,
                        subject     = sta.subject,
                        term        = term,
                        day         = day,
                        start_time  = start,
                        end_time    = end,
                        room_number = room,
                    )
                    taken.add(key)
                    created += 1
                    lessons_added += 1
                    room_idx += 1
                    self.stdout.write(
                        f'  {day.capitalize()[:3]} {period[0]}-{period[1]}  '
                        f'{sta.subject.name} -> {sta.class_obj.name}  ({room})'
                    )

            if lessons_added == 0:
                self.stdout.write(
                    f'  Skipped {sta.subject.name} ({sta.class_obj.name}): no free slots found'
                )

        self.stdout.write(self.style.SUCCESS(
            f'\nDone. {created} new timetable slot(s) seeded for {teacher.get_full_name()}'
        ))
