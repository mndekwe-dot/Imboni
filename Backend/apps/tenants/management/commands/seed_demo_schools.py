"""
Populate demo tenants with realistic, per-school mock data.

    python manage.py seed_demo_schools                  # every profiled school
    python manage.py seed_demo_schools --schema school1 # just one
    python manage.py seed_demo_schools --list           # show profiles, seed nothing
    python manage.py seed_demo_schools --clear          # wipe seeded rows first

How this differs from `seed_all`
--------------------------------
`seed_all` seeds ONE school from hardcoded literals, so running it in every
tenant produces six identical copies of "Imboni School". This command drives
off `apps/tenants/school_profiles.py` instead: each tenant gets its own name,
size, year range, gender mix, boarding arrangement and subject emphasis, so the
subdomains read as six different institutions. It also fills the models added
after `seed_all` was written — Dormitory/DormRoom, TimetablePeriod, DutyPost,
DiningSitting and the subject scheduling weights — which the DOS auto-generator
screens need in order to show anything at all.

Determinism and idempotency
---------------------------
Every school's RNG is seeded from its schema name, so a given profile always
produces the same roster; re-running never reshuffles who is in which class.
Writes are either `get_or_create` or `bulk_create(ignore_conflicts=True)` keyed
on each model's natural key, so the command is safe to run repeatedly.

Two consequences of using bulk_create are worth knowing: it bypasses
`Model.save()`, so `Result.final_score`/`grade` and `Assessment.percentage` are
computed explicitly below rather than by the model; and it needs a real unique
constraint to conflict against, so models without one (Assessment, Fee,
BehaviorReport) are guarded by an existence check instead.
"""
import random
from datetime import date, time, timedelta

from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import make_password
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from django_tenants.utils import schema_context, get_public_schema_name

from apps.tenants.school_profiles import (
    SCHOOL_PROFILES, SUBJECT_CATALOGUE, CORE_SUBJECTS,
    FEMALE_NAMES, MALE_NAMES, SURNAMES, profile_for,
)

User = get_user_model()

# Shared demo password. Hashed ONCE per run and assigned directly to every
# generated user — PBKDF2 costs ~100ms, so hashing per user would add minutes
# to a full six-school seed for no benefit when the password is identical.
DEMO_PASSWORD = 'Imboni@2026'

YEAR = 2026
WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']

# Bell schedule. is_break periods are not schedulable — the timetable generator
# skips them, which is what produces a realistic mid-morning and lunch gap.
BELL_SCHEDULE = [
    (1, 'Period 1',   time(7, 30),  time(8, 20),  False),
    (2, 'Period 2',   time(8, 20),  time(9, 10),  False),
    (3, 'Period 3',   time(9, 10),  time(10, 0),  False),
    (4, 'Break',      time(10, 0),  time(10, 20), True),
    (5, 'Period 4',   time(10, 20), time(11, 10), False),
    (6, 'Period 5',   time(11, 10), time(12, 0),  False),
    (7, 'Lunch',      time(12, 0),  time(13, 0),  True),
    (8, 'Period 6',   time(13, 0),  time(13, 50), False),
    (9, 'Period 7',   time(13, 50), time(14, 40), False),
]

DUTY_POSTS = [
    ('Morning Gate Duty',   1, time(6, 45),  time(7, 30),  1),
    ('Break Supervision',   2, time(10, 0),  time(10, 20), 2),
    ('Dining Hall Duty',    3, time(12, 0),  time(13, 0),  2),
    ('Evening Prep',        4, time(18, 0),  time(20, 0),  2),
    ('Night Rounds',        5, time(21, 0),  time(22, 0),  1),
]

DINING_SITTINGS = [
    ('First Sitting',  'lunch',     1, time(12, 0),  time(12, 30)),
    ('Second Sitting', 'lunch',     2, time(12, 30), time(13, 0)),
    ('Breakfast',      'breakfast', 0, time(6, 30),  time(7, 15)),
    ('Supper',         'supper',    3, time(19, 0),  time(19, 45)),
]

ACTIVITIES = [
    ('Football Club',      'sport',      'Main Pitch',      'Tue & Thu, 16:00'),
    ('Basketball Team',    'sport',      'Court A',         'Mon & Wed, 16:00'),
    ('Debate Society',     'debate',     'Room 12',         'Friday, 15:00'),
    ('Science Club',       'science',    'Physics Lab',     'Wednesday, 16:00'),
    ('Traditional Dance',  'music',      'School Hall',     'Saturday, 10:00'),
    ('Community Outreach', 'community',  'Off Campus',      'Last Saturday'),
    ('Choir',              'music',      'Chapel',          'Sunday, 14:00'),
    ('Chess Club',         'other',      'Library',         'Thursday, 16:00'),
]

# Templates rendered per school, so each one's noticeboard talks about itself.
ANNOUNCEMENT_TEMPLATES = [
    ('Term 2 Examination Timetable',
     'The Term 2 examination timetable for {name} has been published. Students '
     'should report to their examination rooms 20 minutes before each paper. '
     'Any clash must be reported to the Director of Studies immediately.',
     'academic', 'all'),
    ('Parents Meeting, 25 April',
     'Parents and guardians of {name} students are invited to the termly '
     'parents meeting on 25 April at 10:00 in the school hall. Class teachers '
     'will be available to discuss individual progress.',
     'general', 'parents'),
    ('School Fees, Term 2',
     'All Term 2 fees must be cleared before the start of end-of-term '
     'examinations. Statements have been sent to registered parent contacts. '
     'Contact the bursar for a payment plan if needed.',
     'urgent', 'parents'),
    ('{short} Sports Day',
     'The annual {short} Sports Day will be held on 20 May. All houses are '
     'expected to field teams in athletics, football and volleyball. Parents '
     'are warmly invited to attend.',
     'event', 'all'),
    ('Library Opening Hours Extended',
     'The library will stay open until 18:00 on weekdays for the remainder of '
     'the term to support revision. Students must sign the register on entry.',
     'academic', 'students'),
    ('Staff Briefing, Monday',
     'All teaching staff are reminded of the briefing on Monday at 07:00 in '
     'the staff room. Marks for continuous assessment are due the same day.',
     'general', 'teachers'),
]


class Command(BaseCommand):
    help = 'Seed profiled demo tenants with distinct, realistic school data.'

    def add_arguments(self, parser):
        parser.add_argument('--schema', action='append', dest='schemas',
                            help='Seed only this schema (repeatable).')
        parser.add_argument('--clear', action='store_true',
                            help='Delete existing per-school data before seeding.')
        parser.add_argument('--list', action='store_true', dest='list_only',
                            help='List the available profiles and exit.')

    def handle(self, *args, **options):
        if options['list_only']:
            self._list_profiles()
            return

        profiles = SCHOOL_PROFILES
        if options['schemas']:
            profiles = []
            for schema in options['schemas']:
                profile = profile_for(schema)
                if profile is None:
                    raise CommandError(
                        f'No profile for schema "{schema}". '
                        f'Run --list to see the available profiles.'
                    )
                profiles.append(profile)

        password_hash = make_password(DEMO_PASSWORD)
        missing = self._check_schemas_exist(profiles)

        for profile in profiles:
            if profile['schema'] in missing:
                self.stdout.write(self.style.WARNING(
                    f"Skipping {profile['schema']}: no such tenant. Provision it "
                    f"first with `manage.py provision_school --subdomain "
                    f"{profile['schema']} ...`"
                ))
                continue
            self._seed_school(profile, password_hash, clear=options['clear'])

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(
            f'Done. Sign in to any school with password: {DEMO_PASSWORD}'
        ))

    # ── helpers ───────────────────────────────────────────────────────────────

    def _list_profiles(self):
        self.stdout.write(self.style.MIGRATE_HEADING('Available school profiles'))
        for p in SCHOOL_PROFILES:
            classes = sum(len(s) for s in p['streams'].values())
            students = classes * p['class_size']
            boarding = 'day school' if p['boarding'] == 0 else f"{int(p['boarding'] * 100)}% boarding"
            self.stdout.write(
                f"  {p['schema']:<14} {p['name']:<34} "
                f"{classes:>2} classes, ~{students:>3} students, "
                f"{p['gender']}, {boarding}"
            )

    def _check_schemas_exist(self, profiles):
        """Return the set of profile schemas that have no tenant row."""
        from apps.tenants.models import Client
        wanted = {p['schema'] for p in profiles}
        with schema_context(get_public_schema_name()):
            live = set(Client.objects.filter(schema_name__in=wanted)
                       .values_list('schema_name', flat=True))
        return wanted - live

    def _seed_school(self, profile, password_hash, clear=False):
        schema = profile['schema']
        self.stdout.write('')
        self.stdout.write(self.style.MIGRATE_HEADING(
            f"── {profile['name']} ({schema}) ──"
        ))

        # The Client row lives in the public schema, so its identity is updated
        # outside the per-school context below.
        self._update_client(profile)

        with schema_context(schema):
            with transaction.atomic():
                if clear:
                    self._clear(schema)
                ctx = {
                    'profile': profile,
                    'hash': password_hash,
                    # Every section draws from its OWN stream, seeded from the
                    # schema name and the section name.
                    #
                    # A single shared RNG makes the output depend on which
                    # sections ran: the guarded ones (assessments, fees) return
                    # early when their data already exists, consume no
                    # randomness, and shift every later section onto different
                    # values. That is not hypothetical — it made a re-run sample
                    # a different 20% of students in _conduct and create a
                    # second batch of behaviour reports. Independent streams
                    # keep each section reproducible regardless of what ran
                    # before it.
                    'rng_for': lambda name: random.Random(f'{schema}:{name}'),
                }
                ctx['terms'] = self._terms()
                ctx['term'] = ctx['terms']['term2']
                ctx['subjects'] = self._subjects(profile)
                self._school_settings(profile)
                ctx['staff'] = self._staff(profile, password_hash)
                ctx['classes'] = self._classes(profile, ctx['staff'])
                ctx['students'] = self._students(ctx)
                self._parents(ctx)
                self._class_assignments(ctx)
                ctx['assignments'] = self._teaching_assignments(ctx)
                self._periods()
                self._timetable(ctx)
                self._boarding(ctx)
                self._duties(ctx)
                self._dining(ctx)
                self._results(ctx)
                self._assessments(ctx)
                self._attendance(ctx)
                self._conduct(ctx)
                self._announcements(ctx)
                self._leaders(ctx)
                self._activities(ctx)
                self._fees(ctx)

    def _update_client(self, profile):
        from apps.tenants.models import Client
        with schema_context(get_public_schema_name()):
            Client.objects.filter(schema_name=profile['schema']).update(
                name=profile['name'],
                plan=profile['plan'],
                status=profile['status'],
                on_trial=profile['status'] == 'trial',
            )

    def _clear(self, schema):
        """Delete generated rows. Order matters — children before parents."""
        from apps.announcements.models import Announcement
        from apps.attendance.models import AttendanceRecord, AttendanceSummary
        from apps.behavior.models import BehaviorReport, ConductGrade
        from apps.discipline.models import (
            BoardingStudent, DiningPlan, Dormitory, DormRoom, DisciplineStaff,
            StudentLeader,
        )
        from apps.dos.models import (
            DiningAssignment, DiningSitting, DutyAssignment, DutyPost,
            TimetablePeriod,
        )
        from apps.parents.models import ParentStudentRelationship
        from apps.results.models import Assessment, Result
        from apps.student.models import (
            Activity, ActivityEnrollment, Fee, Student,
        )
        from apps.teacher.models import (
            Class, ClassAssignment, SubjectTeacherAssignment, Timetable,
        )

        for model in (
            AttendanceRecord, AttendanceSummary, Assessment, Result,
            BehaviorReport, ConductGrade, ActivityEnrollment, Activity, Fee,
            DiningAssignment, DiningSitting, DutyAssignment, DutyPost,
            DiningPlan, BoardingStudent, DormRoom, Dormitory, StudentLeader,
            DisciplineStaff, Timetable, TimetablePeriod,
            SubjectTeacherAssignment, ClassAssignment,
            ParentStudentRelationship, Announcement, Student, Class,
        ):
            model.objects.all().delete()
        # Keep superusers (the provisioned school admin) so the login still works.
        User.objects.filter(is_superuser=False).delete()
        self.stdout.write('  cleared existing data')

    # ── generators ────────────────────────────────────────────────────────────

    def _terms(self):
        from apps.results.models import AcademicTerm
        spec = [
            ('term1', 1, f'Term 1 {YEAR}', date(YEAR, 1, 5),  date(YEAR, 3, 27), False),
            ('term2', 2, f'Term 2 {YEAR}', date(YEAR, 4, 28), date(YEAR, 7, 24), True),
            ('term3', 3, f'Term 3 {YEAR}', date(YEAR, 9, 7),  date(YEAR, 12, 4), False),
        ]
        terms = {}
        for code, order, name, start, end, current in spec:
            term, _ = AcademicTerm.objects.get_or_create(
                term=code, year=YEAR,
                defaults={'name': name, 'order': order, 'start_date': start,
                          'end_date': end, 'is_current': current},
            )
            terms[code] = term
        AcademicTerm.objects.exclude(pk=terms['term2'].pk).update(is_current=False)
        AcademicTerm.objects.filter(pk=terms['term2'].pk).update(is_current=True)
        return terms

    def _subjects(self, profile):
        from apps.results.models import Subject
        codes = CORE_SUBJECTS + [c for c in profile['extra_subjects']
                                 if c not in CORE_SUBJECTS]
        subjects = {}
        for code in codes:
            name, category, exam_w, tt_w = SUBJECT_CATALOGUE[code]
            subject, _ = Subject.objects.get_or_create(
                code=code,
                defaults={'name': name, 'category': category,
                          'exam_weight': exam_w, 'timetable_weight': tt_w},
            )
            subjects[code] = subject
        self.stdout.write(f'  {len(subjects)} subjects')
        return subjects

    def _school_settings(self, profile):
        from apps.dos.models import SchoolSection, SchoolSetting

        o_years = [y for y in profile['years'] if y in ('S1', 'S2', 'S3')]
        a_years = [y for y in profile['years'] if y in ('S4', 'S5', 'S6')]
        SchoolSection.objects.all().delete()
        for label, years in (('O-Level', o_years), ('A-Level', a_years)):
            if not years:
                continue
            SchoolSection.objects.create(
                name=label,
                years=[{'name': y, 'streams': profile['streams'][y]}
                       for y in years],
            )

        setting = SchoolSetting.get_setting()
        setting.school_name = profile['name']
        setting.timezone = 'Africa/Kigali'
        setting.save()

    def _staff(self, profile, password_hash):
        """Create leadership + teaching staff. Returns {'role': [users]}."""
        rng = random.Random(profile['schema'] + ':staff')
        domain = profile['domain']
        specs = [
            ('admin', 'Head Teacher'),
            ('dos', 'Director of Studies'),
            ('discipline', 'Director of Discipline'),
            ('matron', 'Head Matron'),
        ]
        rows = []
        used = set()

        def make(role, gender_pool):
            first = rng.choice(gender_pool)
            last = rng.choice(SURNAMES)
            email = f'{first[0].lower()}.{last.lower()}@{domain}'
            n = 2
            while email in used:
                email = f'{first[0].lower()}{n}.{last.lower()}@{domain}'
                n += 1
            used.add(email)
            return {'role': role, 'first': first, 'last': last, 'email': email}

        for role, _title in specs:
            pool = FEMALE_NAMES if role == 'matron' else (MALE_NAMES + FEMALE_NAMES)
            rows.append(make(role, pool))
        for _ in range(profile['teachers']):
            rows.append(make('teacher', MALE_NAMES + FEMALE_NAMES))

        users = self._ensure_users(rows, password_hash, employment='full_time')

        by_role = {}
        for row in rows:
            by_role.setdefault(row['role'], []).append(users[row['email']])

        # Discipline portal staff records.
        from apps.discipline.models import DisciplineStaff
        for user, staff_type in ((by_role['discipline'][0], 'director'),
                                 (by_role['matron'][0], 'head_matron')):
            DisciplineStaff.objects.get_or_create(
                user=user, defaults={'staff_type': staff_type,
                                     'assigned_grade': 'all'})

        self.stdout.write(f"  {len(rows)} staff ({len(by_role['teacher'])} teachers)")
        return by_role

    def _ensure_users(self, rows, password_hash, employment=''):
        """
        Create any users in `rows` that don't exist yet, then return
        {email: User} for all of them.

        Split into "look up what exists" and "bulk_create the rest" so a re-run
        keeps the ORIGINAL rows (and therefore every foreign key pointing at
        them) instead of trying to replace them.
        """
        emails = [r['email'] for r in rows]
        existing = set(User.objects.filter(email__in=emails)
                       .values_list('email', flat=True))
        to_create = [
            User(username=r['email'], email=r['email'], first_name=r['first'],
                 last_name=r['last'], role=r['role'], password=password_hash,
                 employment_type=employment if r['role'] == 'teacher' else '',
                 phone_number=r.get('phone', ''), is_active=True,
                 email_verified=True,
                 is_staff=r['role'] == 'admin', is_superuser=False)
            for r in rows if r['email'] not in existing
        ]
        if to_create:
            User.objects.bulk_create(to_create, ignore_conflicts=True)
        return {u.email: u for u in User.objects.filter(email__in=emails)}

    def _classes(self, profile, staff):
        from apps.teacher.models import Class
        teachers = staff['teacher']
        classes = {}
        i = 0
        for year in profile['years']:
            for stream in profile['streams'][year]:
                name = f'{year}{stream}'
                cls, _ = Class.objects.get_or_create(
                    grade=year, section=stream,
                    defaults={'name': name,
                              'class_teacher': teachers[i % len(teachers)],
                              'max_students': profile['class_size'] + 8,
                              'room_number': f'Room {100 + i}'},
                )
                classes[name] = cls
                i += 1
        self.stdout.write(f'  {len(classes)} classes')
        return classes

    def _students(self, ctx):
        """Generate the roster. Returns {class_name: [Student, ...]}."""
        from apps.student.models import Student
        profile, rng = ctx['profile'], ctx['rng_for']('students')

        if profile['gender'] == 'girls':
            name_pool = [(n, 'F') for n in FEMALE_NAMES]
        elif profile['gender'] == 'boys':
            name_pool = [(n, 'M') for n in MALE_NAMES]
        else:
            name_pool = ([(n, 'F') for n in FEMALE_NAMES]
                         + [(n, 'M') for n in MALE_NAMES])

        rows, meta, used = [], [], set()
        counter = 0
        for class_name, cls in ctx['classes'].items():
            for _ in range(profile['class_size']):
                counter += 1
                first, gender = rng.choice(name_pool)
                last = rng.choice(SURNAMES)
                email = f'{first[0].lower()}.{last.lower()}{counter}@{profile["domain"]}'
                while email in used:
                    counter += 1
                    email = f'{first[0].lower()}.{last.lower()}{counter}@{profile["domain"]}'
                used.add(email)
                rows.append({'role': 'student', 'first': first, 'last': last,
                             'email': email,
                             'phone': f'+2507880{counter:05d}'})
                meta.append({
                    'email': email, 'class_name': class_name, 'cls': cls,
                    'gender': gender, 'last': last, 'first': first,
                    'student_id': f'{profile["short"]}-{YEAR}-{counter:04d}',
                    'grade': cls.grade, 'section': cls.section,
                })

        users = self._ensure_users(rows, ctx['hash'])

        existing_ids = set(Student.objects.values_list('student_id', flat=True))
        to_create = []
        for m in meta:
            if m['student_id'] in existing_ids:
                continue
            gpa = round(rng.uniform(1.8, 4.0), 2)
            to_create.append(Student(
                user=users[m['email']], student_id=m['student_id'],
                grade=m['grade'], section=m['section'], status='active',
                current_gpa=gpa,
                attendance_percentage=round(rng.uniform(82, 100), 2),
                enrollment_date=date(YEAR, 1, 5),
                blood_group=rng.choice(['A+', 'O+', 'B+', 'AB+', 'O-', '']),
            ))
        if to_create:
            Student.objects.bulk_create(to_create, ignore_conflicts=True)

        by_id = {s.student_id: s for s in
                 Student.objects.select_related('user')
                 .filter(student_id__in=[m['student_id'] for m in meta])}
        roster = {}
        for m in meta:
            student = by_id.get(m['student_id'])
            if student is None:
                continue
            student._gender = m['gender']       # used by dormitory assignment
            student._family = m['last']
            roster.setdefault(m['class_name'], []).append(student)

        total = sum(len(v) for v in roster.values())
        self.stdout.write(f'  {total} students')
        ctx['all_students'] = [s for v in roster.values() for s in v]
        return roster

    def _parents(self, ctx):
        """One parent per third student, sharing the child's family name."""
        from apps.parents.models import ParentStudentRelationship
        # Parents get ordinary consumer email addresses, not a school domain,
        # so this section needs no profile.
        rng = ctx['rng_for']('parents')
        students = ctx['all_students'][::3]

        rows, links = [], []
        for i, student in enumerate(students):
            is_mother = i % 2 == 0
            first = rng.choice(FEMALE_NAMES if is_mother else MALE_NAMES)
            last = student._family
            email = f'{first.lower()}.{last.lower()}{i}@gmail.com'
            rows.append({'role': 'parent', 'first': first, 'last': last,
                         'email': email, 'phone': f'+2507881{i:05d}'})
            links.append((email, student, 'mother' if is_mother else 'father'))

        users = self._ensure_users(rows, ctx['hash'])
        for email, student, rel in links:
            parent = users.get(email)
            if parent:
                ParentStudentRelationship.objects.get_or_create(
                    parent=parent, student=student,
                    defaults={'relationship_type': rel,
                              'is_primary_contact': True},
                )
        self.stdout.write(f'  {len(links)} parents linked')

    def _class_assignments(self, ctx):
        from apps.teacher.models import ClassAssignment
        rows = [
            ClassAssignment(class_obj=ctx['classes'][name], student=student,
                            term=ctx['term'])
            for name, students in ctx['students'].items()
            for student in students
        ]
        ClassAssignment.objects.bulk_create(rows, ignore_conflicts=True)

    def _teaching_assignments(self, ctx):
        """
        Spread subjects across teachers so each teacher owns a coherent set
        rather than a random scatter: teacher i takes subject i for every class
        that teaches it.
        """
        from apps.teacher.models import SubjectTeacherAssignment
        teachers = ctx['staff']['teacher']
        subjects = list(ctx['subjects'].values())

        rows = []
        for s_idx, subject in enumerate(subjects):
            for c_idx, cls in enumerate(ctx['classes'].values()):
                teacher = teachers[(s_idx + c_idx // 4) % len(teachers)]
                rows.append(SubjectTeacherAssignment(
                    teacher=teacher, subject=subject, class_obj=cls,
                    term=ctx['term'],
                    # Heavier subjects get more contact time; the DOS timetable
                    # generator reads this field.
                    periods_per_week=max(2, subject.timetable_weight // 2),
                ))
        SubjectTeacherAssignment.objects.bulk_create(rows, ignore_conflicts=True)
        self.stdout.write(f'  {len(rows)} teaching assignments')
        return SubjectTeacherAssignment.objects.select_related(
            'subject', 'teacher', 'class_obj').filter(term=ctx['term'])

    def _periods(self):
        from apps.dos.models import TimetablePeriod
        for order, label, start, end, is_break in BELL_SCHEDULE:
            TimetablePeriod.objects.get_or_create(
                order=order,
                defaults={'label': label, 'start_time': start,
                          'end_time': end, 'is_break': is_break},
            )

    def _timetable(self, ctx):
        from apps.teacher.models import Timetable
        teachable = [p for p in BELL_SCHEDULE if not p[4]]
        by_class = {}
        for assignment in ctx['assignments']:
            by_class.setdefault(assignment.class_obj_id, []).append(assignment)

        rows = []
        for cls in ctx['classes'].values():
            pool = by_class.get(cls.id, [])
            if not pool:
                continue
            slot = 0
            for day in WEEKDAYS:
                for _order, _label, start, end, _brk in teachable:
                    assignment = pool[slot % len(pool)]
                    slot += 1
                    rows.append(Timetable(
                        class_obj=cls, subject=assignment.subject,
                        teacher=assignment.teacher, term=ctx['term'],
                        day=day, start_time=start, end_time=end,
                        room_number=cls.room_number or 'Room 101',
                    ))
        Timetable.objects.bulk_create(rows, ignore_conflicts=True)
        self.stdout.write(f'  {len(rows)} timetable slots')

    def _boarding(self, ctx):
        """Dormitories, rooms, boarders and dining plans. Skipped for day schools."""
        from apps.discipline.models import (
            BoardingStudent, DiningPlan, DisFacility, DisFacilitySection,
            Dormitory, DormRoom,
        )
        profile, rng = ctx['profile'], ctx['rng_for']('boarding')
        if not profile['dormitories']:
            # A day school still needs dining plans for the matron screens.
            DiningPlan.objects.bulk_create(
                [DiningPlan(student=s, term=ctx['term'], plan_type='day_scholar')
                 for s in ctx['all_students']],
                ignore_conflicts=True,
            )
            self.stdout.write('  day school — no dormitories')
            return

        section, _ = DisFacilitySection.objects.get_or_create(
            name='Boarding Wing', defaults={'gender': 'mixed'})

        dorms, rooms = {}, []
        for dorm_name, gender in profile['dormitories']:
            dorm, _ = Dormitory.objects.get_or_create(
                name=dorm_name, defaults={'gender': gender})
            dorms[dorm_name] = (dorm, gender)
            for floor in (1, 2):
                for number in range(1, 7):
                    rooms.append(DormRoom(dormitory=dorm,
                                          room_number=f'{floor}{number:02d}',
                                          bed_capacity=6))
            DisFacility.objects.get_or_create(
                name=dorm_name,
                defaults={'facility_type': 'dormitory', 'gender': gender,
                          'section': section, 'capacity': 72},
            )
        DormRoom.objects.bulk_create(rooms, ignore_conflicts=True)

        for name, kind in (('Main Dining Hall', 'dining_hall'),
                           ('School Library', 'library'),
                           ('Sick Bay', 'medical')):
            DisFacility.objects.get_or_create(
                name=name, defaults={'facility_type': kind, 'gender': 'mixed'})

        # Boarders go to a dormitory matching their gender.
        by_gender = {'M': [], 'F': []}
        for dorm_name, (dorm, gender) in dorms.items():
            if gender == 'boys':
                by_gender['M'].append(dorm_name)
            elif gender == 'girls':
                by_gender['F'].append(dorm_name)
            else:
                by_gender['M'].append(dorm_name)
                by_gender['F'].append(dorm_name)

        boarders = 0
        plans = []
        for i, student in enumerate(ctx['all_students']):
            boards = rng.random() < profile['boarding']
            gender = getattr(student, '_gender', 'M')
            options = by_gender.get(gender) or by_gender['M'] or by_gender['F']
            if boards and options:
                dorm_name = options[i % len(options)]
                BoardingStudent.objects.get_or_create(
                    student=student,
                    defaults={
                        'dormitory': dorm_name,
                        'room_number': f'{(i % 2) + 1}{(i % 6) + 1:02d}',
                        'bed_number': str((i % 6) + 1),
                        'boarding_type': 'full_boarder',
                        'check_in_date': date(YEAR, 1, 5),
                    },
                )
                boarders += 1
                plans.append(DiningPlan(student=student, term=ctx['term'],
                                        plan_type='full_board'))
            else:
                plans.append(DiningPlan(student=student, term=ctx['term'],
                                        plan_type='day_scholar'))
        DiningPlan.objects.bulk_create(plans, ignore_conflicts=True)
        self.stdout.write(f'  {len(dorms)} dormitories, {boarders} boarders')

    def _duties(self, ctx):
        from apps.dos.models import DutyAssignment, DutyPost
        staff = ctx['staff']['teacher'] + ctx['staff']['matron'] + ctx['staff']['discipline']
        posts = []
        for name, order, start, end, required in DUTY_POSTS:
            post, _ = DutyPost.objects.get_or_create(
                name=name,
                defaults={'order': order, 'start_time': start,
                          'end_time': end, 'staff_required': required},
            )
            posts.append(post)

        rows, i = [], 0
        for post in posts:
            for day in WEEKDAYS:
                for _ in range(post.staff_required):
                    rows.append(DutyAssignment(post=post, term=ctx['term'],
                                               day=day, staff=staff[i % len(staff)]))
                    i += 1
        DutyAssignment.objects.bulk_create(rows, ignore_conflicts=True)
        self.stdout.write(f'  {len(posts)} duty posts, {len(rows)} duty slots')

    def _dining(self, ctx):
        from apps.dos.models import DiningAssignment, DiningSitting
        profile = ctx['profile']
        capacity = max(60, profile['class_size'] * 4)
        sittings = []
        for name, meal, order, start, end in DINING_SITTINGS:
            sitting, _ = DiningSitting.objects.get_or_create(
                name=name, meal=meal,
                defaults={'order': order, 'start_time': start,
                          'end_time': end, 'capacity': capacity},
            )
            sittings.append(sitting)

        lunch = [s for s in sittings if s.meal == 'lunch']
        rows = [
            DiningAssignment(sitting=lunch[i % len(lunch)], term=ctx['term'],
                             class_obj=cls)
            for i, cls in enumerate(ctx['classes'].values())
        ]
        DiningAssignment.objects.bulk_create(rows, ignore_conflicts=True)

    def _results(self, ctx):
        """
        Marks for the current term. final_score and grade are computed here
        because bulk_create does not call Result.save().
        """
        from apps.results.models import Result
        rng = ctx['rng_for']('results')
        dos = ctx['staff']['dos'][0]
        subject_teacher = {}
        for assignment in ctx['assignments']:
            subject_teacher.setdefault(assignment.subject_id, assignment.teacher)

        comments_good = ['Excellent work this term.', 'Very strong performance.',
                         'Consistently well prepared.', 'A pleasure to teach.']
        comments_mid = ['Steady progress. Keep working.', 'Satisfactory effort.',
                        'Capable of more with regular revision.']
        comments_low = ['Needs significant support.', 'Must attend remedial classes.',
                        'Struggling with the fundamentals.']

        rows = []
        for student in ctx['all_students']:
            ability = float(student.current_gpa or 3.0) / 4.0
            for subject in ctx['subjects'].values():
                noise = rng.uniform(-0.14, 0.14)
                ratio = min(0.99, max(0.25, ability + noise))
                class_test = round(30 * ratio, 2)
                exam = round(70 * ratio, 2)
                final = class_test + exam
                if final >= 90:
                    grade = 'A'
                elif final >= 80:
                    grade = 'B'
                elif final >= 70:
                    grade = 'C'
                elif final >= 60:
                    grade = 'D'
                else:
                    grade = 'F'
                if final >= 75:
                    comment = rng.choice(comments_good)
                elif final >= 55:
                    comment = rng.choice(comments_mid)
                else:
                    comment = rng.choice(comments_low)

                # Most marks are approved; a slice is left mid-workflow so the
                # DOS approval queue and the teacher's rejected list aren't empty.
                roll = rng.random()
                status = 'approved' if roll < 0.75 else ('submitted' if roll < 0.95 else 'rejected')
                rows.append(Result(
                    student=student, subject=subject, term=ctx['term'],
                    teacher=subject_teacher.get(subject.id),
                    class_test_marks=class_test, exam_score=exam,
                    final_score=final, grade=grade,
                    teacher_comment=comment, status=status,
                    submitted_at=timezone.now(),
                    dos_comment='Reviewed and approved.' if status == 'approved' else '',
                    approved_by=dos if status == 'approved' else None,
                    approved_at=timezone.now() if status == 'approved' else None,
                    rejection_reason=('Marks do not match the class register. '
                                      'Please recheck and resubmit.')
                                     if status == 'rejected' else '',
                ))
        Result.objects.bulk_create(rows, ignore_conflicts=True)
        self.stdout.write(f'  {len(rows)} results')

    def _assessments(self, ctx):
        """Continuous assessment. Guarded by existence — Assessment has no unique key."""
        from apps.results.models import Assessment
        if Assessment.objects.filter(term=ctx['term']).exists():
            return
        rng = ctx['rng_for']('assessments')
        titles = [
            ('quiz', 'Class Quiz'), ('homework', 'Homework Set'),
            ('lab', 'Practical Session'), ('presentation', 'Group Presentation'),
        ]
        subjects = list(ctx['subjects'].values())
        rows = []
        for student in ctx['all_students']:
            ability = float(student.current_gpa or 3.0) / 4.0
            for n in range(3):
                subject = subjects[(hash(student.student_id) + n) % len(subjects)]
                a_type, label = titles[n % len(titles)]
                max_score = 20
                obtained = round(max_score * min(1.0, max(0.3, ability + rng.uniform(-0.15, 0.15))), 2)
                rows.append(Assessment(
                    student=student, subject=subject, term=ctx['term'],
                    title=f'{subject.name} {label} {n + 1}',
                    assessment_type=a_type,
                    date=date(YEAR, 5, 4 + n * 7),
                    max_score=max_score, score_obtained=obtained,
                    percentage=round(obtained / max_score * 100, 2),
                ))
        Assessment.objects.bulk_create(rows, ignore_conflicts=True)
        self.stdout.write(f'  {len(rows)} assessments')

    def _attendance(self, ctx):
        from apps.attendance.models import AttendanceRecord, AttendanceSummary
        rng = ctx['rng_for']('attendance')
        marker = ctx['staff']['dos'][0]

        # Four school weeks in May and June of the current term.
        days = []
        for start in (date(YEAR, 5, 4), date(YEAR, 5, 11),
                      date(YEAR, 6, 1), date(YEAR, 6, 8)):
            days.extend(start + timedelta(days=n) for n in range(5))

        rows = []
        for student in ctx['all_students']:
            rate = float(student.attendance_percentage or 90) / 100
            for day in days:
                roll = rng.random()
                if roll < rate:
                    status, late = 'present', 0
                elif roll < rate + 0.05:
                    status, late = 'late', rng.choice([5, 10, 15, 20])
                elif roll < rate + 0.08:
                    status, late = 'excused', 0
                else:
                    status, late = 'absent', 0
                rows.append(AttendanceRecord(student=student, date=day,
                                             status=status, minutes_late=late,
                                             marked_by=marker))
        AttendanceRecord.objects.bulk_create(rows, ignore_conflicts=True)

        # Summaries have no unique constraint, so get_or_create rather than bulk.
        for student in ctx['all_students']:
            for month in (5, 6):
                recs = AttendanceRecord.objects.filter(
                    student=student, date__year=YEAR, date__month=month)
                total = recs.count()
                if not total:
                    continue
                present = recs.filter(status='present').count()
                AttendanceSummary.objects.get_or_create(
                    student=student, month=month, year=YEAR,
                    defaults={
                        'total_days': total, 'present_days': present,
                        'absent_days': recs.filter(status='absent').count(),
                        'late_days': recs.filter(status='late').count(),
                        'excused_days': recs.filter(status='excused').count(),
                        'attendance_percentage': round(present / total * 100, 2),
                    },
                )
        self.stdout.write(f'  {len(rows)} attendance records')

    def _conduct(self, ctx):
        from apps.behavior.models import BehaviorReport, ConductGrade
        rng = ctx['rng_for']('conduct')
        reporter = ctx['staff']['discipline'][0]
        matron = ctx['staff']['matron'][0]

        positive = [
            ('achievement', 'Top of Class in Mathematics',
             'Placed first in the mid-term Mathematics examination.'),
            ('positive', 'Outstanding Laboratory Work',
             'Showed exceptional care and method during the Biology practical.'),
            ('positive', 'Helped a Struggling Classmate',
             'Volunteered to coach a classmate through revision after prep.'),
            ('achievement', 'Perfect Attendance',
             'Full attendance for the month with no lateness recorded.'),
        ]
        negative = [
            ('warning', 'Repeated Late Arrival',
             'Arrived after the bell on four occasions this fortnight.', 'minor', 3),
            ('incident', 'Disruption During Prep',
             'Persistently disruptive during evening prep despite warnings.', 'moderate', 5),
            ('warning', 'Incomplete Assignments',
             'Three consecutive assignments submitted incomplete.', 'minor', 2),
            ('incident', 'Out of Bounds After Lights-Out',
             'Found outside the dormitory during the night check.', 'serious', 10),
        ]

        # Roughly a fifth of the school picks up a report — enough to populate
        # the discipline dashboards without making every student a case file.
        sample = [s for s in ctx['all_students'] if rng.random() < 0.2]
        for i, student in enumerate(sample):
            good = float(student.current_gpa or 3) > 3.2
            if good:
                rtype, title, desc = positive[i % len(positive)]
                severity, marks = 'minor', None
                status, by = 'approved', reporter
            else:
                rtype, title, desc, severity, marks = negative[i % len(negative)]
                status = ['pending_review', 'approved', 'rejected'][i % 3]
                by = matron if i % 2 else reporter
            BehaviorReport.objects.get_or_create(
                student=student, title=title,
                defaults={
                    'report_type': rtype, 'severity': severity,
                    'description': desc, 'date': date(YEAR, 5, 15),
                    'location': 'School Campus', 'reported_by': by,
                    'status': status, 'marks_deducted': marks,
                    'parents_notified': rtype in ('warning', 'incident'),
                },
            )

        for student in ctx['all_students']:
            gpa = float(student.current_gpa or 3)
            grade = 'A' if gpa >= 3.5 else 'B' if gpa >= 2.8 else 'C'
            ConductGrade.objects.get_or_create(
                student=student, term=ctx['term'],
                defaults={'grade': grade,
                          'positive_count': 2 if gpa >= 3.5 else 0,
                          'warning_count': 0 if gpa >= 3.0 else 1,
                          'incident_count': 0 if gpa >= 2.5 else 1,
                          'achievement_count': 1 if gpa >= 3.7 else 0},
            )
        self.stdout.write(f'  {len(sample)} behaviour reports')

    def _announcements(self, ctx):
        from apps.announcements.models import Announcement
        profile = ctx['profile']
        author = ctx['staff']['admin'][0]
        for i, (title, body, category, audience) in enumerate(ANNOUNCEMENT_TEMPLATES):
            Announcement.objects.get_or_create(
                title=title.format(**profile),
                defaults={
                    'content': body.format(**profile),
                    'category': category, 'target_audience': audience,
                    'author': author, 'status': 'published',
                    'published_at': timezone.now() - timedelta(days=i * 2),
                },
            )

    def _leaders(self, ctx):
        from apps.discipline.models import StudentLeader
        seniors = [s for s in ctx['all_students'] if s.grade in ('S4', 'S5', 'S6')]
        pool = seniors or ctx['all_students']
        if not pool:
            return
        roles = ['head_boy', 'head_girl', 'prefect', 'prefect',
                 'class_captain', 'games_captain', 'house_captain']
        for i, role in enumerate(roles):
            if i >= len(pool):
                break
            student = pool[i]
            if role == 'head_boy' and getattr(student, '_gender', 'M') != 'M':
                continue
            if role == 'head_girl' and getattr(student, '_gender', 'F') != 'F':
                continue
            StudentLeader.objects.get_or_create(
                student=student, role=role, term=ctx['term'],
                defaults={'appointed_date': date(YEAR, 1, 12)},
            )

    def _activities(self, ctx):
        from apps.student.models import Activity, ActivityEnrollment
        rng = ctx['rng_for']('activities')
        teachers = ctx['staff']['teacher']
        activities = []
        for i, (name, category, venue, schedule) in enumerate(ACTIVITIES):
            activity, _ = Activity.objects.get_or_create(
                name=name,
                defaults={'category': category, 'venue': venue,
                          'schedule': schedule, 'max_members': 30,
                          'teacher_in_charge': teachers[i % len(teachers)],
                          'description': f'{name} meets {schedule.lower()}.'},
            )
            activities.append(activity)

        rows = []
        for student in ctx['all_students']:
            for activity in rng.sample(activities, k=min(2, len(activities))):
                rows.append(ActivityEnrollment(activity=activity, student=student))
        ActivityEnrollment.objects.bulk_create(rows, ignore_conflicts=True)

    def _fees(self, ctx):
        from apps.student.models import Fee
        if Fee.objects.filter(term=ctx['term']).exists():
            return
        rng = ctx['rng_for']('fees')
        boarding = ctx['profile']['boarding'] > 0
        rows = []
        for student in ctx['all_students']:
            roll = rng.random()
            status = 'cleared' if roll < 0.6 else 'due' if roll < 0.85 else 'overdue'
            rows.append(Fee(
                student=student, category='tuition',
                amount=185000 if boarding else 120000,
                due_date=date(YEAR, 5, 15), status=status, term=ctx['term'],
                paid_date=date(YEAR, 4, 30) if status == 'cleared' else None,
            ))
            if boarding:
                rows.append(Fee(
                    student=student, category='lunch', amount=45000,
                    due_date=date(YEAR, 5, 15), status=status, term=ctx['term'],
                    paid_date=date(YEAR, 4, 30) if status == 'cleared' else None,
                ))
        Fee.objects.bulk_create(rows, ignore_conflicts=True)
