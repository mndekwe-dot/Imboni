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
    from apps.student.models     import Student, Activity, ActivityEnrollment, Assignment, AssignmentSubmission
    from apps.teacher.models     import Class, ClassAssignment, SubjectTeacherAssignment, Timetable, Task, TeacherClassList
    from apps.attendance.models  import AttendanceRecord, AttendanceSummary
    from apps.behavior.models    import BehaviorReport, ConductGrade
    from apps.announcements.models import Announcement
    from apps.discipline.models  import StudentLeader, BoardingStudent, DisciplineStaff, DiningPlan
    from apps.parents.models     import ParentStudentRelationship
    from apps.messages.models    import Conversation, Message
    return {
        'Subject': Subject, 'AcademicTerm': AcademicTerm, 'Result': Result,
        'Assessment': Assessment, 'Student': Student, 'Activity': Activity,
        'ActivityEnrollment': ActivityEnrollment, 'Assignment': Assignment,
        'AssignmentSubmission': AssignmentSubmission, 'Class': Class,
        'ClassAssignment': ClassAssignment,
        'SubjectTeacherAssignment': SubjectTeacherAssignment,
        'Timetable': Timetable, 'Task': Task,
        'AttendanceRecord': AttendanceRecord, 'AttendanceSummary': AttendanceSummary,
        'BehaviorReport': BehaviorReport, 'ConductGrade': ConductGrade,
        'Announcement': Announcement, 'StudentLeader': StudentLeader,
        'BoardingStudent': BoardingStudent, 'DisciplineStaff': DisciplineStaff,
        'DiningPlan': DiningPlan,
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

# teacher email, subject code
TEACHER_SUBJECTS = {
    'c.umutoni@imboni.rw':       'ENG',
    'p.rurangwa@imboni.rw':      'MTH',
    'i.nsabimana@imboni.rw':     'BIO',
    't.bizimana@imboni.rw':      'CHE',
    's.uwera@imboni.rw':         'PHY',
    'j.ntakirutimana@imboni.rw': 'HIS',
}

# teacher email -> list of class names they teach
TEACHER_CLASSES = {
    'c.umutoni@imboni.rw':      ['S1A', 'S3A'],
    'p.rurangwa@imboni.rw':     ['S2A', 'S2B'],
    'i.nsabimana@imboni.rw':    ['S3A', 'S3B', 'S4A'],
    't.bizimana@imboni.rw':     ['S2B'],
    's.uwera@imboni.rw':        ['S3A', 'S3B', 'S4A'],
    'j.ntakirutimana@imboni.rw':['S3A', 'S4A'],
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
            m['Activity'].objects.all().delete()
            m['DiningPlan'].objects.all().delete()
            m['BoardingStudent'].objects.all().delete()
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
        for teacher_email, subject_code in TEACHER_SUBJECTS.items():
            teacher = users.get(teacher_email)
            subject = subjects.get(subject_code)
            if not teacher or not subject:
                continue
            for class_name in TEACHER_CLASSES.get(teacher_email, []):
                cls = classes.get(class_name)
                if cls:
                    SubjectTeacherAssignment.objects.get_or_create(
                        teacher=teacher, subject=subject,
                        class_obj=cls, term=current_term
                    )
        self.stdout.write(self.style.SUCCESS('  Teacher-subject assignments done'))

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
        result_data = [
            # student_email, subject_code, class_test, exam_score, comment
            ('a.uwase@imboni.rw',         'MTH', 18, 67, 'Good performance. Keep it up.'),
            ('a.uwase@imboni.rw',         'ENG', 17, 64, 'Strong written work.'),
            ('m.ingabire@imboni.rw',      'MTH', 19, 72, 'Excellent analytical skills.'),
            ('m.ingabire@imboni.rw',      'BIO', 20, 75, 'Outstanding lab work.'),
            ('k.mutabazi@imboni.rw',      'ENG', 15, 53, 'Needs improvement in grammar.'),
            ('p.nkurunziza@imboni.rw',    'MTH', 12, 40, 'Requires extra support.'),
            ('d.umutoni@imboni.rw',       'PHY', 18, 66, 'Shows great understanding.'),
            ('j.bizimana@imboni.rw',      'CHE', 14, 53, 'Satisfactory performance.'),
            ('g.hakizimana.s@imboni.rw',  'MTH', 20, 74, 'Top of the class.'),
            ('e.ndagijimana@imboni.rw',   'ENG', 11, 37, 'Needs significant support.'),
            ('c.uwimana@imboni.rw',       'HIS', 17, 65, 'Good understanding of events.'),
            ('d.nkurunziza@imboni.rw',    'GEO', 15, 58, 'Average performance.'),
        ]
        subject_teacher_map = {v: users.get(k) for k, v in TEACHER_SUBJECTS.items()}
        r_count = 0
        for s_email, subj_code, ct_marks, exam, comment in result_data:
            student = students.get(s_email)
            subject = subjects.get(subj_code)
            teacher = subject_teacher_map.get(subj_code, list(users.values())[2])
            if not student or not subject:
                continue
            _, created = Result.objects.get_or_create(
                student=student, subject=subject, term=current_term,
                defaults={
                    'teacher': teacher,
                    'class_test_marks': ct_marks,
                    'exam_score':       exam,
                    'teacher_comment':  comment,
                    'dos_comment':      'Reviewed and approved.',
                    'status':           'approved',
                    'approved_by':      dos_user,
                    'approved_at':      timezone.now(),
                }
            )
            if created:
                r_count += 1
        self.stdout.write(self.style.SUCCESS(f'  {r_count} results created'))

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

        # ── 12. Attendance Records ─────────────────────────────────────────────
        self.stdout.write('Creating attendance records...')
        AttendanceRecord = m['AttendanceRecord']
        dos_user = users.get('dos@imboni.rw')
        statuses = ['present', 'present', 'present', 'present', 'absent', 'present', 'late', 'present', 'present', 'excused']
        att_count = 0
        base_date = date(2026, 5, 5)
        for s_email, student in list(students.items())[:10]:
            for i in range(10):
                att_date = base_date + timedelta(days=i if i < 5 else i + 2)
                status   = statuses[(list(students.keys()).index(s_email) + i) % len(statuses)]
                _, created = AttendanceRecord.objects.get_or_create(
                    student=student, date=att_date,
                    defaults={'status': status, 'marked_by': dos_user,
                              'minutes_late': 15 if status == 'late' else 0}
                )
                if created:
                    att_count += 1
        self.stdout.write(self.style.SUCCESS(f'  {att_count} attendance records created'))

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
