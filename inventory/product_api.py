from decimal import Decimal, InvalidOperation

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import models, transaction
from django.db.models import Count, Sum
from django.utils import timezone
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from .models import Inventory, InventoryMovement, Product, ProductUnit, allowed_units_for_product
from .permissions import IsAdminForUnsafeWarehouseActions, IsAdminOrManager


def money(value):
    return f'{(value or Decimal("0.00")):.2f}'


def qty(value):
    return f'{(value or Decimal("0.000")):.3f}'


def parse_decimal(value, field, allow_null=False):
    if value in (None, ''):
        return None if allow_null else Decimal('0.00')
    try:
        parsed = Decimal(str(value))
    except (InvalidOperation, ValueError) as exc:
        raise serializers.ValidationError({field: 'Enter a valid decimal value.'}) from exc
    if not parsed.is_finite():
        raise serializers.ValidationError({field: 'Enter a finite decimal value.'})
    if parsed < 0:
        raise serializers.ValidationError({field: 'Value cannot be negative.'})
    return parsed


class ProductManagementUnitSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)

    class Meta:
        model = ProductUnit
        fields = ('id', 'unit', 'is_default', 'purchase_price', 'selling_price', 'minimum_selling_price', 'is_active')

    def validate(self, attrs):
        for field in ('purchase_price', 'selling_price', 'minimum_selling_price'):
            if field in attrs:
                attrs[field] = parse_decimal(attrs[field], field, allow_null=(field == 'minimum_selling_price'))
        return attrs


class ProductManagementSerializer(serializers.ModelSerializer):
    units = ProductManagementUnitSerializer(many=True)
    stock_summary = serializers.SerializerMethodField()
    warehouse_stock = serializers.SerializerMethodField()
    total_warehouses = serializers.SerializerMethodField()
    low_stock_warehouse_count = serializers.SerializerMethodField()
    stock_status = serializers.CharField(read_only=True)

    class Meta:
        model = Product
        fields = (
            'id', 'code', 'name_en', 'name_ar', 'category', 'description', 'notes',
            'is_active', 'is_deleted', 'created_by', 'updated_by', 'deleted_by',
            'created_at', 'updated_at', 'deleted_at', 'units', 'stock_summary',
            'warehouse_stock', 'total_warehouses', 'low_stock_warehouse_count', 'stock_status',
        )
        read_only_fields = (
            'id', 'code', 'is_deleted', 'created_by', 'updated_by', 'deleted_by',
            'created_at', 'updated_at', 'deleted_at', 'stock_summary', 'warehouse_stock',
            'total_warehouses', 'low_stock_warehouse_count', 'stock_status',
        )

    def get_stock_summary(self, obj):
        rows = obj.inventory_items.values('unit').annotate(quantity=Sum('quantity')).order_by('unit')
        return [{'unit': row['unit'], 'quantity': qty(row['quantity'])} for row in rows]

    def get_warehouse_stock(self, obj):
        return [
            {
                'warehouse_id': item.warehouse_id,
                'warehouse_code': item.warehouse.code,
                'warehouse_name': item.warehouse.warehouse_name,
                'unit': item.unit,
                'quantity': qty(item.quantity),
                'minimum_threshold': qty(item.minimum_threshold),
                'stock_status': item.status,
            }
            for item in obj.inventory_items.select_related('warehouse').filter(warehouse__is_deleted=False).order_by('warehouse__warehouse_name', 'unit')
        ]

    def get_total_warehouses(self, obj):
        return obj.inventory_items.filter(quantity__gt=0, warehouse__is_deleted=False).values('warehouse_id').distinct().count()

    def get_low_stock_warehouse_count(self, obj):
        return obj.inventory_items.filter(quantity__gt=0, quantity__lte=models.F('minimum_threshold'), warehouse__is_deleted=False).count()

    def validate(self, attrs):
        units = attrs.get('units')
        instance = self.instance
        for field in ('name_en', 'name_ar', 'description', 'notes'):
            if field in attrs and isinstance(attrs[field], str):
                attrs[field] = attrs[field].strip()
        if self.context['request'].method == 'POST' and not units:
            raise serializers.ValidationError({'units': 'At least one unit is required.'})
        if units is not None:
            unit_values = [row.get('unit') for row in units]
            if any(not unit for unit in unit_values):
                raise serializers.ValidationError({'units': 'Unit is required.'})
            if len(unit_values) != len(set(unit_values)):
                raise serializers.ValidationError({'units': 'This unit already exists.'})
            default_count = sum(1 for row in units if row.get('is_default'))
            active_default_count = sum(1 for row in units if row.get('is_default') and row.get('is_active', True))
            if default_count != 1 or active_default_count != 1:
                raise serializers.ValidationError({'units': 'Select one default unit.'})
            product_name = attrs.get('name_en', getattr(instance, 'name_en', ''))
            allowed = allowed_units_for_product(product_name)
            if allowed:
                bad = [unit for unit in unit_values if unit not in allowed]
                if bad:
                    raise serializers.ValidationError({'units': f'{bad[0]} is not valid for {product_name}.'})
        return attrs

    def create(self, validated_data):
        request = self.context['request']
        units = validated_data.pop('units', [])
        with transaction.atomic():
            product = Product(**validated_data, created_by=request.user)
            try:
                product.full_clean()
                product.save()
                self._sync_units(product, units)
            except DjangoValidationError as exc:
                raise serializers.ValidationError(exc.message_dict if hasattr(exc, 'message_dict') else exc.messages) from exc
        return product

    def update(self, instance, validated_data):
        request = self.context['request']
        units = validated_data.pop('units', None)
        with transaction.atomic():
            old_name = instance.name_en
            old_category = instance.category
            for key, value in validated_data.items():
                setattr(instance, key, value)
            if (old_name != instance.name_en or old_category != instance.category) and instance.inventory_items.exists():
                allowed = allowed_units_for_product(instance.name_en)
                existing_units = set(instance.units.values_list('unit', flat=True))
                if allowed and not existing_units.issubset(allowed):
                    raise serializers.ValidationError({'category': 'Category or product name cannot make existing units invalid.'})
            instance.updated_by = request.user
            try:
                instance.full_clean()
                instance.save()
                if units is not None:
                    self._sync_units(instance, units)
            except DjangoValidationError as exc:
                raise serializers.ValidationError(exc.message_dict if hasattr(exc, 'message_dict') else exc.messages) from exc
        return instance

    def _sync_units(self, product, units):
        keep_ids = []
        for row in units:
            row = dict(row)
            unit_id = row.pop('id', None)
            if unit_id:
                unit_obj = ProductUnit.objects.filter(product=product, id=unit_id).first()
                if not unit_obj:
                    raise serializers.ValidationError({'units': 'Product unit was not found.'})
            else:
                unit_obj = ProductUnit(product=product)
            if not row.get('is_active', True) and Inventory.objects.filter(product=product, unit=row.get('unit', unit_obj.unit), quantity__gt=0).exists():
                raise serializers.ValidationError({'units': 'A unit used by positive inventory cannot be deactivated.'})
            for key, value in row.items():
                setattr(unit_obj, key, value)
            unit_obj.full_clean()
            unit_obj.save()
            keep_ids.append(unit_obj.id)
        for stale in product.units.exclude(id__in=keep_ids):
            if Inventory.objects.filter(product=product, unit=stale.unit, quantity__gt=0).exists():
                raise serializers.ValidationError({'units': 'A unit used by positive inventory cannot be removed.'})
            stale.is_active = False
            stale.save(update_fields=['is_active', 'updated_at'])


class ProductPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 100


class ProductManagementViewSet(viewsets.ModelViewSet):
    serializer_class = ProductManagementSerializer
    permission_classes = [IsAdminForUnsafeWarehouseActions]
    pagination_class = ProductPagination
    allowed_ordering = {'name_en', '-name_en', 'name_ar', '-name_ar', 'created_at', '-created_at', 'code', '-code'}

    def get_queryset(self):
        return Product.objects.filter(is_deleted=False).prefetch_related('units', 'inventory_items__warehouse')

    def filter_queryset(self, queryset):
        params = self.request.query_params
        if params.get('search'):
            search = params['search']
            queryset = queryset.filter(models.Q(code__icontains=search) | models.Q(name_en__icontains=search) | models.Q(name_ar__icontains=search) | models.Q(description__icontains=search) | models.Q(notes__icontains=search))
        if params.get('category'):
            queryset = queryset.filter(category=params['category'])
        if params.get('unit'):
            queryset = queryset.filter(units__unit=params['unit'], units__is_active=True).distinct()
        active = params.get('is_active')
        if active in ('true', '1'):
            queryset = queryset.filter(is_active=True)
        elif active in ('false', '0'):
            queryset = queryset.filter(is_active=False)
        rows = list(queryset)
        if params.get('stock_status'):
            status_map = {'available': 'Available', 'low_stock': 'Low Stock', 'out_of_stock': 'Out of Stock', 'not_stocked': 'Not Stocked'}
            rows = [product for product in rows if product.stock_status == status_map.get(params['stock_status'], params['stock_status'])]
        ordering = params.get('ordering')
        if ordering:
            if ordering not in self.allowed_ordering:
                raise ValidationError({'ordering': 'Unsupported ordering value.'})
            reverse = ordering.startswith('-')
            field = ordering[1:] if reverse else ordering
            rows.sort(key=lambda product: getattr(product, field), reverse=reverse)
        return rows if (params.get('stock_status') or ordering) else queryset

    def get_permissions(self):
        if self.action in ('list', 'retrieve', 'stock', 'summary', 'options'):
            return [IsAdminOrManager()]
        return super().get_permissions()

    def destroy(self, request, *args, **kwargs):
        product = self.get_object()
        if Inventory.objects.filter(product=product, quantity__gt=0).exists():
            return Response({'detail': 'This product cannot be archived while stock or active business records remain.'}, status=status.HTTP_400_BAD_REQUEST)
        product.is_deleted = True
        product.is_active = False
        product.deleted_by = request.user
        product.deleted_at = timezone.now()
        product.save(update_fields=['is_deleted', 'is_active', 'deleted_by', 'deleted_at', 'updated_at'])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['get'])
    def stock(self, request, pk=None):
        product = self.get_object()
        data = self.get_serializer(product).data
        movements = InventoryMovement.objects.filter(product=product)
        data['movement_count'] = movements.count()
        latest = movements.order_by('-created_at').values_list('created_at', flat=True).first()
        data['latest_inventory_movement_at'] = timezone.localtime(latest).isoformat() if latest else None
        data['low_stock_records'] = [row for row in data['warehouse_stock'] if row['stock_status'] == 'Low Stock']
        return Response(data)

    @action(detail=False, methods=['get'])
    def options(self, request):
        products = Product.objects.filter(is_active=True, is_deleted=False).prefetch_related('units')
        data = ProductManagementSerializer(products, many=True, context={'request': request}).data
        return Response([
            {
                'id': row['id'],
                'code': row['code'],
                'name_en': row['name_en'],
                'name_ar': row['name_ar'],
                'category': row['category'],
                'units': [unit for unit in row['units'] if unit['is_active']],
            }
            for row in data
        ])

    @action(detail=False, methods=['get'])
    def summary(self, request):
        products = list(Product.objects.filter(is_deleted=False).prefetch_related('inventory_items'))
        return Response({
            'total_products': len(products),
            'active_products': sum(1 for product in products if product.is_active),
            'inactive_products': sum(1 for product in products if not product.is_active),
            'commodity_products': sum(1 for product in products if product.category == Product.CATEGORY_COMMODITY),
            'supply_products': sum(1 for product in products if product.category == Product.CATEGORY_SUPPLY),
            'low_stock_products': sum(1 for product in products if product.stock_status == 'Low Stock'),
            'out_of_stock_products': sum(1 for product in products if product.stock_status == 'Out of Stock'),
            'not_stocked_products': sum(1 for product in products if product.stock_status == 'Not Stocked'),
        })
