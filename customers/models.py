from decimal import Decimal
import re

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q, Sum
from django.utils import timezone


PHONE_RE = re.compile(r'^\+?[0-9]{7,15}$')


def normalize_phone(value):
    value = (value or '').strip().replace(' ', '').replace('-', '')
    return value


def validate_photo_file(file_obj):
    if not file_obj:
        return
    allowed_extensions = {'.jpg', '.jpeg', '.png', '.webp'}
    name = (file_obj.name or '').lower()
    if not any(name.endswith(extension) for extension in allowed_extensions):
        raise ValidationError({'photo': 'Photo must be JPG, JPEG, PNG, or WEBP.'})
    if file_obj.size and file_obj.size > 2 * 1024 * 1024:
        raise ValidationError({'photo': 'Photo must not exceed 2 MB.'})


class Customer(models.Model):
    TYPE_FARMER = 'farmer'
    TYPE_INVESTOR = 'investor'
    TYPE_CONSUMER = 'consumer'
    TYPE_EXPORTER = 'exporter'
    TYPE_FACTORY = 'factory'
    TYPE_SUPPLIER = 'supplier'
    CUSTOMER_TYPE_CHOICES = [
        (TYPE_FARMER, 'Farmer'),
        (TYPE_INVESTOR, 'Investor'),
        (TYPE_CONSUMER, 'Consumer'),
        (TYPE_EXPORTER, 'Exporter'),
        (TYPE_FACTORY, 'Factory'),
        (TYPE_SUPPLIER, 'Supplier'),
    ]

    code = models.CharField(max_length=20, unique=True, blank=True)
    name = models.CharField(max_length=150)
    phone = models.CharField(max_length=30)
    secondary_phone = models.CharField(max_length=30, blank=True)
    address = models.CharField(max_length=255)
    customer_type = models.CharField(max_length=20, choices=CUSTOMER_TYPE_CHOICES)
    photo = models.FileField(upload_to='customers/', null=True, blank=True)
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    is_deleted = models.BooleanField(default=False)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='created_customers')
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='updated_customers', null=True, blank=True)
    deleted_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='deleted_customers', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['name']
        indexes = [
            models.Index(fields=['code']),
            models.Index(fields=['phone']),
            models.Index(fields=['customer_type']),
            models.Index(fields=['is_active']),
            models.Index(fields=['is_deleted']),
            models.Index(fields=['created_at']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['phone'],
                condition=Q(is_deleted=False, is_active=True),
                name='unique_active_customer_phone',
            ),
        ]

    def save(self, *args, **kwargs):
        if not self.code:
            last_id = Customer.objects.order_by('-id').values_list('id', flat=True).first() or 0
            self.code = f'CUS-{last_id + 1:04d}'
        super().save(*args, **kwargs)

    def clean(self):
        errors = {}
        for field in ('name', 'phone', 'address', 'customer_type'):
            value = getattr(self, field, '')
            if isinstance(value, str):
                value = value.strip()
                setattr(self, field, value)
            if not value:
                errors[field] = 'This field is required.'

        self.phone = normalize_phone(self.phone)
        self.secondary_phone = normalize_phone(self.secondary_phone)
        if self.phone and not PHONE_RE.match(self.phone):
            errors['phone'] = 'Enter a valid phone number.'
        if self.secondary_phone:
            if not PHONE_RE.match(self.secondary_phone):
                errors['secondary_phone'] = 'Enter a valid phone number.'
            if self.secondary_phone == self.phone:
                errors['secondary_phone'] = 'Secondary phone must be different from phone.'
        if self.customer_type and self.customer_type not in dict(self.CUSTOMER_TYPE_CHOICES):
            errors['customer_type'] = 'Choose a valid customer type.'
        duplicate = Customer.objects.filter(phone=self.phone, is_deleted=False, is_active=True)
        if self.pk:
            duplicate = duplicate.exclude(pk=self.pk)
        if self.phone and duplicate.exists():
            errors['phone'] = 'An active customer with this phone already exists.'
        try:
            validate_photo_file(self.photo)
        except ValidationError as exc:
            errors.update(exc.message_dict)
        if errors:
            raise ValidationError(errors)

    @property
    def cash_totals(self):
        transactions = self.cash_transactions.filter(is_deleted=False)
        debits = transactions.filter(transaction_type__in=CustomerCashTransaction.DEBIT_TYPES).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        credits = transactions.filter(transaction_type__in=CustomerCashTransaction.CREDIT_TYPES).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        payments = transactions.filter(transaction_type=CustomerCashTransaction.PAYMENT_RECEIVED).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        return debits, credits, payments

    @property
    def cash_balance(self):
        debits, credits, _ = self.cash_totals
        return debits - credits

    @property
    def cash_status(self):
        balance = self.cash_balance
        if balance > 0:
            return 'Debtor'
        if balance < 0:
            return 'Creditor'
        return 'Balanced'

    @property
    def last_transaction_at(self):
        cash = self.cash_transactions.filter(is_deleted=False).order_by('-created_at').values_list('created_at', flat=True).first()
        commodity = self.commodity_transactions.filter(is_deleted=False).order_by('-created_at').values_list('created_at', flat=True).first()
        dates = [value for value in (cash, commodity) if value]
        return max(dates) if dates else None

    def commodity_balance_rows(self):
        received_types = CustomerCommodityTransaction.INCREASE_TYPES
        delivered_types = CustomerCommodityTransaction.DECREASE_TYPES
        rows = []
        keys = self.commodity_transactions.filter(is_deleted=False).values('product_id', 'product__name_en', 'product__name_ar', 'unit').distinct()
        for key in keys:
            base = self.commodity_transactions.filter(is_deleted=False, product_id=key['product_id'], unit=key['unit'])
            increases = base.filter(transaction_type__in=received_types).aggregate(total=Sum('quantity'))['total'] or Decimal('0.000')
            decreases = base.filter(transaction_type__in=delivered_types).aggregate(total=Sum('quantity'))['total'] or Decimal('0.000')
            rows.append({
                'product_id': key['product_id'],
                'product_name': key['product__name_en'],
                'product_name_ar': key['product__name_ar'],
                'unit': key['unit'],
                'quantity': increases - decreases,
            })
        return rows

    def __str__(self):
        return f'{self.code} - {self.name}'


class CustomerAccount(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='customer_account')
    customer = models.OneToOneField(Customer, on_delete=models.PROTECT, related_name='mobile_account')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['customer__name']
        indexes = [
            models.Index(fields=['user']),
            models.Index(fields=['customer']),
        ]

    def __str__(self):
        return f'{self.user.email} -> {self.customer.code}'


class MobileIdempotencyKey(models.Model):
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='mobile_idempotency_keys')
    operation = models.CharField(max_length=60)
    key = models.CharField(max_length=120)
    request_hash = models.CharField(max_length=64)
    response_data = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(fields=['customer', 'operation', 'key'], name='unique_mobile_customer_idempotency_key'),
        ]
        indexes = [
            models.Index(fields=['customer', 'operation', 'key']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f'{self.customer.code} {self.operation} {self.key}'


class CustomerCashTransaction(models.Model):
    OPENING_DEBT = 'opening_debt'
    OPENING_CREDIT = 'opening_credit'
    PAYMENT_RECEIVED = 'payment_received'
    PAYMENT_OWED = 'payment_owed'
    CUSTOMER_EXPENSE = 'customer_expense'
    INVOICE_CHARGE = 'invoice_charge'
    ADJUSTMENT_DEBIT = 'adjustment_debit'
    ADJUSTMENT_CREDIT = 'adjustment_credit'
    TRANSACTION_TYPE_CHOICES = [
        (OPENING_DEBT, 'Opening Debt'),
        (OPENING_CREDIT, 'Opening Credit'),
        (PAYMENT_RECEIVED, 'Payment Received'),
        (PAYMENT_OWED, 'Payment Owed'),
        (CUSTOMER_EXPENSE, 'Customer Expense'),
        (INVOICE_CHARGE, 'Invoice Charge'),
        (ADJUSTMENT_DEBIT, 'Adjustment Debit'),
        (ADJUSTMENT_CREDIT, 'Adjustment Credit'),
    ]
    MANUAL_TYPES = {PAYMENT_RECEIVED, PAYMENT_OWED, CUSTOMER_EXPENSE}
    DEBIT_TYPES = {OPENING_DEBT, PAYMENT_OWED, CUSTOMER_EXPENSE, INVOICE_CHARGE, ADJUSTMENT_DEBIT}
    CREDIT_TYPES = {OPENING_CREDIT, PAYMENT_RECEIVED, ADJUSTMENT_CREDIT}

    PAYMENT_CASH = 'cash'
    PAYMENT_ONLINE = 'online'
    PAYMENT_METHOD_CHOICES = [
        (PAYMENT_CASH, 'Cash'),
        (PAYMENT_ONLINE, 'Online'),
    ]
    PAYMENT_REQUIRED_TYPES = {PAYMENT_RECEIVED, CUSTOMER_EXPENSE}
    PAYMENT_FORBIDDEN_TYPES = {PAYMENT_OWED, OPENING_DEBT, OPENING_CREDIT, INVOICE_CHARGE}

    SOURCE_MANUAL = 'manual'
    SOURCE_CUSTOMER = 'customer'
    SOURCE_INVOICE = 'invoice'
    SOURCE_SYSTEM = 'system'
    SOURCE_TYPE_CHOICES = [
        (SOURCE_MANUAL, 'Manual'),
        (SOURCE_CUSTOMER, 'Customer'),
        (SOURCE_INVOICE, 'Invoice'),
        (SOURCE_SYSTEM, 'System'),
    ]

    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name='cash_transactions')
    transaction_type = models.CharField(max_length=30, choices=TRANSACTION_TYPE_CHOICES)
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES, null=True, blank=True)
    amount = models.DecimalField(max_digits=18, decimal_places=2)
    description = models.TextField()
    source_type = models.CharField(max_length=20, choices=SOURCE_TYPE_CHOICES, default=SOURCE_MANUAL)
    source_reference = models.CharField(max_length=120, blank=True)
    is_system_generated = models.BooleanField(default=False)
    linked_journal_transaction = models.ForeignKey('daily_journal.JournalTransaction', on_delete=models.PROTECT, null=True, blank=True, related_name='customer_cash_transactions')
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='created_customer_cash_transactions')
    created_at = models.DateTimeField(default=timezone.now)
    is_deleted = models.BooleanField(default=False)
    deleted_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='deleted_customer_cash_transactions', null=True, blank=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['customer']),
            models.Index(fields=['transaction_type']),
            models.Index(fields=['payment_method']),
            models.Index(fields=['created_at']),
            models.Index(fields=['source_type']),
            models.Index(fields=['source_reference']),
            models.Index(fields=['is_deleted']),
        ]
        constraints = [
            models.CheckConstraint(condition=Q(amount__gt=0), name='customer_cash_amount_positive'),
        ]

    def clean(self):
        errors = {}
        if self.customer_id and (self.customer.is_deleted or not self.customer.is_active):
            errors['customer'] = 'Archived customers cannot receive transactions.'
        if self.amount is not None and self.amount <= 0:
            errors['amount'] = 'Amount must be greater than zero.'
        self.description = (self.description or '').strip()
        if not self.description:
            errors['description'] = 'Description is required.'
        if self.transaction_type in self.PAYMENT_REQUIRED_TYPES and not self.payment_method:
            errors['payment_method'] = 'Payment method is required.'
        if self.transaction_type in self.PAYMENT_FORBIDDEN_TYPES and self.payment_method:
            errors['payment_method'] = 'Payment method must be empty for this transaction type.'
        if self.payment_method and self.payment_method not in dict(self.PAYMENT_METHOD_CHOICES):
            errors['payment_method'] = 'Choose cash or online.'
        if self.transaction_type not in dict(self.TRANSACTION_TYPE_CHOICES):
            errors['transaction_type'] = 'Choose a valid transaction type.'
        if errors:
            raise ValidationError(errors)

    def __str__(self):
        return f'{self.customer.code} - {self.get_transaction_type_display()} - {self.amount}'


class CustomerCommodityTransaction(models.Model):
    PRODUCT_RECEIVED = 'product_received'
    PRODUCT_DELIVERED = 'product_delivered'
    PRODUCT_STORED = 'product_stored'
    WAREHOUSE_WITHDRAWAL = 'warehouse_withdrawal'
    TRANSACTION_TYPE_CHOICES = [
        (PRODUCT_RECEIVED, 'Product Received'),
        (PRODUCT_DELIVERED, 'Product Delivered'),
        (PRODUCT_STORED, 'Product Stored'),
        (WAREHOUSE_WITHDRAWAL, 'Warehouse Withdrawal'),
    ]
    MANUAL_TYPES = {PRODUCT_RECEIVED, PRODUCT_DELIVERED}
    INCREASE_TYPES = {PRODUCT_RECEIVED, PRODUCT_STORED}
    DECREASE_TYPES = {PRODUCT_DELIVERED, WAREHOUSE_WITHDRAWAL}

    SOURCE_MANUAL = 'manual'
    SOURCE_INVENTORY = 'inventory'
    SOURCE_SHIPMENT = 'shipment'
    SOURCE_SYSTEM = 'system'
    SOURCE_TYPE_CHOICES = [
        (SOURCE_MANUAL, 'Manual'),
        (SOURCE_INVENTORY, 'Inventory'),
        (SOURCE_SHIPMENT, 'Shipment'),
        (SOURCE_SYSTEM, 'System'),
    ]

    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name='commodity_transactions')
    transaction_type = models.CharField(max_length=30, choices=TRANSACTION_TYPE_CHOICES)
    product = models.ForeignKey('inventory.Product', on_delete=models.PROTECT, related_name='customer_commodity_transactions')
    quantity = models.DecimalField(max_digits=18, decimal_places=3)
    unit = models.CharField(max_length=20)
    warehouse = models.ForeignKey('inventory.Warehouse', on_delete=models.PROTECT, related_name='customer_commodity_transactions', null=True, blank=True)
    estimated_value = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True)
    description = models.TextField()
    source_type = models.CharField(max_length=20, choices=SOURCE_TYPE_CHOICES, default=SOURCE_MANUAL)
    source_reference = models.CharField(max_length=120, blank=True)
    is_system_generated = models.BooleanField(default=False)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='created_customer_commodity_transactions')
    created_at = models.DateTimeField(default=timezone.now)
    is_deleted = models.BooleanField(default=False)
    deleted_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='deleted_customer_commodity_transactions', null=True, blank=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['customer']),
            models.Index(fields=['product']),
            models.Index(fields=['unit']),
            models.Index(fields=['transaction_type']),
            models.Index(fields=['created_at']),
            models.Index(fields=['source_type']),
            models.Index(fields=['source_reference']),
            models.Index(fields=['is_deleted']),
        ]
        constraints = [
            models.CheckConstraint(condition=Q(quantity__gt=0), name='customer_commodity_quantity_positive'),
            models.CheckConstraint(
                condition=Q(estimated_value__gte=0) | Q(estimated_value__isnull=True),
                name='customer_commodity_estimated_value_non_negative',
            ),
        ]

    def clean(self):
        errors = {}
        if self.customer_id and (self.customer.is_deleted or not self.customer.is_active):
            errors['customer'] = 'Archived customers cannot receive transactions.'
        if self.quantity is not None and self.quantity <= 0:
            errors['quantity'] = 'Quantity must be greater than zero.'
        if self.estimated_value is not None and self.estimated_value < 0:
            errors['estimated_value'] = 'Estimated value cannot be negative.'
        self.description = (self.description or '').strip()
        if not self.description:
            errors['description'] = 'Description is required.'
        if self.transaction_type not in dict(self.TRANSACTION_TYPE_CHOICES):
            errors['transaction_type'] = 'Choose a valid transaction type.'
        if errors:
            raise ValidationError(errors)

    def __str__(self):
        return f'{self.customer.code} - {self.product.name_en} - {self.quantity} {self.unit}'
