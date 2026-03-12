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
