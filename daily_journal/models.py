from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


class JournalTransaction(models.Model):
    JOURNAL_CASH = 'cash'
    JOURNAL_COMMODITY = 'commodity'
    JOURNAL_TYPE_CHOICES = [
        (JOURNAL_CASH, 'Cash'),
        (JOURNAL_COMMODITY, 'Commodity'),
    ]

    CASH_INCOME = 'income'
    CASH_EXPENSE = 'expense'
    CASH_TYPE_CHOICES = [
        (CASH_INCOME, 'Income'),
        (CASH_EXPENSE, 'Expense'),
    ]

    PAYMENT_CASH = 'cash'
    PAYMENT_ELECTRONIC = 'electronic'
    PAYMENT_ONLINE = PAYMENT_ELECTRONIC
    PAYMENT_METHOD_CHOICES = [
        (PAYMENT_CASH, 'Cash'),
        (PAYMENT_ELECTRONIC, 'Electronic Payment'),
    ]

    SOURCE_MANUAL = 'manual'
    SOURCE_INVOICE = 'invoice'
    SOURCE_SHIPMENT = 'shipment'
    SOURCE_WAREHOUSE = 'warehouse'
    SOURCE_CUSTOMER = 'customer'
    SOURCE_WORKER = 'worker'
    SOURCE_TYPE_CHOICES = [
        (SOURCE_MANUAL, 'Manual'),
        (SOURCE_INVOICE, 'Invoice'),
        (SOURCE_SHIPMENT, 'Shipment'),
        (SOURCE_WAREHOUSE, 'Warehouse'),
        (SOURCE_CUSTOMER, 'Customer'),
        (SOURCE_WORKER, 'Worker'),
    ]

    WAREHOUSE_STOCK_IN = 'stock_in'
    WAREHOUSE_MANUAL_WITHDRAWAL = 'manual_withdrawal'
    WAREHOUSE_OPERATION_CHOICES = [
        (WAREHOUSE_STOCK_IN, 'Add Stock'),
        (WAREHOUSE_MANUAL_WITHDRAWAL, 'Manual Withdrawal'),
    ]

    PRODUCT_WHITE_SESAME = 'White Sesame'
    PRODUCT_RED_SESAME = 'Red Sesame'
    PRODUCT_CORN = 'Corn'
    SUPPLY_PRODUCTS = {'Dabara', 'Sacks / Khaysh', 'Plastic'}

    UNIT_QINTAR = 'Qintar'
    UNIT_KG = 'KG'
    UNIT_BAG = 'Bag'
    UNIT_BALE = 'Bale'
    UNIT_UNIT = 'Unit'

    UNIT_RULES = {
        PRODUCT_WHITE_SESAME: {UNIT_QINTAR},
        PRODUCT_RED_SESAME: {UNIT_QINTAR},
        PRODUCT_CORN: {UNIT_KG, UNIT_BAG},
        'Dabara': {UNIT_BALE, UNIT_UNIT},
        'Sacks / Khaysh': {UNIT_BALE, UNIT_UNIT},
        'Plastic': {UNIT_BALE, UNIT_UNIT},
    }

    journal_type = models.CharField(max_length=20, choices=JOURNAL_TYPE_CHOICES)
    party = models.CharField(max_length=255)
    description = models.TextField()
    source_type = models.CharField(max_length=20, choices=SOURCE_TYPE_CHOICES, default=SOURCE_MANUAL)
    source_reference = models.CharField(max_length=120, blank=True)
    is_system_generated = models.BooleanField(default=False)
    idempotency_key = models.CharField(max_length=120, blank=True)
    idempotency_hash = models.CharField(max_length=64, blank=True)
    linked_inventory_movement = models.OneToOneField('inventory.InventoryMovement', on_delete=models.PROTECT, related_name='journal_transaction', null=True, blank=True)
    warehouse_operation = models.CharField(max_length=30, choices=WAREHOUSE_OPERATION_CHOICES, null=True, blank=True)
    warehouse = models.ForeignKey('inventory.Warehouse', on_delete=models.PROTECT, related_name='journal_transactions', null=True, blank=True)
    is_reversed = models.BooleanField(default=False)
    reversed_at = models.DateTimeField(null=True, blank=True)
    reversed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='reversed_journal_transactions', null=True, blank=True)
    reversal_reason = models.TextField(blank=True)
    reversal_transaction = models.ForeignKey('self', on_delete=models.PROTECT, related_name='reversed_originals', null=True, blank=True)

    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='created_journal_transactions')
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='updated_journal_transactions', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    deleted_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='deleted_journal_transactions', null=True, blank=True)

    cash_type = models.CharField(max_length=20, choices=CASH_TYPE_CHOICES, null=True, blank=True)
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES, null=True, blank=True)
    electronic_reference = models.CharField(max_length=120, blank=True)
    payment_receipt = models.FileField(upload_to='daily_journal/receipts/', null=True, blank=True)
    amount = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True)

    product_name = models.CharField(max_length=100, null=True, blank=True)
    quantity = models.DecimalField(max_digits=18, decimal_places=3, null=True, blank=True)
    unit = models.CharField(max_length=20, null=True, blank=True)
    estimated_value = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['journal_type']),
            models.Index(fields=['created_at']),
            models.Index(fields=['cash_type']),
            models.Index(fields=['payment_method']),
            models.Index(fields=['product_name']),
            models.Index(fields=['source_type', 'source_reference']),
            models.Index(fields=['warehouse_operation']),
            models.Index(fields=['warehouse']),
            models.Index(fields=['idempotency_key']),
            models.Index(fields=['is_reversed']),
            models.Index(fields=['is_deleted']),
            models.Index(fields=['journal_type', 'created_at']),
        ]
        constraints = [
            models.CheckConstraint(
                name='journal_amount_positive_or_null',
                condition=models.Q(amount__gt=0) | models.Q(amount__isnull=True),
            ),
            models.CheckConstraint(
                name='journal_quantity_positive_or_null',
                condition=models.Q(quantity__gt=0) | models.Q(quantity__isnull=True),
            ),
            models.CheckConstraint(
                name='journal_estimated_value_non_negative_or_null',
                condition=models.Q(estimated_value__gte=0) | models.Q(estimated_value__isnull=True),
            ),
            models.UniqueConstraint(
                fields=['source_type', 'source_reference'],
                condition=~models.Q(source_reference=''),
                name='unique_journal_source_reference',
            ),
            models.UniqueConstraint(
                fields=['created_by', 'idempotency_key'],
                condition=~models.Q(idempotency_key=''),
                name='unique_journal_user_idempotency_key',
            ),
        ]

    def clean(self):
        errors = {}
        if self.journal_type == self.JOURNAL_CASH:
            if self.payment_method not in dict(self.PAYMENT_METHOD_CHOICES):
                errors['payment_method'] = 'Payment method is required for cash transactions.'
            if self.payment_method == self.PAYMENT_CASH:
                if self.electronic_reference:
                    errors['electronic_reference'] = 'Electronic reference is not allowed for cash payments.'
                if self.payment_receipt:
                    errors['payment_receipt'] = 'Payment receipt is not allowed for cash payments.'
            elif self.payment_method == self.PAYMENT_ELECTRONIC:
                if not self.electronic_reference:
                    errors['electronic_reference'] = 'Electronic transaction reference is required.'
                if not self.payment_receipt:
                    errors['payment_receipt'] = 'Payment receipt image is required.'
            for field in ('product_name', 'quantity', 'unit', 'estimated_value'):
                if getattr(self, field) not in (None, ''):
                    errors[field] = 'Commodity fields are not allowed for cash transactions.'
        elif self.journal_type == self.JOURNAL_COMMODITY:
            for field in ('cash_type', 'payment_method', 'amount', 'electronic_reference', 'payment_receipt'):
                if getattr(self, field) not in (None, ''):
                    errors[field] = 'Cash fields are not allowed for commodity transactions.'

            allowed_units = self.UNIT_RULES.get(self.product_name)
            if self.product_name and allowed_units is None:
                errors['product_name'] = 'Unsupported commodity product.'
            elif self.unit and allowed_units and self.unit not in allowed_units:
                errors['unit'] = f'{self.unit} is not valid for {self.product_name}.'
        else:
            errors['journal_type'] = 'Invalid journal type.'

        if errors:
            raise ValidationError(errors)

    def __str__(self):
        if self.journal_type == self.JOURNAL_CASH:
            return f'{self.get_cash_type_display()} - {self.party} - {self.amount}'
        return f'{self.product_name} - {self.quantity} {self.unit} - {self.party}'

# Create your models here.
