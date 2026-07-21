from django.contrib import admin

from .models import Order, OrderItem


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = (
        'product_code_snapshot',
        'product_name_en_snapshot',
        'product_name_ar_snapshot',
        'unit_snapshot',
        'line_total',
        'created_at',
        'updated_at',
    )


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('order_number', 'customer', 'status', 'item_count', 'subtotal', 'discount_amount', 'total_amount', 'source_channel', 'created_by', 'created_at')
    list_filter = ('status', 'source_channel', 'created_at', 'customer__customer_type')
    search_fields = ('order_number', 'customer__name', 'customer__code', 'customer__phone')
    readonly_fields = (
        'order_number',
        'status',
        'source_channel',
        'subtotal',
        'total_amount',
        'currency',
        'received_by',
        'received_at',
        'cancelled_by',
        'cancelled_at',
        'cancellation_reason',
        'created_by',
        'updated_by',
        'created_at',
        'updated_at',
    )
    inlines = [OrderItemInline]
    date_hierarchy = 'created_at'

    def item_count(self, obj):
        return obj.items.count()

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = ('order', 'product_name_en_snapshot', 'unit_snapshot', 'quantity', 'unit_price', 'line_total')
    list_filter = ('unit_snapshot', 'product')
    search_fields = ('order__order_number', 'product_name_en_snapshot', 'product_name_ar_snapshot', 'product_code_snapshot')
    readonly_fields = ('line_total', 'created_at', 'updated_at')

    def has_delete_permission(self, request, obj=None):
        return False
