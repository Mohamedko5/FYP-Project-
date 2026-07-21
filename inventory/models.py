from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q
from django.utils import timezone


UNIT_QINTAR = 'Qintar'
UNIT_KG = 'KG'
UNIT_BAG = 'Bag'
UNIT_BALE = 'Bale'
UNIT_UNIT = 'Unit'
UNIT_CHOICES = [
    (UNIT_QINTAR, 'Qintar'),
    (UNIT_KG, 'KG'),
    (UNIT_BAG, 'Bag'),
    (UNIT_BALE, 'Bale'),
    (UNIT_UNIT, 'Unit'),
]


class Product(models.Model):
    CATEGORY_COMMODITY = 'commodity'
    CATEGORY_SUPPLY = 'supply'
    CATEGORY_CHOICES = [
        (CATEGORY_COMMODITY, 'Commodity'),
        (CATEGORY_SUPPLY, 'Supply'),
    ]

    code = models.CharField(max_length=20, unique=True, blank=True)
    name_en = models.CharField(max_length=100)
    name_ar = models.CharField(max_length=100)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    description = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    is_deleted = models.BooleanField(default=False)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='created_products', null=True, blank=True)
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='updated_products', null=True, blank=True)
    deleted_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='deleted_products', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['name_en']
        indexes = [
            models.Index(fields=['code']),
            models.Index(fields=['name_en']),
            models.Index(fields=['name_ar']),
            models.Index(fields=['category']),
            models.Index(fields=['is_active']),
            models.Index(fields=['is_deleted']),
            models.Index(fields=['created_at']),
        ]
        constraints = [
            models.UniqueConstraint(
                models.functions.Lower('name_en'),
                condition=Q(is_deleted=False),
                name='unique_active_product_name_en_ci',
            ),
            models.UniqueConstraint(
                models.functions.Lower('name_ar'),
                condition=Q(is_deleted=False),
                name='unique_active_product_name_ar_ci',
            ),
        ]

    def save(self, *args, **kwargs):
        if not self.code:
            last_id = Product.objects.order_by('-id').values_list('id', flat=True).first() or 0
            self.code = f'PRD-{last_id + 1:04d}'
        super().save(*args, **kwargs)

    def clean(self):
        errors = {}
        for field in ('name_en', 'name_ar', 'category', 'description', 'notes'):
            value = getattr(self, field, '')
            if isinstance(value, str):
                setattr(self, field, value.strip())
        if not self.name_en:
            errors['name_en'] = 'English name is required.'
        if not self.name_ar:
            errors['name_ar'] = 'Arabic name is required.'
        if not self.category:
            errors['category'] = 'Category is required.'
        if self.category and self.category not in dict(self.CATEGORY_CHOICES):
            errors['category'] = 'Choose commodity or supply.'
        duplicate_en = Product.objects.filter(name_en__iexact=self.name_en, is_deleted=False)
        duplicate_ar = Product.objects.filter(name_ar__iexact=self.name_ar, is_deleted=False)
        if self.pk:
            duplicate_en = duplicate_en.exclude(pk=self.pk)
            duplicate_ar = duplicate_ar.exclude(pk=self.pk)
        if self.name_en and duplicate_en.exists():
            errors['name_en'] = 'An active product with this English name already exists.'
        if self.name_ar and duplicate_ar.exists():
            errors['name_ar'] = 'An active product with this Arabic name already exists.'
        if errors:
            raise ValidationError(errors)

    @property
    def stock_status(self):
        items = list(self.inventory_items.filter(warehouse__is_deleted=False))
        if not items:
            return 'Not Stocked'
        if all(item.quantity == 0 for item in items):
            return 'Out of Stock'
        if any(Decimal('0.000') < item.quantity <= item.minimum_threshold for item in items):
            return 'Low Stock'
        return 'Available'

    def __str__(self):
        return self.name_en


class ProductUnit(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='units')
    unit = models.CharField(max_length=20, choices=UNIT_CHOICES)
    is_default = models.BooleanField(default=False)
    purchase_price = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal('0.00'))
    selling_price = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal('0.00'))
    minimum_selling_price = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['product__name_en', 'unit']
        constraints = [
            models.UniqueConstraint(fields=['product', 'unit'], name='unique_product_unit'),
            models.CheckConstraint(condition=Q(purchase_price__gte=0), name='product_unit_purchase_price_non_negative'),
            models.CheckConstraint(condition=Q(selling_price__gte=0), name='product_unit_selling_price_non_negative'),
            models.CheckConstraint(condition=Q(minimum_selling_price__gte=0) | Q(minimum_selling_price__isnull=True), name='product_unit_minimum_price_non_negative'),
        ]

    def clean(self):
        errors = {}
        if self.purchase_price is not None and self.purchase_price < 0:
            errors['purchase_price'] = 'Purchase price cannot be negative.'
        if self.selling_price is not None and self.selling_price < 0:
            errors['selling_price'] = 'Selling price cannot be negative.'
        if self.minimum_selling_price is not None and self.minimum_selling_price < 0:
            errors['minimum_selling_price'] = 'Minimum selling price cannot be negative.'
        if self.minimum_selling_price is not None and self.selling_price is not None and self.minimum_selling_price > self.selling_price:
            errors['minimum_selling_price'] = 'Minimum selling price should not exceed selling price.'
        if self.product_id and self.unit:
            allowed = allowed_units_for_product(self.product.name_en)
            if allowed and self.unit not in allowed:
                errors['unit'] = f'{self.unit} is not valid for {self.product.name_en}.'
        if errors:
            raise ValidationError(errors)

    def __str__(self):
        return f'{self.product.name_en} - {self.unit}'


def allowed_units_for_product(product_name):
    rules = {
        'White Sesame': {UNIT_QINTAR},
        'Red Sesame': {UNIT_QINTAR},
        'Corn': {UNIT_KG, UNIT_BAG},
        'Dabara': {UNIT_BALE, UNIT_UNIT},
        'Sacks / Khaysh': {UNIT_BALE, UNIT_UNIT},
        'Plastic': {UNIT_BALE, UNIT_UNIT},
    }
    return rules.get(product_name)


class Warehouse(models.Model):
    code = models.CharField(max_length=20, unique=True, blank=True)
    warehouse_name = models.CharField(max_length=150)
    location = models.CharField(max_length=150)
    primary_product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name='primary_warehouses')
    capacity = models.DecimalField(max_digits=18, decimal_places=3)
    capacity_unit = models.CharField(max_length=20, choices=UNIT_CHOICES)
    manager_name = models.CharField(max_length=150)
    guard_name = models.CharField(max_length=150)
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    is_deleted = models.BooleanField(default=False)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='created_warehouses')
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='updated_warehouses', null=True, blank=True)
    deleted_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='deleted_warehouses', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['warehouse_name']
        indexes = [
            models.Index(fields=['warehouse_name']),
            models.Index(fields=['location']),
            models.Index(fields=['is_deleted']),
            models.Index(fields=['is_active']),
        ]
        constraints = [
            models.CheckConstraint(condition=Q(capacity__gt=0), name='warehouse_capacity_positive'),
        ]

    def save(self, *args, **kwargs):
        if not self.code:
            last_id = Warehouse.objects.order_by('-id').values_list('id', flat=True).first() or 0
            self.code = f'WH-{last_id + 1:04d}'
        super().save(*args, **kwargs)

    def clean(self):
        errors = {}
        for field in ('warehouse_name', 'location', 'manager_name', 'guard_name'):
            if not getattr(self, field, '').strip():
                errors[field] = 'This field is required.'
        if self.capacity is not None and self.capacity <= 0:
            errors['capacity'] = 'Capacity must be greater than zero.'
        if self.primary_product_id and self.capacity_unit:
            allowed = ProductUnit.objects.filter(product=self.primary_product, unit=self.capacity_unit, is_active=True).exists()
            if not allowed:
                errors['capacity_unit'] = f'{self.capacity_unit} is not valid for {self.primary_product.name_en}.'
        if errors:
            raise ValidationError(errors)

    @property
    def used_capacity(self):
        return sum((item.quantity for item in self.inventory_items.all()), Decimal('0.000'))

    @property
    def available_capacity(self):
        available = self.capacity - self.used_capacity
        return max(available, Decimal('0.000'))

    @property
    def usage_percent(self):
        if not self.capacity:
            return Decimal('0.00')
        return min((self.used_capacity / self.capacity) * Decimal('100'), Decimal('100.00'))

    @property
    def status(self):
        if self.is_deleted or not self.is_active:
            return 'Archived'
        used = self.used_capacity
        percent = self.usage_percent
        if used == 0:
            return 'Inactive'
        if percent >= 100:
            return 'Full'
        if percent >= 80:
            return 'Almost Full'
        return 'Available'

    def __str__(self):
        return f'{self.code} - {self.warehouse_name}'


class Inventory(models.Model):
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name='inventory_items')
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name='inventory_items')
    quantity = models.DecimalField(max_digits=18, decimal_places=3, default=Decimal('0.000'))
    unit = models.CharField(max_length=20, choices=UNIT_CHOICES)
    minimum_threshold = models.DecimalField(max_digits=18, decimal_places=3, default=Decimal('0.000'))
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['product__name_en']
        constraints = [
            models.UniqueConstraint(fields=['warehouse', 'product', 'unit'], name='unique_warehouse_product_unit'),
            models.CheckConstraint(condition=Q(quantity__gte=0), name='inventory_quantity_non_negative'),
            models.CheckConstraint(condition=Q(minimum_threshold__gte=0), name='inventory_threshold_non_negative'),
        ]

    @property
    def status(self):
        if self.quantity == 0:
            return 'Out of Stock'
        if self.quantity <= self.minimum_threshold:
            return 'Low Stock'
        return 'Available'

    def clean(self):
        errors = {}
        if self.quantity < 0:
            errors['quantity'] = 'Quantity cannot be negative.'
        if self.minimum_threshold < 0:
            errors['minimum_threshold'] = 'Minimum threshold cannot be negative.'
        if self.product_id and self.unit:
            allowed = ProductUnit.objects.filter(product=self.product, unit=self.unit, is_active=True).exists()
            if not allowed:
                errors['unit'] = f'{self.unit} is not valid for {self.product.name_en}.'
        if self.warehouse_id and self.unit and self.unit != self.warehouse.capacity_unit:
            errors['unit'] = 'Inventory unit must match warehouse capacity unit.'
        if self.product_id and (not self.product.is_active or self.product.is_deleted):
            errors['product'] = 'Product must be active.'
        if self.warehouse_id and (not self.warehouse.is_active or self.warehouse.is_deleted):
            errors['warehouse'] = 'Warehouse must be active.'
        if errors:
            raise ValidationError(errors)

    def __str__(self):
        return f'{self.warehouse.code} - {self.product.name_en} - {self.quantity} {self.unit}'


class InventoryMovement(models.Model):
    STOCK_IN = 'stock_in'
    MANUAL_WITHDRAWAL = 'manual_withdrawal'
    SHIPMENT_OUT = 'shipment_out'
    TRANSFER_IN = 'transfer_in'
    TRANSFER_OUT = 'transfer_out'
    ADJUSTMENT_IN = 'adjustment_in'
    ADJUSTMENT_OUT = 'adjustment_out'
    MOVEMENT_TYPE_CHOICES = [
        (STOCK_IN, 'Stock In'),
        (MANUAL_WITHDRAWAL, 'Manual Withdrawal'),
        (SHIPMENT_OUT, 'Shipment Out'),
        (TRANSFER_IN, 'Transfer In'),
        (TRANSFER_OUT, 'Transfer Out'),
        (ADJUSTMENT_IN, 'Adjustment In'),
        (ADJUSTMENT_OUT, 'Adjustment Out'),
    ]

    SOURCE_MANUAL = 'manual'
    SOURCE_SHIPMENT = 'shipment'
    SOURCE_TRANSFER = 'transfer'
    SOURCE_SYSTEM = 'system'
    SOURCE_TYPE_CHOICES = [
        (SOURCE_MANUAL, 'Manual'),
        (SOURCE_SHIPMENT, 'Shipment'),
        (SOURCE_TRANSFER, 'Transfer'),
        (SOURCE_SYSTEM, 'System'),
    ]

    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name='movements')
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name='inventory_movements')
    movement_type = models.CharField(max_length=30, choices=MOVEMENT_TYPE_CHOICES)
    quantity = models.DecimalField(max_digits=18, decimal_places=3)
    unit = models.CharField(max_length=20, choices=UNIT_CHOICES)
    quantity_before = models.DecimalField(max_digits=18, decimal_places=3)
    quantity_after = models.DecimalField(max_digits=18, decimal_places=3)
    driver_name = models.CharField(max_length=150, blank=True)
    notes = models.TextField(blank=True)
    source_type = models.CharField(max_length=20, choices=SOURCE_TYPE_CHOICES, default=SOURCE_MANUAL)
    source_reference = models.CharField(max_length=120, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='created_inventory_movements')
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['warehouse']),
            models.Index(fields=['product']),
            models.Index(fields=['movement_type']),
            models.Index(fields=['created_at']),
            models.Index(fields=['source_type']),
            models.Index(fields=['source_reference']),
        ]
        constraints = [
            models.CheckConstraint(condition=Q(quantity__gt=0), name='movement_quantity_positive'),
            models.CheckConstraint(condition=Q(quantity_before__gte=0), name='movement_before_non_negative'),
            models.CheckConstraint(condition=Q(quantity_after__gte=0), name='movement_after_non_negative'),
        ]

    def __str__(self):
        return f'{self.get_movement_type_display()} - {self.product.name_en} - {self.quantity} {self.unit}'

# Create your models here.
