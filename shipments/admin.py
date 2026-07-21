from django.contrib import admin

from .models import Shipment, ShipmentItem


class ShipmentItemInline(admin.TabularInline):
    model = ShipmentItem
    extra = 0
    readonly_fields = ('average_bag_weight_kg', 'created_at', 'updated_at')


@admin.register(Shipment)
class ShipmentAdmin(admin.ModelAdmin):
    list_display = ('shipment_number', 'order', 'invoice', 'customer', 'status', 'driver_name', 'started_at', 'completed_at')
    list_filter = ('status', 'created_at', 'customer__customer_type')
    search_fields = ('shipment_number', 'order__order_number', 'invoice__invoice_number', 'customer__name', 'driver_name', 'vehicle_number')
    readonly_fields = ('shipment_number', 'status', 'started_by', 'started_at', 'completed_by', 'completed_at', 'cancelled_by', 'cancelled_at', 'cancellation_reason', 'created_by', 'created_at', 'updated_at')
    inlines = [ShipmentItemInline]

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(ShipmentItem)
class ShipmentItemAdmin(admin.ModelAdmin):
    list_display = ('shipment', 'product_name_en_snapshot', 'warehouse', 'requested_quantity', 'actual_quantity', 'unit_snapshot', 'average_bag_weight_kg')
    list_filter = ('unit_snapshot', 'warehouse', 'product')
    search_fields = ('shipment__shipment_number', 'product_name_en_snapshot', 'product_name_ar_snapshot')
    readonly_fields = ('average_bag_weight_kg', 'created_at', 'updated_at')

    def has_delete_permission(self, request, obj=None):
        return False
