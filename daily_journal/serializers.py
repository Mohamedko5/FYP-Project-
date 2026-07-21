from decimal import Decimal, InvalidOperation

from django.utils import timezone
from rest_framework import serializers

from .models import JournalTransaction


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
            'amount',
            'product_name',
            'quantity',
            'unit',
            'estimated_value',
        )
        read_only_fields = (
            'id',
            'source_type',
            'is_system_generated',
            'created_by',
            'updated_by',
            'deleted_by',
            'created_at',
            'updated_at',
            'date',
            'time',
            'created_by_name',
        )

    def get_date(self, obj):
        return timezone.localtime(obj.created_at).date().isoformat()

    def get_time(self, obj):
        return timezone.localtime(obj.created_at).strftime('%H:%M')

    def get_created_by_name(self, obj):
        user = obj.created_by
        return user.get_full_name() or user.username or user.email

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

    def validate_source_reference(self, value):
        return value.strip()

    def to_internal_value(self, data):
        if 'commodity_direction' in data:
            raise serializers.ValidationError({'commodity_direction': ['This field is not supported.']})
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
            errors['payment_method'] = 'Choose cash or online.'

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

        for field in ('cash_type', 'payment_method', 'amount'):
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
        request = self.context['request']
        validated_data['updated_by'] = request.user
        return super().update(instance, validated_data)
