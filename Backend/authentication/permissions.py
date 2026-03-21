from rest_framework.permissions import BasePermission


class IsDOS(BasePermission):
    """Allow access only to users with role='dos'."""
    message = 'Access restricted to the Director of Studies.'

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role == 'dos'
        )


class IsTeacher(BasePermission):
    """Allow access only to users with role='teacher'."""
    message = 'Access restricted to teachers.'

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role == 'teacher'
        )


class IsParent(BasePermission):
    """Allow access only to users with role='parent'."""
    message = 'Access restricted to parents.'

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role == 'parent'
        )


class IsStudent(BasePermission):
    """Allow access only to users with role='student'."""
    message = 'Access restricted to students.'

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role == 'student'
        )


class IsAdminRole(BasePermission):
    """Allow access only to users with role='admin'."""
    message = 'Access restricted to administrators.'

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role == 'admin'
        )


class IsDOSOrAdmin(BasePermission):
    """Allow access to DOS or admin users."""
    message = 'Access restricted to the Director of Studies or administrators.'

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role in ('dos', 'admin')
        )


class IsTeacherOrDOS(BasePermission):
    """Allow access to teachers, DOS, or admin users."""
    message = 'Access restricted to teachers or the Director of Studies.'

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role in ('teacher', 'dos', 'admin')
        )


class IsMatron(BasePermission):
    """Allow access only to users with role='matron'."""
    message = 'Access restricted to matrons.'

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role == 'matron'
        )


class IsDiscipline(BasePermission):
    """Allow access only to users with role='discipline'."""
    message = 'Access restricted to the Director of Discipline.'

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role == 'discipline'
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