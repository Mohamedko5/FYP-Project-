from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q
from django.utils import timezone


class Order(models.Model):
    STATUS_PENDING = 'pending'
    STATUS_RECEIVED = 'received'
    STATUS_INVOICED = 'invoiced'
    STATUS_READY_FOR_SHIPMENT = 'ready_for_shipment'
    STATUS_PROCESSING = 'processing'
    STATUS_COMPLETED = 'completed'
    STATUS_CANCELLED = 'cancelled'
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_RECEIVED, 'Received'),
        (STATUS_INVOICED, 'Invoiced'),
        (STATUS_READY_FOR_SHIPMENT, 'Ready for Shipment'),
        (STATUS_PROCESSING, 'Processing'),
        (STATUS_COMPLETED, 'Completed'),
        (STATUS_CANCELLED, 'Cancelled'),
    ]

    SOURCE_ADMIN = 'admin'
    SOURCE_CUSTOMER_APP = 'customer_app'
    SOURCE_CHOICES = [
        (SOURCE_ADMIN, 'Admin'),
        (SOURCE_CUSTOMER_APP, 'Customer App'),
    ]

    order_number = models.CharField(max_length=30, unique=True, blank=True)
    customer = models.ForeignKey('customers.Customer', on_delete=models.PROTECT, related_name='orders')
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default=STATUS_RECEIVED)
    source_channel = models.CharField(max_length=20, choices=SOURCE_CHOICES, default=SOURCE_ADMIN)
    customer_reference = models.CharField(max_length=120, blank=True)
    customer_notes = models.TextField(blank=True)
    internal_notes = models.TextField(blank=True)
    subtotal = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal('0.00'))
    discount_amount = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal('0.00'))
    total_amount = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal('0.00'))
    currency = models.CharField(max_length=10, default='SDG')
    received_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='received_orders', null=True, blank=True)
    received_at = models.DateTimeField(null=True, blank=True)
    cancelled_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='cancelled_orders', null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancellation_reason = models.TextField(blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='created_orders')
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='updated_orders', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['order_number']),
            models.Index(fields=['customer']),
            models.Index(fields=['status']),
            models.Index(fields=['source_channel']),
            models.Index(fields=['created_at']),
        ]

    def save(self, *args, **kwargs):
        if not self.order_number:
            year = timezone.localdate().year
            prefix = f'ORD-{year}-'
            last = Order.objects.filter(order_number__startswith=prefix).order_by('-order_number').values_list('order_number', flat=True).first()
            next_number = int(last.rsplit('-', 1)[1]) + 1 if last else 1
            self.order_number = f'{prefix}{next_number:06d}'
        super().save(*args, **kwargs)

    def clean(self):
        errors = {}
        if self.customer_id and (not self.customer.is_active or self.customer.is_deleted):
            errors['customer'] = 'Customer must be active.'
        if self.discount_amount is not None and self.discount_amount < 0:
            errors['discount_amount'] = 'Discount cannot be negative.'
        if self.subtotal is not None and self.discount_amount is not None and self.discount_amount > self.subtotal:
            errors['discount_amount'] = 'Discount cannot exceed subtotal.'
        if self.total_amount is not None and self.total_amount < 0:
            errors['total_amount'] = 'Total amount cannot be negative.'
        if self.status not in dict(self.STATUS_CHOICES):
            errors['status'] = 'Unsupported order status.'
        if self.source_channel not in dict(self.SOURCE_CHOICES):
            errors['source_channel'] = 'Unsupported source channel.'
        if errors:
            raise ValidationError(errors)

    @property
    def can_edit(self):
        return self.status in {self.STATUS_PENDING, self.STATUS_RECEIVED}

    @property
    def can_cancel(self):
        return self.status in {self.STATUS_PENDING, self.STATUS_RECEIVED}

    @property
    def can_create_invoice(self):
        return self.status == self.STATUS_RECEIVED and self.items.exists()

    def __str__(self):
        return self.order_number


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey('inventory.Product', on_delete=models.PROTECT, related_name='order_items')
    product_unit = models.ForeignKey('inventory.ProductUnit', on_delete=models.PROTECT, related_name='order_items')
    product_code_snapshot = models.CharField(max_length=20)
    product_name_en_snapshot = models.CharField(max_length=100)
    product_name_ar_snapshot = models.CharField(max_length=100)
    unit_snapshot = models.CharField(max_length=20)
    quantity = models.DecimalField(max_digits=18, decimal_places=3)
    unit_price = models.DecimalField(max_digits=18, decimal_places=2)
    line_total = models.DecimalField(max_digits=18, decimal_places=2)
    price_override_reason = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['id']
        indexes = [
            models.Index(fields=['product']),
            models.Index(fields=['product_unit']),
            models.Index(fields=['unit_snapshot']),
        ]
        constraints = [
            models.UniqueConstraint(fields=['order', 'product', 'product_unit'], name='unique_order_product_unit'),
            models.CheckConstraint(condition=Q(quantity__gt=0), name='order_item_quantity_positive'),
            models.CheckConstraint(condition=Q(unit_price__gte=0), name='order_item_unit_price_non_negative'),
            models.CheckConstraint(condition=Q(line_total__gte=0), name='order_item_line_total_non_negative'),
        ]

    def __str__(self):
        return f'{self.order.order_number} - {self.product_name_en_snapshot} - {self.quantity} {self.unit_snapshot}'
