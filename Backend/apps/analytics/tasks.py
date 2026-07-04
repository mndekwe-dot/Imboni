"""
Celery tasks for the analytics app.
"""
from celery import shared_task


@shared_task
def send_fee_reminders_task(term_id, statuses=None):
    """
    Notify the parents of every student with unpaid fees in the given term.
    One reminder per student with their total outstanding, not one per fee line.
    """
    from collections import defaultdict
    from apps.student.models import Fee
    from apps.results.models import AcademicTerm
    from apps.notifications.services import notify_parents_of

    term = AcademicTerm.objects.filter(pk=term_id).first()
    if not term:
        return 0

    statuses = statuses or ['due', 'overdue', 'partial']
    unpaid = (
        Fee.objects
        .filter(term=term, status__in=statuses)
        .select_related('student__user')
    )

    by_student = defaultdict(list)
    for fee in unpaid:
        by_student[fee.student_id].append(fee)

    parents_notified = 0
    for fees in by_student.values():
        student = fees[0].student
        total = sum(float(f.amount) for f in fees)
        categories = ', '.join(sorted({f.get_category_display() for f in fees}))
        parents_notified += notify_parents_of(
            student,
            title='Fee payment reminder',
            message=(
                f"{student.full_name} has outstanding fees of RWF {total:,.0f} "
                f"({categories}) for {term.name}. Please arrange payment at your "
                f"earliest convenience."
            ),
            type='announcement',
            path='/parent',
        )
    return parents_notified
