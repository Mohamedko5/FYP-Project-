from rest_framework import permissions

from accounts.models import UserProfile


def user_role(user):
    if not user or not user.is_authenticated:
        return None
    return getattr(getattr(user, 'profile', None), 'role', UserProfile.ROLE_ADMIN)


class IsAdminOrManager(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and user_role(request.user) in {
            UserProfile.ROLE_ADMIN,
            UserProfile.ROLE_MANAGER,
        }


class IsAdminForUnsafeWarehouseActions(IsAdminOrManager):
    admin_actions = {'create', 'update', 'partial_update', 'destroy'}

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        if getattr(view, 'action', None) in self.admin_actions:
            return user_role(request.user) == UserProfile.ROLE_ADMIN
        return True
