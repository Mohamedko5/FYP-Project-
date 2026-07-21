from decimal import Decimal

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone


class Invoice(models.Model):
    STATUS_ISSUED = 'issued'
    STATUS_PAID = 'paid'
    STATUS_CANCELLED = 'cancelled'
    STATUS_CHOICES = [
        (STATUS_ISSUED, 'Issued'),
        (STATUS_PAID, 'Paid'),
        (STATUS_CANCELLED, 'Cancelled'),
    ]
    PAYMENT_UNPAID = 'unpaid'
    PAYMENT_PAID = 'paid'
    PAYMENT_STATUS_CHOICES = [
        (PAYMENT_UNPAID, 'Unpaid'),
        (PAYMENT_PAID, 'Paid'),
    ]

    invoice_number = models.CharField(max_length=30, unique=True, blank=True)
    order = models.ForeignKey('orders.Order', on_delete=models.PROTECT, related_name='invoices')
    customer = models.ForeignKey('customers.Customer', on_delete=models.PROTECT, related_name='invoices')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_ISSUED)
    payment_status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default=PAYMENT_UNPAID)
    subtotal = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal('0.00'))
    discount_amount = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal('0.00'))
    total_amount = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal('0.00'))
    currency = models.CharField(max_length=10, default='SDG')
    notes = models.TextField(blank=True)
    issued_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='issued_invoices')
    issued_at = models.DateTimeField(default=timezone.now)
    paid_at = models.DateTimeField(null=True, blank=True)
    paid_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='paid_invoices', null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancelled_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='cancelled_invoices', null=True, blank=True)
    cancellation_reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-issued_at']
        indexes = [
            models.Index(fields=['invoice_number']),
            models.Index(fields=['order']),
            models.Index(fields=['customer']),
            models.Index(fields=['status']),
            models.Index(fields=['payment_status']),
            models.Index(fields=['issued_at']),
        ]
        constraints = [
            models.UniqueConstraint(fields=['order'], condition=~Q(status='cancelled'), name='unique_active_invoice_per_order'),
        ]

    def save(self, *args, **kwargs):
        if not self.invoice_number:
            year = timezone.localdate().year
            prefix = f'INV-{year}-'
            last = Invoice.objects.filter(invoice_number__startswith=prefix).order_by('-invoice_number').values_list('invoice_number', flat=True).first()
            next_number = int(last.rsplit('-', 1)[1]) + 1 if last else 1
            self.invoice_number = f'{prefix}{next_number:06d}'
        super().save(*args, **kwargs)

    def __str__(self):
        return self.invoice_number


class InvoiceItem(models.Model):
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='items')
    order_item = models.ForeignKey('orders.OrderItem', on_delete=models.PROTECT, related_name='invoice_items')
    product = models.ForeignKey('inventory.Product', on_delete=models.PROTECT, related_name='invoice_items')
    product_unit = models.ForeignKey('inventory.ProductUnit', on_delete=models.PROTECT, related_name='invoice_items')
    product_code_snapshot = models.CharField(max_length=20)
    product_name_en_snapshot = models.CharField(max_length=100)
    product_name_ar_snapshot = models.CharField(max_length=100)
    unit_snapshot = models.CharField(max_length=20)
    quantity = models.DecimalField(max_digits=18, decimal_places=3)
    unit_price = models.DecimalField(max_digits=18, decimal_places=2)
    line_total = models.DecimalField(max_digits=18, decimal_places=2)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['id']
        constraints = [
            models.UniqueConstraint(fields=['invoice', 'order_item'], name='unique_invoice_order_item'),
        ]


class InvoicePayment(models.Model):
    PAYMENT_CASH = 'cash'
    PAYMENT_ONLINE = 'online'
    PAYMENT_METHOD_CHOICES = [
        (PAYMENT_CASH, 'Cash'),
        (PAYMENT_ONLINE, 'Online'),
    ]

    invoice = models.OneToOneField(Invoice, on_delete=models.PROTECT, related_name='payment')
    amount = models.DecimalField(max_digits=18, decimal_places=2)
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES)
    payment_reference = models.CharField(max_length=120, blank=True)
    linked_customer_transaction = models.ForeignKey('customers.CustomerCashTransaction', on_delete=models.PROTECT, related_name='invoice_payments', null=True, blank=True)
    linked_journal_transaction = models.ForeignKey('daily_journal.JournalTransaction', on_delete=models.PROTECT, related_name='invoice_payments', null=True, blank=True)
    received_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='received_invoice_payments')
    received_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-received_at']
        indexes = [
            models.Index(fields=['payment_method']),
            models.Index(fields=['received_at']),
        ]
