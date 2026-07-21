from decimal import Decimal

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone


class Shipment(models.Model):
    STATUS_READY = 'ready_for_shipment'
    STATUS_PROCESSING = 'processing'
    STATUS_COMPLETED = 'completed'
    STATUS_CANCELLED = 'cancelled'
    STATUS_CHOICES = [
        (STATUS_READY, 'Ready for Shipment'),
        (STATUS_PROCESSING, 'Processing'),
        (STATUS_COMPLETED, 'Completed'),
        (STATUS_CANCELLED, 'Cancelled'),
    ]

    shipment_number = models.CharField(max_length=30, unique=True, blank=True)
    order = models.ForeignKey('orders.Order', on_delete=models.PROTECT, related_name='shipments')
    invoice = models.ForeignKey('invoices.Invoice', on_delete=models.PROTECT, related_name='shipments')
    customer = models.ForeignKey('customers.Customer', on_delete=models.PROTECT, related_name='shipments')
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default=STATUS_READY)
    driver_name = models.CharField(max_length=150, blank=True)
    vehicle_number = models.CharField(max_length=80, blank=True)
    notes = models.TextField(blank=True)
    started_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='started_shipments', null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='completed_shipments', null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    cancelled_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='cancelled_shipments', null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancellation_reason = models.TextField(blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='created_shipments')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['shipment_number']),
            models.Index(fields=['order']),
            models.Index(fields=['invoice']),
            models.Index(fields=['customer']),
            models.Index(fields=['status']),
            models.Index(fields=['created_at']),
        ]
        constraints = [
            models.UniqueConstraint(fields=['invoice'], condition=~Q(status='cancelled'), name='unique_active_shipment_per_invoice'),
        ]

    def save(self, *args, **kwargs):
        if not self.shipment_number:
            year = timezone.localdate().year
            prefix = f'SHP-{year}-'
            last = Shipment.objects.filter(shipment_number__startswith=prefix).order_by('-shipment_number').values_list('shipment_number', flat=True).first()
            next_number = int(last.rsplit('-', 1)[1]) + 1 if last else 1
            self.shipment_number = f'{prefix}{next_number:06d}'
        super().save(*args, **kwargs)

    def __str__(self):
        return self.shipment_number


class ShipmentItem(models.Model):
    shipment = models.ForeignKey(Shipment, on_delete=models.CASCADE, related_name='items')
    invoice_item = models.ForeignKey('invoices.InvoiceItem', on_delete=models.PROTECT, related_name='shipment_items')
    order_item = models.ForeignKey('orders.OrderItem', on_delete=models.PROTECT, related_name='shipment_items')
    product = models.ForeignKey('inventory.Product', on_delete=models.PROTECT, related_name='shipment_items')
    product_unit = models.ForeignKey('inventory.ProductUnit', on_delete=models.PROTECT, related_name='shipment_items')
    product_code_snapshot = models.CharField(max_length=20)
    product_name_en_snapshot = models.CharField(max_length=100)
    product_name_ar_snapshot = models.CharField(max_length=100)
    unit_snapshot = models.CharField(max_length=20)
    requested_quantity = models.DecimalField(max_digits=18, decimal_places=3)
    actual_quantity = models.DecimalField(max_digits=18, decimal_places=3, null=True, blank=True)
    warehouse = models.ForeignKey('inventory.Warehouse', on_delete=models.PROTECT, related_name='shipment_items', null=True, blank=True)
    number_of_bags = models.PositiveIntegerField(null=True, blank=True)
    total_weight_kg = models.DecimalField(max_digits=18, decimal_places=3, null=True, blank=True)
    average_bag_weight_kg = models.DecimalField(max_digits=18, decimal_places=3, null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['id']
        constraints = [
            models.UniqueConstraint(fields=['shipment', 'invoice_item'], name='unique_shipment_invoice_item'),
            models.CheckConstraint(condition=Q(requested_quantity__gt=0), name='shipment_item_requested_quantity_positive'),
            models.CheckConstraint(condition=Q(actual_quantity__gt=0) | Q(actual_quantity__isnull=True), name='shipment_item_actual_quantity_positive_or_null'),
        ]

    def __str__(self):
        return f'{self.shipment.shipment_number} - {self.product_name_en_snapshot}'
