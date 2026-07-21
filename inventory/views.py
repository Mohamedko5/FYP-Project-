from datetime import datetime, time
from decimal import Decimal

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import models
from django.db.models import Count, Sum
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Inventory, InventoryMovement, Product, Warehouse
from .permissions import IsAdminForUnsafeWarehouseActions, IsAdminOrManager
from .serializers import (
    InventoryMovementSerializer,
    InventorySerializer,
    ProductSerializer,
    StockOperationSerializer,
    WarehouseSerializer,
    WithdrawStockSerializer,
)
from .services import add_stock, withdraw_stock


def parse_bool(value, field):
    if value in (None, ''):
        return None
    normalized = str(value).lower()
    if normalized in ('true', '1', 'yes'):
        return True
    if normalized in ('false', '0', 'no'):
        return False
    raise ValidationError({field: 'Use true or false.'})


def parse_local_date(value, field='date'):
    try:
        return datetime.strptime(value, '%Y-%m-%d').date()
    except ValueError as exc:
        raise ValidationError({field: 'Use YYYY-MM-DD format.'}) from exc


def day_bounds(day):
    tz = timezone.get_current_timezone()
    return (
        timezone.make_aware(datetime.combine(day, time.min), tz),
        timezone.make_aware(datetime.combine(day, time.max), tz),
    )


def money_quantity(value):
    return f'{(value or Decimal("0.000")):.3f}'


def movement_response(inventory, movement, request):
    inventory.warehouse.refresh_from_db()
    data = {
        'inventory_item': InventorySerializer(inventory, context={'request': request}).data,
        'warehouse': WarehouseSerializer(inventory.warehouse, context={'request': request}).data,
        'movement': InventoryMovementSerializer(movement, context={'request': request}).data,
    }
    return Response(data, status=status.HTTP_201_CREATED)


class ProductViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    queryset = Product.objects.prefetch_related('units').filter(is_deleted=False)
    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticated]

    def filter_queryset(self, queryset):
        params = self.request.query_params
        search = params.get('search')
        if search:
            queryset = queryset.filter(
                models.Q(name_en__icontains=search)
                | models.Q(name_ar__icontains=search)
                | models.Q(code__icontains=search)
            )
        category = params.get('category')
        if category:
            if category not in dict(Product.CATEGORY_CHOICES):
                raise ValidationError({'category': 'Choose commodity or supply.'})
            queryset = queryset.filter(category=category)
        active = parse_bool(params.get('active'), 'active')
        if active is not None:
            queryset = queryset.filter(is_active=active)
        return queryset


class WarehouseViewSet(viewsets.ModelViewSet):
    queryset = Warehouse.objects.select_related('primary_product').prefetch_related('primary_product__units', 'inventory_items__product__units')
    serializer_class = WarehouseSerializer
    permission_classes = [IsAdminForUnsafeWarehouseActions]
    allowed_ordering = {'warehouse_name', '-warehouse_name', 'created_at', '-created_at', 'capacity', '-capacity'}

    def get_queryset(self):
        return self.queryset.filter(is_deleted=False)

    def filter_queryset(self, queryset):
        params = self.request.query_params
        search = params.get('search')
        if search:
            queryset = queryset.filter(
                models.Q(warehouse_name__icontains=search)
                | models.Q(code__icontains=search)
                | models.Q(location__icontains=search)
                | models.Q(manager_name__icontains=search)
                | models.Q(guard_name__icontains=search)
            )
        product = params.get('product')
        if product:
            queryset = queryset.filter(models.Q(primary_product_id=product) | models.Q(primary_product__name_en=product))
        location = params.get('location')
        if location:
            queryset = queryset.filter(location__icontains=location)
        active = parse_bool(params.get('is_active'), 'is_active')
        if active is not None:
            queryset = queryset.filter(is_active=active)
        ordering = params.get('ordering')
        if ordering:
            if ordering not in self.allowed_ordering:
                raise ValidationError({'ordering': 'Unsupported ordering value.'})
            queryset = queryset.order_by(ordering)
        status_filter = params.get('status')
        if status_filter:
            queryset = [warehouse for warehouse in queryset if warehouse.status == status_filter]
        return queryset

    def destroy(self, request, *args, **kwargs):
        warehouse = self.get_object()
        if warehouse.inventory_items.filter(quantity__gt=0).exists():
            return Response({'detail': 'This warehouse cannot be archived while it contains stock.'}, status=status.HTTP_400_BAD_REQUEST)
        warehouse.is_deleted = True
        warehouse.is_active = False
        warehouse.deleted_by = request.user
        warehouse.deleted_at = timezone.now()
        warehouse.save(update_fields=['is_deleted', 'is_active', 'deleted_by', 'deleted_at', 'updated_at'])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], url_path='add-stock', permission_classes=[IsAdminOrManager])
    def add_stock(self, request, pk=None):
        serializer = StockOperationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            inventory, movement = add_stock(warehouse_id=pk, user=request.user, **serializer.validated_data)
        except (Product.DoesNotExist, Warehouse.DoesNotExist) as exc:
            raise ValidationError({'detail': 'Warehouse or product was not found.'}) from exc
        except DjangoValidationError as exc:
            raise ValidationError(exc.message_dict if hasattr(exc, 'message_dict') else exc.messages) from exc
        return movement_response(inventory, movement, request)

    @action(detail=True, methods=['post'], url_path='withdraw-stock', permission_classes=[IsAdminOrManager])
    def withdraw_stock(self, request, pk=None):
        serializer = WithdrawStockSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            inventory, movement = withdraw_stock(warehouse_id=pk, user=request.user, **serializer.validated_data)
        except (Product.DoesNotExist, Warehouse.DoesNotExist) as exc:
            raise ValidationError({'detail': 'Warehouse or product was not found.'}) from exc
        except DjangoValidationError as exc:
            raise ValidationError(exc.message_dict if hasattr(exc, 'message_dict') else exc.messages) from exc
        return movement_response(inventory, movement, request)

    @action(detail=True, methods=['get'], url_path='movements', permission_classes=[IsAdminOrManager])
    def movements(self, request, pk=None):
        queryset = InventoryMovement.objects.filter(warehouse_id=pk).select_related('warehouse', 'product', 'created_by')
        queryset = filter_movements(queryset, request.query_params)
        return Response(InventoryMovementSerializer(queryset, many=True, context={'request': request}).data)


def filter_movements(queryset, params):
    movement_type = params.get('movement_type')
    if movement_type:
        if movement_type not in dict(InventoryMovement.MOVEMENT_TYPE_CHOICES):
            raise ValidationError({'movement_type': 'Unsupported movement type.'})
        queryset = queryset.filter(movement_type=movement_type)
    product = params.get('product')
    if product:
        queryset = queryset.filter(models.Q(product_id=product) | models.Q(product__name_en=product))
    source_type = params.get('source_type')
    if source_type:
        if source_type not in dict(InventoryMovement.SOURCE_TYPE_CHOICES):
            raise ValidationError({'source_type': 'Unsupported source type.'})
        queryset = queryset.filter(source_type=source_type)
    if params.get('date'):
        start, end = day_bounds(parse_local_date(params['date']))
        queryset = queryset.filter(created_at__gte=start, created_at__lte=end)
    if params.get('date_from'):
        start, _ = day_bounds(parse_local_date(params['date_from'], 'date_from'))
        queryset = queryset.filter(created_at__gte=start)
    if params.get('date_to'):
        _, end = day_bounds(parse_local_date(params['date_to'], 'date_to'))
        queryset = queryset.filter(created_at__lte=end)
    ordering = params.get('ordering')
    if ordering:
        if ordering not in ('created_at', '-created_at'):
            raise ValidationError({'ordering': 'Choose created_at or -created_at.'})
        queryset = queryset.order_by(ordering)
    return queryset


class InventoryViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    queryset = Inventory.objects.select_related('warehouse', 'product').prefetch_related('product__units')
    serializer_class = InventorySerializer
    permission_classes = [IsAdminOrManager]

    def filter_queryset(self, queryset):
        params = self.request.query_params
        if params.get('warehouse'):
            queryset = queryset.filter(warehouse_id=params['warehouse'])
        if params.get('product'):
            queryset = queryset.filter(models.Q(product_id=params['product']) | models.Q(product__name_en=params['product']))
        if params.get('unit'):
            queryset = queryset.filter(unit=params['unit'])
        low_stock = parse_bool(params.get('low_stock'), 'low_stock')
        if low_stock is True:
            queryset = queryset.filter(quantity__lte=models.F('minimum_threshold'), quantity__gt=0)
        elif low_stock is False:
            queryset = queryset.exclude(quantity__lte=models.F('minimum_threshold'), quantity__gt=0)
        out_of_stock = parse_bool(params.get('out_of_stock'), 'out_of_stock')
        if out_of_stock is True:
            queryset = queryset.filter(quantity=0)
        elif out_of_stock is False:
            queryset = queryset.exclude(quantity=0)
        return queryset


class InventoryMovementViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    queryset = InventoryMovement.objects.select_related('warehouse', 'product', 'created_by')
    serializer_class = InventoryMovementSerializer
    permission_classes = [IsAdminOrManager]

    def filter_queryset(self, queryset):
        return filter_movements(queryset, self.request.query_params)

    def update(self, request, *args, **kwargs):
        return Response({'detail': 'Movement records cannot be edited.'}, status=status.HTTP_405_METHOD_NOT_ALLOWED)

    def destroy(self, request, *args, **kwargs):
        return Response({'detail': 'Movement records cannot be deleted.'}, status=status.HTTP_405_METHOD_NOT_ALLOWED)


class InventorySummaryViewSet(viewsets.ViewSet):
    permission_classes = [IsAdminOrManager]

    def list(self, request):
        warehouses = Warehouse.objects.filter(is_deleted=False)
        active = warehouses.filter(is_active=True)
        warehouse_list = list(active.prefetch_related('inventory_items'))
        groups = Inventory.objects.values('product_id', 'product__name_en', 'unit').annotate(quantity=Sum('quantity')).order_by('product__name_en', 'unit')
        return Response({
            'total_warehouses': warehouses.count(),
            'active_warehouses': active.count(),
            'almost_full_warehouses': sum(1 for warehouse in warehouse_list if warehouse.status == 'Almost Full'),
            'full_warehouses': sum(1 for warehouse in warehouse_list if warehouse.status == 'Full'),
            'low_stock_items': Inventory.objects.filter(quantity__lte=models.F('minimum_threshold'), quantity__gt=0).count(),
            'inventory_groups': [
                {
                    'product_id': row['product_id'],
                    'product_name': row['product__name_en'],
                    'unit': row['unit'],
                    'quantity': money_quantity(row['quantity']),
                }
                for row in groups
            ],
        })
