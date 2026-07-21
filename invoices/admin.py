from django.contrib import admin

from .models import Invoice, InvoiceItem, InvoicePayment


class InvoiceItemInline(admin.TabularInline):
    model = InvoiceItem
    extra = 0
    readonly_fields = tuple(field.name for field in InvoiceItem._meta.fields)


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ('invoice_number', 'order_number', 'customer', 'total_amount', 'payment_status', 'status', 'issued_by', 'issued_at', 'paid_at')
    list_filter = ('status', 'payment_status', 'issued_at', 'customer__customer_type')
    search_fields = ('invoice_number', 'order__order_number', 'customer__name', 'customer__code', 'customer__phone')
    readonly_fields = (
        'invoice_number', 'order', 'customer', 'status', 'payment_status', 'subtotal',
        'discount_amount', 'total_amount', 'currency', 'issued_by', 'issued_at',
        'paid_at', 'paid_by', 'cancelled_at', 'cancelled_by', 'cancellation_reason',
        'created_at', 'updated_at',
    )
    inlines = [InvoiceItemInline]

    def order_number(self, obj):
        return obj.order.order_number

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(InvoiceItem)
class InvoiceItemAdmin(admin.ModelAdmin):
    list_display = ('invoice', 'product_name_en_snapshot', 'unit_snapshot', 'quantity', 'unit_price', 'line_total')
    search_fields = ('invoice__invoice_number', 'product_name_en_snapshot', 'product_name_ar_snapshot')
    readonly_fields = tuple(field.name for field in InvoiceItem._meta.fields)

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(InvoicePayment)
class InvoicePaymentAdmin(admin.ModelAdmin):
    list_display = ('invoice', 'amount', 'payment_method', 'payment_reference', 'received_by', 'received_at')
    list_filter = ('payment_method', 'received_at')
    search_fields = ('invoice__invoice_number', 'payment_reference')
    readonly_fields = tuple(field.name for field in InvoicePayment._meta.fields)

    def has_delete_permission(self, request, obj=None):
        return False
