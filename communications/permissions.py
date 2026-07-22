from rest_framework.permissions import BasePermission


def user_role(user):
    profile = getattr(user, 'profile', None)
    return getattr(profile, 'role', None)


def is_admin_or_manager(user):
    return bool(user and user.is_authenticated and (user.is_staff or user.is_superuser or user_role(user) in {'admin', 'manager'}))


def is_mobile_customer(user):
    if not user or not user.is_authenticated or not user.is_active:
        return False
    if is_admin_or_manager(user):
        return False
    account = getattr(user, 'customer_account', None)
    customer = getattr(account, 'customer', None)
    return bool(customer and customer.is_active and not customer.is_deleted)


class IsAdminOrManager(BasePermission):
    def has_permission(self, request, view):
        return is_admin_or_manager(request.user)


class IsMobileCustomer(BasePermission):
    def has_permission(self, request, view):
        return is_mobile_customer(request.user)
