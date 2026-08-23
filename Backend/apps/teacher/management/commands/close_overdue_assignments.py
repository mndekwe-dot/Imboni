"""
Close published assignments whose due date has passed.

An assignment carried a `closed` status that nothing ever set, so work stayed
open to submission indefinitely - a paper due in March still accepted a
hand-in in September, and the teacher's "Closed" filter tab was permanently
empty.

Only assignments that have opted out of late submissions are closed here:
`accept_late_submissions=True` is the default and means exactly what it says,
so those stay open until the teacher closes them by hand.

Run daily:
    python manage.py close_overdue_assignments

Options:
    --grace N   wait N days after the due date before closing (default 0)
    --dry-run   report what would close, change nothing
"""
from datetime import date, timedelta

from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Close active assignments past their due date that do not accept late work.'

    def add_arguments(self, parser):
        parser.add_argument('--grace', type=int, default=0,
                            help='Days to wait after the due date before closing.')
        parser.add_argument('--dry-run', action='store_true',
                            help='List what would close without changing anything.')

    def handle(self, *args, **options):
        from apps.teacher.models import Assignment

        grace = max(options['grace'], 0)
        cutoff = date.today() - timedelta(days=grace)

        due = (Assignment.objects
               .filter(status='active',
                       accept_late_submissions=False,
                       due_date__lt=cutoff)
               .select_related('class_obj', 'subject'))

        count = due.count()
        if not count:
            self.stdout.write('Nothing to close.')
            return

        for assignment in due:
            self.stdout.write(
                f'  {assignment.title} ({assignment.class_obj.name}, '
                f'due {assignment.due_date})'
            )

        if options['dry_run']:
            self.stdout.write(self.style.WARNING(f'Dry run: {count} would be closed.'))
            return

        # A single UPDATE rather than a save() per row: nothing on this model
        # hooks save, and the set can be large at the end of a term.
        closed = due.update(status='closed')
        self.stdout.write(self.style.SUCCESS(f'{closed} assignment(s) closed.'))
