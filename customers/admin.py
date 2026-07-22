import logging

from django.contrib import admin
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from accounts.models import UserProfile
from .email_service import EmailDeliveryError, send_registration_approved_email, send_registration_rejected_email
from .models import Customer, CustomerAccount, CustomerCashTransaction, CustomerCommodityTransaction, CustomerRegistrationRequest
from .services import customer_cash_balance, customer_cash_status


logger = logging.getLogger(__name__)


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'phone', 'customer_type', 'admin_cash_status', 'admin_cash_balance', 'is_active', 'is_deleted', 'created_at')
    list_filter = ('customer_type', 'is_active', 'is_deleted', 'created_at')
    search_fields = ('code', 'name', 'phone', 'secondary_phone', 'address')
    readonly_fields = ('code', 'created_by', 'updated_by', 'deleted_by', 'created_at', 'updated_at', 'deleted_at')
    date_hierarchy = 'created_at'

    def admin_cash_status(self, obj):
        return customer_cash_status(obj)

    def admin_cash_balance(self, obj):
        return customer_cash_balance(obj)

    def has_delete_permission(self, request, obj=None):
        return False


def is_admin_user(user):
    return bool(user and user.is_authenticated and (user.is_superuser or getattr(getattr(user, 'profile', None), 'role', None) == UserProfile.ROLE_ADMIN))


def approve_registration(registration, admin_user):
    if not is_admin_user(admin_user):
        raise PermissionError('Only Admin users can approve customer registrations.')
    with transaction.atomic():
        registration = CustomerRegistrationRequest.objects.select_for_update().get(pk=registration.pk)
        if registration.status != CustomerRegistrationRequest.STATUS_PENDING_APPROVAL or not registration.email_verified:
            raise ValueError('Only verified pending registrations can be approved.')
        User = get_user_model()
        user = User.objects.filter(email__iexact=registration.email).first()
        if not user:
            username_base = registration.email.split('@')[0]
            username = username_base
            suffix = 1
            while User.objects.filter(username__iexact=username).exists():
                suffix += 1
                username = f'{username_base}{suffix}'
            user = User(username=username, email=registration.email, is_active=True, is_staff=False, is_superuser=False)
            names = registration.full_name.split(' ', 1)
            user.first_name = names[0]
            user.last_name = names[1] if len(names) > 1 else ''
            user.password = registration.password_hash
            user.save()
        else:
            user.is_active = True
            user.is_staff = False
            user.is_superuser = False
            user.password = registration.password_hash
            user.save(update_fields=['is_active', 'is_staff', 'is_superuser', 'password'])
        UserProfile.objects.filter(user=user).delete()
        customer = Customer.objects.filter(phone=registration.phone, is_deleted=False).first()
        if not customer:
            customer = Customer.objects.create(
                name=registration.business_name or registration.full_name,
                phone=registration.phone,
                secondary_phone=registration.secondary_phone,
                address=registration.address,
                customer_type=registration.customer_type,
                is_active=True,
                is_deleted=False,
                created_by=admin_user,
                updated_by=admin_user,
            )
        else:
            customer.is_active = True
            customer.is_deleted = False
            customer.updated_by = admin_user
            customer.save(update_fields=['is_active', 'is_deleted', 'updated_by', 'updated_at'])
        CustomerAccount.objects.update_or_create(user=user, defaults={'customer': customer})
        registration.status = CustomerRegistrationRequest.STATUS_APPROVED
        registration.approved_by = admin_user
        registration.approved_at = timezone.now()
        registration.created_user = user
        registration.created_customer = customer
        registration.save(update_fields=['status', 'approved_by', 'approved_at', 'created_user', 'created_customer', 'updated_at'])
        transaction.on_commit(lambda: _send_approval_notification(registration.pk))
        return registration


def reject_registration(registration, admin_user, reason='Rejected by Admin.'):
    if not is_admin_user(admin_user):
        raise PermissionError('Only Admin users can reject customer registrations.')
    registration.status = CustomerRegistrationRequest.STATUS_REJECTED
    registration.rejection_reason = reason or 'Rejected by Admin.'
    registration.save(update_fields=['status', 'rejection_reason', 'updated_at'])
    _send_rejection_notification(registration.pk)
    return registration


def _send_approval_notification(registration_id):
    try:
        registration = CustomerRegistrationRequest.objects.get(pk=registration_id)
        send_registration_approved_email(registration)
    except (CustomerRegistrationRequest.DoesNotExist, EmailDeliveryError) as exc:
        logger.warning('Customer approval notification failed for registration_id=%s error=%s', registration_id, exc.__class__.__name__)


def _send_rejection_notification(registration_id):
    try:
        registration = CustomerRegistrationRequest.objects.get(pk=registration_id)
        send_registration_rejected_email(registration)
    except (CustomerRegistrationRequest.DoesNotExist, EmailDeliveryError) as exc:
        logger.warning('Customer rejection notification failed for registration_id=%s error=%s', registration_id, exc.__class__.__name__)


@admin.register(CustomerRegistrationRequest)
class CustomerRegistrationRequestAdmin(admin.ModelAdmin):
    list_display = ('full_name', 'business_name', 'email', 'phone', 'customer_type', 'email_verified', 'status', 'created_at')
    list_filter = ('status', 'email_verified', 'customer_type', 'created_at')
    search_fields = ('full_name', 'business_name', 'email', 'phone', 'address')
    readonly_fields = ('created_user', 'created_customer', 'approved_by', 'approved_at', 'created_at', 'updated_at')
    exclude = ('password_hash', 'verification_code_hash')
    actions = ('approve_selected_registrations', 'reject_selected_registrations')

    @admin.action(description='Approve selected registration requests')
    def approve_selected_registrations(self, request, queryset):
        approved = 0
        for registration in queryset:
            try:
                approve_registration(registration, request.user)
                approved += 1
            except (PermissionError, ValueError) as exc:
                self.message_user(request, str(exc), level='ERROR')
        self.message_user(request, f'Approved {approved} registration request(s).')

    @admin.action(description='Reject selected registration requests')
    def reject_selected_registrations(self, request, queryset):
        updated = 0
        for registration in queryset.filter(status__in=[
            CustomerRegistrationRequest.STATUS_EMAIL_PENDING,
            CustomerRegistrationRequest.STATUS_PENDING_APPROVAL,
        ]):
            reject_registration(registration, request.user)
            updated += 1
        self.message_user(request, f'Rejected {updated} registration request(s).')

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(CustomerCashTransaction)
class CustomerCashTransactionAdmin(admin.ModelAdmin):
    list_display = ('customer', 'transaction_type', 'payment_method', 'amount', 'source_type', 'created_by', 'created_at', 'is_deleted')
    list_filter = ('transaction_type', 'payment_method', 'source_type', 'is_deleted', 'created_at')
    search_fields = ('customer__code', 'customer__name', 'description', 'source_reference')
    readonly_fields = (
        'customer',
        'transaction_type',
        'payment_method',
        'amount',
        'source_type',
        'source_reference',
        'is_system_generated',
        'linked_journal_transaction',
        'created_by',
        'created_at',
        'is_deleted',
        'deleted_by',
        'deleted_at',
    )
    date_hierarchy = 'created_at'

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(CustomerCommodityTransaction)
class CustomerCommodityTransactionAdmin(admin.ModelAdmin):
    list_display = ('customer', 'transaction_type', 'product', 'quantity', 'unit', 'source_type', 'created_by', 'created_at', 'is_deleted')
    list_filter = ('transaction_type', 'unit', 'source_type', 'is_deleted', 'created_at')
    search_fields = ('customer__code', 'customer__name', 'product__name_en', 'description', 'source_reference')
    readonly_fields = (
        'customer',
        'transaction_type',
        'product',
        'quantity',
        'unit',
        'warehouse',
        'estimated_value',
        'source_type',
        'source_reference',
        'is_system_generated',
        'created_by',
        'created_at',
        'is_deleted',
        'deleted_by',
        'deleted_at',
    )
    date_hierarchy = 'created_at'

    def has_delete_permission(self, request, obj=None):
        return False
