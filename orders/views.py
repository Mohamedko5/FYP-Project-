from datetime import datetime, time
from decimal import Decimal

from django.db import models
from django.db.models import Sum
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from accounts.models import UserProfile
from inventory.permissions import IsAdminOrManager, user_role

from .models import Order
from .serializers import CancelOrderSerializer, MarkReceivedSerializer, OrderListSerializer, OrderSerializer


class OrderPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 100


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


class OrderViewSet(viewsets.ModelViewSet):
    queryset = Order.objects.select_related('customer', 'created_by', 'updated_by', 'received_by', 'cancelled_by').prefetch_related('items__product', 'items__product_unit')
    permission_classes = [IsAdminOrManager]
    pagination_class = OrderPagination
    allowed_ordering = {'created_at', '-created_at', 'order_number', '-order_number', 'total_amount', '-total_amount'}

    def get_serializer_class(self):
        if self.action == 'list':
            return OrderListSerializer
        return OrderSerializer

    def filter_queryset(self, queryset):
        if self.action not in ('list',):
            return queryset
        params = self.request.query_params
        search = params.get('search')
        if search:
            queryset = queryset.filter(
                models.Q(order_number__icontains=search)
                | models.Q(customer__code__icontains=search)
                | models.Q(customer__name__icontains=search)
                | models.Q(customer__phone__icontains=search)
                | models.Q(customer_reference__icontains=search)
                | models.Q(customer_notes__icontains=search)
                | models.Q(internal_notes__icontains=search)
                | models.Q(items__product_name_en_snapshot__icontains=search)
                | models.Q(items__product_name_ar_snapshot__icontains=search)
            ).distinct()
        status_filter = params.get('status')
        if status_filter:
            values = [value for value in status_filter.split(',') if value]
            invalid = [value for value in values if value not in dict(Order.STATUS_CHOICES)]
            if invalid:
                raise ValidationError({'status': 'Unsupported order status.'})
            queryset = queryset.filter(status__in=values)
        if params.get('customer'):
            queryset = queryset.filter(customer_id=params['customer'])
        if params.get('product'):
            product_filter = params['product']
            if str(product_filter).isdigit():
                queryset = queryset.filter(models.Q(items__product_id=product_filter) | models.Q(items__product_name_en_snapshot=product_filter)).distinct()
            else:
                queryset = queryset.filter(items__product_name_en_snapshot=product_filter).distinct()
        if params.get('unit'):
            queryset = queryset.filter(items__unit_snapshot=params['unit']).distinct()
        if params.get('source_channel'):
            queryset = queryset.filter(source_channel=params['source_channel'])
        if params.get('date'):
            start, end = day_bounds(parse_local_date(params['date']))
            queryset = queryset.filter(created_at__gte=start, created_at__lte=end)
        if params.get('date_from'):
            start, _ = day_bounds(parse_local_date(params['date_from'], 'date_from'))
            queryset = queryset.filter(created_at__gte=start)
        if params.get('date_to'):
            _, end = day_bounds(parse_local_date(params['date_to'], 'date_to'))
            queryset = queryset.filter(created_at__lte=end)
        rows = list(queryset)
        stock_sufficient = parse_bool(params.get('stock_sufficient'), 'stock_sufficient')
        if stock_sufficient is not None:
            serializer = OrderListSerializer(context={'request': self.request})
            rows = [order for order in rows if serializer.get_overall_stock_sufficient(order) is stock_sufficient]
        ordering = params.get('ordering', '-created_at')
        if ordering:
            if ordering not in self.allowed_ordering:
                raise ValidationError({'ordering': 'Unsupported ordering value.'})
            reverse = ordering.startswith('-')
            field = ordering[1:] if reverse else ordering
            rows.sort(key=lambda order: getattr(order, field), reverse=reverse)
        return rows

    def perform_create(self, serializer):
        serializer.save()

    def perform_update(self, serializer):
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        return Response({'detail': 'Orders cannot be permanently deleted. Use cancel instead.'}, status=status.HTTP_405_METHOD_NOT_ALLOWED)

    @action(detail=True, methods=['post'], url_path='mark-received')
    def mark_received(self, request, pk=None):
        order = self.get_object()
        serializer = MarkReceivedSerializer(data=request.data, context={'request': request, 'order': order})
        serializer.is_valid(raise_exception=True)
        order = serializer.save()
        return Response(OrderSerializer(order, context={'request': request}).data)

    @action(detail=True, methods=['post'], url_path='cancel')
    def cancel(self, request, pk=None):
        if user_role(request.user) != UserProfile.ROLE_ADMIN:
            return Response({'detail': 'Only admin users can cancel orders.'}, status=status.HTTP_403_FORBIDDEN)
        order = self.get_object()
        serializer = CancelOrderSerializer(data=request.data, context={'request': request, 'order': order})
        serializer.is_valid(raise_exception=True)
        order = serializer.save()
        return Response(OrderSerializer(order, context={'request': request}).data)

    @action(detail=True, methods=['get'])
    def availability(self, request, pk=None):
        order = self.get_object()
        data = OrderSerializer(order, context={'request': request}).data
        return Response({
            'order_id': order.id,
            'order_number': order.order_number,
            'overall_stock_sufficient': data['overall_stock_sufficient'],
            'stock_availability_status': data['stock_availability_status'],
            'items': [
                {
                    'id': item['id'],
                    'product': item['product'],
                    'unit': item['unit_snapshot'],
                    **item['availability'],
                }
                for item in data['items']
            ],
        })

    @action(detail=False, methods=['get'])
    def summary(self, request):
        orders = list(Order.objects.prefetch_related('items__product'))
        serializer = OrderListSerializer(context={'request': request})
        total_value = Order.objects.exclude(status=Order.STATUS_CANCELLED).aggregate(total=Sum('total_amount'))['total'] or Decimal('0.00')
        return Response({
            'total_orders': len(orders),
            'pending_orders': sum(1 for order in orders if order.status == Order.STATUS_PENDING),
            'received_orders': sum(1 for order in orders if order.status == Order.STATUS_RECEIVED),
            'invoiced_orders': sum(1 for order in orders if order.status == Order.STATUS_INVOICED),
            'ready_for_shipment_orders': sum(1 for order in orders if order.status == Order.STATUS_READY_FOR_SHIPMENT),
            'processing_orders': sum(1 for order in orders if order.status == Order.STATUS_PROCESSING),
            'completed_orders': sum(1 for order in orders if order.status == Order.STATUS_COMPLETED),
            'cancelled_orders': sum(1 for order in orders if order.status == Order.STATUS_CANCELLED),
            'orders_with_stock_shortage': sum(1 for order in orders if not serializer.get_overall_stock_sufficient(order)),
            'total_received_order_value': f'{total_value:.2f}',
        })
