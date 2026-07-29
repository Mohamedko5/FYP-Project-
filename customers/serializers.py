from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Sum
from django.utils import timezone
from rest_framework import serializers

from inventory.models import Product, Warehouse
from inventory.serializers import ProductSerializer

from .models import Customer, CustomerCashTransaction, CustomerCommodityTransaction, validate_photo_file
from .services import (
    create_cash_transaction,
    create_commodity_transaction,
    create_customer_with_opening,
    customer_cash_balance,
    customer_cash_status,
    customer_cash_totals,
    customer_commodity_balances,
    money,
    quantity,
    record_customer_payment,
    update_customer_basic,
)


BLOCKED_LEGACY_FIELDS = {'lahu', 'alayh', 'lahuWaAlayh', 'commodity_direction'}


def local_date(value):
    return timezone.localtime(value).date().isoformat()


def local_time(value):
    return timezone.localtime(value).strftime('%H:%M')


class CustomerSerializer(serializers.ModelSerializer):
    opening_balance_amount = serializers.DecimalField(max_digits=18, decimal_places=2, write_only=True, required=False, allow_null=True)
    opening_balance_type = serializers.ChoiceField(
        choices=('customer_owes_company', 'company_owes_customer'),
        write_only=True,
        required=False,
        allow_blank=True,
    )
    cash_balance = serializers.SerializerMethodField()
    absolute_cash_balance = serializers.SerializerMethodField()
    cash_status = serializers.SerializerMethodField()
    total_debits = serializers.SerializerMethodField()
    total_credits = serializers.SerializerMethodField()
    total_payments_received = serializers.SerializerMethodField()
    commodity_balances = serializers.SerializerMethodField()
    last_transaction_at = serializers.SerializerMethodField()
    cash_transaction_count = serializers.SerializerMethodField()
    commodity_transaction_count = serializers.SerializerMethodField()
    photo_url = serializers.SerializerMethodField()

    class Meta:
        model = Customer
        fields = (
            'id',
            'code',
            'name',
            'phone',
            'secondary_phone',
            'address',
            'customer_type',
            'photo',
            'photo_url',
            'notes',
            'is_active',
            'is_deleted',
            'created_by',
            'updated_by',
            'deleted_by',
            'created_at',
            'updated_at',
            'deleted_at',
            'opening_balance_amount',
            'opening_balance_type',
            'cash_balance',
            'absolute_cash_balance',
            'cash_status',
            'total_debits',
            'total_credits',
            'total_payments_received',
            'commodity_balances',
            'last_transaction_at',
            'cash_transaction_count',
            'commodity_transaction_count',
        )
        read_only_fields = (
            'id',
            'code',
            'is_deleted',
            'created_by',
            'updated_by',
            'deleted_by',
            'created_at',
            'updated_at',
            'deleted_at',
            'cash_balance',
            'absolute_cash_balance',
            'cash_status',
            'total_debits',
            'total_credits',
            'total_payments_received',
            'commodity_balances',
            'last_transaction_at',
            'cash_transaction_count',
            'commodity_transaction_count',
            'photo_url',
        )

    def to_internal_value(self, data):
        blocked = BLOCKED_LEGACY_FIELDS.intersection(data.keys())
        if blocked:
            raise serializers.ValidationError({field: ['This field is not supported.'] for field in blocked})
        return super().to_internal_value(data)

    def validate_photo(self, value):
        try:
            validate_photo_file(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict.get('photo', exc.messages))
        return value

    def get_photo_url(self, obj):
        if not obj.photo:
            return ''
        request = self.context.get('request')
        url = obj.photo.url
        return request.build_absolute_uri(url) if request else url

    def get_cash_balance(self, obj):
        return money(customer_cash_balance(obj))

    def get_absolute_cash_balance(self, obj):
        return money(abs(customer_cash_balance(obj)))

    def get_cash_status(self, obj):
        return customer_cash_status(obj)

    def get_total_debits(self, obj):
        debits, _, _ = customer_cash_totals(obj)
        return money(debits)

    def get_total_credits(self, obj):
        _, credits, _ = customer_cash_totals(obj)
        return money(credits)

    def get_total_payments_received(self, obj):
        _, _, payments = customer_cash_totals(obj)
        return money(payments)

    def get_commodity_balances(self, obj):
        return customer_commodity_balances(obj)

    def get_last_transaction_at(self, obj):
        value = obj.last_transaction_at
        return timezone.localtime(value).isoformat() if value else None

    def get_cash_transaction_count(self, obj):
        return obj.cash_transactions.filter(is_deleted=False).count()

    def get_commodity_transaction_count(self, obj):
        return obj.commodity_transactions.filter(is_deleted=False).count()

    def create(self, validated_data):
        request = self.context['request']
        opening_amount = validated_data.pop('opening_balance_amount', None)
        opening_type = validated_data.pop('opening_balance_type', '')
        try:
            return create_customer_with_opening(
                user=request.user,
                opening_balance_amount=opening_amount,
                opening_balance_type=opening_type,
                **validated_data,
            )
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict if hasattr(exc, 'message_dict') else exc.messages)

    def update(self, instance, validated_data):
        request = self.context['request']
        validated_data.pop('opening_balance_amount', None)
        validated_data.pop('opening_balance_type', None)
        try:
            return update_customer_basic(customer=instance, user=request.user, **validated_data)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict if hasattr(exc, 'message_dict') else exc.messages)


class CustomerUpdateSerializer(CustomerSerializer):
    class Meta(CustomerSerializer.Meta):
        fields = tuple(
            field for field in CustomerSerializer.Meta.fields
            if field not in {'opening_balance_amount', 'opening_balance_type'}
        )

    def validate(self, attrs):
        if self.instance and self.instance.is_deleted and attrs.get('is_active') is True:
            raise serializers.ValidationError({'is_active': 'Use Restore Customer to reactivate archived customers.'})
        return attrs


class CustomerCashTransactionSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    customer_code = serializers.CharField(source='customer.code', read_only=True)
    date = serializers.SerializerMethodField()
    time = serializers.SerializerMethodField()
    administrator_name = serializers.SerializerMethodField()
    balance_after = serializers.SerializerMethodField()
    invoice_number = serializers.CharField(source='invoice.invoice_number', read_only=True)
    linked_journal_reference = serializers.CharField(source='linked_journal_transaction.source_reference', read_only=True)

    class Meta:
        model = CustomerCashTransaction
        fields = (
            'id',
            'reference_number',
            'customer',
            'customer_name',
            'customer_code',
            'transaction_type',
            'payment_method',
            'payment_purpose',
            'invoice',
            'invoice_number',
            'amount',
            'description',
            'source_type',
            'source_reference',
            'is_system_generated',
            'linked_journal_transaction',
            'linked_journal_reference',
            'created_by',
            'created_at',
            'date',
            'time',
            'administrator_name',
            'balance_after',
            'is_reversed',
            'reversed_at',
            'reversed_by',
            'reversal_reason',
            'reversal_transaction',
            'is_deleted',
            'deleted_by',
            'deleted_at',
        )
        read_only_fields = (
            'id',
            'reference_number',
            'customer',
            'invoice',
            'invoice_number',
            'source_type',
            'source_reference',
            'is_system_generated',
            'linked_journal_transaction',
            'linked_journal_reference',
            'created_by',
            'created_at',
            'date',
            'time',
            'administrator_name',
            'balance_after',
            'is_reversed',
            'reversed_at',
            'reversed_by',
            'reversal_reason',
            'reversal_transaction',
            'is_deleted',
            'deleted_by',
            'deleted_at',
        )

    def to_internal_value(self, data):
        blocked = BLOCKED_LEGACY_FIELDS.intersection(data.keys())
        if blocked:
            raise serializers.ValidationError({field: ['This field is not supported.'] for field in blocked})
        return super().to_internal_value(data)

    def get_date(self, obj):
        return local_date(obj.created_at)

    def get_time(self, obj):
        return local_time(obj.created_at)

    def get_administrator_name(self, obj):
        user = obj.created_by
        return user.get_full_name() or user.username or user.email

    def get_balance_after(self, obj):
        transactions = CustomerCashTransaction.objects.filter(customer=obj.customer, is_deleted=False, created_at__lte=obj.created_at)
        debits = transactions.filter(transaction_type__in=CustomerCashTransaction.DEBIT_TYPES).aggregate(total=Sum('amount'))['total'] or 0
        credits = transactions.filter(transaction_type__in=CustomerCashTransaction.CREDIT_TYPES).aggregate(total=Sum('amount'))['total'] or 0
        return money(debits - credits)

    def create(self, validated_data):
        request = self.context['request']
        customer = self.context['customer']
        try:
            return create_cash_transaction(customer=customer, user=request.user, **validated_data)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict if hasattr(exc, 'message_dict') else exc.messages)

    def update(self, instance, validated_data):
        if instance.is_system_generated:
            raise serializers.ValidationError({'detail': 'System-generated transactions cannot be edited.'})
        allowed = {'description'}
        disallowed = set(validated_data) - allowed
        if disallowed:
            raise serializers.ValidationError({field: 'This field cannot be edited.' for field in disallowed})
        instance.description = validated_data.get('description', instance.description)
        instance.full_clean()
        instance.save(update_fields=['description'])
        return instance


class CustomerPaymentCreateSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=18, decimal_places=2)
    payment_method = serializers.ChoiceField(choices=CustomerCashTransaction.PAYMENT_METHOD_CHOICES)
    payment_purpose = serializers.ChoiceField(choices=CustomerCashTransaction.PAYMENT_PURPOSE_CHOICES)
    invoice_id = serializers.IntegerField(required=False, allow_null=True)
    description = serializers.CharField(required=False, allow_blank=True)
    idempotency_key = serializers.CharField(required=False, allow_blank=True, max_length=120)

    blocked_fields = {
        'created_by',
        'created_at',
        'source_type',
        'source_reference',
        'is_system_generated',
        'reference_number',
        'linked_journal_transaction',
    }

    def to_internal_value(self, data):
        blocked = self.blocked_fields.intersection(data.keys())
        if blocked:
            raise serializers.ValidationError({field: ['This field cannot be supplied by the client.'] for field in blocked})
        return super().to_internal_value(data)

    def validate(self, attrs):
        invoice_id = attrs.get('invoice_id')
        invoice = None
        if invoice_id:
            from invoices.models import Invoice

            try:
                invoice = Invoice.objects.get(pk=invoice_id)
            except Invoice.DoesNotExist as exc:
                raise serializers.ValidationError({'invoice_id': 'Invoice was not found.'}) from exc
        attrs['invoice'] = invoice
        return attrs

    def save(self, **kwargs):
        try:
            return record_customer_payment(
                customer=self.context['customer'],
                amount=self.validated_data['amount'],
                payment_method=self.validated_data['payment_method'],
                payment_purpose=self.validated_data['payment_purpose'],
                description=self.validated_data.get('description', ''),
                user=self.context['request'].user,
                invoice=self.validated_data.get('invoice'),
                idempotency_key=self.validated_data.get('idempotency_key', ''),
            )
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict if hasattr(exc, 'message_dict') else exc.messages) from exc


class CustomerPaymentResponseSerializer(serializers.Serializer):
    def to_representation(self, instance):
        payment, previous_balance, new_balance = instance
        journal = payment.linked_journal_transaction
        return {
            'payment': CustomerCashTransactionSerializer(payment, context=self.context).data,
            'journal_transaction': {
                'id': journal.id if journal else None,
                'cash_type': journal.cash_type if journal else '',
                'amount': money(journal.amount) if journal else '',
                'source_type': journal.source_type if journal else '',
                'source_reference': journal.source_reference if journal else '',
            },
            'customer_account': {
                'previous_balance': money(previous_balance),
                'new_balance': money(new_balance),
                'cash_status': customer_cash_status(payment.customer),
            },
        }


class CustomerPaymentReverseSerializer(serializers.Serializer):
    reason = serializers.CharField()


class CustomerCommodityTransactionSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    product_detail = ProductSerializer(source='product', read_only=True)
    warehouse_name = serializers.CharField(source='warehouse.warehouse_name', read_only=True)
    date = serializers.SerializerMethodField()
    time = serializers.SerializerMethodField()
    administrator_name = serializers.SerializerMethodField()
    product_id = serializers.PrimaryKeyRelatedField(source='product', queryset=Product.objects.filter(is_active=True, is_deleted=False), write_only=True)
    warehouse_id = serializers.PrimaryKeyRelatedField(source='warehouse', queryset=Warehouse.objects.all(), write_only=True, required=False, allow_null=True)

    class Meta:
        model = CustomerCommodityTransaction
        fields = (
            'id',
            'customer',
            'customer_name',
            'transaction_type',
            'product',
            'product_id',
            'product_detail',
            'quantity',
            'unit',
            'warehouse',
            'warehouse_id',
            'warehouse_name',
            'estimated_value',
            'description',
            'source_type',
            'source_reference',
            'is_system_generated',
            'created_by',
            'created_at',
            'date',
            'time',
            'administrator_name',
            'is_deleted',
            'deleted_by',
            'deleted_at',
        )
        read_only_fields = (
            'id',
            'customer',
            'product',
            'warehouse',
            'source_type',
            'source_reference',
            'is_system_generated',
            'created_by',
            'created_at',
            'date',
            'time',
            'administrator_name',
            'is_deleted',
            'deleted_by',
            'deleted_at',
        )

    def to_internal_value(self, data):
        blocked = BLOCKED_LEGACY_FIELDS.intersection(data.keys())
        if blocked:
            raise serializers.ValidationError({field: ['This field is not supported.'] for field in blocked})
        return super().to_internal_value(data)

    def get_date(self, obj):
        return local_date(obj.created_at)

    def get_time(self, obj):
        return local_time(obj.created_at)

    def get_administrator_name(self, obj):
        user = obj.created_by
        return user.get_full_name() or user.username or user.email

    def create(self, validated_data):
        request = self.context['request']
        customer = self.context['customer']
        product = validated_data.pop('product')
        warehouse = validated_data.pop('warehouse', None)
        try:
            return create_commodity_transaction(
                customer=customer,
                user=request.user,
                product_id=product.id,
                quantity_value=validated_data.pop('quantity'),
                warehouse=warehouse,
                **validated_data,
            )
        except (DjangoValidationError, Product.DoesNotExist) as exc:
            if isinstance(exc, DjangoValidationError):
                raise serializers.ValidationError(exc.message_dict if hasattr(exc, 'message_dict') else exc.messages)
            raise serializers.ValidationError({'product_id': 'Product was not found.'})
