from decimal import Decimal, InvalidOperation

from django.utils import timezone
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from inventory.models import InventoryMovement, Product, Warehouse
from inventory.serializers import InventoryMovementSerializer, InventorySerializer

from .models import JournalTransaction
from .services import record_warehouse_commodity_transaction, warehouse_summary

ALLOWED_RECEIPT_CONTENT_TYPES = {'image/jpeg', 'image/png', 'image/webp'}
ALLOWED_RECEIPT_EXTENSIONS = ('.jpg', '.jpeg', '.png', '.webp')


def parse_decimal(value, field_name, allow_zero=False):
    if value in (None, ''):
        return None
    try:
        decimal_value = Decimal(str(value))
    except (InvalidOperation, ValueError) as exc:
        raise serializers.ValidationError({field_name: 'Enter a valid decimal value.'}) from exc
    if not decimal_value.is_finite():
        raise serializers.ValidationError({field_name: 'Enter a finite decimal value.'})
    if allow_zero:
        if decimal_value < 0:
            raise serializers.ValidationError({field_name: 'Value cannot be negative.'})
    elif decimal_value <= 0:
        raise serializers.ValidationError({field_name: 'Value must be greater than zero.'})
    return decimal_value


class JournalTransactionSerializer(serializers.ModelSerializer):
    date = serializers.SerializerMethodField()
    time = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    warehouse_name = serializers.CharField(source='warehouse.warehouse_name', read_only=True)
    movement_reference = serializers.CharField(source='linked_inventory_movement.source_reference', read_only=True)
    payment_receipt_url = serializers.SerializerMethodField()

    class Meta:
        model = JournalTransaction
        fields = (
            'id',
            'journal_type',
            'party',
            'description',
            'source_type',
            'source_reference',
            'is_system_generated',
            'created_by',
            'updated_by',
            'deleted_by',
            'created_at',
            'updated_at',
            'date',
            'time',
            'created_by_name',
            'cash_type',
            'payment_method',
            'electronic_reference',
            'payment_receipt',
            'payment_receipt_url',
            'amount',
            'product_name',
            'quantity',
            'unit',
            'estimated_value',
            'idempotency_key',
            'linked_inventory_movement',
            'warehouse_operation',
            'warehouse',
            'warehouse_name',
            'movement_reference',
            'is_reversed',
            'reversed_at',
            'reversed_by',
            'reversal_reason',
            'reversal_transaction',
        )
        read_only_fields = (
            'id',
            'source_type',
            'source_reference',
            'is_system_generated',
            'created_by',
            'updated_by',
            'deleted_by',
            'created_at',
            'updated_at',
            'date',
            'time',
            'created_by_name',
            'idempotency_key',
            'linked_inventory_movement',
            'warehouse_operation',
            'warehouse',
            'warehouse_name',
            'movement_reference',
            'is_reversed',
            'reversed_at',
            'reversed_by',
            'reversal_reason',
            'reversal_transaction',
        )

    def get_date(self, obj):
        return timezone.localtime(obj.created_at).date().isoformat()

    def get_time(self, obj):
        return timezone.localtime(obj.created_at).strftime('%H:%M')

    def get_created_by_name(self, obj):
        user = obj.created_by
        return user.get_full_name() or user.username or user.email

    def get_payment_receipt_url(self, obj):
        if not obj.payment_receipt:
            return None
        try:
            request = self.context.get('request')
            url = obj.payment_receipt.url
            return request.build_absolute_uri(url) if request else url
        except ValueError:
            return None

    def validate_party(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Party is required.')
        return value

    def validate_description(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Description is required.')
        return value

    def validate_payment_method(self, value):
        return JournalTransaction.PAYMENT_ELECTRONIC if value == 'online' else value

    def validate_source_reference(self, value):
        return value.strip()

    def validate_payment_receipt(self, value):
        if value in (None, ''):
            return value
        content_type = getattr(value, 'content_type', '')
        name = getattr(value, 'name', '').lower()
        if content_type and content_type not in ALLOWED_RECEIPT_CONTENT_TYPES:
            raise serializers.ValidationError('Upload a JPEG, PNG, or WebP receipt image.')
        if name and not name.endswith(ALLOWED_RECEIPT_EXTENSIONS):
            raise serializers.ValidationError('Upload a JPEG, PNG, or WebP receipt image.')
        return value

    def to_internal_value(self, data):
        if 'commodity_direction' in data:
            raise serializers.ValidationError({'commodity_direction': ['This field is not supported.']})
        if 'warehouse_id' in data or 'warehouse_operation' in data:
            raise serializers.ValidationError({
                'detail': ['Warehouse commodity transactions must use /api/journal/warehouse-commodity-transactions/.']
            })
        return super().to_internal_value(data)

    def validate(self, attrs):
        data = self._merged_transaction_data(attrs)
        journal_type = data.get('journal_type')

        if journal_type == JournalTransaction.JOURNAL_CASH:
            self._validate_cash(data, attrs)
        elif journal_type == JournalTransaction.JOURNAL_COMMODITY:
            self._validate_commodity(data, attrs)
        else:
            raise serializers.ValidationError({'journal_type': 'Choose cash or commodity.'})

        return attrs

    def _merged_transaction_data(self, attrs):
        data = {}
        fields = (
            'journal_type',
            'party',
            'description',
            'cash_type',
            'payment_method',
            'electronic_reference',
            'payment_receipt',
            'amount',
            'product_name',
            'quantity',
            'unit',
            'estimated_value',
        )
        for field in fields:
            if self.instance is not None:
                data[field] = getattr(self.instance, field)
            if field in attrs:
                data[field] = attrs[field]
        return data

    def _validate_cash(self, data, attrs):
        errors = {}
        if not data.get('cash_type'):
            errors['cash_type'] = 'Cash type is required.'
        elif data.get('cash_type') not in dict(JournalTransaction.CASH_TYPE_CHOICES):
            errors['cash_type'] = 'Choose income or expense.'

        if not data.get('payment_method'):
            errors['payment_method'] = 'Payment method is required.'
        elif data.get('payment_method') not in dict(JournalTransaction.PAYMENT_METHOD_CHOICES):
            errors['payment_method'] = 'Choose cash or electronic payment.'
        elif data.get('payment_method') == JournalTransaction.PAYMENT_CASH:
            attrs['electronic_reference'] = ''
            attrs['payment_receipt'] = None
        elif data.get('payment_method') == JournalTransaction.PAYMENT_ELECTRONIC:
            if not (data.get('electronic_reference') or '').strip():
                errors['electronic_reference'] = 'Electronic transaction reference is required.'
            elif 'electronic_reference' in attrs:
                attrs['electronic_reference'] = attrs['electronic_reference'].strip()
            if not data.get('payment_receipt'):
                errors['payment_receipt'] = 'Payment receipt image is required.'

        try:
            amount = parse_decimal(data.get('amount'), 'amount')
        except serializers.ValidationError as exc:
            errors.update(exc.detail)
        else:
            if amount is None:
                errors['amount'] = 'Amount is required.'
            elif 'amount' in attrs:
                attrs['amount'] = amount

        for field in ('product_name', 'quantity', 'unit', 'estimated_value'):
            if data.get(field) not in (None, ''):
                errors[field] = 'Commodity fields are not allowed for cash transactions.'

        if errors:
            raise serializers.ValidationError(errors)

    def _validate_commodity(self, data, attrs):
        errors = {}
        product_name = (data.get('product_name') or '').strip()
        unit = data.get('unit')

        if not product_name:
            errors['product_name'] = 'Product name is required.'
        elif product_name not in JournalTransaction.UNIT_RULES:
            errors['product_name'] = 'Unsupported commodity product.'
        elif unit and unit not in JournalTransaction.UNIT_RULES[product_name]:
            errors['unit'] = f'{unit} is not valid for {product_name}.'

        if product_name and 'product_name' in attrs:
            attrs['product_name'] = product_name

        try:
            quantity = parse_decimal(data.get('quantity'), 'quantity')
        except serializers.ValidationError as exc:
            errors.update(exc.detail)
        else:
            if quantity is None:
                errors['quantity'] = 'Quantity is required.'
            elif 'quantity' in attrs:
                attrs['quantity'] = quantity

        if not unit:
            errors['unit'] = 'Unit is required.'

        try:
            estimated_value = parse_decimal(data.get('estimated_value'), 'estimated_value', allow_zero=True)
        except serializers.ValidationError as exc:
            errors.update(exc.detail)
        else:
            if estimated_value is None:
                errors['estimated_value'] = 'Estimated value is required.'
            elif 'estimated_value' in attrs:
                attrs['estimated_value'] = estimated_value

        for field in ('cash_type', 'payment_method', 'amount', 'electronic_reference', 'payment_receipt'):
            if data.get(field) not in (None, ''):
                errors[field] = 'Cash fields are not allowed for commodity transactions.'

        if errors:
            raise serializers.ValidationError(errors)

    def create(self, validated_data):
        request = self.context['request']
        validated_data['created_by'] = request.user
        validated_data['source_type'] = JournalTransaction.SOURCE_MANUAL
        validated_data['is_system_generated'] = False
        return super().create(validated_data)

    def update(self, instance, validated_data):
        if instance.is_system_generated:
            raise serializers.ValidationError({'detail': 'System-generated journal transactions cannot be edited here.'})
        request = self.context['request']
        validated_data['updated_by'] = request.user
        return super().update(instance, validated_data)


class WarehouseCommodityTransactionSerializer(serializers.Serializer):
    warehouse_operation = serializers.ChoiceField(choices=JournalTransaction.WAREHOUSE_OPERATION_CHOICES)
    warehouse_id = serializers.IntegerField()
    product_id = serializers.IntegerField()
    unit = serializers.CharField(max_length=20)
    quantity = serializers.CharField()
    minimum_threshold = serializers.CharField(required=False, allow_blank=True, default='0')
    party = serializers.CharField(max_length=255)
    estimated_value = serializers.CharField()
    driver_name = serializers.CharField(required=False, allow_blank=True, default='')
    description = serializers.CharField()
    idempotency_key = serializers.CharField(required=False, allow_blank=True, max_length=120)

    blocked_backend_fields = {
        'movement_type',
        'source_type',
        'source_reference',
        'created_by',
        'created_at',
        'quantity_before',
        'quantity_after',
        'linked_inventory_movement',
        'journal_type',
    }

    def to_internal_value(self, data):
        blocked = sorted(self.blocked_backend_fields.intersection(set(data.keys())))
        if blocked:
            raise serializers.ValidationError({
                field: ['This field is generated by the backend.']
                for field in blocked
            })
        return super().to_internal_value(data)

    def validate(self, attrs):
        try:
            attrs['warehouse'] = Warehouse.objects.get(pk=attrs['warehouse_id'])
        except Warehouse.DoesNotExist as exc:
            raise serializers.ValidationError({'warehouse_id': 'Warehouse was not found.'}) from exc
        try:
            attrs['product'] = Product.objects.get(pk=attrs['product_id'])
        except Product.DoesNotExist as exc:
            raise serializers.ValidationError({'product_id': 'Product was not found.'}) from exc
        return attrs

    def create(self, validated_data):
        request = self.context['request']
        idempotency_key = (
            request.headers.get('Idempotency-Key')
            or validated_data.get('idempotency_key')
            or ''
        )
        try:
            return record_warehouse_commodity_transaction(
                warehouse=validated_data['warehouse'],
                product=validated_data['product'],
                unit=validated_data['unit'],
                quantity=validated_data['quantity'],
                warehouse_operation=validated_data['warehouse_operation'],
                party=validated_data['party'],
                estimated_value=validated_data['estimated_value'],
                description=validated_data['description'],
                user=request.user,
                minimum_threshold=validated_data.get('minimum_threshold') or '0',
                driver_name=validated_data.get('driver_name') or '',
                idempotency_key=idempotency_key,
            )
        except DjangoValidationError as exc:
            detail = exc.message_dict if hasattr(exc, 'message_dict') else exc.messages
            raise serializers.ValidationError(detail) from exc


class WarehouseCommodityTransactionResponseSerializer(serializers.Serializer):
    journal_transaction = serializers.SerializerMethodField()
    inventory_movement = serializers.SerializerMethodField()
    inventory = serializers.SerializerMethodField()
    warehouse_summary = serializers.SerializerMethodField()

    def get_journal_transaction(self, obj):
        return JournalTransactionSerializer(obj['journal_transaction'], context=self.context).data

    def get_inventory_movement(self, obj):
        movement = obj.get('inventory_movement')
        return InventoryMovementSerializer(movement, context=self.context).data if movement else None

    def get_inventory(self, obj):
        inventory = obj.get('inventory')
        return InventorySerializer(inventory, context=self.context).data if inventory else None

    def get_warehouse_summary(self, obj):
        inventory = obj.get('inventory')
        journal = obj.get('journal_transaction')
        warehouse = inventory.warehouse if inventory else journal.warehouse
        return warehouse_summary(warehouse) if warehouse else None


class WarehouseCommodityReversalSerializer(serializers.Serializer):
    reason = serializers.CharField()

    def validate_reason(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Reversal reason is required.')
        return value
