"""
Management command to seed extended sample data covering all models.

Usage:
    python manage.py seed_extended_data
    python manage.py seed_extended_data --clear   # wipe extended data first

Models seeded:
    - teacher.Class + ClassAssignment + SubjectTeacherAssignment + Timetable
    - students.Fee + StudentDocument
    - messages.Conversation + Message + MessageReadReceipt
"""
from datetime import date, time, timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone


class Command(BaseCommand):
    help = 'Seed extended sample data for all models'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Delete all extended data before seeding',
        )

    def handle(self, *args, **options):
        # Deferred imports to avoid app-loading issues
        from apps.authentication.models import User
        from apps.parents.models import Student, Fee, StudentDocument, ParentStudentRelationship
        from apps.results.models import Subject, AcademicTerm, Assessment, Result
        from apps.teacher.models import Class, ClassAssignment, SubjectTeacherAssignment, Timetable
        from apps.messages.models import Conversation, Message, MessageReadReceipt

        if options['clear']:
            self.stdout.write('Clearing extended data...')
            MessageReadReceipt.objects.all().delete()
            Message.objects.all().delete()
            Conversation.objects.all().delete()
            StudentDocument.objects.all().delete()
            Fee.objects.all().delete()
            Timetable.objects.all().delete()
            SubjectTeacherAssignment.objects.all().delete()
            ClassAssignment.objects.all().delete()
            Class.objects.all().delete()
            self.stdout.write(self.style.WARNING('Extended data cleared.'))

        # ── Guard: need existing base data ─────────────────────────────────
        current_term = AcademicTerm.objects.filter(is_current=True).first()
        if not current_term:
            self.stdout.write(self.style.ERROR(
                'No current academic term found. Run seed_data first.'
            ))
            return

        students = list(Student.objects.select_related('user').all())
        teachers = list(User.objects.filter(role='teacher'))
        subjects = list(Subject.objects.all())
        parents = list(User.objects.filter(role='parent'))

        if not students:
            self.stdout.write(self.style.ERROR('No students found. Run seed_data first.'))
            return
        if not teachers:
            self.stdout.write(self.style.ERROR('No teachers found. Run seed_data first.'))
            return
        if len(subjects) < 5:
            self.stdout.write(self.style.ERROR('Need at least 5 subjects. Run seed_data first.'))
            return

        self.stdout.write('Seeding extended data...')

        classes = self._seed_classes(students, teachers, Class)
        self._seed_class_assignments(students, classes, current_term, ClassAssignment)
        assignments = self._seed_subject_teacher_assignments(
            teachers, subjects, classes, current_term, SubjectTeacherAssignment
        )
        self._seed_timetable(assignments, current_term, Timetable)
        self._seed_fees(students, current_term, Fee)
        self._seed_documents(students, teachers, StudentDocument)
        self._seed_conversations(parents, teachers, students, Conversation, Message, MessageReadReceipt)

        self.stdout.write(self.style.SUCCESS('Extended data seeded successfully!'))
        self._print_summary(Class, ClassAssignment, SubjectTeacherAssignment,
                            Timetable, Fee, StudentDocument, Conversation, Message)

    # ── 1. Classes ──────────────────────────────────────────────────────────

    def _seed_classes(self, students, teachers, Class):
        """Create one Class per unique grade/section found in Student records."""
        grade_sections = set((s.grade, s.section) for s in students)
        teacher_cycle = teachers * 10  # enough to go around

        created = []
        for i, (grade, section) in enumerate(sorted(grade_sections)):
            class_teacher = teacher_cycle[i % len(teachers)]
            obj, was_created = Class.objects.get_or_create(
                grade=grade,
                section=section,
                defaults={
                    'name': f'Grade {grade}{section}',
                    'class_teacher': class_teacher,
                    'max_students': 35,
                    'room_number': f'R{grade}0{section}',
                    'is_active': True,
                }
            )
            created.append(obj)
            if was_created:
                self.stdout.write(f'  Created class: {obj}')

        self.stdout.write(f'  Classes: {len(created)} ready')
        return created

    # ── 2. ClassAssignments ─────────────────────────────────────────────────

    def _seed_class_assignments(self, students, classes, current_term, ClassAssignment):
        """Assign each student to the class matching their grade/section."""
        class_map = {(c.grade, c.section): c for c in classes}
        count = 0
        for student in students:
            class_obj = class_map.get((student.grade, student.section))
            if not class_obj:
                continue
            _, was_created = ClassAssignment.objects.get_or_create(
                class_obj=class_obj,
                student=student,
                term=current_term,
            )
            if was_created:
                count += 1
        self.stdout.write(f'  ClassAssignments: {count} created')

    # ── 3. SubjectTeacherAssignments ────────────────────────────────────────

    def _seed_subject_teacher_assignments(self, teachers, subjects, classes, current_term, STA):
        """Assign subjects to teachers within each class (2 subjects per teacher per class)."""
        created = []
        for class_obj in classes:
            subject_teacher_pairs = []
            # Distribute subjects evenly among available teachers
            for idx, subject in enumerate(subjects):
                teacher = teachers[idx % len(teachers)]
                obj, was_created = STA.objects.get_or_create(
                    teacher=teacher,
                    subject=subject,
                    class_obj=class_obj,
                    term=current_term,
                )
                subject_teacher_pairs.append((subject, teacher, class_obj))
                if was_created:
                    created.append(obj)
        self.stdout.write(f'  SubjectTeacherAssignments: {len(created)} created')
        return created

    # ── 4. Timetable ────────────────────────────────────────────────────────

    def _seed_timetable(self, assignments, current_term, Timetable):
        """
        Build a Mon-Fri timetable for each class.
        5 periods per day, subjects rotate across the week.
        """
        from apps.teacher.models import SubjectTeacherAssignment, Class

        days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
        periods = [
            (time(7, 30), time(8, 30)),
            (time(8, 30), time(9, 30)),
            (time(9, 45), time(10, 45)),
            (time(10, 45), time(11, 45)),
            (time(13, 0), time(14, 0)),
        ]

        count = 0
        all_classes = Class.objects.all()
        for class_obj in all_classes:
            # Gather subject+teacher pairs for this class
            stas = list(
                SubjectTeacherAssignment.objects.filter(
                    class_obj=class_obj, term=current_term
                ).select_related('subject', 'teacher')
            )
            if not stas:
                continue

            slot = 0
            for day in days:
                for period_start, period_end in periods:
                    sta = stas[slot % len(stas)]
                    _, was_created = Timetable.objects.get_or_create(
                        class_obj=class_obj,
                        day=day,
                        start_time=period_start,
                        term=current_term,
                        defaults={
                            'subject': sta.subject,
                            'teacher': sta.teacher,
                            'end_time': period_end,
                            'room_number': class_obj.room_number or f'R{class_obj.grade}01',
                        }
                    )
                    if was_created:
                        count += 1
                    slot += 1

        self.stdout.write(f'  Timetable entries: {count} created')

    # ── 5. Fees ─────────────────────────────────────────────────────────────

    def _seed_fees(self, students, current_term, Fee):
        """Create 3 fee records per student with varied statuses."""
        today = date.today()
        fee_templates = [
            {
                'category': 'tuition',
                'amount': 850000,
                'due_date': today - timedelta(days=30),
                'status': 'cleared',
                'paid_date': today - timedelta(days=35),
                'notes': 'Term 1 tuition fees',
            },
            {
                'category': 'transport',
                'amount': 120000,
                'due_date': today + timedelta(days=15),
                'status': 'due',
                'paid_date': None,
                'notes': 'Monthly bus fee',
            },
            {
                'category': 'lunch',
                'amount': 80000,
                'due_date': today - timedelta(days=5),
                'status': 'partial',
                'paid_date': None,
                'notes': 'Lunch program — balance remaining',
            },
        ]

        count = 0
        for student in students:
            for template in fee_templates:
                _, was_created = Fee.objects.get_or_create(
                    student=student,
                    category=template['category'],
                    term=current_term,
                    defaults={
                        'amount': template['amount'],
                        'due_date': template['due_date'],
                        'status': template['status'],
                        'paid_date': template['paid_date'],
                        'notes': template['notes'],
                    }
                )
                if was_created:
                    count += 1

        self.stdout.write(f'  Fees: {count} created')

    # ── 6. StudentDocuments ─────────────────────────────────────────────────

    def _seed_documents(self, students, teachers, StudentDocument):
        """Create 2 document records per student (no actual file on disk)."""
        doc_templates = [
            {
                'title': 'February Newsletter',
                'document_type': 'newsletter',
                'file': 'student_documents/newsletter_feb_2026.pdf',
            },
            {
                'title': 'Sports Day Consent Form',
                'document_type': 'consent',
                'file': 'student_documents/sports_consent_2026.pdf',
            },
        ]

        admin_user = teachers[0] if teachers else None
        count = 0
        for student in students:
            for template in doc_templates:
                if not StudentDocument.objects.filter(
                    student=student,
                    title=template['title'],
                ).exists():
                    StudentDocument.objects.create(
                        student=student,
                        title=template['title'],
                        document_type=template['document_type'],
                        file=template['file'],
                        uploaded_by=admin_user,
                    )
                    count += 1

        self.stdout.write(f'  StudentDocuments: {count} created')

    # ── 7. Conversations + Messages ─────────────────────────────────────────

    def _seed_conversations(self, parents, teachers, students, Conversation, Message, MessageReadReceipt):
        """Create sample conversations between parents and teachers."""
        if not parents or not teachers:
            self.stdout.write(self.style.WARNING(
                '  Skipping conversations: no parents or no teachers found.'
            ))
            return

        # Pair each parent with a teacher (cycle through teachers)
        conv_count = 0
        msg_count = 0
        now = timezone.now()

        conversations_data = [
            {
                'subject': 'Academic Progress Update',
                'messages': [
                    ('teacher', "Good afternoon! I wanted to share that your child has been making excellent progress in Mathematics this term."),
                    ('parent', "Thank you so much for letting me know! We've been practising at home as well."),
                    ('teacher', "That really shows. The quiz scores have improved by 15% since last month. Keep it up!"),
                ],
            },
            {
                'subject': 'Attendance Concern',
                'messages': [
                    ('teacher', "Hello, I noticed your child was absent three days last week. Is everything okay?"),
                    ('parent', "I apologise — they had a mild fever but are fully recovered now."),
                    ('teacher', "Glad to hear it. Please send a note to the office when returning after illness. Take care!"),
                    ('parent', "Will do, thank you for checking in."),
                ],
            },
            {
                'subject': 'Upcoming Parent-Teacher Meeting',
                'messages': [
                    ('teacher', "Dear parent, the school is holding a Parent-Teacher meeting on 15th March at 3 PM. Please confirm if you can attend."),
                    ('parent', "Yes, I will be there. Is there anything specific I should prepare?"),
                    ('teacher', "Just bring any questions you have about the term's results. We will have all reports ready."),
                ],
            },
            {
                'subject': 'Sports Day Consent Form',
                'messages': [
                    ('teacher', "Hi! Could you please return the signed Sports Day consent form by Friday?"),
                    ('parent', "Oh yes, I forgot! I will send it with my child tomorrow morning."),
                    ('teacher', "Perfect, thank you!"),
                ],
            },
            {
                'subject': 'Science Project Submission',
                'messages': [
                    ('parent', "My child says the Science project is due next Monday. Can you confirm the deadline?"),
                    ('teacher', "Yes, submissions are due Monday 9th. They can submit digitally or in print."),
                    ('parent', "Understood, thank you for clarifying."),
                    ('teacher', "No problem at all. Looking forward to seeing the projects!"),
                    ('parent', "They've been working hard on it — very excited!"),
                ],
            },
        ]

        for i, conv_data in enumerate(conversations_data):
            parent = parents[i % len(parents)]
            teacher = teachers[i % len(teachers)]

            conv, was_created = Conversation.objects.get_or_create(
                subject=conv_data['subject'],
                defaults={'is_group': False}
            )
            if was_created:
                conv.participants.set([parent, teacher])
                conv_count += 1

                # Create messages in chronological order
                for j, (role, content) in enumerate(conv_data['messages']):
                    sender = teacher if role == 'teacher' else parent
                    msg_time = now - timedelta(days=(len(conversations_data) - i), hours=j)
                    msg = Message.objects.create(
                        conversation=conv,
                        sender=sender,
                        content=content,
                        is_read=True,
                        read_at=msg_time + timedelta(minutes=5),
                        created_at=msg_time,
                    )
                    # Add read receipt for the recipient
                    recipient = parent if role == 'teacher' else teacher
                    MessageReadReceipt.objects.get_or_create(
                        message=msg,
                        user=recipient,
                    )
                    msg_count += 1

        self.stdout.write(f'  Conversations: {conv_count} created, Messages: {msg_count} created')

    # ── Summary ─────────────────────────────────────────────────────────────

    def _print_summary(self, Class, ClassAssignment, SubjectTeacherAssignment,
                       Timetable, Fee, StudentDocument, Conversation, Message):
        self.stdout.write('\n== Database Summary ============================')
        rows = [
            ('Classes', Class.objects.count()),
            ('ClassAssignments', ClassAssignment.objects.count()),
            ('SubjectTeacherAssignments', SubjectTeacherAssignment.objects.count()),
            ('Timetable entries', Timetable.objects.count()),
            ('Fees', Fee.objects.count()),
            ('StudentDocuments', StudentDocument.objects.count()),
            ('Conversations', Conversation.objects.count()),
            ('Messages', Message.objects.count()),
        ]
        for label, count in rows:
            self.stdout.write(f'  {label:<30} {count}')
        self.stdout.write('===============================================')
