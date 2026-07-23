import os
import uuid
from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q
from django.utils import timezone


def supply_offer_attachment_path(instance, filename):
    extension = os.path.splitext(filename or '')[1].lower()
    return f'supply_offers/{timezone.now():%Y/%m}/{uuid.uuid4().hex}{extension}'


class SupplyOffer(models.Model):
    STATUS_DRAFT = 'draft'
    STATUS_SUBMITTED = 'submitted'
    STATUS_UNDER_REVIEW = 'under_review'
    STATUS_COUNTER_OFFERED = 'counter_offered'
    STATUS_CUSTOMER_ACCEPTED = 'customer_accepted'
    STATUS_CUSTOMER_DECLINED = 'customer_declined'
    STATUS_APPROVED = 'approved'
    STATUS_REJECTED = 'rejected'
    STATUS_WITHDRAWN = 'withdrawn'
    STATUS_EXPIRED = 'expired'
    STATUS_AWAITING_RECEIPT = 'awaiting_receipt'
    STATUS_RECEIVED = 'received'
    STATUS_COMPLETED = 'completed'
    STATUS_CANCELLED = 'cancelled'
    STATUS_CHOICES = [
        (STATUS_DRAFT, 'Draft'),
        (STATUS_SUBMITTED, 'Submitted'),
        (STATUS_UNDER_REVIEW, 'Under Review'),
        (STATUS_COUNTER_OFFERED, 'New Price Proposed'),
        (STATUS_CUSTOMER_ACCEPTED, 'Customer Accepted'),
        (STATUS_CUSTOMER_DECLINED, 'Customer Declined'),
        (STATUS_APPROVED, 'Approved'),
        (STATUS_REJECTED, 'Rejected'),
        (STATUS_WITHDRAWN, 'Withdrawn'),
        (STATUS_EXPIRED, 'Expired'),
        (STATUS_AWAITING_RECEIPT, 'Awaiting Product Receipt'),
        (STATUS_RECEIVED, 'Received'),
        (STATUS_COMPLETED, 'Completed'),
        (STATUS_CANCELLED, 'Cancelled'),
    ]
    WITHDRAWABLE_STATUSES = {STATUS_DRAFT, STATUS_SUBMITTED, STATUS_UNDER_REVIEW, STATUS_COUNTER_OFFERED}

    offer_number = models.CharField(max_length=30, unique=True, blank=True)
    customer = models.ForeignKey('customers.Customer', on_delete=models.PROTECT, related_name='supply_offers')
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default=STATUS_DRAFT)
    customer_reference = models.CharField(max_length=150, blank=True)
    region = models.CharField(max_length=120)
    city = models.CharField(max_length=120)
    area = models.CharField(max_length=120, blank=True)
    detailed_address = models.CharField(max_length=255)
    latitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    longitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    availability_date = models.DateField(null=True, blank=True)
    customer_notes = models.TextField(blank=True)
    admin_notes = models.TextField(blank=True)
    rejection_reason = models.TextField(blank=True)
    customer_safe_admin_message = models.TextField(blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name='reviewed_supply_offers')
    approved_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name='approved_supply_offers')
    rejected_at = models.DateTimeField(null=True, blank=True)
    rejected_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name='rejected_supply_offers')
    receiving_warehouse = models.ForeignKey('inventory.Warehouse', on_delete=models.PROTECT, null=True, blank=True, related_name='supply_offers')
    currency = models.CharField(max_length=10, default='SDG')
    proposed_total = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    admin_proposed_total = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True)
    agreed_total = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True)
    idempotency_key = models.CharField(max_length=120, blank=True)
    receipt_recorded_at = models.DateTimeField(null=True, blank=True)
    receipt_recorded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name='received_supply_offers')
    payment_recorded_at = models.DateTimeField(null=True, blank=True)
    payment_recorded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name='paid_supply_offers')
    linked_payment = models.ForeignKey('customers.CustomerCashTransaction', on_delete=models.PROTECT, null=True, blank=True, related_name='supply_offer_payments')
    linked_journal = models.ForeignKey('daily_journal.JournalTransaction', on_delete=models.PROTECT, null=True, blank=True, related_name='supply_offer_payments')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['offer_number']),
            models.Index(fields=['customer', 'status']),
            models.Index(fields=['status']),
            models.Index(fields=['city']),
            models.Index(fields=['submitted_at']),
            models.Index(fields=['idempotency_key']),
        ]
        constraints = [
            models.UniqueConstraint(fields=['customer', 'idempotency_key'], condition=~Q(idempotency_key=''), name='unique_customer_supply_offer_idempotency'),
        ]

    def save(self, *args, **kwargs):
        if not self.offer_number:
            year = timezone.localdate().year
            prefix = f'SUP-{year}-'
            last = SupplyOffer.objects.filter(offer_number__startswith=prefix).order_by('-offer_number').values_list('offer_number', flat=True).first()
            next_number = int(last.rsplit('-', 1)[1]) + 1 if last else 1
            self.offer_number = f'{prefix}{next_number:06d}'
        super().save(*args, **kwargs)

    @property
    def product_summary(self):
        names = list(self.items.values_list('product_name_snapshot', flat=True)[:3])
        return ', '.join(names) if names else ''

    def recalculate_totals(self):
        items = list(self.items.all())
        self.proposed_total = sum((Decimal(str(item.customer_proposed_line_total or '0')) for item in items), Decimal('0.00'))
        admin_values = [
            Decimal(str(item.admin_proposed_unit_price)) * Decimal(str(item.quantity))
            for item in items
            if item.admin_proposed_unit_price is not None
        ]
        self.admin_proposed_total = sum(admin_values, Decimal('0.00')) if admin_values else None
        agreed_values = [Decimal(str(item.agreed_line_total)) for item in items if item.agreed_line_total is not None]
        self.agreed_total = sum(agreed_values, Decimal('0.00')) if agreed_values else None

    def clean(self):
        errors = {}
        for field in ('region', 'city', 'detailed_address'):
            if not (getattr(self, field, '') or '').strip():
                errors[field] = 'This field is required.'
        if self.status not in dict(self.STATUS_CHOICES):
            errors['status'] = 'Unsupported offer status.'
        if errors:
            raise ValidationError(errors)

    def __str__(self):
        return self.offer_number


class SupplyOfferItem(models.Model):
    offer = models.ForeignKey(SupplyOffer, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey('inventory.Product', on_delete=models.PROTECT, related_name='supply_offer_items')
    product_unit = models.ForeignKey('inventory.ProductUnit', on_delete=models.PROTECT, related_name='supply_offer_items')
    quantity = models.DecimalField(max_digits=18, decimal_places=3)
    customer_proposed_unit_price = models.DecimalField(max_digits=18, decimal_places=2)
    customer_proposed_line_total = models.DecimalField(max_digits=18, decimal_places=2)
    admin_proposed_unit_price = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True)
    agreed_unit_price = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True)
    agreed_line_total = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True)
    accepted_quantity = models.DecimalField(max_digits=18, decimal_places=3, null=True, blank=True)
    rejected_quantity = models.DecimalField(max_digits=18, decimal_places=3, null=True, blank=True)
    quality_grade = models.CharField(max_length=120, blank=True)
    harvest_date = models.DateField(null=True, blank=True)
    packaging_details = models.CharField(max_length=255, blank=True)
    item_notes = models.TextField(blank=True)
    product_name_snapshot = models.CharField(max_length=100)
    unit_snapshot = models.CharField(max_length=20)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['id']
        constraints = [
            models.UniqueConstraint(fields=['offer', 'product', 'product_unit'], name='unique_supply_offer_product_unit_line'),
            models.CheckConstraint(condition=Q(quantity__gt=0), name='supply_offer_item_quantity_positive'),
            models.CheckConstraint(condition=Q(customer_proposed_unit_price__gt=0), name='supply_offer_item_price_positive'),
        ]

    def clean(self):
        errors = {}
        if self.product_id and (self.product.is_deleted or not self.product.is_active):
            errors['product'] = 'Product must be active.'
        if self.product_unit_id:
            if not self.product_unit.is_active:
                errors['product_unit'] = 'Product unit must be active.'
            if self.product_id and self.product_unit.product_id != self.product_id:
                errors['product_unit'] = 'Unit does not belong to this product.'
        if self.quantity is not None and self.quantity <= 0:
            errors['quantity'] = 'Quantity must be greater than zero.'
        if self.customer_proposed_unit_price is not None and self.customer_proposed_unit_price <= 0:
            errors['customer_proposed_unit_price'] = 'Proposed unit price must be greater than zero.'
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.product_name_snapshot = self.product.name_en
        self.unit_snapshot = self.product_unit.unit
        self.customer_proposed_line_total = Decimal(str(self.quantity)) * Decimal(str(self.customer_proposed_unit_price))
        if self.agreed_unit_price is not None:
            self.agreed_line_total = Decimal(str(self.quantity)) * Decimal(str(self.agreed_unit_price))
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.offer.offer_number} - {self.product_name_snapshot}'


class SupplyOfferAttachment(models.Model):
    TYPE_PRODUCT_IMAGE = 'product_image'
    TYPE_QUALITY_DOCUMENT = 'quality_document'
    TYPE_OTHER_DOCUMENT = 'other_document'
    TYPE_CHOICES = [
        (TYPE_PRODUCT_IMAGE, 'Product Image'),
        (TYPE_QUALITY_DOCUMENT, 'Quality Document'),
        (TYPE_OTHER_DOCUMENT, 'Other Document'),
    ]

    offer = models.ForeignKey(SupplyOffer, on_delete=models.CASCADE, related_name='attachments')
    item = models.ForeignKey(SupplyOfferItem, on_delete=models.CASCADE, null=True, blank=True, related_name='attachments')
    attachment_type = models.CharField(max_length=30, choices=TYPE_CHOICES, default=TYPE_PRODUCT_IMAGE)
    file = models.FileField(upload_to=supply_offer_attachment_path)
    original_filename = models.CharField(max_length=255)
    mime_type = models.CharField(max_length=120)
    file_size = models.PositiveIntegerField()
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='uploaded_supply_offer_attachments')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
        indexes = [models.Index(fields=['offer']), models.Index(fields=['attachment_type'])]


class SupplyOfferStatusHistory(models.Model):
    ACTOR_CUSTOMER = 'customer'
    ACTOR_ADMIN = 'admin'
    ACTOR_SYSTEM = 'system'
    ACTOR_CHOICES = [
        (ACTOR_CUSTOMER, 'Customer'),
        (ACTOR_ADMIN, 'Admin'),
        (ACTOR_SYSTEM, 'System'),
    ]

    offer = models.ForeignKey(SupplyOffer, on_delete=models.CASCADE, related_name='timeline')
    previous_status = models.CharField(max_length=30, blank=True)
    new_status = models.CharField(max_length=30)
    changed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='supply_offer_status_changes')
    actor_type = models.CharField(max_length=20, choices=ACTOR_CHOICES)
    customer_safe_note = models.TextField(blank=True)
    internal_note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
        indexes = [models.Index(fields=['offer', 'created_at']), models.Index(fields=['new_status'])]
