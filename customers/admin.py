from django.contrib import admin

from .models import Customer, CustomerCashTransaction, CustomerCommodityTransaction
from .services import customer_cash_balance, customer_cash_status


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
