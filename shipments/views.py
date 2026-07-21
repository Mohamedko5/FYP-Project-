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

from .models import Shipment
from .serializers import CancelShipmentSerializer, CompleteShipmentSerializer, ShipmentSerializer, StartProcessingSerializer


class ShipmentPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 100


def parse_date(value, field='date'):
    try:
        return datetime.strptime(value, '%Y-%m-%d').date()
    except ValueError as exc:
        raise ValidationError({field: 'Use YYYY-MM-DD format.'}) from exc


def day_bounds(day):
    tz = timezone.get_current_timezone()
    return timezone.make_aware(datetime.combine(day, time.min), tz), timezone.make_aware(datetime.combine(day, time.max), tz)


class ShipmentViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Shipment.objects.select_related('order', 'invoice', 'customer', 'started_by', 'completed_by', 'cancelled_by').prefetch_related('items__warehouse')
    serializer_class = ShipmentSerializer
    permission_classes = [IsAdminOrManager]
    pagination_class = ShipmentPagination

    def filter_queryset(self, queryset):
        if self.action != 'list':
            return queryset
        params = self.request.query_params
        if params.get('search'):
            search = params['search']
            queryset = queryset.filter(
                models.Q(shipment_number__icontains=search)
                | models.Q(order__order_number__icontains=search)
                | models.Q(invoice__invoice_number__icontains=search)
                | models.Q(customer__name__icontains=search)
                | models.Q(driver_name__icontains=search)
                | models.Q(vehicle_number__icontains=search)
                | models.Q(items__product_name_en_snapshot__icontains=search)
            ).distinct()
        if params.get('status'):
            queryset = queryset.filter(status=params['status'])
        if params.get('customer'):
            queryset = queryset.filter(customer_id=params['customer'])
        if params.get('product'):
            product = params['product']
            queryset = queryset.filter(items__product_id=product).distinct() if str(product).isdigit() else queryset.filter(items__product_name_en_snapshot=product).distinct()
        if params.get('warehouse'):
            queryset = queryset.filter(items__warehouse_id=params['warehouse']).distinct()
        if params.get('date'):
            start, end = day_bounds(parse_date(params['date']))
            queryset = queryset.filter(created_at__gte=start, created_at__lte=end)
        return queryset

    @action(detail=True, methods=['post'], url_path='start-processing')
    def start_processing(self, request, pk=None):
        shipment = self.get_object()
        serializer = StartProcessingSerializer(data=request.data, context={'request': request, 'shipment': shipment})
        serializer.is_valid(raise_exception=True)
        shipment = serializer.save()
        return Response(ShipmentSerializer(shipment, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        shipment = self.get_object()
        serializer = CompleteShipmentSerializer(data=request.data, context={'request': request, 'shipment': shipment})
        serializer.is_valid(raise_exception=True)
        shipment = serializer.save()
        return Response(ShipmentSerializer(shipment, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        if user_role(request.user) != UserProfile.ROLE_ADMIN:
            return Response({'detail': 'Only admin users can cancel shipments.'}, status=status.HTTP_403_FORBIDDEN)
        shipment = self.get_object()
        serializer = CancelShipmentSerializer(data=request.data, context={'request': request, 'shipment': shipment})
        serializer.is_valid(raise_exception=True)
        shipment = serializer.save()
        return Response(ShipmentSerializer(shipment, context={'request': request}).data)

    @action(detail=False, methods=['get'])
    def summary(self, request):
        completed_items = Shipment.objects.filter(status=Shipment.STATUS_COMPLETED).values('items__product_id', 'items__product_name_en_snapshot', 'items__unit_snapshot').annotate(quantity=Sum('items__actual_quantity'))
        return Response({
            'ready_count': Shipment.objects.filter(status=Shipment.STATUS_READY).count(),
            'processing_count': Shipment.objects.filter(status=Shipment.STATUS_PROCESSING).count(),
            'completed_count': Shipment.objects.filter(status=Shipment.STATUS_COMPLETED).count(),
            'cancelled_count': Shipment.objects.filter(status=Shipment.STATUS_CANCELLED).count(),
            'completed_item_groups': [
                {
                    'product_id': row['items__product_id'],
                    'product_name': row['items__product_name_en_snapshot'],
                    'unit': row['items__unit_snapshot'],
                    'quantity': f'{(row["quantity"] or Decimal("0.000")):.3f}',
                }
                for row in completed_items
            ],
        })
