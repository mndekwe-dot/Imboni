"""
python manage.py seed_assignments

Creates sample assignments for the first teacher in the DB so the
Assignments page has data to display immediately after setup.
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import date, timedelta


class Command(BaseCommand):
    help = 'Seed sample teacher assignments for testing'

    def handle(self, *args, **options):
        from apps.authentication.models import User
        from apps.results.models import Subject, AcademicTerm
        from apps.teacher.models import Assignment, SubjectTeacherAssignment, Class

        term = AcademicTerm.objects.filter(is_current=True).first()
        if not term:
            self.stderr.write('No current academic term found. Create one first.')
            return

        teacher = User.objects.filter(role='teacher').first()
        if not teacher:
            self.stderr.write('No teacher user found.')
            return

        # Find classes and subjects assigned to this teacher
        assignments_qs = (
            SubjectTeacherAssignment.objects
            .filter(teacher=teacher, term=term)
            .select_related('class_obj', 'subject')[:6]
        )
        if not assignments_qs.exists():
            self.stderr.write(
                f'Teacher {teacher.get_full_name()} has no SubjectTeacherAssignment rows for current term.'
            )
            return

        today = date.today()

        samples = [
            {
                'title':        'Problem Set 4: Quadratic Equations',
                'mode':         'paper',
                'status':       'active',
                'due_date':     today + timedelta(days=7),
                'max_score':    30,
                'instructions': 'Solve all problems showing full working. Submit handwritten.',
            },
            {
                'title':        'Chapter 6 Quiz: Algebra',
                'mode':         'online',
                'status':       'active',
                'due_date':     today + timedelta(days=3),
                'max_score':    20,
                'questions': [
                    {'id': 1, 'text': 'What is 2x + 3 = 7? Solve for x.',
                     'options': ['x = 1', 'x = 2', 'x = 3', 'x = 4'], 'correct': 1},
                    {'id': 2, 'text': 'Which is the quadratic formula?',
                     'options': ['x = -b ± √(b²-4ac) / 2a', 'x = b/a', 'x = -c/b', 'x = a/b'], 'correct': 0},
                ],
            },
            {
                'title':        'Lab Report: Projectile Motion Experiment',
                'mode':         'paper',
                'status':       'draft',
                'due_date':     today + timedelta(days=14),
                'max_score':    100,
                'instructions': 'Write a full lab report including hypothesis, method, results and conclusion.',
            },
            {
                'title':        'Take-home CAT: Trigonometry',
                'mode':         'paper',
                'status':       'draft',
                'due_date':     today + timedelta(days=10),
                'max_score':    30,
                'instructions': 'Complete all 5 questions. Show all calculations.',
            },
        ]

        created = 0
        for i, sample in enumerate(samples):
            sta = assignments_qs[i % assignments_qs.count()]
            obj, new = Assignment.objects.get_or_create(
                teacher   = teacher,
                class_obj = sta.class_obj,
                subject   = sta.subject,
                title     = sample['title'],
                defaults  = {
                    'mode':         sample['mode'],
                    'status':       sample['status'],
                    'due_date':     sample['due_date'],
                    'max_score':    sample['max_score'],
                    'instructions': sample.get('instructions', ''),
                    'questions':    sample.get('questions', []),
                    'published_at': timezone.now() if sample['status'] == 'active' else None,
                },
            )
            if new:
                created += 1
                self.stdout.write(
                    f'  Created: [{sample["status"]}] {sample["title"]} -> {sta.class_obj.name}'
                )
            else:
                self.stdout.write(f'  Already exists: {sample["title"]}')

        self.stdout.write(self.style.SUCCESS(
            f'\nDone. {created} new assignment(s) seeded for teacher: {teacher.get_full_name()}'
        ))
