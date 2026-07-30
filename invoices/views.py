from datetime import datetime, time
from decimal import Decimal

from django.db import models
from django.db.models import Sum
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from accounts.models import UserProfile
from inventory.permissions import IsAdminOrManager, user_role

from .models import Invoice, InvoicePayment
from .serializers import CancelInvoiceSerializer, CreateInvoiceFromOrderSerializer, InvoiceSerializer, MarkPaidSerializer


class InvoicePagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 100


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


class InvoiceViewSet(viewsets.ModelViewSet):
    queryset = Invoice.objects.select_related('order', 'customer', 'issued_by', 'paid_by', 'cancelled_by').prefetch_related('items__product', 'items__product_unit')
    serializer_class = InvoiceSerializer
    permission_classes = [IsAdminOrManager]
    pagination_class = InvoicePagination
    parser_classes = [JSONParser, FormParser, MultiPartParser]
    allowed_ordering = {'issued_at', '-issued_at', 'invoice_number', '-invoice_number', 'total_amount', '-total_amount'}

    def filter_queryset(self, queryset):
        if self.action != 'list':
            return queryset
        params = self.request.query_params
        if params.get('search'):
            search = params['search']
            queryset = queryset.filter(
                models.Q(invoice_number__icontains=search)
                | models.Q(order__order_number__icontains=search)
                | models.Q(customer__code__icontains=search)
                | models.Q(customer__name__icontains=search)
                | models.Q(customer__phone__icontains=search)
                | models.Q(items__product_name_en_snapshot__icontains=search)
                | models.Q(items__product_name_ar_snapshot__icontains=search)
                | models.Q(payment__payment_reference__icontains=search)
                | models.Q(notes__icontains=search)
            ).distinct()
        for field in ('status', 'payment_status'):
            if params.get(field):
                queryset = queryset.filter(**{field: params[field]})
        if params.get('payment_method'):
            queryset = queryset.filter(payment__payment_method=params['payment_method'])
        if params.get('customer'):
            queryset = queryset.filter(customer_id=params['customer'])
        if params.get('order'):
            queryset = queryset.filter(order_id=params['order'])
        if params.get('product'):
            product = params['product']
            queryset = queryset.filter(items__product_id=product).distinct() if str(product).isdigit() else queryset.filter(items__product_name_en_snapshot=product).distinct()
        if params.get('date'):
            start, end = day_bounds(parse_local_date(params['date']))
            queryset = queryset.filter(issued_at__gte=start, issued_at__lte=end)
        if params.get('date_from'):
            start, _ = day_bounds(parse_local_date(params['date_from'], 'date_from'))
            queryset = queryset.filter(issued_at__gte=start)
        if params.get('date_to'):
            _, end = day_bounds(parse_local_date(params['date_to'], 'date_to'))
            queryset = queryset.filter(issued_at__lte=end)
        ordering = params.get('ordering', '-issued_at')
        if ordering:
            if ordering not in self.allowed_ordering:
                raise ValidationError({'ordering': 'Unsupported ordering value.'})
            queryset = queryset.order_by(ordering)
        return queryset

    def create(self, request, *args, **kwargs):
        return Response({'detail': 'Use /api/invoices/from-order/{order_id}/.'}, status=status.HTTP_405_METHOD_NOT_ALLOWED)

    def destroy(self, request, *args, **kwargs):
        return Response({'detail': 'Invoices cannot be permanently deleted. Use cancel instead.'}, status=status.HTTP_405_METHOD_NOT_ALLOWED)

    @action(detail=False, methods=['post'], url_path=r'from-order/(?P<order_id>[^/.]+)')
    def from_order(self, request, order_id=None):
        serializer = CreateInvoiceFromOrderSerializer(data=request.data, context={'request': request, 'order_id': order_id})
        serializer.is_valid(raise_exception=True)
        invoice = serializer.save()
        return Response(InvoiceSerializer(invoice, context={'request': request}).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='mark-paid')
    def mark_paid(self, request, pk=None):
        invoice = self.get_object()
        serializer = MarkPaidSerializer(data=request.data, context={'request': request, 'invoice': invoice})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        invoice.refresh_from_db()
        return Response(InvoiceSerializer(invoice, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        if user_role(request.user) != UserProfile.ROLE_ADMIN:
            return Response({'detail': 'Only admin users can cancel invoices.'}, status=status.HTTP_403_FORBIDDEN)
        invoice = self.get_object()
        serializer = CancelInvoiceSerializer(data=request.data, context={'request': request, 'invoice': invoice})
        serializer.is_valid(raise_exception=True)
        invoice = serializer.save()
        return Response(InvoiceSerializer(invoice, context={'request': request}).data)

    @action(detail=False, methods=['get'])
    def summary(self, request):
        active = Invoice.objects.exclude(status=Invoice.STATUS_CANCELLED)
        paid = active.filter(payment_status=Invoice.PAYMENT_PAID)
        unpaid = active.filter(payment_status=Invoice.PAYMENT_UNPAID)
        cash = InvoicePayment.objects.filter(payment_method=InvoicePayment.PAYMENT_CASH).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        online = InvoicePayment.objects.filter(payment_method=InvoicePayment.PAYMENT_ONLINE).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        return Response({
            'total_invoices': Invoice.objects.count(),
            'unpaid_invoices': unpaid.count(),
            'paid_invoices': paid.count(),
            'cancelled_invoices': Invoice.objects.filter(status=Invoice.STATUS_CANCELLED).count(),
            'total_issued_value': f'{(active.aggregate(total=Sum("total_amount"))["total"] or Decimal("0.00")):.2f}',
            'total_paid_value': f'{(paid.aggregate(total=Sum("total_amount"))["total"] or Decimal("0.00")):.2f}',
            'total_outstanding_value': f'{(unpaid.aggregate(total=Sum("total_amount"))["total"] or Decimal("0.00")):.2f}',
            'cash_payments': f'{cash:.2f}',
            'online_payments': f'{online:.2f}',
        })
