from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from rest_framework import serializers

from .models import Shipment, ShipmentItem
from .services import cancel_shipment, complete_shipment, start_shipment_processing, user_name


class ShipmentItemSerializer(serializers.ModelSerializer):
    warehouse_name = serializers.CharField(source='warehouse.warehouse_name', read_only=True)

    class Meta:
        model = ShipmentItem
        fields = (
            'id', 'invoice_item', 'order_item', 'product', 'product_unit',
            'product_code_snapshot', 'product_name_en_snapshot', 'product_name_ar_snapshot',
            'unit_snapshot', 'requested_quantity', 'actual_quantity', 'warehouse',
            'warehouse_name', 'number_of_bags', 'total_weight_kg', 'average_bag_weight_kg',
            'notes', 'created_at', 'updated_at',
        )
        read_only_fields = fields


class ShipmentSerializer(serializers.ModelSerializer):
    items = ShipmentItemSerializer(many=True, read_only=True)
    order_number = serializers.CharField(source='order.order_number', read_only=True)
    invoice_number = serializers.CharField(source='invoice.invoice_number', read_only=True)
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    customer_code = serializers.CharField(source='customer.code', read_only=True)
    started_by_name = serializers.SerializerMethodField()
    completed_by_name = serializers.SerializerMethodField()
    cancelled_by_name = serializers.SerializerMethodField()
    created_date = serializers.SerializerMethodField()
    created_time = serializers.SerializerMethodField()
    product_summary = serializers.SerializerMethodField()

    class Meta:
        model = Shipment
        fields = (
            'id', 'shipment_number', 'order', 'order_number', 'invoice', 'invoice_number',
            'customer', 'customer_name', 'customer_code', 'status', 'driver_name',
            'vehicle_number', 'notes', 'started_by', 'started_by_name', 'started_at',
            'completed_by', 'completed_by_name', 'completed_at', 'cancelled_by',
            'cancelled_by_name', 'cancelled_at', 'cancellation_reason', 'created_by',
            'created_at', 'created_date', 'created_time', 'updated_at', 'items',
            'product_summary',
        )
        read_only_fields = fields

    def get_started_by_name(self, obj):
        return user_name(obj.started_by)

    def get_completed_by_name(self, obj):
        return user_name(obj.completed_by)

    def get_cancelled_by_name(self, obj):
        return user_name(obj.cancelled_by)

    def get_created_date(self, obj):
        return timezone.localtime(obj.created_at).date().isoformat()

    def get_created_time(self, obj):
        return timezone.localtime(obj.created_at).strftime('%H:%M')

    def get_product_summary(self, obj):
        items = list(obj.items.all())
        if not items:
            return ''
        first = items[0].product_name_en_snapshot
        more = len(items) - 1
        return f'{first} + {more} more' if more else first


class StartProcessingSerializer(serializers.Serializer):
    driver_name = serializers.CharField()
    vehicle_number = serializers.CharField(required=False, allow_blank=True)
    notes = serializers.CharField(required=False, allow_blank=True)
    items = serializers.ListField(child=serializers.DictField())

    def save(self, **kwargs):
        try:
            return start_shipment_processing(
                self.context['shipment'],
                self.context['request'].user,
                self.validated_data['driver_name'],
                self.validated_data.get('vehicle_number', ''),
                self.validated_data.get('notes', ''),
                self.validated_data['items'],
            )
        except (DjangoValidationError, ValueError) as exc:
            if isinstance(exc, DjangoValidationError):
                raise serializers.ValidationError(exc.message_dict if hasattr(exc, 'message_dict') else exc.messages) from exc
            raise serializers.ValidationError({'items': 'Enter valid shipment item values.'}) from exc


class CancelShipmentSerializer(serializers.Serializer):
    reason = serializers.CharField()

    def save(self, **kwargs):
        try:
            return cancel_shipment(self.context['shipment'], self.context['request'].user, self.validated_data['reason'])
        except PermissionError as exc:
            raise serializers.PermissionDenied(str(exc)) from exc
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict if hasattr(exc, 'message_dict') else exc.messages) from exc


class CompleteShipmentSerializer(serializers.Serializer):
    def save(self, **kwargs):
        try:
            return complete_shipment(self.context['shipment'], self.context['request'].user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict if hasattr(exc, 'message_dict') else exc.messages) from exc
