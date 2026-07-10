"""
Send each parent a weekly summary of their children's week: attendance,
newly approved results and conduct reports from the last 7 days.

Run weekly (e.g. Friday evening via cron / Task Scheduler):
    python manage.py send_weekly_digest

Options:
    --dry-run    print what would be sent without sending anything
    --no-email   create in-app notifications only, skip email
"""
from datetime import date, timedelta

from django.core.management.base import BaseCommand


def _child_summary(student, since):
    """Collect one child's week into a dict; None when nothing happened."""
    from apps.attendance.models import AttendanceRecord
    from apps.results.models import Result
    from apps.behavior.models import BehaviorReport

    attendance = AttendanceRecord.objects.filter(student=student, date__gte=since)
    absent = attendance.filter(status='absent').count()
    late = attendance.filter(status='late').count()

    new_results = (
        Result.objects
        .filter(student=student, status='approved', approved_at__date__gte=since)
        .select_related('subject')
    )
    reports = BehaviorReport.objects.filter(
        student=student, status='approved', date__gte=since,
    )

    if not attendance.exists() and not new_results.exists() and not reports.exists():
        return None

    lines = [f"{student.full_name} (S{student.grade}{student.section}):"]
    if attendance.exists():
        lines.append(f"  Attendance: {absent} absence(s), {late} late arrival(s) this week.")
    for r in new_results:
        lines.append(f"  New result: {r.subject.name} — {r.final_score} ({r.grade}).")
    for rep in reports:
        lines.append(f"  Conduct: {rep.get_report_type_display()} — {rep.title}.")
    return '\n'.join(lines)


class Command(BaseCommand):
    help = "Email each parent a summary of their children's week."

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true')
        parser.add_argument('--no-email', action='store_true')

    def handle(self, *args, **options):
        from collections import defaultdict
        from apps.parents.models import ParentStudentRelationship
        from apps.notifications.services import notify_user
        from apps.notifications.tasks import safe_delay, send_email_task

        since = date.today() - timedelta(days=7)

        children_by_parent = defaultdict(list)
        for rel in ParentStudentRelationship.objects.select_related('parent', 'student__user'):
            children_by_parent[rel.parent].append(rel.student)

        digests_sent = 0
        for parent, children in children_by_parent.items():
            summaries = [s for s in (_child_summary(c, since) for c in children) if s]
            if not summaries:
                continue

            body = (
                f"Dear {parent.get_full_name() or 'Parent'},\n\n"
                f"Here is your weekly summary from Imboni School "
                f"({since} to {date.today()}):\n\n"
                + '\n\n'.join(summaries)
                + "\n\nLog in to the parent portal for full details."
            )

            if options['dry_run']:
                self.stdout.write(f"--- would send to {parent.email} ---\n{body}\n")
                digests_sent += 1
                continue

            notify_user(
                parent,
                title='Your weekly summary',
                message=f"This week's summary for {', '.join(c.full_name for c in children)} is ready.",
                type='announcement',
                path='/parent',
            )

            if not options['no_email'] and parent.email:
                # Each email is its own Celery task so one bad address can be
                # retried (3x) without blocking or failing the whole digest.
                try:
                    safe_delay(
                        send_email_task,
                        'Imboni — Your weekly school summary',
                        body,
                        [parent.email],
                    )
                except Exception:
                    pass

            digests_sent += 1

        self.stdout.write(self.style.SUCCESS(f'{digests_sent} digest(s) sent.'))
