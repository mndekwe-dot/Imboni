"""
Holding a new student until their enrolment is confirmed.

Some schools do not want a student on any register until the family has paid a
deposit or agreed a payment plan with the bursar. This is off unless the school
switches it on (SchoolSetting.hold_enrolment_until_deposit), and a school that
does not ask for a deposit sees no change at all.

When it is on:
  * registration creates the student as `pending_deposit` and does NOT place
    them in a class, so they never reach a teacher's register or timetable;
  * the bursar sees them in an awaiting-deposit queue with what the family owes;
  * confirming enrolment makes them active and places them in the class that
    matches their year and stream, if there is exactly that class this term.
"""
PENDING = 'pending_deposit'


def holds_new_students():
    """Is this school holding new students until the bursar confirms?"""
    try:
        from apps.dos.models import SchoolSetting
        return bool(SchoolSetting.get_setting().hold_enrolment_until_deposit)
    except Exception:
        # A settings read must never be the thing that stops a registration.
        return False


def status_for_new_student():
    return PENDING if holds_new_students() else 'active'


def confirm_enrolment(student):
    """
    Make a held student active and place them in their class.

    Returns {'placed': bool, 'class_name': str | None}. A student is activated
    even when no class could be found (the DOS places them by hand then); that is
    reported, not hidden.
    """
    from apps.results.models import AcademicTerm
    from apps.teacher.models import Class, ClassAssignment

    student.status = 'active'
    student.save(update_fields=['status', 'updated_at'] if hasattr(student, 'updated_at') else ['status'])

    term = AcademicTerm.objects.filter(is_current=True).first()
    matches = list(Class.objects.filter(grade=student.grade, section__iexact=student.section)[:2])
    if term and len(matches) == 1:
        ClassAssignment.objects.get_or_create(class_obj=matches[0], student=student, term=term)
        return {'placed': True, 'class_name': matches[0].name}
    return {'placed': False, 'class_name': None}
