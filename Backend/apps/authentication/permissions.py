from rest_framework.permissions import BasePermission

# The roles a person can hold IN ADDITION to their own. Never admin (it is the
# key to everything and is given deliberately, as a role), and never student or
# parent (those are who someone IS to the school, not a duty they take on).
SECONDARY_ROLES = ('teacher', 'dos', 'discipline', 'matron', 'librarian', 'bursar')


def has_role(user, *roles):
    """
    True if the user's own role, or one of their secondary roles, is in ``roles``.

    The one place that says what "a DOS" means for access, so the permission
    classes below cannot disagree about it. A secondary role is only honoured
    if it is one a person may hold at all: a stray 'admin' written into
    ``extra_roles`` by anything other than the admin screen grants nothing.
    """
    if user.role in roles:
        return True
    extras = getattr(user, 'extra_roles', None) or []
    return any(r in roles and r in SECONDARY_ROLES for r in extras)


class IsDOS(BasePermission):
    """Allow access only to users with role='dos'."""
    message = 'Access restricted to the Director of Studies.'

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            has_role(request.user, 'dos')
        )


class IsTeacher(BasePermission):
    """Allow access only to users with role='teacher'."""
    message = 'Access restricted to teachers.'

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            has_role(request.user, 'teacher')
        )


class IsParent(BasePermission):
    """Allow access only to users with role='parent'."""
    message = 'Access restricted to parents.'

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            has_role(request.user, 'parent')
        )


class IsStudent(BasePermission):
    """Allow access only to users with role='student'."""
    message = 'Access restricted to students.'

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            has_role(request.user, 'student')
        )


class IsAdminRole(BasePermission):
    """Allow access only to users with role='admin'."""
    message = 'Access restricted to administrators.'

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            has_role(request.user, 'admin')
        )


class IsDOSOrAdmin(BasePermission):
    """Allow access to DOS or admin users."""
    message = 'Access restricted to the Director of Studies or administrators.'

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            has_role(request.user, 'dos', 'admin')
        )


class IsTeacherOrDOS(BasePermission):
    """Allow access to teachers, DOS, or admin users."""
    message = 'Access restricted to teachers or the Director of Studies.'

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            has_role(request.user, 'teacher', 'dos', 'admin')
        )


class IsMatron(BasePermission):
    """Allow access only to users with role='matron'."""
    message = 'Access restricted to matrons.'

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            has_role(request.user, 'matron')
        )


class IsDiscipline(BasePermission):
    """Allow access only to users with role='discipline'."""
    message = 'Access restricted to the Director of Discipline.'

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            has_role(request.user, 'discipline')
        )
class IsDisciplineOrMatron(BasePermission):
    """Allow access to the Director of Discipline or any matron/patron."""
    message = 'Access restricted to Discipline staff and Matrons.'

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            has_role(request.user, 'discipline', 'matron')
        )


class IsDOSOrAdminOrDiscipline(BasePermission):
    """Allow access to DOS, Admin, or Discipline master."""
    message = 'Access restricted to DOS, Admin, or Discipline staff.'

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            has_role(request.user, 'discipline','dos','admin')
        )

class IsParentOrTeacherOrDOS(BasePermission):
    """Allow access to parents, students, teachers, DOS, or admin users."""
    message = 'Access restricted to parents, students, teachers, or the Director of Studies.'

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            has_role(request.user, 'parent', 'student', 'teacher', 'dos', 'admin')
        )


class CanInvite(BasePermission):
    """
    Controls which roles can invite which other roles.
    Admin    → can invite anyone
    DOS      → can invite teachers and students
    Discipline → can invite students, matrons, patrons
    """
    message = "You do not have permission to send invitations."

    INVITE_PERMISSIONS=  {
        'admin':['student','parent','teacher',
        'dos','matron','discipline','admin'],
        'dos':['teacher','student'],
        'discipline':['student','matron'],
    }
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return request.user.role in self.INVITE_PERMISSIONS
    def can_invite_role(self,inviter_role,target_role):
        allowed = self.INVITE_PERMISSIONS.get(inviter_role,[])
        return target_role in allowed

class IsLibrarian(BasePermission):
    """Allow access only to users with role='librarian'."""
    message = 'Access restricted to the librarian.'

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            has_role(request.user, 'librarian')
        )


class IsLibrarianOrAdmin(BasePermission):
    """
    The librarian, or a school administrator.

    Acquisitions are approved by the office rather than by the person who asked
    for the book, so those endpoints need both roles and then check which one
    is calling.
    """
    message = 'Access restricted to the librarian and school administrators.'

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            has_role(request.user, 'librarian', 'admin')
        )


class IsBursar(BasePermission):
    """Allow access only to users with role='bursar' — the finance office."""
    message = 'Access restricted to the finance office.'

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            has_role(request.user, 'bursar')
        )


class IsBursarOrAdmin(BasePermission):
    """
    The bursar, or a school administrator.

    Money is the one area where the head teacher legitimately wants to read
    everything the office can: these endpoints admit both and let the view
    decide which of them may WRITE.
    """
    message = 'Access restricted to the finance office and school administrators.'

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            has_role(request.user, 'bursar', 'admin')
        )
