"""
Fee reminders that go out on their own, for schools that have asked for them.

The bursar's "Remind families" screen is a decision made each time. This is the
same message sent on a schedule, so a family that owes is not forgotten because
the office was busy that fortnight. It is deliberately careful:

* off until the school switches it on;
* at most once per ``fee_reminder_every_days`` per school, however often the job runs;
* in-app (with push) and email only. SMS costs money and an unattended job has
  nobody to stop it;
* only families who still owe at least ``fee_reminder_min_percent`` of the bill.
"""
import logging
from datetime import timedelta
from decimal import Decimal

from django.utils import timezone

logger = logging.getLogger(__name__)

MESSAGE = (
    'Fees reminder: {student_name} ({student_code}) has {balance} outstanding '
    'this term. Please pay at the school office or by mobile money.'
)


def send_scheduled_reminders(now=None):
    """Remind the current school's owing families if it is due. Returns a summary."""
    from apps.dos.models import SchoolSetting
    from apps.notifications.services import notify_parents_of
    from apps.results.models import AcademicTerm
    from apps.student.models import Fee, Student

    from .views import families_from_fees

    now = now or timezone.now()
    setting = SchoolSetting.get_setting()
    if not setting.auto_fee_reminders:
        return {'sent': 0, 'skipped': 'off'}
    last = setting.fee_reminders_last_sent
    if last and now - last < timedelta(days=max(1, setting.fee_reminder_every_days)):
        return {'sent': 0, 'skipped': 'not due'}
    term = AcademicTerm.objects.filter(is_current=True).first()
    if term is None:
        return {'sent': 0, 'skipped': 'no current term'}

    fees = (Fee.objects.filter(term=term)
            .select_related('student__user').prefetch_related('payments'))
    min_percent = Decimal(setting.fee_reminder_min_percent)

    families = reached = unreachable = 0
    for row in families_from_fees(fees):
        share = (row['outstanding'] / row['charged'] * 100) if row['charged'] else Decimal('100')
        if share < min_percent:
            continue
        families += 1
        student = Student.objects.filter(pk=row['student']['id']).first()
        if student is None:
            continue
        text = MESSAGE.format(
            student_name=row['student']['name'], student_code=row['student']['student_id'],
            balance=f"{row['outstanding']:,.0f}")
        made = notify_parents_of(student, 'Fees reminder', text, type='announcement',
                                 path='/parent/children', send_email=True)
        if made:
            reached += 1
        else:
            unreachable += 1

    setting.fee_reminders_last_sent = now
    setting.save(update_fields=['fee_reminders_last_sent'])
    logger.info('Scheduled fee reminders: %s families, %s reached, %s unreachable',
                families, reached, unreachable)
    return {'sent': reached, 'families': families, 'unreachable': unreachable}
