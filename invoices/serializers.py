from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from rest_framework import serializers

from orders.models import Order

from .models import Invoice, InvoiceItem, InvoicePayment
from .services import cancel_invoice, create_invoice_from_order, mark_invoice_paid, user_name

ALLOWED_RECEIPT_CONTENT_TYPES = {'image/jpeg', 'image/png', 'image/webp'}
ALLOWED_RECEIPT_EXTENSIONS = ('.jpg', '.jpeg', '.png', '.webp')


class InvoiceItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceItem
        fields = (
            'id', 'order_item', 'product', 'product_unit', 'product_code_snapshot',
            'product_name_en_snapshot', 'product_name_ar_snapshot', 'unit_snapshot',
            'quantity', 'unit_price', 'line_total', 'notes', 'created_at',
        )
        read_only_fields = fields


class InvoicePaymentSerializer(serializers.ModelSerializer):
    received_by_name = serializers.SerializerMethodField()
    payment_receipt_url = serializers.SerializerMethodField()
    customer_transaction_id = serializers.IntegerField(source='linked_customer_transaction_id', read_only=True)
    journal_transaction_id = serializers.IntegerField(source='linked_journal_transaction_id', read_only=True)
    journal_reference = serializers.CharField(source='linked_journal_transaction.source_reference', read_only=True)

    class Meta:
        model = InvoicePayment
        fields = (
            'id', 'amount', 'payment_method', 'payment_reference', 'payment_receipt',
            'payment_receipt_url', 'received_by', 'received_by_name', 'received_at',
            'customer_transaction_id', 'journal_transaction_id', 'journal_reference',
        )
        read_only_fields = fields

    def get_received_by_name(self, obj):
        return user_name(obj.received_by)

    def get_payment_receipt_url(self, obj):
        if not obj.payment_receipt:
            return None
        try:
            request = self.context.get('request')
            url = obj.payment_receipt.url
            return request.build_absolute_uri(url) if request else url
        except ValueError:
            return None


class InvoiceSerializer(serializers.ModelSerializer):
    items = InvoiceItemSerializer(many=True, read_only=True)
    payment = InvoicePaymentSerializer(read_only=True)
    order_number = serializers.CharField(source='order.order_number', read_only=True)
    customer_code = serializers.CharField(source='customer.code', read_only=True)
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    customer_phone = serializers.CharField(source='customer.phone', read_only=True)
    product_summary = serializers.SerializerMethodField()
    item_count = serializers.SerializerMethodField()
    issued_date = serializers.SerializerMethodField()
    issued_time = serializers.SerializerMethodField()
    issued_by_name = serializers.SerializerMethodField()
    paid_by_name = serializers.SerializerMethodField()
    cancelled_by_name = serializers.SerializerMethodField()
    outstanding_amount = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = (
            'id', 'invoice_number', 'order', 'order_number', 'customer', 'customer_code',
            'customer_name', 'customer_phone', 'status', 'payment_status', 'subtotal',
            'discount_amount', 'total_amount', 'outstanding_amount', 'currency', 'notes',
            'issued_by', 'issued_by_name', 'issued_at', 'issued_date', 'issued_time',
            'paid_at', 'paid_by', 'paid_by_name', 'cancelled_at', 'cancelled_by',
            'cancelled_by_name', 'cancellation_reason', 'created_at', 'updated_at',
            'items', 'item_count', 'product_summary', 'payment',
        )
        read_only_fields = (
            'id', 'invoice_number', 'order', 'customer', 'status', 'payment_status',
            'subtotal', 'discount_amount', 'total_amount', 'outstanding_amount',
            'currency', 'issued_by', 'issued_by_name', 'issued_at', 'issued_date',
            'issued_time', 'paid_at', 'paid_by', 'paid_by_name', 'cancelled_at',
            'cancelled_by', 'cancelled_by_name', 'cancellation_reason', 'created_at',
            'updated_at', 'items', 'item_count', 'product_summary', 'payment',
        )

    def get_product_summary(self, obj):
        items = list(obj.items.all())
        if not items:
            return ''
        first = items[0].product_name_en_snapshot
        more = len(items) - 1
        return f'{first} + {more} more' if more else first

    def get_item_count(self, obj):
        return obj.items.count()

    def get_issued_date(self, obj):
        return timezone.localtime(obj.issued_at).date().isoformat()

    def get_issued_time(self, obj):
        return timezone.localtime(obj.issued_at).strftime('%H:%M')

    def get_issued_by_name(self, obj):
        return user_name(obj.issued_by)

    def get_paid_by_name(self, obj):
        return user_name(obj.paid_by)

    def get_cancelled_by_name(self, obj):
        return user_name(obj.cancelled_by)

    def get_outstanding_amount(self, obj):
        return '0.00' if obj.payment_status == Invoice.PAYMENT_PAID or obj.status == Invoice.STATUS_CANCELLED else f'{obj.total_amount:.2f}'

    def update(self, instance, validated_data):
        if instance.status != Invoice.STATUS_ISSUED or instance.payment_status != Invoice.PAYMENT_UNPAID:
            raise serializers.ValidationError({'invoice': 'Only unpaid issued invoice notes can be edited.'})
        instance.notes = validated_data.get('notes', instance.notes)
        instance.save(update_fields=['notes', 'updated_at'])
        return instance


class CreateInvoiceFromOrderSerializer(serializers.Serializer):
    notes = serializers.CharField(required=False, allow_blank=True)

    def save(self, **kwargs):
        try:
            order = Order.objects.get(id=self.context['order_id'])
            return create_invoice_from_order(order, self.context['request'].user, self.validated_data.get('notes', ''))
        except Order.DoesNotExist as exc:
            raise serializers.ValidationError({'order': 'Order was not found.'}) from exc
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict if hasattr(exc, 'message_dict') else exc.messages) from exc


class MarkPaidSerializer(serializers.Serializer):
    payment_method = serializers.ChoiceField(choices=InvoicePayment.PAYMENT_METHOD_CHOICES)
    payment_reference = serializers.CharField(required=False, allow_blank=True)
    amount = serializers.DecimalField(max_digits=18, decimal_places=2, required=False)
    payment_date = serializers.DateField(required=False)
    payment_receipt = serializers.FileField(required=False, allow_empty_file=False)
    idempotency_key = serializers.CharField(required=False, allow_blank=True, max_length=120)

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

    def save(self, **kwargs):
        try:
            request = self.context['request']
            return mark_invoice_paid(
                self.context['invoice'],
                request.user,
                self.validated_data['payment_method'],
                self.validated_data.get('payment_reference', ''),
                self.validated_data.get('amount'),
                self.validated_data.get('payment_date'),
                self.validated_data.get('payment_receipt'),
                idempotency_key=request.headers.get('Idempotency-Key') or self.validated_data.get('idempotency_key', ''),
            )
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict if hasattr(exc, 'message_dict') else exc.messages) from exc


class CancelInvoiceSerializer(serializers.Serializer):
    reason = serializers.CharField()

    def save(self, **kwargs):
        try:
            return cancel_invoice(self.context['invoice'], self.context['request'].user, self.validated_data['reason'])
        except PermissionError as exc:
            raise serializers.PermissionDenied(str(exc)) from exc
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict if hasattr(exc, 'message_dict') else exc.messages) from exc
