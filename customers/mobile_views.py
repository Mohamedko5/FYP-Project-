import hashlib
import json
from datetime import datetime, time
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import models, transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from inventory.models import Product
from invoices.models import Invoice
from orders.models import Order
from shipments.models import Shipment

from .mobile_serializers import (
    MobileCustomerSerializer,
    MobileInvoiceDetailSerializer,
    MobileInvoiceListSerializer,
    MobileLoginSerializer,
    MobileOrderCreateSerializer,
    MobileOrderDetailSerializer,
    MobileOrderListSerializer,
    MobileProductSerializer,
    MobileShipmentDetailSerializer,
    MobileShipmentListSerializer,
)
from .models import MobileIdempotencyKey
from .permissions import IsMobileCustomer, is_mobile_customer_user


User = get_user_model()


class MobilePagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 50


def customer_for_request(request):
    return request.user.customer_account.customer


def parse_local_date(value, field):
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


def paginate_response(view, queryset, serializer_class, request):
    paginator = MobilePagination()
    page = paginator.paginate_queryset(queryset, request, view=view)
    serializer = serializer_class(page, many=True, context={'request': request})
    return paginator.get_paginated_response(serializer.data)


def mobile_token_response(user, customer):
    refresh = RefreshToken.for_user(user)
    return {
        'access': str(refresh.access_token),
        'refresh': str(refresh),
        'customer': MobileCustomerSerializer(customer).data,
    }


class MobileLoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = MobileLoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({'detail': 'Invalid email or password.'}, status=status.HTTP_401_UNAUTHORIZED)
        return Response(mobile_token_response(serializer.validated_data['user'], serializer.validated_data['customer']))


class MobileRefreshView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        refresh_value = request.data.get('refresh')
        if not refresh_value:
            return Response({'detail': 'Refresh token is required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            refresh = RefreshToken(refresh_value)
            user_id = refresh.payload.get('user_id')
            user = User.objects.select_related('customer_account__customer', 'profile').get(pk=user_id)
        except (TokenError, User.DoesNotExist):
            return Response({'detail': 'Your session has expired.'}, status=status.HTTP_401_UNAUTHORIZED)

        if not is_mobile_customer_user(user):
            return Response({'detail': 'Your customer account is inactive.'}, status=status.HTTP_401_UNAUTHORIZED)

        return Response({
            'access': str(refresh.access_token),
            'customer': MobileCustomerSerializer(user.customer_account.customer).data,
        })


class MobileLogoutView(APIView):
    permission_classes = [IsMobileCustomer]

    def post(self, request):
        refresh_value = request.data.get('refresh')
        if refresh_value:
            try:
                refresh = RefreshToken(refresh_value)
                blacklist = getattr(refresh, 'blacklist', None)
                if callable(blacklist):
                    blacklist()
            except TokenError:
                pass
        return Response({'detail': 'Logged out successfully.'})


class MobileMeView(APIView):
    permission_classes = [IsMobileCustomer]

    def get(self, request):
        return Response(MobileCustomerSerializer(request.user.customer_account.customer).data)


class MobileProductListView(APIView):
    permission_classes = [IsMobileCustomer]
    allowed_ordering = {'name_en', '-name_en', 'selling_price', '-selling_price'}

    def get_queryset(self, request):
        queryset = Product.objects.filter(is_active=True, is_deleted=False, units__is_active=True).prefetch_related('units', 'inventory_items').distinct()
        params = request.query_params
        search = params.get('search')
        if search:
            queryset = queryset.filter(
                models.Q(code__icontains=search)
                | models.Q(name_en__icontains=search)
                | models.Q(name_ar__icontains=search)
                | models.Q(description__icontains=search)
            )
        if params.get('category'):
            queryset = queryset.filter(category=params['category'])
        if params.get('unit'):
            queryset = queryset.filter(units__unit=params['unit'], units__is_active=True)
        available = params.get('available')
        if available in ('true', '1', 'yes'):
            queryset = queryset.filter(inventory_items__warehouse__is_active=True, inventory_items__warehouse__is_deleted=False, inventory_items__quantity__gt=0)
        elif available in ('false', '0', 'no'):
            available_ids = Product.objects.filter(inventory_items__warehouse__is_active=True, inventory_items__warehouse__is_deleted=False, inventory_items__quantity__gt=0).values('id')
            queryset = queryset.exclude(id__in=available_ids)
        elif available not in (None, ''):
            raise ValidationError({'available': 'Use true or false.'})
        ordering = params.get('ordering') or 'name_en'
        if ordering not in self.allowed_ordering:
            raise ValidationError({'ordering': 'Unsupported ordering value.'})
        if ordering in ('selling_price', '-selling_price'):
            queryset = queryset.annotate(customer_price=models.Min('units__selling_price')).order_by('-customer_price' if ordering.startswith('-') else 'customer_price', 'name_en')
        else:
            queryset = queryset.order_by(ordering)
        return queryset.distinct()

    def get(self, request):
        return paginate_response(self, self.get_queryset(request), MobileProductSerializer, request)


class MobileProductDetailView(APIView):
    permission_classes = [IsMobileCustomer]

    def get(self, request, pk):
        try:
            product = Product.objects.prefetch_related('units', 'inventory_items').get(pk=pk, is_active=True, is_deleted=False, units__is_active=True)
        except Product.DoesNotExist:
            return Response({'detail': 'Product was not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(MobileProductSerializer(product, context={'request': request}).data)


class MobileOrderListCreateView(APIView):
    permission_classes = [IsMobileCustomer]
    allowed_ordering = {'created_at', '-created_at'}

    def queryset(self, request):
        customer = customer_for_request(request)
        queryset = Order.objects.filter(customer=customer).select_related('customer').prefetch_related('items', 'invoices', 'shipments')
        status_filter = request.query_params.get('status')
        if status_filter:
            values = [value for value in status_filter.split(',') if value]
            invalid = [value for value in values if value not in dict(Order.STATUS_CHOICES)]
            if invalid:
                raise ValidationError({'status': 'Unsupported order status.'})
            queryset = queryset.filter(status__in=values)
        if request.query_params.get('date_from'):
            start, _ = day_bounds(parse_local_date(request.query_params['date_from'], 'date_from'))
            queryset = queryset.filter(created_at__gte=start)
        if request.query_params.get('date_to'):
            _, end = day_bounds(parse_local_date(request.query_params['date_to'], 'date_to'))
            queryset = queryset.filter(created_at__lte=end)
        ordering = request.query_params.get('ordering') or '-created_at'
        if ordering not in self.allowed_ordering:
            raise ValidationError({'ordering': 'Unsupported ordering value.'})
        return queryset.order_by(ordering)

    def get(self, request):
        return paginate_response(self, self.queryset(request), MobileOrderListSerializer, request)

    def post(self, request):
        customer = customer_for_request(request)
        raw_key = (request.headers.get('Idempotency-Key') or '').strip()
        request_hash = hashlib.sha256(json.dumps(request.data, sort_keys=True, default=str).encode('utf-8')).hexdigest()
        if raw_key:
            existing = MobileIdempotencyKey.objects.filter(customer=customer, operation='create_order', key=raw_key).first()
            if existing:
                if existing.request_hash != request_hash:
                    return Response({'detail': 'Idempotency key was already used with a different request.'}, status=status.HTTP_409_CONFLICT)
                return Response(existing.response_data, status=status.HTTP_200_OK)
        serializer = MobileOrderCreateSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            order = serializer.save()
            data = MobileOrderDetailSerializer(order, context={'request': request}).data
            if raw_key:
                MobileIdempotencyKey.objects.create(customer=customer, operation='create_order', key=raw_key, request_hash=request_hash, response_data=data)
        return Response(data, status=status.HTTP_201_CREATED)


class MobileOrderDetailView(APIView):
    permission_classes = [IsMobileCustomer]

    def get(self, request, pk):
        try:
            order = Order.objects.select_related('customer').prefetch_related('items', 'invoices', 'shipments').get(pk=pk, customer=customer_for_request(request))
        except Order.DoesNotExist:
            return Response({'detail': 'Order was not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(MobileOrderDetailSerializer(order, context={'request': request}).data)


class MobileInvoiceListView(APIView):
    permission_classes = [IsMobileCustomer]

    def queryset(self, request):
        queryset = Invoice.objects.filter(customer=customer_for_request(request)).select_related('order').prefetch_related('items', 'shipments')
        payment_status = request.query_params.get('payment_status') or request.query_params.get('status')
        if payment_status in (Invoice.PAYMENT_UNPAID, Invoice.PAYMENT_PAID):
            queryset = queryset.filter(payment_status=payment_status)
        return queryset.order_by('-issued_at')

    def get(self, request):
        return paginate_response(self, self.queryset(request), MobileInvoiceListSerializer, request)


class MobileInvoiceDetailView(APIView):
    permission_classes = [IsMobileCustomer]

    def get(self, request, pk):
        try:
            invoice = Invoice.objects.select_related('order').prefetch_related('items', 'shipments').get(pk=pk, customer=customer_for_request(request))
        except Invoice.DoesNotExist:
            return Response({'detail': 'Invoice was not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(MobileInvoiceDetailSerializer(invoice, context={'request': request}).data)


class MobileShipmentListView(APIView):
    permission_classes = [IsMobileCustomer]

    def queryset(self, request):
        queryset = Shipment.objects.filter(customer=customer_for_request(request)).select_related('order', 'invoice').prefetch_related('items')
        status_filter = request.query_params.get('status')
        if status_filter:
            values = [value for value in status_filter.split(',') if value]
            invalid = [value for value in values if value not in dict(Shipment.STATUS_CHOICES)]
            if invalid:
                raise ValidationError({'status': 'Unsupported shipment status.'})
            queryset = queryset.filter(status__in=values)
        return queryset.order_by('-created_at')

    def get(self, request):
        return paginate_response(self, self.queryset(request), MobileShipmentListSerializer, request)


class MobileShipmentDetailView(APIView):
    permission_classes = [IsMobileCustomer]

    def get(self, request, pk):
        try:
            shipment = Shipment.objects.select_related('order', 'invoice').prefetch_related('items').get(pk=pk, customer=customer_for_request(request))
        except Shipment.DoesNotExist:
            return Response({'detail': 'Shipment was not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(MobileShipmentDetailSerializer(shipment, context={'request': request}).data)


class MobileHomeSummaryView(APIView):
    permission_classes = [IsMobileCustomer]

    def get(self, request):
        customer = customer_for_request(request)
        orders = Order.objects.filter(customer=customer)
        invoices = Invoice.objects.filter(customer=customer)
        shipments = Shipment.objects.filter(customer=customer)
        outstanding = invoices.filter(payment_status=Invoice.PAYMENT_UNPAID, status=Invoice.STATUS_ISSUED).aggregate(total=Sum('total_amount'))['total'] or Decimal('0.00')
        recent_orders = orders.prefetch_related('items', 'invoices', 'shipments').order_by('-created_at')[:3]
        return Response({
            'customer': {'code': customer.code, 'name': customer.name},
            'orders': {
                'total': orders.count(),
                'pending': orders.filter(status=Order.STATUS_PENDING).count(),
                'received': orders.filter(status=Order.STATUS_RECEIVED).count(),
                'invoiced': orders.filter(status=Order.STATUS_INVOICED).count(),
                'ready_for_shipment': orders.filter(status=Order.STATUS_READY_FOR_SHIPMENT).count(),
                'processing': orders.filter(status=Order.STATUS_PROCESSING).count(),
                'completed': orders.filter(status=Order.STATUS_COMPLETED).count(),
                'cancelled': orders.filter(status=Order.STATUS_CANCELLED).count(),
            },
            'invoices': {
                'total': invoices.count(),
                'unpaid': invoices.filter(payment_status=Invoice.PAYMENT_UNPAID, status=Invoice.STATUS_ISSUED).count(),
                'paid': invoices.filter(payment_status=Invoice.PAYMENT_PAID).count(),
                'outstanding_value': f'{outstanding:.2f}',
            },
            'shipments': {
                'ready': shipments.filter(status=Shipment.STATUS_READY).count(),
                'processing': shipments.filter(status=Shipment.STATUS_PROCESSING).count(),
                'completed': shipments.filter(status=Shipment.STATUS_COMPLETED).count(),
                'cancelled': shipments.filter(status=Shipment.STATUS_CANCELLED).count(),
            },
            'recent_orders': MobileOrderListSerializer(recent_orders, many=True, context={'request': request}).data,
        })
