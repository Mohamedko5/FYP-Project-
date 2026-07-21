from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from rest_framework import serializers

from customers.models import Customer
from customers.serializers import CustomerSerializer
from inventory.models import Product, ProductUnit

from .models import Order, OrderItem
from .services import (
    cancel_order,
    create_order,
    mark_order_received,
    money,
    quantity,
    stock_availability,
    update_order,
)


class OrderCustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = ('id', 'code', 'name', 'phone', 'customer_type')


class OrderItemSerializer(serializers.ModelSerializer):
    product_id = serializers.PrimaryKeyRelatedField(source='product', queryset=Product.objects.filter(is_active=True, is_deleted=False), write_only=True)
    product_unit_id = serializers.PrimaryKeyRelatedField(source='product_unit', queryset=ProductUnit.objects.filter(is_active=True), write_only=True)
    quantity = serializers.CharField()
    unit_price = serializers.CharField(required=False, allow_blank=True)
    product = serializers.SerializerMethodField()
    availability = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = (
            'id',
            'product',
            'product_id',
            'product_unit',
            'product_unit_id',
            'product_code_snapshot',
            'product_name_en_snapshot',
            'product_name_ar_snapshot',
            'unit_snapshot',
            'quantity',
            'unit_price',
            'line_total',
            'price_override_reason',
            'notes',
            'availability',
            'created_at',
            'updated_at',
        )
        read_only_fields = (
            'id',
            'product',
            'product_unit',
            'product_code_snapshot',
            'product_name_en_snapshot',
            'product_name_ar_snapshot',
            'unit_snapshot',
            'line_total',
            'availability',
            'created_at',
            'updated_at',
        )

    def get_product(self, obj):
        return {
            'id': obj.product_id,
            'code': obj.product_code_snapshot,
            'name_en': obj.product_name_en_snapshot,
            'name_ar': obj.product_name_ar_snapshot,
        }

    def get_availability(self, obj):
        return stock_availability(obj.product, obj.unit_snapshot, obj.quantity)


class OrderSerializer(serializers.ModelSerializer):
    customer = OrderCustomerSerializer(read_only=True)
    customer_id = serializers.PrimaryKeyRelatedField(source='customer', queryset=Customer.objects.filter(is_active=True, is_deleted=False), write_only=True)
    items = OrderItemSerializer(many=True)
    item_count = serializers.SerializerMethodField()
    product_summary = serializers.SerializerMethodField()
    stock_availability_status = serializers.SerializerMethodField()
    overall_stock_sufficient = serializers.SerializerMethodField()
    created_date = serializers.SerializerMethodField()
    created_time = serializers.SerializerMethodField()
    administrator_name = serializers.SerializerMethodField()
    received_by_name = serializers.SerializerMethodField()
    cancelled_by_name = serializers.SerializerMethodField()
    can_edit = serializers.BooleanField(read_only=True)
    can_cancel = serializers.BooleanField(read_only=True)
    can_create_invoice = serializers.BooleanField(read_only=True)
    invoice = serializers.SerializerMethodField()
    shipment = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = (
            'id',
            'order_number',
            'customer',
            'customer_id',
            'status',
            'source_channel',
            'customer_reference',
            'customer_notes',
            'internal_notes',
            'subtotal',
            'discount_amount',
            'total_amount',
            'currency',
            'items',
            'item_count',
            'product_summary',
            'stock_availability_status',
            'overall_stock_sufficient',
            'received_by',
            'received_by_name',
            'received_at',
            'cancelled_by',
            'cancelled_by_name',
            'cancelled_at',
            'cancellation_reason',
            'created_by',
            'updated_by',
            'created_at',
            'updated_at',
            'created_date',
            'created_time',
            'administrator_name',
            'can_edit',
            'can_cancel',
            'can_create_invoice',
            'invoice',
            'shipment',
        )
        read_only_fields = (
            'id',
            'order_number',
            'status',
            'source_channel',
            'subtotal',
            'total_amount',
            'currency',
            'received_by',
            'received_by_name',
            'received_at',
            'cancelled_by',
            'cancelled_by_name',
            'cancelled_at',
            'cancellation_reason',
            'created_by',
            'updated_by',
            'created_at',
            'updated_at',
            'created_date',
            'created_time',
            'administrator_name',
            'item_count',
            'product_summary',
            'stock_availability_status',
            'overall_stock_sufficient',
            'can_edit',
            'can_cancel',
            'can_create_invoice',
            'invoice',
            'shipment',
        )

    def get_item_count(self, obj):
        return obj.items.count()

    def get_product_summary(self, obj):
        items = list(obj.items.all())
        if not items:
            return ''
        first = items[0].product_name_en_snapshot
        remaining = len(items) - 1
        return f'{first} + {remaining} more' if remaining else first

    def get_stock_availability_status(self, obj):
        return 'Stock Sufficient' if self.get_overall_stock_sufficient(obj) else 'Stock Shortage'

    def get_overall_stock_sufficient(self, obj):
        return all(stock_availability(item.product, item.unit_snapshot, item.quantity)['is_stock_sufficient'] for item in obj.items.all())

    def get_created_date(self, obj):
        return timezone.localtime(obj.created_at).date().isoformat()

    def get_created_time(self, obj):
        return timezone.localtime(obj.created_at).strftime('%H:%M')

    def user_name(self, user):
        if not user:
            return ''
        return user.get_full_name() or user.username or user.email

    def get_administrator_name(self, obj):
        return self.user_name(obj.created_by)

    def get_received_by_name(self, obj):
        return self.user_name(obj.received_by)

    def get_cancelled_by_name(self, obj):
        return self.user_name(obj.cancelled_by)

    def get_invoice(self, obj):
        return None

    def get_shipment(self, obj):
        return None

    def validate(self, attrs):
        for blocked in ('order_number', 'status', 'subtotal', 'total_amount', 'created_by', 'received_by', 'received_at', 'source_channel'):
            if blocked in self.initial_data:
                attrs.pop(blocked, None)
        return attrs

    def create(self, validated_data):
        request = self.context['request']
        items = validated_data.pop('items', [])
        customer = validated_data.pop('customer')
        try:
            return create_order(user=request.user, customer_id=customer.id, items=items, **validated_data)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict if hasattr(exc, 'message_dict') else exc.messages) from exc

    def update(self, instance, validated_data):
        request = self.context['request']
        items = validated_data.pop('items', None)
        customer = validated_data.pop('customer', None)
        try:
            return update_order(
                order=instance,
                user=request.user,
                customer_id=customer.id if customer else None,
                items=items,
                **validated_data,
            )
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict if hasattr(exc, 'message_dict') else exc.messages) from exc


class OrderListSerializer(OrderSerializer):
    class Meta(OrderSerializer.Meta):
        fields = (
            'id',
            'order_number',
            'customer',
            'item_count',
            'product_summary',
            'subtotal',
            'discount_amount',
            'total_amount',
            'currency',
            'status',
            'source_channel',
            'stock_availability_status',
            'overall_stock_sufficient',
            'created_date',
            'created_time',
            'administrator_name',
            'can_edit',
            'can_cancel',
            'can_create_invoice',
            'invoice',
        )


class CancelOrderSerializer(serializers.Serializer):
    reason = serializers.CharField()

    def save(self, **kwargs):
        try:
            return cancel_order(self.context['order'], self.validated_data['reason'], self.context['request'].user)
        except PermissionError as exc:
            raise serializers.PermissionDenied(str(exc)) from exc
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict if hasattr(exc, 'message_dict') else exc.messages) from exc


class MarkReceivedSerializer(serializers.Serializer):
    def save(self, **kwargs):
        try:
            return mark_order_received(self.context['order'], self.context['request'].user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict if hasattr(exc, 'message_dict') else exc.messages) from exc
