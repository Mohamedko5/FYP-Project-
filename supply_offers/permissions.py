from rest_framework.permissions import BasePermission

from accounts.models import UserProfile


def is_admin_or_manager(user):
    if not user or not user.is_authenticated:
        return False
    if user.is_staff or user.is_superuser:
        return True
    return getattr(getattr(user, 'profile', None), 'role', '') in {UserProfile.ROLE_ADMIN, UserProfile.ROLE_MANAGER}


class IsMobileCustomer(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and hasattr(request.user, 'customer_account'))


class IsAdminOrManager(BasePermission):
    def has_permission(self, request, view):
        return is_admin_or_manager(request.user)
