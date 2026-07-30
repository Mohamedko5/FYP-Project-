from rest_framework import permissions

from accounts.models import UserProfile


def user_role(user):
    if not user or not user.is_authenticated:
        return None
    return getattr(getattr(user, 'profile', None), 'role', None)


class IsZakatUser(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and user_role(request.user) in {
            UserProfile.ROLE_ADMIN,
            UserProfile.ROLE_MANAGER,
        }


class IsZakatAdminForSensitiveActions(IsZakatUser):
    admin_actions = {
        'approve',
        'verify',
        'activate',
        'cancel',
        'seed_draft_rules',
    }

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        if request.method not in permissions.SAFE_METHODS and getattr(view, 'basename', '') == 'zakat-rule':
            return user_role(request.user) == UserProfile.ROLE_ADMIN
        if getattr(view, 'action', None) in self.admin_actions:
            return user_role(request.user) == UserProfile.ROLE_ADMIN
        return True
