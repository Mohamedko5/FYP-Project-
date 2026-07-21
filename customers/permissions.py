from rest_framework.permissions import BasePermission


def user_role(user):
    profile = getattr(user, 'profile', None)
    return getattr(profile, 'role', 'admin')


class IsAdminOrManager(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and user_role(request.user) in {'admin', 'manager'})


class IsAdminForDeleteOnly(BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method == 'DELETE':
            return user_role(request.user) == 'admin'
        return user_role(request.user) in {'admin', 'manager'}
