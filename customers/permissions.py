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


def is_mobile_customer_user(user):
    if not user or not user.is_authenticated or not user.is_active:
        return False
    if getattr(user, 'is_staff', False) or getattr(user, 'is_superuser', False):
        return False
    profile = getattr(user, 'profile', None)
    if getattr(profile, 'role', None) in {'admin', 'manager'}:
        return False
    account = getattr(user, 'customer_account', None)
    customer = getattr(account, 'customer', None)
    return bool(customer and customer.is_active and not customer.is_deleted)


class IsMobileCustomer(BasePermission):
    def has_permission(self, request, view):
        return is_mobile_customer_user(request.user)
