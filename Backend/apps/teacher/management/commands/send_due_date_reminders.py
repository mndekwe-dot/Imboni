"""
Notify students about active assignments due tomorrow that they haven't
submitted yet.

Run daily (e.g. from cron / Task Scheduler):
    python manage.py send_due_date_reminders

Options:
    --days N   remind N days before the due date (default 1)
"""
from datetime import date, timedelta

from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Send in-app reminders for assignments due soon to students who haven't submitted."

    def add_arguments(self, parser):
        parser.add_argument('--days', type=int, default=1,
                            help='How many days before the due date to remind (default 1).')

    def handle(self, *args, **options):
        from apps.teacher.models import Assignment, AssignmentSubmission, ClassAssignment
        from apps.results.models import AcademicTerm
        from apps.notifications.services import notify_user

        target_date = date.today() + timedelta(days=options['days'])
        term = AcademicTerm.objects.filter(is_current=True).first()

        assignments = (
            Assignment.objects
            .filter(status='active', due_date=target_date)
            .select_related('class_obj', 'subject')
        )

        sent = 0
        for assignment in assignments:
            roster = ClassAssignment.objects.filter(class_obj=assignment.class_obj)
            if term:
                roster = roster.filter(term=term)
            roster = roster.select_related('student__user')

            submitted_ids = set(
                AssignmentSubmission.objects
                .filter(assignment=assignment)
                .values_list('student_id', flat=True)
            )

            for ca in roster:
                if ca.student_id in submitted_ids:
                    continue
                if notify_user(
                    ca.student.user,
                    title=f'Due tomorrow: {assignment.title}',
                    message=(
                        f"{assignment.subject.name} — '{assignment.title}' is due on "
                        f"{assignment.due_date}. Don't forget to submit."
                    ),
                    type='exam',
                    path='/student/assignments',
                ):
                    sent += 1

        self.stdout.write(self.style.SUCCESS(
            f'{assignments.count()} assignment(s) due on {target_date}; {sent} reminder(s) sent.'
        ))
