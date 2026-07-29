from datetime import datetime, time
from decimal import Decimal

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import models, transaction
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from .models import Customer, CustomerCashTransaction, CustomerCommodityTransaction
from .permissions import IsAdminForDeleteOnly
from .serializers import (
    CustomerCashTransactionSerializer,
    CustomerCommodityTransactionSerializer,
    CustomerPaymentCreateSerializer,
    CustomerPaymentResponseSerializer,
    CustomerPaymentReverseSerializer,
    CustomerSerializer,
    CustomerUpdateSerializer,
)
from .services import (
    customer_cash_balance,
    customer_cash_status,
    customer_cash_totals,
    customer_commodity_balances,
    money,
    reverse_customer_payment,
    soft_delete_cash_transaction,
    soft_delete_commodity_transaction,
)
from .permissions import user_role


class CustomerPagination(PageNumberPagination):
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


def filter_cash_transactions(queryset, params):
    transaction_type = params.get('transaction_type')
    if transaction_type:
        if transaction_type not in dict(CustomerCashTransaction.TRANSACTION_TYPE_CHOICES):
            raise ValidationError({'transaction_type': 'Unsupported transaction type.'})
        queryset = queryset.filter(transaction_type=transaction_type)
    payment_method = params.get('payment_method')
    if payment_method:
        if payment_method not in dict(CustomerCashTransaction.PAYMENT_METHOD_CHOICES):
            raise ValidationError({'payment_method': 'Choose cash or online.'})
        queryset = queryset.filter(payment_method=payment_method)
    payment_purpose = params.get('payment_purpose')
    if payment_purpose:
        if payment_purpose not in dict(CustomerCashTransaction.PAYMENT_PURPOSE_CHOICES):
            raise ValidationError({'payment_purpose': 'Unsupported payment purpose.'})
        queryset = queryset.filter(payment_purpose=payment_purpose)
    reversed_filter = parse_bool(params.get('is_reversed'), 'is_reversed')
    if reversed_filter is not None:
        queryset = queryset.filter(is_reversed=reversed_filter)
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
        if ordering not in ('created_at', '-created_at', 'amount', '-amount'):
            raise ValidationError({'ordering': 'Unsupported ordering value.'})
        queryset = queryset.order_by(ordering)
    return queryset


def filter_commodity_transactions(queryset, params):
    transaction_type = params.get('transaction_type')
    if transaction_type:
        if transaction_type not in dict(CustomerCommodityTransaction.TRANSACTION_TYPE_CHOICES):
            raise ValidationError({'transaction_type': 'Unsupported transaction type.'})
        queryset = queryset.filter(transaction_type=transaction_type)
    if params.get('product'):
        queryset = queryset.filter(models.Q(product_id=params['product']) | models.Q(product__name_en=params['product']))
    if params.get('unit'):
        queryset = queryset.filter(unit=params['unit'])
    if params.get('warehouse'):
        queryset = queryset.filter(warehouse_id=params['warehouse'])
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
        if ordering not in ('created_at', '-created_at', 'quantity', '-quantity'):
            raise ValidationError({'ordering': 'Unsupported ordering value.'})
        queryset = queryset.order_by(ordering)
    return queryset


class CustomerViewSet(viewsets.ModelViewSet):
    serializer_class = CustomerSerializer
    permission_classes = [IsAdminForDeleteOnly]
    pagination_class = CustomerPagination
    allowed_ordering = {'name', '-name', 'created_at', '-created_at', 'cash_balance', '-cash_balance'}

    def get_serializer_class(self):
        if self.action in {'update', 'partial_update'}:
            return CustomerUpdateSerializer
        return CustomerSerializer

    def get_queryset(self):
        queryset = Customer.objects.all() if self.action == 'restore' else Customer.objects.filter(is_deleted=False)
        return queryset.prefetch_related('cash_transactions', 'commodity_transactions__product')

    def filter_queryset(self, queryset):
        params = self.request.query_params
        search = params.get('search')
        if search:
            queryset = queryset.filter(
                models.Q(code__icontains=search)
                | models.Q(name__icontains=search)
                | models.Q(phone__icontains=search)
                | models.Q(secondary_phone__icontains=search)
                | models.Q(address__icontains=search)
            )
        customer_type = params.get('customer_type')
        if customer_type:
            if customer_type not in dict(Customer.CUSTOMER_TYPE_CHOICES):
                raise ValidationError({'customer_type': 'Choose a valid customer type.'})
            queryset = queryset.filter(customer_type=customer_type)
        active = parse_bool(params.get('is_active'), 'is_active')
        if active is not None:
            queryset = queryset.filter(is_active=active)
        cash_status = params.get('cash_status')
        rows = list(queryset)
        if cash_status:
            status_map = {'debtor': 'Debtor', 'creditor': 'Creditor', 'balanced': 'Balanced'}
            if cash_status not in status_map:
                raise ValidationError({'cash_status': 'Choose debtor, creditor, or balanced.'})
            rows = [customer for customer in rows if customer_cash_status(customer) == status_map[cash_status]]
        ordering = params.get('ordering')
        if ordering:
            if ordering not in self.allowed_ordering:
                raise ValidationError({'ordering': 'Unsupported ordering value.'})
            reverse = ordering.startswith('-')
            field = ordering[1:] if reverse else ordering
            if field == 'cash_balance':
                rows.sort(key=customer_cash_balance, reverse=reverse)
            else:
                rows.sort(key=lambda customer: getattr(customer, field), reverse=reverse)
        return rows if (cash_status or ordering) else queryset

    def destroy(self, request, *args, **kwargs):
        customer = self.get_object()
        commodity_positive = any(Decimal(row['quantity']) > 0 for row in customer_commodity_balances(customer))
        if customer_cash_balance(customer) != 0 or commodity_positive:
            return Response({'detail': 'This customer cannot be archived while an account balance remains.'}, status=status.HTTP_400_BAD_REQUEST)
        customer.is_deleted = True
        customer.is_active = False
        customer.deleted_by = request.user
        customer.deleted_at = timezone.now()
        customer.save(update_fields=['is_deleted', 'is_active', 'deleted_by', 'deleted_at', 'updated_at'])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], url_path='restore')
    def restore(self, request, pk=None):
        if user_role(request.user) != 'admin':
            return Response({'detail': 'Only admin users can restore customers.'}, status=status.HTTP_403_FORBIDDEN)
        customer = self.get_object()
        customer.is_deleted = False
        customer.is_active = True
        customer.deleted_by = None
        customer.deleted_at = None
        customer.updated_by = request.user
        customer.full_clean()
        customer.save(update_fields=['is_deleted', 'is_active', 'deleted_by', 'deleted_at', 'updated_by', 'updated_at'])
        return Response(CustomerSerializer(customer, context={'request': request}).data)

    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
        customers = list(Customer.objects.filter(is_deleted=False).prefetch_related('cash_transactions'))
        balances = [customer_cash_balance(customer) for customer in customers]
        return Response({
            'total_customers': len(customers),
            'active_customers': sum(1 for customer in customers if customer.is_active),
            'debtors': sum(1 for balance in balances if balance > 0),
            'creditors': sum(1 for balance in balances if balance < 0),
            'balanced': sum(1 for balance in balances if balance == 0),
            'total_customer_debt': money(sum((balance for balance in balances if balance > 0), Decimal('0.00'))),
            'total_customer_credit': money(abs(sum((balance for balance in balances if balance < 0), Decimal('0.00')))),
        })

    @action(detail=True, methods=['get', 'post'], url_path='cash-transactions')
    def cash_transactions(self, request, pk=None):
        customer = self.get_object()
        if request.method == 'GET':
            queryset = filter_cash_transactions(customer.cash_transactions.filter(is_deleted=False), request.query_params)
            return Response(CustomerCashTransactionSerializer(queryset, many=True, context={'request': request}).data)
        serializer = CustomerCashTransactionSerializer(data=request.data, context={'request': request, 'customer': customer})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        customer.refresh_from_db()
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='payments')
    def payments(self, request, pk=None):
        customer = self.get_object()
        serializer = CustomerPaymentCreateSerializer(data=request.data, context={'request': request, 'customer': customer})
        serializer.is_valid(raise_exception=True)
        result = serializer.save()
        return Response(CustomerPaymentResponseSerializer(result, context={'request': request}).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get', 'post'], url_path='commodity-transactions')
    def commodity_transactions(self, request, pk=None):
        customer = self.get_object()
        if request.method == 'GET':
            queryset = filter_commodity_transactions(customer.commodity_transactions.filter(is_deleted=False).select_related('product', 'warehouse', 'created_by'), request.query_params)
            return Response(CustomerCommodityTransactionSerializer(queryset, many=True, context={'request': request}).data)
        serializer = CustomerCommodityTransactionSerializer(data=request.data, context={'request': request, 'customer': customer})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'], url_path='statement')
    def statement(self, request, pk=None):
        customer = self.get_object()
        cash_queryset = filter_cash_transactions(customer.cash_transactions.filter(is_deleted=False), request.query_params)
        commodity_queryset = filter_commodity_transactions(customer.commodity_transactions.filter(is_deleted=False).select_related('product', 'warehouse', 'created_by'), request.query_params)
        debits, credits, payments = customer_cash_totals(customer)
        return Response({
            'generated_at': timezone.localtime(timezone.now()).isoformat(),
            'customer': CustomerSerializer(customer, context={'request': request}).data,
            'cash_balance': money(customer_cash_balance(customer)),
            'cash_status': customer_cash_status(customer),
            'total_debits': money(debits),
            'total_credits': money(credits),
            'total_payments_received': money(payments),
            'commodity_balances': customer_commodity_balances(customer),
            'cash_transactions': CustomerCashTransactionSerializer(cash_queryset, many=True, context={'request': request}).data,
            'commodity_transactions': CustomerCommodityTransactionSerializer(commodity_queryset, many=True, context={'request': request}).data,
        })


class CashTransactionViewSet(mixins.RetrieveModelMixin, mixins.UpdateModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    queryset = CustomerCashTransaction.objects.filter(is_deleted=False).select_related('customer', 'created_by')
    serializer_class = CustomerCashTransactionSerializer
    permission_classes = [IsAdminForDeleteOnly]

    def destroy(self, request, *args, **kwargs):
        transaction_obj = self.get_object()
        try:
            soft_delete_cash_transaction(transaction_obj=transaction_obj, user=request.user)
        except DjangoValidationError as exc:
            raise ValidationError(exc.message_dict if hasattr(exc, 'message_dict') else exc.messages) from exc
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], url_path='reverse')
    def reverse(self, request, pk=None):
        if user_role(request.user) != 'admin':
            return Response({'detail': 'Only admin users can reverse payments.'}, status=status.HTTP_403_FORBIDDEN)
        transaction_obj = self.get_object()
        serializer = CustomerPaymentReverseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            reversal = reverse_customer_payment(payment=transaction_obj, user=request.user, reason=serializer.validated_data['reason'])
        except DjangoValidationError as exc:
            raise ValidationError(exc.message_dict if hasattr(exc, 'message_dict') else exc.messages) from exc
        return Response(CustomerCashTransactionSerializer(reversal, context={'request': request}).data, status=status.HTTP_201_CREATED)


class CommodityTransactionViewSet(mixins.RetrieveModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    queryset = CustomerCommodityTransaction.objects.filter(is_deleted=False).select_related('customer', 'product', 'warehouse', 'created_by')
    serializer_class = CustomerCommodityTransactionSerializer
    permission_classes = [IsAdminForDeleteOnly]

    def destroy(self, request, *args, **kwargs):
        transaction_obj = self.get_object()
        try:
            soft_delete_commodity_transaction(transaction_obj=transaction_obj, user=request.user)
        except DjangoValidationError as exc:
            raise ValidationError(exc.message_dict if hasattr(exc, 'message_dict') else exc.messages) from exc
        return Response(status=status.HTTP_204_NO_CONTENT)
