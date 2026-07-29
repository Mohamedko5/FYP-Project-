from rest_framework.permissions import BasePermission


def user_role(user):
    if not user or not user.is_authenticated:
        return None
    if getattr(user, 'is_superuser', False):
        return 'admin'
    profile = getattr(user, 'profile', None)
    return getattr(profile, 'role', None)


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
