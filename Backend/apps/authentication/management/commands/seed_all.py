"""
Imboni School — Full Database Seed Command
Usage:
    python manage.py seed_all           # seed everything
    python manage.py seed_all --clear   # wipe existing data first
"""

import uuid
from datetime import date, time, timedelta
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()

# ── Lazy model imports (avoid circular import issues) ──────────────────────────
def get_models():
    from apps.results.models     import Subject, AcademicTerm, Result, Assessment
    from apps.student.models     import Student, Activity, ActivityEnrollment, ActivityEvent, Assignment, AssignmentSubmission
    from apps.teacher.models     import Class, ClassAssignment, SubjectTeacherAssignment, Timetable, Task, TeacherClassList
    from apps.attendance.models  import AttendanceRecord, AttendanceSummary
    from apps.behavior.models    import BehaviorReport, ConductGrade
    from apps.announcements.models import Announcement
    from apps.discipline.models  import StudentLeader, BoardingStudent, DisciplineStaff, DiningPlan, DisFacility, DisFacilitySection
    from apps.parents.models     import ParentStudentRelationship
    from apps.messages.models    import Conversation, Message
    return {
        'Subject': Subject, 'AcademicTerm': AcademicTerm, 'Result': Result,
        'Assessment': Assessment, 'Student': Student, 'Activity': Activity,
        'ActivityEnrollment': ActivityEnrollment, 'ActivityEvent': ActivityEvent,
        'Assignment': Assignment,
        'AssignmentSubmission': AssignmentSubmission, 'Class': Class,
        'ClassAssignment': ClassAssignment,
        'SubjectTeacherAssignment': SubjectTeacherAssignment,
        'Timetable': Timetable, 'Task': Task,
        'AttendanceRecord': AttendanceRecord, 'AttendanceSummary': AttendanceSummary,
        'BehaviorReport': BehaviorReport, 'ConductGrade': ConductGrade,
        'Announcement': Announcement, 'StudentLeader': StudentLeader,
        'BoardingStudent': BoardingStudent, 'DisciplineStaff': DisciplineStaff,
        'DiningPlan': DiningPlan, 'DisFacility': DisFacility, 'DisFacilitySection': DisFacilitySection,
        'ParentStudentRelationship': ParentStudentRelationship,
        'Conversation': Conversation, 'Message': Message,
        'TeacherClassList': TeacherClassList,
    }


PASSWORD = 'Imboni@2026'

USERS = [
    # role, first_name, last_name, email, phone, employment_type
    ('admin',      'Alphonse',    'Nkurunziza',      'admin@imboni.rw',         '+250788000001', ''),
    ('dos',        'Jean-Claude', 'Ndagijimana',     'dos@imboni.rw',           '+250788000002', 'full_time'),
    ('teacher',    'Claudine',    'Umutoni',         'c.umutoni@imboni.rw',     '+250788000003', 'full_time'),
    ('teacher',    'Pacifique',   'Rurangwa',        'p.rurangwa@imboni.rw',    '+250788000004', 'full_time'),
    ('teacher',    'Immaculee',   'Nsabimana',       'i.nsabimana@imboni.rw',   '+250788000005', 'full_time'),
    ('teacher',    'Theophile',   'Bizimana',        't.bizimana@imboni.rw',    '+250788000006', 'part_time'),
    ('teacher',    'Sandrine',    'Uwera',           's.uwera@imboni.rw',       '+250788000007', 'full_time'),
    ('teacher',    'Janvier',     'Ntakirutimana',   'j.ntakirutimana@imboni.rw','+250788000008','full_time'),
    ('matron',     'Grace',       'Hakizimana',      'g.hakizimana@imboni.rw',  '+250788000009', ''),
    ('discipline', 'Patrick',     'Habimana',        'p.habimana@imboni.rw',    '+250788000010', ''),
    ('student',    'Amina',       'Uwase',           'a.uwase@imboni.rw',       '+250788000011', ''),
    ('student',    'Kevin',       'Mutabazi',        'k.mutabazi@imboni.rw',    '+250788000012', ''),
    ('student',    'Marie',       'Ingabire',        'm.ingabire@imboni.rw',    '+250788000013', ''),
    ('student',    'Peter',       'Nkurunziza',      'p.nkurunziza@imboni.rw',  '+250788000014', ''),
    ('student',    'Diane',       'Umutoni',         'd.umutoni@imboni.rw',     '+250788000015', ''),
    ('student',    'James',       'Bizimana',        'j.bizimana@imboni.rw',    '+250788000016', ''),
    ('student',    'Grace',       'Hakizimana',      'g.hakizimana.s@imboni.rw','+250788000017', ''),
    ('student',    'Eric',        'Ndagijimana',     'e.ndagijimana@imboni.rw', '+250788000018', ''),
    ('student',    'Lydia',       'Uwineza',         'l.uwineza@imboni.rw',     '+250788000019', ''),
    ('student',    'Moses',       'Habimana',        'm.habimana@imboni.rw',    '+250788000020', ''),
    ('student',    'Mercy',       'Nyirabeza',       'm.nyirabeza@imboni.rw',   '+250788000021', ''),
    ('student',    'Felix',       'Ndayishimiye',    'f.ndayishimiye@imboni.rw','+250788000022', ''),
    ('student',    'Clarisse',    'Uwimana',         'c.uwimana@imboni.rw',     '+250788000023', ''),
    ('student',    'David',       'Nkurunziza',      'd.nkurunziza@imboni.rw',  '+250788000024', ''),
    ('student',    'Joy',         'Mukamazimpaka',   'j.mukamazimpaka@imboni.rw','+250788000025',''),
    ('parent',     'Chantal',     'Uwase',           'ch.uwase@gmail.com',      '+250788000026', ''),
    ('parent',     'Robert',      'Mutabazi',        'r.mutabazi@gmail.com',    '+250788000027', ''),
    ('parent',     'Esperance',   'Ingabire',        'e.ingabire@gmail.com',    '+250788000028', ''),
    ('parent',     'Francois',    'Nkurunziza',      'f.nkurunziza@gmail.com',  '+250788000029', ''),
    ('parent',     'Agnes',       'Umutoni',         'a.umutoni@gmail.com',     '+250788000030', ''),
]

SUBJECTS_DATA = [
    # (code, name, category)
    ('MTH', 'Mathematics',        'Sciences'),
    ('PHY', 'Physics',            'Sciences'),
    ('CHE', 'Chemistry',          'Sciences'),
    ('BIO', 'Biology',            'Sciences'),
    ('ICT', 'Computer Science',   'Sciences'),
    ('ENG', 'English',            'Languages'),
    ('FRE', 'French',             'Languages'),
    ('KIN', 'Kinyarwanda',        'Languages'),
    ('HIS', 'History',            'Humanities'),
    ('GEO', 'Geography',          'Humanities'),
    ('CRE', 'CRE',                'Humanities'),
    ('ENT', 'Entrepreneurship',   'Humanities'),
    ('ECO', 'Economics',          'Social Sciences'),
    ('GS',  'General Studies',    'Social Sciences'),
    ('ART', 'Art & Design',       'Arts'),
    ('MUS', 'Music',              'Arts'),
]

SCHOOL_SECTIONS = [
    {
        'name': 'O-Level',
        'years': [
            {'name': 'S1', 'streams': ['A', 'B', 'C']},
            {'name': 'S2', 'streams': ['A', 'B', 'C']},
            {'name': 'S3', 'streams': ['A', 'B', 'C']},
        ]
    },
    {
        'name': 'A-Level',
        'years': [
            {'name': 'S4', 'streams': ['MPG', 'PCB', 'MCE']},
            {'name': 'S5', 'streams': ['MPG', 'PCB', 'MCE']},
            {'name': 'S6', 'streams': ['MPG', 'PCB', 'HEG']},
        ]
    },
]

# grade, section, name
CLASSES_DATA = [
    (1, 'A', 'S1A'), (1, 'B', 'S1B'),
    (2, 'A', 'S2A'), (2, 'B', 'S2B'),
    (3, 'A', 'S3A'), (3, 'B', 'S3B'),
    (4, 'A', 'S4A'), (4, 'B', 'S4B'),
    (5, 'A', 'S5A'),
    (6, 'A', 'S6A'),
]

# email, grade, section, student_id, gpa, dormitory
STUDENTS_DATA = [
    ('a.uwase@imboni.rw',            4, 'A', 'STU-2026-001', 3.5, 'Bisoke'),
    ('k.mutabazi@imboni.rw',         3, 'B', 'STU-2026-002', 3.1, 'Muhabura'),
    ('m.ingabire@imboni.rw',         3, 'A', 'STU-2026-003', 3.9, 'Bisoke'),
    ('p.nkurunziza@imboni.rw',       2, 'A', 'STU-2026-004', 2.4, 'Sabyinyo'),
    ('d.umutoni@imboni.rw',          5, 'A', 'STU-2026-005', 3.7, 'Karisimbi'),
    ('j.bizimana@imboni.rw',         5, 'A', 'STU-2026-006', 3.0, 'Muhabura'),
    ('g.hakizimana.s@imboni.rw',     1, 'A', 'STU-2026-007', 4.0, 'Bisoke'),
    ('e.ndagijimana@imboni.rw',      1, 'B', 'STU-2026-008', 2.2, 'Sabyinyo'),
    ('l.uwineza@imboni.rw',          3, 'A', 'STU-2026-009', 3.6, 'Karisimbi'),
    ('m.habimana@imboni.rw',         3, 'B', 'STU-2026-010', 3.3, 'Sabyinyo'),
    ('m.nyirabeza@imboni.rw',        3, 'A', 'STU-2026-011', 3.4, 'Bisoke'),
    ('f.ndayishimiye@imboni.rw',     4, 'A', 'STU-2026-012', 3.2, 'Muhabura'),
    ('c.uwimana@imboni.rw',          4, 'A', 'STU-2026-013', 3.8, 'Karisimbi'),
    ('d.nkurunziza@imboni.rw',       4, 'A', 'STU-2026-014', 3.1, 'Sabyinyo'),
    ('j.mukamazimpaka@imboni.rw',    4, 'B', 'STU-2026-015', 3.6, 'Bisoke'),
]

# parent email, student email, relationship
PARENT_LINKS = [
    ('ch.uwase@gmail.com',      'a.uwase@imboni.rw',          'mother'),
    ('r.mutabazi@gmail.com',    'k.mutabazi@imboni.rw',       'father'),
    ('e.ingabire@gmail.com',    'm.ingabire@imboni.rw',       'mother'),
    ('f.nkurunziza@gmail.com',  'p.nkurunziza@imboni.rw',    'father'),
    ('a.umutoni@gmail.com',     'd.umutoni@imboni.rw',        'mother'),
]

# teacher email -> list of (subject_code, class_name) pairs they teach
# Each teacher covers multiple subjects across multiple classes so My Classes is rich
TEACHER_ASSIGNMENTS = [
    # Claudine Umutoni — English & General Studies
    ('c.umutoni@imboni.rw', 'ENG', 'S1A'), ('c.umutoni@imboni.rw', 'ENG', 'S1B'),
    ('c.umutoni@imboni.rw', 'ENG', 'S2A'), ('c.umutoni@imboni.rw', 'ENG', 'S2B'),
    ('c.umutoni@imboni.rw', 'ENG', 'S3A'), ('c.umutoni@imboni.rw', 'ENG', 'S3B'),
    ('c.umutoni@imboni.rw', 'GS',  'S1A'), ('c.umutoni@imboni.rw', 'GS',  'S1B'),
    ('c.umutoni@imboni.rw', 'GS',  'S2A'), ('c.umutoni@imboni.rw', 'GS',  'S2B'),

    # Pacifique Rurangwa — Mathematics
    ('p.rurangwa@imboni.rw', 'MTH', 'S1A'), ('p.rurangwa@imboni.rw', 'MTH', 'S1B'),
    ('p.rurangwa@imboni.rw', 'MTH', 'S2A'), ('p.rurangwa@imboni.rw', 'MTH', 'S2B'),
    ('p.rurangwa@imboni.rw', 'MTH', 'S3A'), ('p.rurangwa@imboni.rw', 'MTH', 'S3B'),
    ('p.rurangwa@imboni.rw', 'MTH', 'S4A'), ('p.rurangwa@imboni.rw', 'MTH', 'S4B'),

    # Immaculee Nsabimana — Biology & Chemistry
    ('i.nsabimana@imboni.rw', 'BIO', 'S3A'), ('i.nsabimana@imboni.rw', 'BIO', 'S3B'),
    ('i.nsabimana@imboni.rw', 'BIO', 'S4A'), ('i.nsabimana@imboni.rw', 'BIO', 'S4B'),
    ('i.nsabimana@imboni.rw', 'BIO', 'S5A'), ('i.nsabimana@imboni.rw', 'BIO', 'S6A'),
    ('i.nsabimana@imboni.rw', 'CHE', 'S3A'), ('i.nsabimana@imboni.rw', 'CHE', 'S3B'),

    # Theophile Bizimana — Chemistry & Physics (upper school)
    ('t.bizimana@imboni.rw', 'CHE', 'S4A'), ('t.bizimana@imboni.rw', 'CHE', 'S4B'),
    ('t.bizimana@imboni.rw', 'CHE', 'S5A'), ('t.bizimana@imboni.rw', 'CHE', 'S6A'),
    ('t.bizimana@imboni.rw', 'PHY', 'S4A'), ('t.bizimana@imboni.rw', 'PHY', 'S4B'),

    # Sandrine Uwera — Physics
    ('s.uwera@imboni.rw', 'PHY', 'S1A'), ('s.uwera@imboni.rw', 'PHY', 'S1B'),
    ('s.uwera@imboni.rw', 'PHY', 'S2A'), ('s.uwera@imboni.rw', 'PHY', 'S2B'),
    ('s.uwera@imboni.rw', 'PHY', 'S3A'), ('s.uwera@imboni.rw', 'PHY', 'S3B'),
    ('s.uwera@imboni.rw', 'PHY', 'S5A'), ('s.uwera@imboni.rw', 'PHY', 'S6A'),

    # Janvier Ntakirutimana — History & Geography
    ('j.ntakirutimana@imboni.rw', 'HIS', 'S1A'), ('j.ntakirutimana@imboni.rw', 'HIS', 'S1B'),
    ('j.ntakirutimana@imboni.rw', 'HIS', 'S2A'), ('j.ntakirutimana@imboni.rw', 'HIS', 'S2B'),
    ('j.ntakirutimana@imboni.rw', 'HIS', 'S3A'), ('j.ntakirutimana@imboni.rw', 'HIS', 'S3B'),
    ('j.ntakirutimana@imboni.rw', 'GEO', 'S4A'), ('j.ntakirutimana@imboni.rw', 'GEO', 'S4B'),
    ('j.ntakirutimana@imboni.rw', 'GEO', 'S5A'), ('j.ntakirutimana@imboni.rw', 'GEO', 'S6A'),
]

# Keep these for backward-compat references elsewhere in the seed
TEACHER_SUBJECTS = {
    'c.umutoni@imboni.rw':       'ENG',
    'p.rurangwa@imboni.rw':      'MTH',
    'i.nsabimana@imboni.rw':     'BIO',
    't.bizimana@imboni.rw':      'CHE',
    's.uwera@imboni.rw':         'PHY',
    'j.ntakirutimana@imboni.rw': 'HIS',
}

TEACHER_CLASSES = {
    'c.umutoni@imboni.rw':       ['S1A', 'S1B', 'S2A', 'S2B', 'S3A', 'S3B'],
    'p.rurangwa@imboni.rw':      ['S1A', 'S1B', 'S2A', 'S2B', 'S3A', 'S3B', 'S4A', 'S4B'],
    'i.nsabimana@imboni.rw':     ['S3A', 'S3B', 'S4A', 'S4B', 'S5A', 'S6A'],
    't.bizimana@imboni.rw':      ['S4A', 'S4B', 'S5A', 'S6A'],
    's.uwera@imboni.rw':         ['S1A', 'S1B', 'S2A', 'S2B', 'S3A', 'S3B', 'S5A', 'S6A'],
    'j.ntakirutimana@imboni.rw': ['S1A', 'S1B', 'S2A', 'S2B', 'S3A', 'S3B', 'S4A', 'S4B', 'S5A', 'S6A'],
}

DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']

PERIODS = [
    (time(7, 30),  time(8, 30)),
    (time(8, 30),  time(9, 30)),
    (time(9, 30),  time(10, 30)),
    (time(11, 0),  time(12, 0)),
    (time(12, 0),  time(13, 0)),
    (time(14, 0),  time(15, 0)),
    (time(15, 0),  time(16, 0)),
]

ANNOUNCEMENTS_DATA = [
    ('Term 2 Exam Schedule Released',
     'The examination schedule for Term 2 2026 has been released. All students are expected to be present 30 minutes before their examination time. Parents are advised to ensure students arrive at school early.',
     'academic', 'all', 'published'),
    ('Sports Day — May 20, 2026',
     'The annual Sports Day will be held on May 20, 2026. All students are encouraged to participate. Parents and guardians are warmly invited to attend and cheer for our school teams.',
     'event', 'all', 'published'),
    ('Parents Meeting — April 25',
     'There will be a parent-teacher meeting on April 25, 2026 at 10:00 AM in the school hall. All parents are required to attend to discuss their children\'s academic progress.',
     'general', 'parents', 'published'),
    ('Library Hours Extended',
     'The school library will now remain open until 6:00 PM on weekdays to allow students more time for research and study. Students must have their library cards to access the facility.',
     'academic', 'students', 'published'),
    ('Fee Deadline Reminder',
     'This is a reminder that all school fees for Term 2 2026 must be cleared by April 30, 2026. Students with outstanding balances may not be allowed to sit for examinations.',
     'general', 'parents', 'published'),
    ('Umuco Fest Cultural Festival',
     'Imboni School will host the annual Umuco Fest Cultural Festival on May 2, 2026. Students are encouraged to showcase Rwanda\'s rich cultural heritage through dance, music, and art.',
     'event', 'all', 'published'),
    ('Mathematics Olympiad Registration',
     'Registration for the Inter-School Mathematics Olympiad is now open. Interested students in S4-S6 should register with Mr. Rurangwa before April 20, 2026.',
     'academic', 'students', 'published'),
    ('New Health Protocols',
     'Following updated Ministry of Health guidelines, all students are required to wash hands before entering classrooms. Hand sanitizer stations have been installed at all entry points.',
     'general', 'all', 'published'),
]


class Command(BaseCommand):
    help = 'Seed the database with comprehensive sample data for Imboni School'

    def add_arguments(self, parser):
        parser.add_argument('--clear', action='store_true', help='Clear existing data before seeding')

    def handle(self, *args, **options):
        m = get_models()

        if options['clear']:
            self.stdout.write('Clearing existing data...')
            m['Message'].objects.all().delete()
            m['Conversation'].objects.all().delete()
            m['Announcement'].objects.all().delete()
            m['ConductGrade'].objects.all().delete()
            m['BehaviorReport'].objects.all().delete()
            m['AttendanceSummary'].objects.all().delete()
            m['AttendanceRecord'].objects.all().delete()
            m['Assessment'].objects.all().delete()
            m['Result'].objects.all().delete()
            m['AssignmentSubmission'].objects.all().delete()
            m['Assignment'].objects.all().delete()
            m['ActivityEnrollment'].objects.all().delete()
            m['ActivityEvent'].objects.all().delete()
            m['Activity'].objects.all().delete()
            m['DiningPlan'].objects.all().delete()
            m['BoardingStudent'].objects.all().delete()
            m['DisFacility'].objects.all().delete()
            m['DisFacilitySection'].objects.all().delete()
            m['StudentLeader'].objects.all().delete()
            m['DisciplineStaff'].objects.all().delete()
            m['Timetable'].objects.all().delete()
            m['TeacherClassList'].objects.all().delete()
            m['SubjectTeacherAssignment'].objects.all().delete()
            m['ClassAssignment'].objects.all().delete()
            m['ParentStudentRelationship'].objects.all().delete()
            m['Class'].objects.all().delete()
            m['Student'].objects.all().delete()
            m['AcademicTerm'].objects.all().delete()
            m['Subject'].objects.all().delete()
            User.objects.exclude(is_superuser=True).delete()
            self.stdout.write(self.style.WARNING('Existing data cleared.'))

        # ── 1. Users ───────────────────────────────────────────────────────────
        self.stdout.write('Creating users...')
        users = {}
        for role, first, last, email, phone, emp_type in USERS:
            user, created = User.objects.get_or_create(email=email, defaults={
                'username':        email,
                'first_name':      first,
                'last_name':       last,
                'role':            role,
                'phone_number':    phone,
                'employment_type': emp_type,
                'is_active':       True,
                'email_verified':  True,
            })
            if created:
                user.set_password(PASSWORD)
                user.save()
            users[email] = user
        self.stdout.write(self.style.SUCCESS(f'  {len(users)} users ready'))

        # ── 2. Academic Terms ──────────────────────────────────────────────────
        self.stdout.write('Creating academic terms...')
        AcademicTerm = m['AcademicTerm']
        term1_2026, _ = AcademicTerm.objects.get_or_create(
            term='term1', year=2026,
            defaults={'name': 'Term 1 2026', 'start_date': date(2026, 1, 5),
                      'end_date': date(2026, 3, 27), 'is_current': False}
        )
        term2_2026, _ = AcademicTerm.objects.get_or_create(
            term='term2', year=2026,
            defaults={'name': 'Term 2 2026', 'start_date': date(2026, 4, 28),
                      'end_date': date(2026, 7, 24), 'is_current': True}
        )
        AcademicTerm.objects.exclude(pk=term2_2026.pk).update(is_current=False)
        current_term = term2_2026
        self.stdout.write(self.style.SUCCESS(f'  Current term: {current_term.name}'))

        # ── 3. Subjects ────────────────────────────────────────────────────────
        self.stdout.write('Creating subjects...')
        Subject = m['Subject']
        subjects = {}
        for code, name, category in SUBJECTS_DATA:
            subj, _ = Subject.objects.get_or_create(
                code=code,
                defaults={'name': name, 'category': category, 'is_active': True}
            )
            # update category if subject already existed without one
            if subj.category != category:
                subj.category = category
                subj.save(update_fields=['category'])
            subjects[code] = subj
        self.stdout.write(self.style.SUCCESS(f'  {len(subjects)} subjects ready'))

        # ── School Sections (new per-year stream format) ───────────────────────
        self.stdout.write('Creating school sections...')
        from apps.dos.models import SchoolSection, SchoolSetting
        SchoolSection.objects.all().delete()
        for sec in SCHOOL_SECTIONS:
            SchoolSection.objects.create(name=sec['name'], years=sec['years'])
        self.stdout.write(self.style.SUCCESS(f'  {len(SCHOOL_SECTIONS)} sections created'))

        # ── School Settings (timezone default) ────────────────────────────────
        settings = SchoolSetting.get_setting()
        if not settings.timezone:
            settings.timezone = 'Africa/Kigali'
            settings.save()
        self.stdout.write(self.style.SUCCESS('  School settings ready'))

        # ── 4. Classes ─────────────────────────────────────────────────────────
        self.stdout.write('Creating classes...')
        Class = m['Class']
        classes = {}
        teacher_users = [u for r, *_, e, __, ___ in USERS if r == 'teacher' for u in [users.get(e)] if u]
        for i, (grade, section, name) in enumerate(CLASSES_DATA):
            class_teacher = teacher_users[i % len(teacher_users)]
            cls, _ = Class.objects.get_or_create(
                grade=grade, section=section,
                defaults={'name': name, 'class_teacher': class_teacher, 'max_students': 40}
            )
            classes[name] = cls
        self.stdout.write(self.style.SUCCESS(f'  {len(classes)} classes ready'))

        # ── 5. Students ────────────────────────────────────────────────────────
        self.stdout.write('Creating students...')
        Student = m['Student']
        students = {}
        for email, grade, section, student_id, gpa, dormitory in STUDENTS_DATA:
            user = users.get(email)
            if not user:
                continue
            student, _ = Student.objects.get_or_create(user=user, defaults={
                'student_id':            student_id,
                'grade':                 grade,
                'section':               section,
                'status':                'active',
                'current_gpa':           gpa,
                'attendance_percentage': round(85 + (gpa * 3), 1),
                'enrollment_date':       date(2026, 1, 5),
            })
            students[email] = student
        self.stdout.write(self.style.SUCCESS(f'  {len(students)} students ready'))

        # ── 6. Parent-Student Links ────────────────────────────────────────────
        self.stdout.write('Linking parents to students...')
        ParentStudentRelationship = m['ParentStudentRelationship']
        for parent_email, student_email, rel_type in PARENT_LINKS:
            parent  = users.get(parent_email)
            student = students.get(student_email)
            if parent and student:
                ParentStudentRelationship.objects.get_or_create(
                    parent=parent, student=student,
                    defaults={'relationship_type': rel_type, 'is_primary_contact': True}
                )
        self.stdout.write(self.style.SUCCESS(f'  {len(PARENT_LINKS)} parent links ready'))

        # ── 7. Class Assignments (students -> classes) ──────────────────────────
        self.stdout.write('Assigning students to classes...')
        ClassAssignment = m['ClassAssignment']
        for email, grade, section, *_ in STUDENTS_DATA:
            class_name = f'S{grade}{section}'
            cls     = classes.get(class_name)
            student = students.get(email)
            if cls and student:
                ClassAssignment.objects.get_or_create(
                    class_obj=cls, student=student, term=current_term,
                    defaults={'assigned_date': date(2026, 4, 28)}
                )
        self.stdout.write(self.style.SUCCESS('  Class assignments done'))

        # ── 8. Subject-Teacher Assignments ────────────────────────────────────
        self.stdout.write('Assigning teachers to subjects and classes...')
        SubjectTeacherAssignment = m['SubjectTeacherAssignment']
        sta_count = 0
        for teacher_email, subject_code, class_name in TEACHER_ASSIGNMENTS:
            teacher = users.get(teacher_email)
            subject = subjects.get(subject_code)
            cls     = classes.get(class_name)
            if not teacher or not subject or not cls:
                continue
            _, created = SubjectTeacherAssignment.objects.get_or_create(
                teacher=teacher, subject=subject,
                class_obj=cls, term=current_term
            )
            if created:
                sta_count += 1
        self.stdout.write(self.style.SUCCESS(f'  {sta_count} teacher-subject assignments created'))

        # ── 9. Timetable ───────────────────────────────────────────────────────
        self.stdout.write('Building timetable...')
        Timetable = m['Timetable']
        subject_list = list(subjects.values())
        teacher_list = list(users[e] for e in TEACHER_SUBJECTS)
        room_num = 100
        count = 0
        for cls in classes.values():
            for d_idx, day in enumerate(DAYS):
                for p_idx, (start, end) in enumerate(PERIODS[:5]):
                    subj    = subject_list[(d_idx + p_idx + list(classes.values()).index(cls)) % len(subject_list)]
                    teacher = teacher_list[(d_idx + p_idx) % len(teacher_list)]
                    _, created = Timetable.objects.get_or_create(
                        class_obj=cls, day=day, start_time=start, term=current_term,
                        defaults={'subject': subj, 'teacher': teacher,
                                  'end_time': end, 'room_number': f'Room {room_num + (d_idx * 10) + p_idx}'}
                    )
                    if created:
                        count += 1
        self.stdout.write(self.style.SUCCESS(f'  {count} timetable entries created'))

        # ── 10. Results ────────────────────────────────────────────────────────
        self.stdout.write('Creating results...')
        Result = m['Result']
        dos_user = users.get('dos@imboni.rw')

        # Format: student_email, subject_code, class_test, exam_score, teacher_comment, status, rejection_reason
        # status options:
        #   'approved'  → DOS reviewed and accepted
        #   'submitted' → teacher submitted, DOS has not reviewed yet (shows as 'pending' in UI)
        #   'rejected'  → DOS reviewed and sent back for correction
        result_data = [
            # ── APPROVED — DOS already reviewed these ──────────────────────────
            ('a.uwase@imboni.rw',        'MTH', 18, 67, 'Good performance. Keep it up.',        'approved', ''),
            ('a.uwase@imboni.rw',        'ENG', 17, 64, 'Strong written work.',                 'approved', ''),
            ('m.ingabire@imboni.rw',     'BIO', 20, 75, 'Outstanding lab work.',                'approved', ''),
            ('d.umutoni@imboni.rw',      'PHY', 18, 66, 'Shows great understanding.',           'approved', ''),
            ('g.hakizimana.s@imboni.rw', 'MTH', 20, 74, 'Top of the class.',                   'approved', ''),
            ('c.uwimana@imboni.rw',      'HIS', 17, 65, 'Good understanding of events.',        'approved', ''),

            # ── SUBMITTED (PENDING) — teacher sent, DOS has not reviewed yet ───
            ('m.ingabire@imboni.rw',     'MTH', 19, 72, 'Excellent analytical skills.',         'submitted', ''),
            ('k.mutabazi@imboni.rw',     'ENG', 15, 53, 'Needs improvement in grammar.',        'submitted', ''),
            ('j.bizimana@imboni.rw',     'CHE', 14, 53, 'Satisfactory performance.',            'submitted', ''),
            ('l.uwineza@imboni.rw',      'BIO', 16, 61, 'Good effort in lab sessions.',         'submitted', ''),
            ('m.habimana@imboni.rw',     'MTH', 13, 48, 'Struggling with algebra concepts.',    'submitted', ''),

            # ── REJECTED — DOS found issues and sent back for correction ────────
            ('p.nkurunziza@imboni.rw',   'MTH', 12, 40, 'Requires extra support.',              'rejected', 'Marks do not match the class register. Please recheck and resubmit.'),
            ('e.ndagijimana@imboni.rw',  'ENG', 11, 37, 'Needs significant support.',           'rejected', 'Several student scores are missing. Complete the marksheet and resubmit.'),
            ('d.nkurunziza@imboni.rw',   'GEO', 15, 58, 'Average performance.',                 'rejected', 'The exam scores exceed the maximum allowed. Please verify and correct.'),
        ]

        subject_teacher_map = {v: users.get(k) for k, v in TEACHER_SUBJECTS.items()}
        r_count = 0
        for s_email, subj_code, ct_marks, exam, comment, status, rejection_reason in result_data:
            student = students.get(s_email)
            subject = subjects.get(subj_code)
            teacher = subject_teacher_map.get(subj_code, list(users.values())[2])
            if not student or not subject:
                continue

            # Build the defaults dict based on status
            defaults = {
                'teacher':          teacher,
                'class_test_marks': ct_marks,
                'exam_score':       exam,
                'teacher_comment':  comment,
                'submitted_at':     timezone.now(),
            }
            if status == 'approved':
                defaults['dos_comment']  = 'Reviewed and approved.'
                defaults['approved_by']  = dos_user
                defaults['approved_at']  = timezone.now()
            if status == 'rejected':
                defaults['rejection_reason'] = rejection_reason
                defaults['dos_comment']      = 'Please correct the issues and resubmit.'
            defaults['status'] = status

            _, created = Result.objects.get_or_create(
                student=student, subject=subject, term=current_term,
                defaults=defaults
            )
            if created:
                r_count += 1
        self.stdout.write(self.style.SUCCESS(f'  {r_count} results created ({r_count} total — approved, pending and rejected)'))

        # ── 11. Assessments ────────────────────────────────────────────────────
        self.stdout.write('Creating assessments...')
        Assessment = m['Assessment']
        assessment_data = [
            ('a.uwase@imboni.rw',       'MTH', 'quiz',         'Algebra Quiz #3',         date(2026, 5, 5),  20, 18),
            ('a.uwase@imboni.rw',       'ENG', 'presentation', 'Climate Change Project',  date(2026, 4, 28), 50, 45),
            ('m.ingabire@imboni.rw',    'BIO', 'lab',          'Cell Division Lab',       date(2026, 5, 8),  30, 28),
            ('k.mutabazi@imboni.rw',    'ENG', 'homework',     'Essay — My Community',    date(2026, 5, 3),  20, 14),
            ('d.umutoni@imboni.rw',     'PHY', 'quiz',         'Forces & Motion Quiz',    date(2026, 5, 6),  20, 17),
            ('g.hakizimana.s@imboni.rw','MTH', 'quiz',         'Fractions Quiz',          date(2026, 5, 5),  20, 20),
            ('p.nkurunziza@imboni.rw',  'MTH', 'homework',     'Equations Worksheet',     date(2026, 5, 4),  20, 10),
            ('j.bizimana@imboni.rw',    'CHE', 'lab',          'Acid-Base Titration Lab', date(2026, 5, 7),  30, 22),
        ]
        a_count = 0
        for s_email, subj_code, a_type, title, a_date, max_s, obtained in assessment_data:
            student = students.get(s_email)
            subject = subjects.get(subj_code)
            if not student or not subject:
                continue
            _, created = Assessment.objects.get_or_create(
                student=student, subject=subject, title=title,
                defaults={'term': current_term, 'assessment_type': a_type,
                          'date': a_date, 'max_score': max_s, 'score_obtained': obtained}
            )
            if created:
                a_count += 1
        self.stdout.write(self.style.SUCCESS(f'  {a_count} assessments created'))

        # ── 12. Attendance Records + Summaries ────────────────────────────────
        self.stdout.write('Creating attendance records...')
        AttendanceRecord = m['AttendanceRecord']
        AttendanceSummary = m['AttendanceSummary']
        dos_user = users.get('dos@imboni.rw')
        statuses = ['present', 'present', 'present', 'present', 'absent', 'present', 'late', 'present', 'present', 'excused']

        att_count = 0
        for s_email, student in list(students.items())[:10]:
            s_idx = list(students.keys()).index(s_email)
            # Seed May 2026 (10 school days: May 5–9 and May 12–16)
            may_dates = [date(2026, 5, 5), date(2026, 5, 6), date(2026, 5, 7),
                         date(2026, 5, 8), date(2026, 5, 9), date(2026, 5, 12),
                         date(2026, 5, 13), date(2026, 5, 14), date(2026, 5, 15), date(2026, 5, 16)]
            # Seed June 2026 (10 school days: June 2–6 and June 9–13)
            jun_dates = [date(2026, 6, 2), date(2026, 6, 3), date(2026, 6, 4),
                         date(2026, 6, 5), date(2026, 6, 6), date(2026, 6, 9),
                         date(2026, 6, 10), date(2026, 6, 11), date(2026, 6, 12), date(2026, 6, 13)]

            for all_dates in [may_dates, jun_dates]:
                for i, att_date in enumerate(all_dates):
                    status = statuses[(s_idx + i) % len(statuses)]
                    _, created = AttendanceRecord.objects.get_or_create(
                        student=student, date=att_date,
                        defaults={'status': status, 'marked_by': dos_user,
                                  'minutes_late': 15 if status == 'late' else 0}
                    )
                    if created:
                        att_count += 1

        self.stdout.write(self.style.SUCCESS(f'  {att_count} attendance records created'))

        # Build AttendanceSummary for each student+month
        self.stdout.write('Building attendance summaries...')
        sum_count = 0
        for s_email, student in list(students.items())[:10]:
            for (yr, mo) in [(2026, 5), (2026, 6)]:
                recs = AttendanceRecord.objects.filter(
                    student=student, date__year=yr, date__month=mo
                )
                total   = recs.count()
                present = recs.filter(status='present').count()
                absent  = recs.filter(status='absent').count()
                late    = recs.filter(status='late').count()
                excused = recs.filter(status='excused').count()
                if total == 0:
                    continue
                pct = round((present / total) * 100, 1)
                _, created = AttendanceSummary.objects.get_or_create(
                    student=student, month=mo, year=yr,
                    defaults={
                        'total_days': total,
                        'present_days': present,
                        'absent_days': absent,
                        'late_days': late,
                        'excused_days': excused,
                        'attendance_percentage': pct,
                    }
                )
                if created:
                    sum_count += 1
        self.stdout.write(self.style.SUCCESS(f'  {sum_count} attendance summaries created'))

        # ── 13. Behavior Reports ───────────────────────────────────────────────
        self.stdout.write('Creating behavior reports...')
        BehaviorReport = m['BehaviorReport']
        discipline_user = users.get('p.habimana@imboni.rw')
        behavior_data = [
            ('a.uwase@imboni.rw',      'achievement', 'minor',    'Academic Excellence Award',
             'Uwase Amina achieved the highest score in the Mathematics mid-term examination.'),
            ('m.ingabire@imboni.rw',   'positive',    'minor',    'Outstanding Lab Work',
             'Ingabire Marie demonstrated exceptional skills during the Biology lab session.'),
            ('p.nkurunziza@imboni.rw', 'warning',     'moderate', 'Late Submission of Assignments',
             'Peter has repeatedly submitted assignments late. Parent has been notified.'),
            ('e.ndagijimana@imboni.rw','incident',    'minor',    'Disruptive Behaviour in Class',
             'Eric was disruptive during the English lesson. He has been spoken to.'),
            ('k.mutabazi@imboni.rw',   'positive',    'minor',    'Helped Classmate',
             'Kevin voluntarily helped a classmate understand a difficult Mathematics concept.'),
            ('g.hakizimana.s@imboni.rw','achievement', 'minor',   'Perfect Attendance — April',
             'Grace Hakizimana achieved 100% attendance for the month of April 2026.'),
            ('d.umutoni@imboni.rw',    'positive',    'minor',    'Community Service Leadership',
             'Diane led the school community service program with great responsibility.'),
        ]
        b_count = 0
        for s_email, rpt_type, severity, title, desc in behavior_data:
            student = students.get(s_email)
            if not student:
                continue
            _, created = BehaviorReport.objects.get_or_create(
                student=student, title=title,
                defaults={'reported_by': discipline_user, 'report_type': rpt_type,
                          'severity': severity, 'description': desc,
                          'date': date(2026, 5, 1), 'location': 'School Campus',
                          'parents_notified': rpt_type in ['warning', 'incident']}
            )
            if created:
                b_count += 1
        self.stdout.write(self.style.SUCCESS(f'  {b_count} behavior reports created'))

        # ── 13b. Conduct Grades ────────────────────────────────────────────────
        self.stdout.write('Creating conduct grades...')
        ConductGrade = m['ConductGrade']
        conduct_data = [
            # student_email, grade, positive, warnings, incidents, achievements
            ('a.uwase@imboni.rw',       'A', 3, 0, 0, 1),
            ('m.ingabire@imboni.rw',    'A', 2, 0, 0, 0),
            ('k.mutabazi@imboni.rw',    'B', 2, 0, 0, 0),
            ('p.nkurunziza@imboni.rw',  'C', 0, 1, 0, 0),
            ('e.ndagijimana@imboni.rw', 'C', 0, 0, 1, 0),
            ('g.hakizimana.s@imboni.rw','A', 1, 0, 0, 1),
            ('d.umutoni@imboni.rw',     'A', 2, 0, 0, 0),
        ]
        cg_count = 0
        for s_email, grade, pos, warn, inc, ach in conduct_data:
            student = students.get(s_email)
            if student:
                _, created = ConductGrade.objects.get_or_create(
                    student=student, term=current_term,
                    defaults={
                        'grade': grade,
                        'positive_count': pos,
                        'warning_count': warn,
                        'incident_count': inc,
                        'achievement_count': ach,
                    }
                )
                if created:
                    cg_count += 1
        self.stdout.write(self.style.SUCCESS(f'  {cg_count} conduct grades created'))

        # ── 13c. Matron Incident Reports (pending / approved / rejected) ─────
        self.stdout.write('Creating matron incident reports...')
        matron_user     = users.get('g.hakizimana@imboni.rw')
        discipline_user = users.get('p.habimana@imboni.rw')

        matron_report_data = [
            # (student_email, report_type, severity, title, description, status, review_notes)
            # (student_email, report_type, severity, title, description, status, review_notes, marks_deducted)
            (
                'k.mutabazi@imboni.rw', 'incident', 'moderate',
                'Found Outside Dormitory After Lights-Out',
                'Kevin Mutabazi was found outside Bisoke dormitory at 10:45 PM during lights-out check. '
                'He claimed he was going to the bathroom but had no reasonable explanation for being in the '
                'corridor. This is a second occurrence this term.',
                'pending_review', '', 5,
            ),
            (
                'e.ndagijimana@imboni.rw', 'warning', 'minor',
                'Missing Evening Prep Session',
                'Eric Ndagijimana was absent from the compulsory evening prep session on three consecutive days '
                '(May 27–29). No permission slip was produced.',
                'pending_review', '', 3,
            ),
            (
                'p.nkurunziza@imboni.rw', 'incident', 'serious',
                'Fighting in Dormitory',
                'Peter Nkurunziza was involved in a physical altercation with another student in Sabyinyo '
                'dormitory on the evening of May 22. Both students have been spoken to separately. '
                'Recommending suspension pending review.',
                'approved',
                'Confirmed after investigation. Suspension of 2 days has been enforced. Parent has been notified.',
                10,
            ),
            (
                'a.uwase@imboni.rw', 'warning', 'minor',
                'Uniform Violation — Repeated',
                'Amina Uwase was noted to be wearing non-regulation shoes on three occasions this week. '
                'A verbal warning was given on the first instance with no improvement.',
                'rejected',
                'Uniform violations do not require a formal conduct report unless there is persistent defiance. '
                'Please issue a written warning first and escalate only if the issue continues.',
                None,
            ),
        ]

        mr_count = 0
        for s_email, rpt_type, severity, title, desc, rpt_status, review_notes, marks_deducted in matron_report_data:
            student = students.get(s_email)
            if not student or not matron_user:
                continue

            reviewed_by = None
            reviewed_at = None
            if rpt_status in ('approved', 'rejected') and discipline_user:
                reviewed_by = discipline_user
                reviewed_at = timezone.now() - timedelta(days=1)

            _, created = BehaviorReport.objects.get_or_create(
                student=student, title=title,
                defaults={
                    'reported_by':    matron_user,
                    'report_type':    rpt_type,
                    'severity':       severity,
                    'description':    desc,
                    'date':           date(2026, 5, 28),
                    'location':       'Dormitory',
                    'status':         rpt_status,
                    'reviewed_by':    reviewed_by,
                    'reviewed_at':    reviewed_at,
                    'review_notes':   review_notes,
                    'marks_deducted': marks_deducted,
                    'parents_notified': rpt_status == 'approved',
                }
            )
            if created:
                mr_count += 1
        self.stdout.write(self.style.SUCCESS(f'  {mr_count} matron reports created'))

        # ── 14. Announcements ──────────────────────────────────────────────────
        self.stdout.write('Creating announcements...')
        Announcement = m['Announcement']
        admin_user = users.get('admin@imboni.rw')
        ann_count = 0
        for title, content, category, audience, status in ANNOUNCEMENTS_DATA:
            _, created = Announcement.objects.get_or_create(
                title=title,
                defaults={'content': content, 'category': category,
                          'target_audience': audience, 'author': admin_user,
                          'status': status,
                          'published_at': timezone.now() - timedelta(days=ann_count)}
            )
            if created:
                ann_count += 1
        self.stdout.write(self.style.SUCCESS(f'  {ann_count} announcements created'))

        # ── 15. Student Leaders ────────────────────────────────────────────────
        self.stdout.write('Appointing student leaders...')
        StudentLeader = m['StudentLeader']
        leader_data = [
            ('c.uwimana@imboni.rw',      'head_girl'),
            ('d.nkurunziza@imboni.rw',   'head_boy'),
            ('a.uwase@imboni.rw',        'prefect'),
            ('l.uwineza@imboni.rw',      'house_captain'),
            ('m.nyirabeza@imboni.rw',    'house_captain'),
        ]
        l_count = 0
        for s_email, role in leader_data:
            student = students.get(s_email)
            if student:
                _, created = StudentLeader.objects.get_or_create(
                    student=student, role=role, term=current_term,
                    defaults={'appointed_date': date(2026, 1, 5)}
                )
                if created:
                    l_count += 1
        self.stdout.write(self.style.SUCCESS(f'  {l_count} student leaders appointed'))

        # ── 16. Boarding Students ──────────────────────────────────────────────
        self.stdout.write('Setting up boarding records...')
        BoardingStudent = m['BoardingStudent']
        boarding_data = [
            ('a.uwase@imboni.rw',       'Bisoke',    '1A', '01', 'full_boarder'),
            ('m.ingabire@imboni.rw',    'Bisoke',    '1B', '02', 'full_boarder'),
            ('l.uwineza@imboni.rw',     'Karisimbi', '2A', '01', 'full_boarder'),
            ('m.nyirabeza@imboni.rw',   'Bisoke',    '1C', '03', 'full_boarder'),
            ('d.umutoni@imboni.rw',     'Karisimbi', '2B', '02', 'full_boarder'),
            ('k.mutabazi@imboni.rw',    'Muhabura',  '1A', '01', 'full_boarder'),
            ('m.habimana@imboni.rw',    'Sabyinyo',  '1A', '01', 'full_boarder'),
            ('p.nkurunziza@imboni.rw',  'Sabyinyo',  '1B', '02', 'weekly_boarder'),
        ]
        bd_count = 0
        for s_email, dorm, room, bed, b_type in boarding_data:
            student = students.get(s_email)
            if student:
                _, created = BoardingStudent.objects.get_or_create(
                    student=student,
                    defaults={'dormitory': dorm, 'room_number': room,
                              'bed_number': bed, 'boarding_type': b_type,
                              'check_in_date': date(2026, 1, 5), 'is_active': True}
                )
                if created:
                    bd_count += 1
        self.stdout.write(self.style.SUCCESS(f'  {bd_count} boarding records created'))

        # ── 16b. Facilities (dormitories, dining halls, rooms) ────────────────
        self.stdout.write('Setting up school facilities...')
        DisFacility = m['DisFacility']
        facilities_data = [
            # (name, facility_type, gender, capacity, description)
            ('Bisoke',              'dormitory',  'girls', 60,  'Girls dormitory — S1–S3 wing'),
            ('Karisimbi',           'dormitory',  'girls', 50,  'Girls dormitory — S4–S6 wing'),
            ('Muhabura',            'dormitory',  'boys',  60,  'Boys dormitory — junior wing'),
            ('Sabyinyo',            'dormitory',  'boys',  55,  'Boys dormitory — senior wing'),
            ('Main Dining Hall',    'dining_hall','na',    300, 'Primary dining facility for all students'),
            ('Junior Dining Hall',  'dining_hall','na',    150, 'Secondary dining area — overflow and junior classes'),
            ('Student Common Room', 'common_room','mixed', 80,  'Shared common room for recreation and socialising'),
            ('Medical Bay',         'medical',    'na',    10,  'School health facility managed by the matron'),
            ('Sports Ground',       'sports',     'mixed', 200, 'Multi-purpose outdoor sports field'),
            ('Basketball Court',    'sports',     'mixed', 60,  'Outdoor basketball court'),
            ('School Library',      'library',    'mixed', 100, 'Main library — open weekdays until 6 PM'),
        ]
        fac_count = 0
        for name, ftype, gender, capacity, description in facilities_data:
            _, created = DisFacility.objects.get_or_create(
                name=name, facility_type=ftype,
                defaults={'gender': gender, 'capacity': capacity,
                          'description': description, 'is_active': True}
            )
            if created:
                fac_count += 1
        self.stdout.write(self.style.SUCCESS(f'  {fac_count} facilities created'))

        # ── 16c. Dormitory Sections ───────────────────────────────────────────
        self.stdout.write('Setting up dormitory sections...')
        DisFacilitySection = m['DisFacilitySection']
        sections_data = [
            ('Boys Section',  'boys',  'Dormitory section for male students',   ['Muhabura', 'Sabyinyo']),
            ('Girls Section', 'girls', 'Dormitory section for female students', ['Bisoke', 'Karisimbi']),
        ]
        for sec_name, gender, description, dorm_names in sections_data:
            sec, _ = DisFacilitySection.objects.get_or_create(
                name=sec_name,
                defaults={'gender': gender, 'description': description},
            )
            DisFacility.objects.filter(facility_type='dormitory', name__in=dorm_names).update(section=sec)
        self.stdout.write(self.style.SUCCESS('  Dormitory sections ready'))

        # ── 16d. Dining Plans ─────────────────────────────────────────────────
        self.stdout.write('Setting up dining plans...')
        DiningPlan = m['DiningPlan']
        dining_data = [
            # (student_email, plan_type)
            ('a.uwase@imboni.rw',       'full_board'),
            ('m.ingabire@imboni.rw',    'full_board'),
            ('l.uwineza@imboni.rw',     'full_board'),
            ('m.nyirabeza@imboni.rw',   'full_board'),
            ('d.umutoni@imboni.rw',     'full_board'),
            ('k.mutabazi@imboni.rw',    'full_board'),
            ('m.habimana@imboni.rw',    'full_board'),
            ('p.nkurunziza@imboni.rw',  'half_board'),
            ('j.bizimana@imboni.rw',    'day_scholar'),
            ('c.uwimana@imboni.rw',     'day_scholar'),
            ('f.ndayishimiye@imboni.rw','day_scholar'),
        ]
        dp_count = 0
        for s_email, plan_type in dining_data:
            student = students.get(s_email)
            if student:
                _, created = DiningPlan.objects.get_or_create(
                    student=student, term=current_term,
                    defaults={'plan_type': plan_type, 'is_active': True}
                )
                if created:
                    dp_count += 1
        self.stdout.write(self.style.SUCCESS(f'  {dp_count} dining plans created'))

        # ── 17. Discipline Staff ───────────────────────────────────────────────
        self.stdout.write('Setting up discipline staff...')
        DisciplineStaff = m['DisciplineStaff']
        matron_user = users.get('g.hakizimana@imboni.rw')
        disc_user   = users.get('p.habimana@imboni.rw')
        if matron_user:
            DisciplineStaff.objects.get_or_create(
                user=matron_user,
                defaults={'staff_type': 'matron', 'assigned_dormitory': 'Bisoke', 'is_active': True}
            )
        if disc_user:
            DisciplineStaff.objects.get_or_create(
                user=disc_user,
                defaults={'staff_type': 'director', 'is_active': True}
            )
        self.stdout.write(self.style.SUCCESS('  Discipline staff ready'))

        # ── 18. Conversations & Messages ───────────────────────────────────────
        self.stdout.write('Creating sample conversations...')
        Conversation = m['Conversation']
        Message      = m['Message']
        convo_data = [
            ('ch.uwase@gmail.com', 'c.umutoni@imboni.rw', 'Amina\'s English Progress',
             [('ch.uwase@gmail.com', 'Good morning Ms. Umutoni. How is Amina performing in English this term?'),
              ('c.umutoni@imboni.rw', 'Good morning Mrs. Uwase. Amina is doing very well. Her essay writing has improved significantly.'),
              ('ch.uwase@gmail.com', 'That is wonderful to hear. Thank you for the update.')]),
            ('r.mutabazi@gmail.com', 'p.rurangwa@imboni.rw', 'Kevin\'s Mathematics Results',
             [('r.mutabazi@gmail.com', 'Hello Mr. Rurangwa. I wanted to ask about Kevin\'s performance in Mathematics.'),
              ('p.rurangwa@imboni.rw', 'Hello Mr. Mutabazi. Kevin needs extra support. I recommend he attends the Saturday revision sessions.'),
              ('r.mutabazi@gmail.com', 'Thank you. We will make sure he attends.')]),
        ]
        msg_count = 0
        for p_email, t_email, subject, messages in convo_data:
            parent  = users.get(p_email)
            teacher = users.get(t_email)
            if not parent or not teacher:
                continue
            convo, _ = Conversation.objects.get_or_create(
                subject=subject,
                defaults={'is_group': False}
            )
            convo.participants.add(parent, teacher)
            for sender_email, content in messages:
                sender = users.get(sender_email)
                if sender:
                    msg, created = Message.objects.get_or_create(
                        conversation=convo, sender=sender, content=content
                    )
                    if created:
                        msg_count += 1
        self.stdout.write(self.style.SUCCESS(f'  {msg_count} messages created'))

        # ── 19. Teacher Class Lists ────────────────────────────────────────────
        self.stdout.write('Assigning teacher class lists...')
        TeacherClassList = m['TeacherClassList']
        TeacherClassList.objects.all().delete()
        for teacher_email, class_names in TEACHER_CLASSES.items():
            teacher = users.get(teacher_email)
            if not teacher:
                continue
            for class_name in class_names:
                TeacherClassList.objects.get_or_create(
                    teacher=teacher,
                    class_name=class_name,
                )
        self.stdout.write(self.style.SUCCESS('  Teacher class lists seeded'))

        # ── 20. Activities ────────────────────────────────────────────────────
        self.stdout.write('Creating extracurricular activities...')
        Activity     = m['Activity']
        ActivityEvent = m['ActivityEvent']
        ActivityEnrollment = m['ActivityEnrollment']
        activities_data = [
            ('Chess Club',          'debate',    'Mon & Wed 4:30–5:30 PM', 'Library Room 1', 20, 'c.umutoni@imboni.rw'),
            ('Basketball Team',     'sport',     'Tue & Thu 4:30–6:00 PM', 'Sports Ground',  15, 'p.rurangwa@imboni.rw'),
            ('Science Club',        'science',   'Friday 3:00–5:00 PM',    'Science Lab 1',  25, 's.uwera@imboni.rw'),
            ('Debate Club',         'debate',    'Monday 3:00–4:30 PM',    'Room 201',       20, 'c.umutoni@imboni.rw'),
            ('Drama & Arts Club',   'art',       'Wednesday 3:00–5:00 PM', 'School Hall',    30, 'i.nsabimana@imboni.rw'),
            ('Community Service',   'community', 'Saturday 8:00 AM–12:00', 'School Campus',  30, 'dos@imboni.rw'),
        ]
        activity_objs = {}
        act_count = 0
        for name, category, schedule, venue, max_m, teacher_email in activities_data:
            teacher = users.get(teacher_email)
            obj, created = Activity.objects.get_or_create(
                name=name,
                defaults={
                    'description': f'{name} — open to all students.',
                    'category': category,
                    'schedule': schedule,
                    'venue': venue,
                    'max_members': max_m,
                    'teacher_in_charge': teacher,
                    'is_active': True,
                }
            )
            activity_objs[name] = obj
            if created:
                act_count += 1
        self.stdout.write(self.style.SUCCESS(f'  {act_count} activities created'))

        # ── 21. Activity Events ────────────────────────────────────────────────
        self.stdout.write('Creating activity events...')
        events_data = [
            ('Chess Club',        'Inter-School Chess Tournament',    date(2026, 6, 14), time(9, 0),  time(12, 0), 'Library Room 1'),
            ('Science Club',      'Science Fair Preparation Session', date(2026, 6, 17), time(15, 0), time(17, 0), 'Science Lab 1'),
            ('Debate Club',       'Inter-School Debate Competition',  date(2026, 6, 20), time(8, 0),  time(16, 0), 'Room 201'),
            ('Basketball Team',   'Basketball Match vs. GSO',         date(2026, 6, 21), time(10, 0), time(12, 0), 'Sports Ground'),
            ('Drama & Arts Club', 'End-of-Term Drama Showcase',       date(2026, 7, 5),  time(17, 0), time(19, 0), 'School Hall'),
        ]
        ev_count = 0
        for act_name, title, ev_date, start, end, venue in events_data:
            act = activity_objs.get(act_name)
            if not act:
                continue
            _, created = ActivityEvent.objects.get_or_create(
                activity=act, title=title,
                defaults={'date': ev_date, 'start_time': start, 'end_time': end, 'venue': venue}
            )
            if created:
                ev_count += 1
        self.stdout.write(self.style.SUCCESS(f'  {ev_count} activity events created'))

        # ── 22. Activity Enrollments ───────────────────────────────────────────
        self.stdout.write('Enrolling students in activities...')
        enroll_data = [
            # student_email, activity_name
            ('a.uwase@imboni.rw',       'Chess Club'),
            ('a.uwase@imboni.rw',       'Science Club'),
            ('a.uwase@imboni.rw',       'Debate Club'),
            ('m.ingabire@imboni.rw',    'Science Club'),
            ('m.ingabire@imboni.rw',    'Drama & Arts Club'),
            ('k.mutabazi@imboni.rw',    'Basketball Team'),
            ('k.mutabazi@imboni.rw',    'Community Service'),
            ('d.umutoni@imboni.rw',     'Drama & Arts Club'),
            ('g.hakizimana.s@imboni.rw','Chess Club'),
            ('c.uwimana@imboni.rw',     'Debate Club'),
            ('l.uwineza@imboni.rw',     'Science Club'),
        ]
        en_count = 0
        for s_email, act_name in enroll_data:
            student = students.get(s_email)
            act     = activity_objs.get(act_name)
            if student and act:
                _, created = ActivityEnrollment.objects.get_or_create(
                    student=student, activity=act,
                    defaults={'status': 'active'}
                )
                if created:
                    en_count += 1
        self.stdout.write(self.style.SUCCESS(f'  {en_count} enrollments created'))

        # ── 23. Assignments + Submissions ─────────────────────────────────────
        self.stdout.write('Creating assignments...')
        Assignment         = m['Assignment']
        AssignmentSubmission = m['AssignmentSubmission']

        s4a_class = classes.get('S4A')
        if s4a_class:
            # Assignments for S4A — mix of pending, upcoming, and past
            assignments_data = [
                # title, subject_code, teacher_email, due_date, description
                ('Term 2 Mathematics Problem Set',      'MTH', 'p.rurangwa@imboni.rw',      date(2026, 6, 15), 'Complete exercises 5.1 to 5.4 from the textbook.'),
                ('English Persuasive Essay',            'ENG', 'c.umutoni@imboni.rw',       date(2026, 6, 12), 'Write a 600-word persuasive essay on the effects of social media on youth.'),
                ('Physics Lab Report — Projectile',    'PHY', 's.uwera@imboni.rw',         date(2026, 6, 10), 'Write up your lab report from the projectile motion experiment.'),
                ('Chemistry Worksheet — Reaction Rates','CHE', 't.bizimana@imboni.rw',      date(2026, 6, 20), 'Answer all questions on reaction rates and equilibrium.'),
                ('History Essay — Colonial Rwanda',    'HIS', 'j.ntakirutimana@imboni.rw', date(2026, 6, 25), 'Discuss the impact of colonialism on Rwandan society and culture (800 words).'),
                ('Mathematics CAT 2 Preparation Notes','MTH', 'p.rurangwa@imboni.rw',      date(2026, 5, 28), 'Summarise your revision notes for CAT 2 — Algebra & Functions.'),
                ('Computer Science Design Brief',      'ICT', 'i.nsabimana@imboni.rw',     date(2026, 5, 30), 'Create a design brief for your Term 2 website project.'),
                ('Biology — Ecosystems Report',        'BIO', 'i.nsabimana@imboni.rw',     date(2026, 5, 20), 'Write a report on the ecosystem you studied in the field trip.'),
            ]
            ass_objs = {}
            ass_count = 0
            for title, subj_code, teacher_email, due_d, desc in assignments_data:
                subj    = subjects.get(subj_code)
                teacher = users.get(teacher_email)
                if not subj or not teacher:
                    continue
                obj, created = Assignment.objects.get_or_create(
                    title=title, class_obj=s4a_class, term=current_term,
                    defaults={
                        'subject': subj,
                        'teacher': teacher,
                        'due_date': due_d,
                        'description': desc,
                    }
                )
                ass_objs[title] = obj
                if created:
                    ass_count += 1
            self.stdout.write(self.style.SUCCESS(f'  {ass_count} assignments created'))

            # Submissions for Amina (a.uwase@imboni.rw)
            amina = students.get('a.uwase@imboni.rw')
            if amina:
                sub_data = [
                    # assignment_title, status, grade, feedback
                    ('Mathematics CAT 2 Preparation Notes', 'graded',    85.0, 'Well-structured notes. Excellent coverage of all topics.'),
                    ('Computer Science Design Brief',       'submitted',  None, ''),
                ]
                sub_count = 0
                for title, sub_status, grade, feedback in sub_data:
                    ass = ass_objs.get(title)
                    if ass:
                        _, created = AssignmentSubmission.objects.get_or_create(
                            assignment=ass, student=amina,
                            defaults={'status': sub_status, 'grade': grade, 'feedback': feedback, 'notes': ''}
                        )
                        if created:
                            sub_count += 1
                self.stdout.write(self.style.SUCCESS(f'  {sub_count} assignment submissions created for Amina'))
        else:
            self.stdout.write(self.style.WARNING('  S4A class not found — skipping assignments'))

        # ── 24. Teacher Tasks ─────────────────────────────────────────────────
        self.stdout.write('Creating teacher tasks...')
        Task = m['Task']
        tasks_data = [
            # (teacher_email, title, description, priority, due_date, is_completed)
            ('c.umutoni@imboni.rw',       'Grade S1A English Essays',            'Review and grade the persuasive essays submitted by S1A students.',                         'high',   date(2026, 6, 10), False),
            ('c.umutoni@imboni.rw',       'Prepare Term 2 Reading List',         'Compile recommended reading materials for S3A literature module.',                          'medium', date(2026, 6, 20), False),
            ('c.umutoni@imboni.rw',       'Submit S3A Attendance Report',        'Complete monthly attendance report for S3A — May 2026.',                                   'high',   date(2026, 5, 31), True ),
            ('c.umutoni@imboni.rw',       'Parent Meeting Preparation',          'Prepare student progress notes for the upcoming parent-teacher meeting.',                   'medium', date(2026, 6, 25), False),
            ('p.rurangwa@imboni.rw',      'Prepare CAT 2 Mathematics Paper',     'Set questions and marking scheme for S2 CAT 2.',                                           'high',   date(2026, 6, 14), False),
            ('p.rurangwa@imboni.rw',      'Grade S4A Problem Sets',              'Mark and enter scores for the Term 2 problem set submission.',                             'high',   date(2026, 6, 16), False),
            ('p.rurangwa@imboni.rw',      'Order Mathematical Tables',           'Submit request to admin for new sets of mathematical tables for S4 and S5.',               'low',    date(2026, 6, 30), False),
            ('p.rurangwa@imboni.rw',      'Review S2B Progress Reports',         'Review term progress for S2B and update the class register.',                              'medium', date(2026, 6, 12), True ),
            ('i.nsabimana@imboni.rw',     'Science Fair Preparation',            'Guide S4A students in preparing their science fair projects for July showcase.',           'medium', date(2026, 6, 25), False),
            ('i.nsabimana@imboni.rw',     'Lab Equipment Inventory',             'Complete end-of-term inventory of Biology lab equipment and supplies.',                    'medium', date(2026, 6, 28), False),
            ('i.nsabimana@imboni.rw',     'Submit S3A Biology Results',          'Enter and submit Biology Term 2 assessment results for S3A.',                              'high',   date(2026, 6, 7),  True ),
            ('i.nsabimana@imboni.rw',     'Prepare Genetics Lesson Materials',   'Print and organise genetics worksheets and diagrams for the upcoming unit.',               'low',    date(2026, 6, 22), False),
            ('t.bizimana@imboni.rw',      'Chemistry Mock Exam Review',          'Review S2B Chemistry mock exam papers and record scores.',                                 'high',   date(2026, 6, 12), False),
            ('t.bizimana@imboni.rw',      'Update Lab Safety Manual',            'Revise the chemistry lab safety procedures document.',                                     'low',    date(2026, 6, 30), False),
            ('t.bizimana@imboni.rw',      'Order Chemistry Reagents',            'Submit requisition for lab reagents needed for Term 3 practicals.',                        'medium', date(2026, 6, 20), False),
            ('s.uwera@imboni.rw',         'Grade Physics Lab Reports',           'Mark the projectile motion lab reports for S3A and S4A.',                                 'high',   date(2026, 6, 11), False),
            ('s.uwera@imboni.rw',         'Prepare End-of-Term Practical',       'Design and set up Physics practical exam for S3 and S4.',                                 'medium', date(2026, 6, 22), False),
            ('s.uwera@imboni.rw',         'Submit S3A Physics Marks',            'Enter continuous assessment marks for S3A into the school system.',                       'high',   date(2026, 6, 8),  True ),
            ('j.ntakirutimana@imboni.rw', 'Plan Field Trip to Museum',           'Organise a History field trip to the Kigali Memorial Centre for S4A.',                   'medium', date(2026, 7, 5),  False),
            ('j.ntakirutimana@imboni.rw', 'Grade History Essays',               'Mark and record scores for the Colonial Rwanda essay assignment.',                         'high',   date(2026, 6, 28), False),
            ('j.ntakirutimana@imboni.rw', 'Update S4A Scheme of Work',          'Update the History scheme of work for Term 3 in line with new curriculum guidelines.',    'medium', date(2026, 6, 18), False),
        ]
        task_count = 0
        for teacher_email, title, description, priority, due_d, is_completed in tasks_data:
            teacher = users.get(teacher_email)
            if teacher:
                _, created = Task.objects.get_or_create(
                    teacher=teacher, title=title,
                    defaults={'description': description, 'priority': priority,
                              'due_date': due_d, 'is_completed': is_completed}
                )
                if created:
                    task_count += 1
        self.stdout.write(self.style.SUCCESS(f'  {task_count} teacher tasks created'))

        # ── 25. Teacher Announcements ──────────────────────────────────────────
        self.stdout.write('Creating teacher announcements...')
        teacher_ann_data = [
            # (teacher_email, title, content, category, audience, status)
            ('c.umutoni@imboni.rw',       'S3A English Assignment Extension',
             'Due to the Science Day event, the deadline for the S3A English persuasive essay has been extended by three days. New deadline: Friday, June 12, 2026.',
             'academic', 'students', 'published'),
            ('p.rurangwa@imboni.rw',      'Mathematics CAT 2 — Date Confirmed',
             'The Mathematics CAT 2 for all S4 and S5 classes will be held on June 14, 2026 from 8:00 AM to 10:00 AM. Students must bring their own calculators.',
             'academic', 'students', 'published'),
            ('i.nsabimana@imboni.rw',     'Science Fair Registration Open',
             'Registration for the Term 2 Science Fair is now open. All S4 students must register their project titles with Mr. Nsabimana by June 13, 2026.',
             'event', 'students', 'published'),
            ('s.uwera@imboni.rw',         'Physics Practical Session — S3A',
             'A compulsory practical for S3A Physics will be held on June 10, 2026 from 2:00 PM to 4:00 PM in the Physics Lab. Bring your lab notebooks.',
             'academic', 'students', 'published'),
            ('j.ntakirutimana@imboni.rw', 'History Museum Visit — Permission Forms',
             'Permission forms for the Kigali Memorial Centre visit (July 5, 2026) have been distributed. Signed forms must be returned to Mr. Ntakirutimana by June 25.',
             'event', 'parents', 'published'),
            ('c.umutoni@imboni.rw',       'Reading Week — S1A Library Sessions',
             'S1A students will have dedicated library sessions every Tuesday from June 9 to June 30, 3:30–4:30 PM. Attendance is compulsory.',
             'academic', 'students', 'published'),
            ('t.bizimana@imboni.rw',      'S2B Chemistry Lab Rules Reminder',
             'All S2B students are reminded to wear lab coats and safety goggles during every Chemistry practical session. Non-compliance will result in exclusion from the lab.',
             'general', 'students', 'published'),
        ]
        t_ann_count = 0
        for i, (teacher_email, title, content, category, audience, ann_status) in enumerate(teacher_ann_data):
            teacher = users.get(teacher_email)
            if teacher:
                _, created = Announcement.objects.get_or_create(
                    title=title,
                    defaults={'content': content, 'category': category, 'target_audience': audience,
                              'author': teacher, 'status': ann_status,
                              'published_at': timezone.now() - timedelta(days=i + 1)}
                )
                if created:
                    t_ann_count += 1
        self.stdout.write(self.style.SUCCESS(f'  {t_ann_count} teacher announcements created'))

        # ── 26. Additional Assessments (all classes) ──────────────────────────
        self.stdout.write('Creating additional assessments...')
        extra_assessment_data = [
            # (student_email, subject_code, assessment_type, title, date, max_score, score_obtained)
            # S1A — Grace
            ('g.hakizimana.s@imboni.rw', 'ENG', 'quiz',         'Comprehension Exercise 1',           date(2026, 5, 6),  20, 17),
            ('g.hakizimana.s@imboni.rw', 'KIN', 'homework',     'Kinyarwanda Composition',            date(2026, 5, 9),  20, 16),
            ('g.hakizimana.s@imboni.rw', 'HIS', 'quiz',         'Pre-Colonial Rwanda Quiz',           date(2026, 5, 13), 20, 18),
            # S1B — Eric
            ('e.ndagijimana@imboni.rw',  'MTH', 'quiz',         'Number Patterns Quiz',               date(2026, 5, 6),  20, 11),
            ('e.ndagijimana@imboni.rw',  'ENG', 'homework',     'Grammar Worksheet',                  date(2026, 5, 9),  20, 9 ),
            ('e.ndagijimana@imboni.rw',  'GEO', 'quiz',         'Map Reading Exercise',               date(2026, 5, 14), 20, 13),
            # S2A — Peter
            ('p.nkurunziza@imboni.rw',   'ENG', 'quiz',         'Vocabulary Test',                    date(2026, 5, 7),  20, 10),
            ('p.nkurunziza@imboni.rw',   'HIS', 'homework',     'Research Task — Colonialism',        date(2026, 5, 11), 20, 12),
            ('p.nkurunziza@imboni.rw',   'BIO', 'lab',          'Plant Cell Lab',                     date(2026, 5, 14), 30, 16),
            # S3A — Marie
            ('m.ingabire@imboni.rw',     'MTH', 'quiz',         'Quadratic Equations Quiz',           date(2026, 5, 7),  20, 19),
            ('m.ingabire@imboni.rw',     'ENG', 'presentation', 'Book Report — Animal Farm',          date(2026, 5, 10), 30, 27),
            ('m.ingabire@imboni.rw',     'CHE', 'lab',          'Periodic Table Lab',                 date(2026, 5, 13), 30, 24),
            # S3A — Lydia
            ('l.uwineza@imboni.rw',      'MTH', 'quiz',         'Algebra Quiz #2',                    date(2026, 5, 7),  20, 17),
            ('l.uwineza@imboni.rw',      'ENG', 'quiz',         'Reading Comprehension — S3',         date(2026, 5, 11), 20, 15),
            ('l.uwineza@imboni.rw',      'PHY', 'lab',          'Energy & Work Lab',                  date(2026, 5, 14), 30, 22),
            # S3A — Mercy
            ('m.nyirabeza@imboni.rw',    'MTH', 'quiz',         'Quadratic Equations Quiz',           date(2026, 5, 7),  20, 16),
            ('m.nyirabeza@imboni.rw',    'BIO', 'lab',          'Photosynthesis Lab',                 date(2026, 5, 12), 30, 22),
            ('m.nyirabeza@imboni.rw',    'HIS', 'quiz',         'Independence Movements Quiz',        date(2026, 5, 15), 20, 15),
            # S3B — Kevin
            ('k.mutabazi@imboni.rw',     'MTH', 'quiz',         'Algebra & Functions Quiz',           date(2026, 5, 7),  20, 13),
            ('k.mutabazi@imboni.rw',     'BIO', 'homework',     'Ecology Worksheet',                  date(2026, 5, 11), 20, 14),
            ('k.mutabazi@imboni.rw',     'PHY', 'lab',          'Friction & Motion Lab',              date(2026, 5, 14), 30, 18),
            # S3B — Moses
            ('m.habimana@imboni.rw',     'ENG', 'quiz',         'Grammar & Punctuation Test',         date(2026, 5, 8),  20, 12),
            ('m.habimana@imboni.rw',     'BIO', 'lab',          'Enzyme Activity Lab',                date(2026, 5, 12), 30, 17),
            ('m.habimana@imboni.rw',     'HIS', 'homework',     'Essay — Genocide Against Tutsi',     date(2026, 5, 15), 20, 13),
            # S4A — Felix
            ('f.ndayishimiye@imboni.rw', 'MTH', 'quiz',         'Algebra Quiz #3',                    date(2026, 5, 8),  20, 16),
            ('f.ndayishimiye@imboni.rw', 'ENG', 'homework',     'Essay — Technology in Society',      date(2026, 5, 12), 20, 14),
            ('f.ndayishimiye@imboni.rw', 'PHY', 'lab',          'Optics Lab — Lenses',                date(2026, 5, 14), 30, 23),
            # S4A — Clarisse
            ('c.uwimana@imboni.rw',      'MTH', 'quiz',         'Calculus Introduction Quiz',         date(2026, 5, 8),  20, 18),
            ('c.uwimana@imboni.rw',      'PHY', 'quiz',         'Waves & Sound Quiz',                 date(2026, 5, 11), 20, 17),
            ('c.uwimana@imboni.rw',      'ENG', 'presentation', 'Oral Presentation — Leadership',     date(2026, 5, 13), 30, 28),
            # S4A — David
            ('d.nkurunziza@imboni.rw',   'MTH', 'quiz',         'Calculus Introduction Quiz',         date(2026, 5, 8),  20, 14),
            ('d.nkurunziza@imboni.rw',   'ENG', 'homework',     'Essay — Environmental Issues',       date(2026, 5, 12), 20, 13),
            ('d.nkurunziza@imboni.rw',   'CHE', 'lab',          'Redox Reactions Lab',                date(2026, 5, 15), 30, 19),
            # S4B — Joy
            ('j.mukamazimpaka@imboni.rw','MTH', 'quiz',         'Quadratic Functions Quiz',           date(2026, 5, 8),  20, 17),
            ('j.mukamazimpaka@imboni.rw','ENG', 'quiz',         'Reading & Summary Skills',           date(2026, 5, 12), 20, 16),
            ('j.mukamazimpaka@imboni.rw','BIO', 'lab',          'Genetics & Heredity Lab',            date(2026, 5, 15), 30, 24),
            # S5A — Diane
            ('d.umutoni@imboni.rw',      'MTH', 'quiz',         'Integration Techniques Quiz',        date(2026, 5, 9),  20, 18),
            ('d.umutoni@imboni.rw',      'ENG', 'presentation', 'Debate: Technology & Society',       date(2026, 5, 13), 30, 27),
            ('d.umutoni@imboni.rw',      'CHE', 'lab',          'Organic Chemistry — Reactions',      date(2026, 5, 15), 30, 25),
            # S5A — James
            ('j.bizimana@imboni.rw',     'MTH', 'quiz',         'Integration Techniques Quiz',        date(2026, 5, 9),  20, 14),
            ('j.bizimana@imboni.rw',     'ENG', 'homework',     'Literary Analysis — Poem',           date(2026, 5, 13), 20, 13),
            ('j.bizimana@imboni.rw',     'PHY', 'lab',          'Electromagnetic Induction Lab',      date(2026, 5, 15), 30, 21),
        ]
        extra_a_count = 0
        for s_email, subj_code, a_type, title, a_date, max_s, obtained in extra_assessment_data:
            student = students.get(s_email)
            subject = subjects.get(subj_code)
            if not student or not subject:
                continue
            _, created = Assessment.objects.get_or_create(
                student=student, subject=subject, title=title,
                defaults={'term': current_term, 'assessment_type': a_type,
                          'date': a_date, 'max_score': max_s, 'score_obtained': obtained}
            )
            if created:
                extra_a_count += 1
        self.stdout.write(self.style.SUCCESS(f'  {extra_a_count} additional assessments created'))

        # ── 27. Additional Results (all students & subjects) ──────────────────
        self.stdout.write('Creating additional results...')
        extra_result_data = [
            # (student_email, subject_code, class_test_marks, exam_score, teacher_comment, status)
            # S1A — Grace
            ('g.hakizimana.s@imboni.rw', 'ENG', 18, 70, 'Excellent comprehension skills.',           'approved'),
            ('g.hakizimana.s@imboni.rw', 'HIS', 19, 72, 'Outstanding grasp of Rwandan history.',    'submitted'),
            ('g.hakizimana.s@imboni.rw', 'KIN', 17, 68, 'Very good Kinyarwanda writing.',           'submitted'),
            # S1B — Eric
            ('e.ndagijimana@imboni.rw',  'MTH', 10, 34, 'Needs significant support in numeracy.',   'submitted'),
            ('e.ndagijimana@imboni.rw',  'HIS', 12, 42, 'Average understanding of concepts.',       'approved'),
            ('e.ndagijimana@imboni.rw',  'GEO', 13, 47, 'Some improvement noted. Keep working.',    'submitted'),
            # S2A — Peter
            ('p.nkurunziza@imboni.rw',   'ENG', 11, 38, 'Vocabulary needs work.',                   'submitted'),
            ('p.nkurunziza@imboni.rw',   'BIO', 13, 47, 'Reasonable effort in lab sessions.',       'submitted'),
            ('p.nkurunziza@imboni.rw',   'HIS', 12, 44, 'Improving but needs more effort.',         'submitted'),
            # S3A — Marie
            ('m.ingabire@imboni.rw',     'CHE', 19, 73, 'Excellent chemistry knowledge.',           'approved'),
            ('m.ingabire@imboni.rw',     'PHY', 17, 65, 'Strong analytical reasoning.',             'submitted'),
            ('m.ingabire@imboni.rw',     'ENG', 18, 69, 'Outstanding written expression.',          'submitted'),
            # S3A — Lydia
            ('l.uwineza@imboni.rw',      'MTH', 17, 64, 'Good problem-solving approach.',           'approved'),
            ('l.uwineza@imboni.rw',      'PHY', 15, 57, 'Improving steadily.',                      'submitted'),
            ('l.uwineza@imboni.rw',      'ENG', 16, 62, 'Good comprehension and writing skills.',   'submitted'),
            # S3A — Mercy
            ('m.nyirabeza@imboni.rw',    'MTH', 16, 61, 'Good consistency in performance.',         'approved'),
            ('m.nyirabeza@imboni.rw',    'BIO', 15, 58, 'Good lab work throughout.',                'submitted'),
            ('m.nyirabeza@imboni.rw',    'HIS', 15, 60, 'Good understanding of modern history.',    'submitted'),
            # S3B — Kevin
            ('k.mutabazi@imboni.rw',     'MTH', 14, 51, 'Satisfactory. Needs focus on algebra.',    'submitted'),
            ('k.mutabazi@imboni.rw',     'PHY', 13, 49, 'Needs to improve practical skills.',       'submitted'),
            ('k.mutabazi@imboni.rw',     'BIO', 14, 53, 'Adequate performance in lab sessions.',    'submitted'),
            # S3B — Moses
            ('m.habimana@imboni.rw',     'ENG', 12, 45, 'Needs to focus on grammar.',               'submitted'),
            ('m.habimana@imboni.rw',     'BIO', 14, 53, 'Satisfactory lab results.',                'submitted'),
            ('m.habimana@imboni.rw',     'HIS', 13, 50, 'Average performance.',                     'submitted'),
            # S4A — Felix
            ('f.ndayishimiye@imboni.rw', 'MTH', 16, 60, 'Good problem-solving skills.',             'approved'),
            ('f.ndayishimiye@imboni.rw', 'PHY', 17, 63, 'Excellent lab technique.',                 'submitted'),
            ('f.ndayishimiye@imboni.rw', 'ENG', 15, 58, 'Good written work.',                       'submitted'),
            # S4A — Clarisse
            ('c.uwimana@imboni.rw',      'MTH', 18, 70, 'Exceptional mathematical ability.',        'approved'),
            ('c.uwimana@imboni.rw',      'PHY', 17, 66, 'Very strong theoretical understanding.',   'submitted'),
            ('c.uwimana@imboni.rw',      'ENG', 18, 71, 'Outstanding performance in English.',      'submitted'),
            # S4A — David
            ('d.nkurunziza@imboni.rw',   'MTH', 15, 56, 'Average performance. Needs revision.',    'submitted'),
            ('d.nkurunziza@imboni.rw',   'CHE', 14, 52, 'Satisfactory lab work.',                   'submitted'),
            ('d.nkurunziza@imboni.rw',   'ENG', 14, 55, 'Average. More practice needed.',           'submitted'),
            # S4B — Joy
            ('j.mukamazimpaka@imboni.rw','MTH', 17, 65, 'Good application of functions.',           'approved'),
            ('j.mukamazimpaka@imboni.rw','BIO', 18, 68, 'Excellent genetics understanding.',        'submitted'),
            ('j.mukamazimpaka@imboni.rw','ENG', 17, 66, 'Strong writing and analysis.',             'submitted'),
            # S5A — Diane
            ('d.umutoni@imboni.rw',      'MTH', 19, 72, 'Outstanding performance throughout.',     'approved'),
            ('d.umutoni@imboni.rw',      'CHE', 18, 69, 'Excellent organic chemistry knowledge.',  'submitted'),
            ('d.umutoni@imboni.rw',      'ENG', 18, 71, 'Very articulate. Excellent essays.',       'submitted'),
            # S5A — James
            ('j.bizimana@imboni.rw',     'MTH', 14, 52, 'Needs to revise integration techniques.', 'submitted'),
            ('j.bizimana@imboni.rw',     'PHY', 15, 55, 'Reasonable lab performance.',             'submitted'),
            ('j.bizimana@imboni.rw',     'ENG', 13, 50, 'Needs to improve essay structure.',        'submitted'),
        ]
        extra_r_count = 0
        for s_email, subj_code, ct_marks, exam, comment, r_status in extra_result_data:
            student = students.get(s_email)
            subject = subjects.get(subj_code)
            teacher = subject_teacher_map.get(subj_code, list(users.values())[2])
            if not student or not subject:
                continue
            defaults = {
                'teacher':          teacher,
                'class_test_marks': ct_marks,
                'exam_score':       exam,
                'teacher_comment':  comment,
                'submitted_at':     timezone.now(),
                'status':           r_status,
            }
            if r_status == 'approved':
                defaults['dos_comment'] = 'Reviewed and approved.'
                defaults['approved_by'] = dos_user
                defaults['approved_at'] = timezone.now()
            Result.objects.get_or_create(
                student=student, subject=subject, term=current_term,
                defaults=defaults,
            )
            extra_r_count += 1
        self.stdout.write(self.style.SUCCESS(f'  {extra_r_count} additional results processed'))

        # ── 28. Assignments for Other Classes ─────────────────────────────────
        self.stdout.write('Creating assignments for other classes...')
        other_class_assignments = [
            # (class_name, title, subject_code, teacher_email, due_date, description)
            ('S3A', 'Biology Cell Division Essay',            'BIO', 'i.nsabimana@imboni.rw',     date(2026, 6, 13), 'Write a 400-word essay explaining the stages of mitosis and meiosis.'),
            ('S3A', 'English Book Report',                    'ENG', 'c.umutoni@imboni.rw',       date(2026, 6, 10), 'Write a book report on any novel of your choice (minimum 300 words).'),
            ('S3A', 'Mathematics — Simultaneous Equations',   'MTH', 'p.rurangwa@imboni.rw',      date(2026, 6, 17), 'Solve all problems from Chapter 6 exercises 6.1 to 6.3.'),
            ('S3A', 'Physics Motion Lab Write-up',            'PHY', 's.uwera@imboni.rw',         date(2026, 6, 11), "Write a formal lab report for the Newton's Laws practical session."),
            ('S3B', 'Mathematics Algebra Worksheet',          'MTH', 'p.rurangwa@imboni.rw',      date(2026, 6, 17), 'Complete the algebra worksheet focusing on factorisation and expansion.'),
            ('S3B', 'English Grammar Revision',               'ENG', 'c.umutoni@imboni.rw',       date(2026, 6, 12), 'Complete the grammar revision booklet pages 24–38.'),
            ('S3B', 'History — Independence Essay',           'HIS', 'j.ntakirutimana@imboni.rw', date(2026, 6, 20), 'Write a 500-word essay on the path to Rwandan independence.'),
            ('S2A', 'Mathematics — Fractions & Decimals',     'MTH', 'p.rurangwa@imboni.rw',      date(2026, 6, 14), 'Complete exercises on fractions, decimals and percentages from Chapter 4.'),
            ('S2A', 'English Reading Comprehension',          'ENG', 'c.umutoni@imboni.rw',       date(2026, 6, 11), 'Read the passage on page 85 and answer all comprehension questions.'),
            ('S2A', 'Chemistry — Elements Worksheet',         'CHE', 't.bizimana@imboni.rw',      date(2026, 6, 18), 'Complete the worksheet on the first 20 elements of the periodic table.'),
            ('S2B', 'Chemistry Acid & Base Lab Report',       'CHE', 't.bizimana@imboni.rw',      date(2026, 6, 13), 'Write up the formal report from the acid-base neutralisation practical.'),
            ('S2B', 'Mathematics — Geometry',                 'MTH', 'p.rurangwa@imboni.rw',      date(2026, 6, 18), 'Complete geometry exercises from Chapter 7 — angles, triangles and circles.'),
            ('S1A', 'English — Descriptive Writing',          'ENG', 'c.umutoni@imboni.rw',       date(2026, 6, 10), 'Write a descriptive paragraph (150 words) about your favourite place in Rwanda.'),
            ('S1A', 'Mathematics — Number Systems',           'MTH', 'p.rurangwa@imboni.rw',      date(2026, 6, 15), 'Complete number system exercises from Chapter 2, pages 14–18.'),
            ('S1A', 'History — Pre-Colonial Rwanda',          'HIS', 'j.ntakirutimana@imboni.rw', date(2026, 6, 22), 'Draw a timeline of key events in pre-colonial Rwanda (1600–1900).'),
            ('S1B', 'Mathematics — Basic Arithmetic',         'MTH', 'p.rurangwa@imboni.rw',      date(2026, 6, 15), 'Complete arithmetic exercises: addition, subtraction, multiplication.'),
            ('S1B', 'History — Ancient Rwanda Map',           'HIS', 'j.ntakirutimana@imboni.rw', date(2026, 6, 22), 'Draw and label the map of pre-colonial Rwanda with key kingdoms.'),
            ('S5A', 'Mathematics Integration Problem Set',    'MTH', 'p.rurangwa@imboni.rw',      date(2026, 6, 16), 'Solve the integration problem set from Chapter 9, all exercises.'),
            ('S5A', 'Physics — Electromagnetic Induction Lab','PHY', 's.uwera@imboni.rw',         date(2026, 6, 12), 'Complete the formal write-up for the electromagnetic induction experiment.'),
            ('S6A', 'Mathematics — Mock Exam Revision',       'MTH', 'p.rurangwa@imboni.rw',      date(2026, 6, 20), 'Complete the mock exam revision paper from last year with full working.'),
        ]
        other_ass_count = 0
        for class_name, title, subj_code, teacher_email, due_d, desc in other_class_assignments:
            cls     = classes.get(class_name)
            subj    = subjects.get(subj_code)
            teacher = users.get(teacher_email)
            if not cls or not subj or not teacher:
                continue
            _, created = Assignment.objects.get_or_create(
                title=title, class_obj=cls, term=current_term,
                defaults={'subject': subj, 'teacher': teacher, 'due_date': due_d, 'description': desc}
            )
            if created:
                other_ass_count += 1
        self.stdout.write(self.style.SUCCESS(f'  {other_ass_count} assignments for other classes created'))

        # ── 29. More Assignment Submissions ───────────────────────────────────
        self.stdout.write('Creating additional assignment submissions...')
        extra_submissions = [
            # (student_email, assignment_title, class_name, status, grade, feedback)
            ('m.ingabire@imboni.rw',    'Biology Cell Division Essay',          'S3A', 'submitted', None, ''),
            ('l.uwineza@imboni.rw',     'Biology Cell Division Essay',          'S3A', 'submitted', None, ''),
            ('m.nyirabeza@imboni.rw',   'Mathematics — Simultaneous Equations', 'S3A', 'submitted', None, ''),
            ('l.uwineza@imboni.rw',     'English Book Report',                  'S3A', 'graded', 82.0, 'Very well-written report. Clear analysis and good structure.'),
            ('m.ingabire@imboni.rw',    'English Book Report',                  'S3A', 'graded', 90.0, 'Exceptional literary insight. One of the best reports this term.'),
            ('k.mutabazi@imboni.rw',    'Mathematics Algebra Worksheet',        'S3B', 'submitted', None, ''),
            ('m.habimana@imboni.rw',    'English Grammar Revision',             'S3B', 'submitted', None, ''),
            ('p.nkurunziza@imboni.rw',  'Mathematics — Fractions & Decimals',   'S2A', 'submitted', None, ''),
            ('g.hakizimana.s@imboni.rw','English — Descriptive Writing',        'S1A', 'graded', 90.0, 'Exceptional writing. Beautiful description of Kigali.'),
            ('g.hakizimana.s@imboni.rw','Mathematics — Number Systems',         'S1A', 'submitted', None, ''),
            ('c.uwimana@imboni.rw',     'Term 2 Mathematics Problem Set',       'S4A', 'graded', 78.0, 'Good work. Review question 5 for next time.'),
            ('f.ndayishimiye@imboni.rw','Physics Lab Report — Projectile',      'S4A', 'submitted', None, ''),
            ('d.nkurunziza@imboni.rw',  'History Essay — Colonial Rwanda',      'S4A', 'submitted', None, ''),
            ('j.mukamazimpaka@imboni.rw','English Persuasive Essay',            'S4A', 'submitted', None, ''),
            ('d.umutoni@imboni.rw',     'Chemistry Worksheet — Reaction Rates', 'S4A', 'graded', 91.0, 'Excellent understanding of equilibrium constants.'),
            ('j.bizimana@imboni.rw',    'History Essay — Colonial Rwanda',      'S4A', 'submitted', None, ''),
            ('d.umutoni@imboni.rw',     'Mathematics Integration Problem Set',  'S5A', 'submitted', None, ''),
            ('j.bizimana@imboni.rw',    'Physics — Electromagnetic Induction Lab','S5A', 'submitted', None, ''),
        ]
        extra_sub_count = 0
        for s_email, ass_title, class_name, sub_status, grade, feedback in extra_submissions:
            student = students.get(s_email)
            cls     = classes.get(class_name)
            if not student or not cls:
                continue
            ass = Assignment.objects.filter(title=ass_title, class_obj=cls, term=current_term).first()
            if not ass:
                continue
            _, created = AssignmentSubmission.objects.get_or_create(
                assignment=ass, student=student,
                defaults={'status': sub_status, 'grade': grade, 'feedback': feedback, 'notes': ''}
            )
            if created:
                extra_sub_count += 1
        self.stdout.write(self.style.SUCCESS(f'  {extra_sub_count} additional submissions created'))

        # ── 30. More Conversations & Messages ─────────────────────────────────
        self.stdout.write('Creating additional conversations...')
        more_convos = [
            ('p.rurangwa@imboni.rw', 'c.umutoni@imboni.rw', 'CAT 2 Coordination',
             [('p.rurangwa@imboni.rw',  'Good morning Ms. Umutoni. Are we coordinating the CAT 2 date with the admin office?'),
              ('c.umutoni@imboni.rw',   'Yes, I spoke with the principal. June 14th has been confirmed for all S4 and S5 classes.'),
              ('p.rurangwa@imboni.rw',  'Perfect. I will prepare the Mathematics paper and share it with you by June 10th for review.')]),
            ('i.nsabimana@imboni.rw', 'dos@imboni.rw', 'Science Fair Approval',
             [('i.nsabimana@imboni.rw', 'Good afternoon. I would like to formally request approval for the Term 2 Science Fair scheduled for July 5.'),
              ('dos@imboni.rw',         'Thank you Mr. Nsabimana. The Science Fair is approved. Please submit the student project list by June 20.'),
              ('i.nsabimana@imboni.rw', 'Understood. I will have the list ready well before then. Thank you.')]),
            ('s.uwera@imboni.rw', 'p.rurangwa@imboni.rw', 'Lab Room Booking',
             [('s.uwera@imboni.rw',     'Hi Mr. Rurangwa. Can we coordinate on the Physics lab booking? I need it on June 10 and 17 afternoons.'),
              ('p.rurangwa@imboni.rw',  'No conflict on my end. June 10 and 17 are free. I will note that in the lab schedule.')]),
            ('f.nkurunziza@gmail.com', 'p.rurangwa@imboni.rw', "Peter's Mathematics Results",
             [('f.nkurunziza@gmail.com','Hello Mr. Rurangwa. I am concerned about Peter\'s Mathematics performance this term. Can we discuss?'),
              ('p.rurangwa@imboni.rw',  "Good morning Mr. Nkurunziza. Peter is struggling with algebra. I recommend Saturday revision sessions."),
              ('f.nkurunziza@gmail.com','Thank you for the information. We will ensure he attends the revision sessions.')]),
            ('e.ingabire@gmail.com', 'i.nsabimana@imboni.rw', "Marie's Science Progress",
             [('e.ingabire@gmail.com',  'Hello Mr. Nsabimana. How is Marie performing in Biology this term?'),
              ('i.nsabimana@imboni.rw', 'Mrs. Ingabire, Marie is one of our top students. Her lab work is exceptional and she scored 75% in the last exam.'),
              ('e.ingabire@gmail.com',  'That is wonderful to hear. Thank you very much.')]),
            ('j.ntakirutimana@imboni.rw', 'dos@imboni.rw', 'Field Trip Permission',
             [('j.ntakirutimana@imboni.rw','Good morning. I would like to request formal approval for the S4A History field trip to the Kigali Memorial Centre on July 5.'),
              ('dos@imboni.rw',            'Thank you Mr. Ntakirutimana. The field trip is approved subject to signed parent consent forms for all students.'),
              ('j.ntakirutimana@imboni.rw','Understood. I have already distributed the consent forms and will collect them by June 25.')]),
        ]
        extra_msg_count = 0
        for u1_email, u2_email, subject, messages in more_convos:
            u1 = users.get(u1_email)
            u2 = users.get(u2_email)
            if not u1 or not u2:
                continue
            convo, _ = Conversation.objects.get_or_create(
                subject=subject,
                defaults={'is_group': False}
            )
            convo.participants.add(u1, u2)
            for sender_email, content in messages:
                sender = users.get(sender_email)
                if sender:
                    msg, created = Message.objects.get_or_create(
                        conversation=convo, sender=sender, content=content
                    )
                    if created:
                        extra_msg_count += 1
        self.stdout.write(self.style.SUCCESS(f'  {extra_msg_count} additional messages created'))

        # ── Done ───────────────────────────────────────────────────────────────
        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('=' * 55))
        self.stdout.write(self.style.SUCCESS('  Database seeded successfully!'))
        self.stdout.write(self.style.SUCCESS('=' * 55))
        self.stdout.write('')
        self.stdout.write('  Login credentials (all use same password):')
        self.stdout.write(f'  Password: {PASSWORD}')
        self.stdout.write('')
        self.stdout.write('  admin@imboni.rw       -> Admin portal')
        self.stdout.write('  dos@imboni.rw         -> DOS portal')
        self.stdout.write('  c.umutoni@imboni.rw   -> Teacher portal')
        self.stdout.write('  p.rurangwa@imboni.rw  -> Teacher portal')
        self.stdout.write('  a.uwase@imboni.rw     -> Student portal')
        self.stdout.write('  ch.uwase@gmail.com    -> Parent portal')
        self.stdout.write('  g.hakizimana@imboni.rw-> Matron portal')
        self.stdout.write('  p.habimana@imboni.rw  -> Discipline portal')
        self.stdout.write('')
