"""
Object-level access: may this user look at this student?

A permission class answers "is the caller a parent?" — it cannot answer "is the
caller *this child's* parent?", because it never sees the id in the URL. Several
views took a student id from the path and filtered on it with only a role check
in front, so any parent could read any other family's child by changing the id.

Lives in `authentication` rather than in any one feature app because attendance,
results and anything else student-scoped all need the same answer, and a copy
per app is how the rule drifts.

Imports are deferred into the function body: this module is imported from
`authentication`, which loads before `parents` and `teacher` do.
"""

# Roles whose remit is the whole school. Scoping them per-student would break
# the job rather than protect anyone — a DOS approving results, a matron
# treating a boarder, and a discipline officer reviewing an incident all need
# to reach any child in the school. The tenant schema is the real boundary.
SCHOOL_WIDE_ROLES = {'admin', 'dos', 'discipline', 'matron'}


def can_view_student(user, student_id):
    """
    True when `user` may read records belonging to `student_id`.

    Closed by default: an unknown or missing role gets nothing, so a role added
    later fails shut rather than silently inheriting access to every child.
    """
    from apps.parents.models import ParentStudentRelationship
    from apps.teacher.models import ClassAssignment, SubjectTeacherAssignment

    if not getattr(user, 'is_authenticated', False):
        return False

    role = getattr(user, 'role', None)

    if role in SCHOOL_WIDE_ROLES:
        return True

    if role == 'student':
        student = getattr(user, 'student_profile', None)
        return student is not None and str(student.id) == str(student_id)

    if role == 'parent':
        return ParentStudentRelationship.objects.filter(
            parent=user, student_id=student_id,
        ).exists()

    if role == 'teacher':
        # Any class the teacher is assigned to, in any term — a teacher who
        # taught a child last term still has reason to look back at their work.
        class_ids = SubjectTeacherAssignment.objects.filter(
            teacher=user,
        ).values_list('class_obj_id', flat=True)
        return ClassAssignment.objects.filter(
            student_id=student_id, class_obj_id__in=class_ids,
        ).exists()

    return False
