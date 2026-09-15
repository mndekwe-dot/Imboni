"""The register's rules, kept out of the views so the signal and the API agree."""
from .models import DEFAULT_DEPARTMENTS, ROLE_DEPARTMENT, STAFF_ROLES, Department, StaffMember

ROLE_TITLES = {
    'teacher': 'Teacher',
    'dos': 'Director of Studies',
    'admin': 'Head teacher',
    'bursar': 'Bursar',
    'matron': 'Matron',
    'discipline': 'Director of Discipline',
    'librarian': 'Librarian',
}


def department_for_role(role):
    """The department a role starts in; created if the school deleted its row."""
    code = ROLE_DEPARTMENT.get(role)
    if not code:
        return None
    name = dict(DEFAULT_DEPARTMENTS).get(code, code.title())
    department, _ = Department.objects.get_or_create(
        code=code, defaults={'name': name, 'sort_order': _default_order(code)})
    return department


def _default_order(code):
    codes = [c for c, _ in DEFAULT_DEPARTMENTS]
    return (codes.index(code) + 1) * 10 if code in codes else 100


def sync_member(user):
    """
    Keep a staff account's register entry present and its details current.

    Created with the role's department and title the first time; after that
    only what the account owns (names, email, phone) is copied across. The
    department and job title belong to the register and are never overwritten,
    so moving a teacher into the boarding department survives their next login.
    """
    # A superuser is the platform's own login, not somebody the school employs.
    if user.role not in STAFF_ROLES or user.is_superuser:
        return None
    member = StaffMember.objects.filter(user=user).first()
    employment = user.employment_type if user.employment_type in ('full_time', 'part_time') else 'full_time'
    if member is None:
        return StaffMember.objects.create(
            user=user, first_name=user.first_name or user.username,
            last_name=user.last_name, email=user.email, phone=user.phone_number,
            job_title=ROLE_TITLES.get(user.role, ''), department=department_for_role(user.role),
            employment_type=employment)

    changed = []
    for field, value in (('first_name', user.first_name or user.username),
                         ('last_name', user.last_name), ('email', user.email),
                         ('phone', user.phone_number)):
        if getattr(member, field) != value:
            setattr(member, field, value)
            changed.append(field)
    if changed:
        member.save(update_fields=changed + ['updated_at'])
    return member


def member_for(user):
    """The register entry for an account, made on the spot for an older one."""
    return StaffMember.objects.filter(user=user).first() or sync_member(user)
