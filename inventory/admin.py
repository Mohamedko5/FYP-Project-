from django.contrib import admin

from .models import Inventory, InventoryMovement, Product, ProductUnit, Warehouse


class ProductUnitInline(admin.TabularInline):
    model = ProductUnit
    extra = 0


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('code', 'name_en', 'name_ar', 'category', 'stock_status', 'is_active', 'is_deleted', 'created_at')
    list_filter = ('category', 'is_active', 'is_deleted')
    search_fields = ('code', 'name_en', 'name_ar', 'description', 'notes')
    readonly_fields = ('code', 'created_at', 'updated_at', 'deleted_at')
    inlines = [ProductUnitInline]


@admin.register(ProductUnit)
class ProductUnitAdmin(admin.ModelAdmin):
    list_display = ('product', 'unit', 'is_default', 'purchase_price', 'selling_price', 'minimum_selling_price', 'is_active', 'created_at')
    list_filter = ('unit', 'is_default', 'is_active')
    search_fields = ('product__name_en', 'unit')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(Warehouse)
class WarehouseAdmin(admin.ModelAdmin):
    list_display = ('code', 'warehouse_name', 'location', 'primary_product', 'capacity', 'capacity_unit', 'manager_name', 'is_active', 'is_deleted')
    list_filter = ('capacity_unit', 'is_active', 'is_deleted', 'primary_product')
    search_fields = ('code', 'warehouse_name', 'location', 'manager_name', 'guard_name')
    readonly_fields = ('code', 'created_at', 'updated_at', 'deleted_at')
    date_hierarchy = 'created_at'


@admin.register(Inventory)
class InventoryAdmin(admin.ModelAdmin):
    list_display = ('warehouse', 'product', 'quantity', 'unit', 'minimum_threshold', 'status', 'updated_at')
    list_filter = ('unit', 'product', 'warehouse')
    search_fields = ('warehouse__warehouse_name', 'product__name_en')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(InventoryMovement)
class InventoryMovementAdmin(admin.ModelAdmin):
    list_display = ('id', 'warehouse', 'product', 'movement_type', 'quantity', 'unit', 'quantity_before', 'quantity_after', 'source_type', 'created_by', 'created_at')
    list_filter = ('movement_type', 'source_type', 'unit', 'product', 'warehouse')
    search_fields = ('warehouse__warehouse_name', 'product__name_en', 'source_reference', 'driver_name', 'notes')
    readonly_fields = tuple(field.name for field in InventoryMovement._meta.fields)
    date_hierarchy = 'created_at'

    def has_change_permission(self, request, obj=None):
        if obj:
            return False
        return super().has_change_permission(request, obj)

# Register your models here.
