from decimal import Decimal, InvalidOperation

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import models
from django.utils import timezone
from rest_framework import serializers

from .models import Inventory, InventoryMovement, Product, ProductUnit, Warehouse
from .services import add_stock, withdraw_stock


def as_decimal_string(value, places='0.000'):
    return f'{(value or Decimal(places)):.{len(places.split(".")[1])}f}'


class ProductUnitSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductUnit
        fields = ('id', 'unit', 'is_default')


class ProductSerializer(serializers.ModelSerializer):
    units = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = ('id', 'code', 'name_en', 'name_ar', 'category', 'is_active', 'units')

    def get_units(self, obj):
        return ProductUnitSerializer(obj.units.filter(is_active=True), many=True).data


class InventorySerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)
    product_id = serializers.IntegerField(source='product.id', read_only=True)
    product_name = serializers.CharField(source='product.name_en', read_only=True)
    status = serializers.CharField(read_only=True)

    class Meta:
        model = Inventory
        fields = (
            'id',
            'warehouse',
            'product',
            'product_id',
            'product_name',
            'quantity',
            'unit',
            'minimum_threshold',
            'status',
            'created_at',
            'updated_at',
        )
        read_only_fields = fields


class WarehouseSerializer(serializers.ModelSerializer):
    primary_product = ProductSerializer(read_only=True)
    primary_product_id = serializers.PrimaryKeyRelatedField(
        queryset=Product.objects.filter(is_active=True, is_deleted=False),
        source='primary_product',
        write_only=True,
    )
    inventory_items = InventorySerializer(many=True, read_only=True)
    used_capacity = serializers.SerializerMethodField()
    available_capacity = serializers.SerializerMethodField()
    usage_percent = serializers.SerializerMethodField()
    status = serializers.CharField(read_only=True)
    low_stock_count = serializers.SerializerMethodField()

    class Meta:
        model = Warehouse
        fields = (
            'id',
            'code',
            'warehouse_name',
            'location',
            'primary_product',
            'primary_product_id',
            'capacity',
            'capacity_unit',
            'manager_name',
            'guard_name',
            'notes',
            'is_active',
            'is_deleted',
            'created_by',
            'updated_by',
            'deleted_by',
            'created_at',
            'updated_at',
            'deleted_at',
            'used_capacity',
            'available_capacity',
            'usage_percent',
            'status',
            'low_stock_count',
            'inventory_items',
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
            'used_capacity',
            'available_capacity',
            'usage_percent',
            'status',
            'low_stock_count',
            'inventory_items',
        )

    def get_used_capacity(self, obj):
        return as_decimal_string(obj.used_capacity)

    def get_available_capacity(self, obj):
        return as_decimal_string(obj.available_capacity)

    def get_usage_percent(self, obj):
        return f'{obj.usage_percent:.2f}'

    def get_low_stock_count(self, obj):
        return obj.inventory_items.filter(quantity__lte=models.F('minimum_threshold')).count()

    def validate(self, attrs):
        attrs = {**attrs}
        for field in ('warehouse_name', 'location', 'manager_name', 'guard_name', 'notes'):
            if field in attrs and isinstance(attrs[field], str):
                attrs[field] = attrs[field].strip()
        instance = self.instance
        primary_product = attrs.get('primary_product', getattr(instance, 'primary_product', None))
        capacity_unit = attrs.get('capacity_unit', getattr(instance, 'capacity_unit', None))
        capacity = attrs.get('capacity', getattr(instance, 'capacity', None))
        warehouse_name = attrs.get('warehouse_name', getattr(instance, 'warehouse_name', ''))
        location = attrs.get('location', getattr(instance, 'location', ''))

        errors = {}
        for field in ('warehouse_name', 'location', 'manager_name', 'guard_name'):
            value = attrs.get(field, getattr(instance, field, ''))
            if not str(value or '').strip():
                errors[field] = 'This field is required.'
        if capacity is not None and capacity <= 0:
            errors['capacity'] = 'Capacity must be greater than zero.'
        if primary_product and capacity_unit and not ProductUnit.objects.filter(product=primary_product, unit=capacity_unit, is_active=True).exists():
            errors['capacity_unit'] = f'{capacity_unit} is not valid for {primary_product.name_en}.'
        duplicate = Warehouse.objects.filter(
            warehouse_name__iexact=warehouse_name,
            location__iexact=location,
            is_deleted=False,
            is_active=True,
        )
        if instance:
            duplicate = duplicate.exclude(id=instance.id)
        if warehouse_name and location and duplicate.exists():
            errors['warehouse_name'] = 'An active warehouse with this name already exists in this location.'
        if errors:
            raise serializers.ValidationError(errors)
        return attrs

    def create(self, validated_data):
        request = self.context['request']
        warehouse = Warehouse(**validated_data, created_by=request.user)
        try:
            warehouse.full_clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict) from exc
        warehouse.save()
        return warehouse

    def update(self, instance, validated_data):
        request = self.context['request']
        for key, value in validated_data.items():
            setattr(instance, key, value)
        instance.updated_by = request.user
        try:
            instance.full_clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict) from exc
        instance.save()
        return instance


class InventoryMovementSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)
    product_name = serializers.CharField(source='product.name_en', read_only=True)
    warehouse_name = serializers.CharField(source='warehouse.warehouse_name', read_only=True)
    date = serializers.SerializerMethodField()
    time = serializers.SerializerMethodField()
    administrator_name = serializers.SerializerMethodField()

    class Meta:
        model = InventoryMovement
        fields = (
            'id',
            'warehouse',
            'warehouse_name',
            'product',
            'product_name',
            'movement_type',
            'quantity',
            'unit',
            'quantity_before',
            'quantity_after',
            'driver_name',
            'notes',
            'source_type',
            'source_reference',
            'created_by',
            'created_at',
            'date',
            'time',
            'administrator_name',
        )
        read_only_fields = fields

    def get_date(self, obj):
        return timezone.localtime(obj.created_at).date().isoformat()

    def get_time(self, obj):
        return timezone.localtime(obj.created_at).strftime('%H:%M')

    def get_administrator_name(self, obj):
        return obj.created_by.get_full_name() or obj.created_by.username or obj.created_by.email


class StockOperationSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    quantity = serializers.CharField()
    unit = serializers.CharField()
    minimum_threshold = serializers.CharField(required=False, allow_blank=True, default='0')
    driver_name = serializers.CharField(required=False, allow_blank=True, default='')
    notes = serializers.CharField(required=False, allow_blank=True, default='')


class WithdrawStockSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    quantity = serializers.CharField()
    unit = serializers.CharField()
    driver_name = serializers.CharField(required=False, allow_blank=True, default='')
    notes = serializers.CharField()
    source_type = serializers.CharField(required=False, allow_blank=True)
    movement_type = serializers.CharField(required=False, allow_blank=True)


class StockOperationResultSerializer(serializers.Serializer):
    inventory_item = InventorySerializer()
    warehouse = WarehouseSerializer()
    movement = InventoryMovementSerializer()
