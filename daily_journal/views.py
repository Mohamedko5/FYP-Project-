from datetime import datetime, time
from decimal import Decimal

from django.db import models
from django.db.models import Count, Sum
from django.utils import timezone
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import status, viewsets
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from inventory.permissions import IsAdminOrManager

from .models import JournalTransaction
from .serializers import (
    JournalTransactionSerializer,
    WarehouseCommodityReversalSerializer,
    WarehouseCommodityTransactionResponseSerializer,
    WarehouseCommodityTransactionSerializer,
)
from .services import reverse_warehouse_commodity_transaction


def parse_local_date(value):
    if not value:
        return timezone.localdate()
    try:
        return datetime.strptime(value, '%Y-%m-%d').date()
    except ValueError as exc:
        raise ValidationError({'date': 'Use YYYY-MM-DD format.'}) from exc


def local_day_bounds(day):
    current_timezone = timezone.get_current_timezone()
    start = timezone.make_aware(datetime.combine(day, time.min), current_timezone)
    end = timezone.make_aware(datetime.combine(day, time.max), current_timezone)
    return start, end


def money(value):
    return f'{(value or Decimal("0.00")):.2f}'


def quantity(value):
    return f'{(value or Decimal("0.000")):.3f}'


class JournalTransactionViewSet(viewsets.ModelViewSet):
    serializer_class = JournalTransactionSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    ordering_fields = {'created_at', 'amount', 'quantity'}

    def get_queryset(self):
        return JournalTransaction.objects.filter(is_deleted=False)

    def filter_queryset(self, queryset):
        queryset = super().filter_queryset(queryset)
        params = self.request.query_params

        if 'date' in params:
            day = parse_local_date(params.get('date'))
            start, end = local_day_bounds(day)
            queryset = queryset.filter(created_at__gte=start, created_at__lte=end)

        journal_type = params.get('journal_type')
        if journal_type:
            if journal_type not in dict(JournalTransaction.JOURNAL_TYPE_CHOICES):
                raise ValidationError({'journal_type': 'Choose cash or commodity.'})
            queryset = queryset.filter(journal_type=journal_type)

        cash_type = params.get('cash_type')
        if cash_type:
            if cash_type not in dict(JournalTransaction.CASH_TYPE_CHOICES):
                raise ValidationError({'cash_type': 'Choose income or expense.'})
            queryset = queryset.filter(cash_type=cash_type)

        payment_method = params.get('payment_method')
        if payment_method:
            if payment_method == 'online':
                payment_method = JournalTransaction.PAYMENT_ELECTRONIC
            if payment_method not in dict(JournalTransaction.PAYMENT_METHOD_CHOICES):
                raise ValidationError({'payment_method': 'Choose cash or electronic payment.'})
            queryset = queryset.filter(payment_method=payment_method)

        product_name = params.get('product_name')
        if product_name:
            queryset = queryset.filter(product_name=product_name)

        unit = params.get('unit')
        if unit:
            allowed_units = {
                JournalTransaction.UNIT_QINTAR,
                JournalTransaction.UNIT_KG,
                JournalTransaction.UNIT_BAG,
                JournalTransaction.UNIT_BALE,
                JournalTransaction.UNIT_UNIT,
            }
            if unit not in allowed_units:
                raise ValidationError({'unit': 'Choose Qintar, KG, Bag, Bale, or Unit.'})
            queryset = queryset.filter(unit=unit)

        search = params.get('search')
        if search:
            queryset = queryset.filter(
                models.Q(party__icontains=search)
                | models.Q(description__icontains=search)
                | models.Q(product_name__icontains=search)
                | models.Q(source_reference__icontains=search)
            )

        ordering = params.get('ordering')
        if ordering:
            field = ordering[1:] if ordering.startswith('-') else ordering
            if field not in self.ordering_fields:
                raise ValidationError({'ordering': 'Choose created_at, -created_at, amount, -amount, quantity, or -quantity.'})
            queryset = queryset.order_by(ordering)

        return queryset

    def perform_destroy(self, instance):
        if instance.is_deleted:
            raise ValidationError({'detail': 'Deleted transactions cannot be deleted again.'})
        if instance.is_system_generated:
            raise ValidationError({'detail': 'System-generated journal transactions cannot be deleted here.'})
        instance.is_deleted = True
        instance.deleted_at = timezone.now()
        instance.deleted_by = self.request.user
        instance.save(update_fields=['is_deleted', 'deleted_at', 'deleted_by', 'updated_at'])

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def update(self, request, *args, **kwargs):
        if self.get_object().is_deleted:
            return Response({'detail': 'Deleted transactions cannot be edited.'}, status=status.HTTP_400_BAD_REQUEST)
        return super().update(request, *args, **kwargs)

    @action(detail=False, methods=['get'], url_path='daily-summary')
    def daily_summary(self, request):
        day = parse_local_date(request.query_params.get('date'))
        start, end = local_day_bounds(day)
        base = self.get_queryset()

        previous_cash = base.filter(journal_type=JournalTransaction.JOURNAL_CASH, created_at__lt=start)
        previous_income = previous_cash.filter(cash_type=JournalTransaction.CASH_INCOME).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        previous_expenses = previous_cash.filter(cash_type=JournalTransaction.CASH_EXPENSE).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        opening_balance = previous_income - previous_expenses

        current_cash = base.filter(journal_type=JournalTransaction.JOURNAL_CASH, created_at__gte=start, created_at__lte=end)
        total_income = current_cash.filter(cash_type=JournalTransaction.CASH_INCOME).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        total_expenses = current_cash.filter(cash_type=JournalTransaction.CASH_EXPENSE).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        net = total_income - total_expenses
        cash_method_income = current_cash.filter(payment_method=JournalTransaction.PAYMENT_CASH, cash_type=JournalTransaction.CASH_INCOME).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        cash_method_expenses = current_cash.filter(payment_method=JournalTransaction.PAYMENT_CASH, cash_type=JournalTransaction.CASH_EXPENSE).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        electronic_method_income = current_cash.filter(payment_method=JournalTransaction.PAYMENT_ELECTRONIC, cash_type=JournalTransaction.CASH_INCOME).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        electronic_method_expenses = current_cash.filter(payment_method=JournalTransaction.PAYMENT_ELECTRONIC, cash_type=JournalTransaction.CASH_EXPENSE).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

        current_commodity = base.filter(journal_type=JournalTransaction.JOURNAL_COMMODITY, created_at__gte=start, created_at__lte=end)
        estimated_total_value = current_commodity.aggregate(total=Sum('estimated_value'))['total'] or Decimal('0.00')
        commodity_groups = current_commodity.values('product_name', 'unit').annotate(
            quantity_total=Sum('quantity'),
            estimated_value_total=Sum('estimated_value'),
            transaction_count=Count('id'),
        ).order_by('product_name', 'unit')

        return Response({
            'date': day.isoformat(),
            'cash': {
                'opening_balance': money(opening_balance),
                'total_income': money(total_income),
                'total_expenses': money(total_expenses),
                'net': money(net),
                'closing_balance': money(opening_balance + net),
                'payment_methods': {
                    'cash': {
                        'income': money(cash_method_income),
                        'expenses': money(cash_method_expenses),
                    },
                    'electronic': {
                        'income': money(electronic_method_income),
                        'expenses': money(electronic_method_expenses),
                    },
                },
            },
            'commodity': {
                'transaction_count': current_commodity.count(),
                'estimated_total_value': money(estimated_total_value),
                'groups': [
                    {
                        'product_name': row['product_name'],
                        'unit': row['unit'],
                        'quantity': quantity(row['quantity_total']),
                        'estimated_value': money(row['estimated_value_total']),
                        'transaction_count': row['transaction_count'],
                    }
                    for row in commodity_groups
                ],
            },
        })


def django_validation_detail(exc):
    return exc.message_dict if hasattr(exc, 'message_dict') else exc.messages


class WarehouseCommodityTransactionView(APIView):
    permission_classes = [IsAdminOrManager]

    def post(self, request):
        serializer = WarehouseCommodityTransactionSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        journal, movement, inventory = serializer.save()
        response = WarehouseCommodityTransactionResponseSerializer({
            'journal_transaction': journal,
            'inventory_movement': movement,
            'inventory': inventory,
        }, context={'request': request})
        return Response(response.data, status=status.HTTP_201_CREATED)


class WarehouseCommodityTransactionReverseView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        serializer = WarehouseCommodityReversalSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            journal = JournalTransaction.objects.get(pk=pk, is_deleted=False)
            reversal, movement, inventory = reverse_warehouse_commodity_transaction(
                journal=journal,
                user=request.user,
                reason=serializer.validated_data['reason'],
            )
        except JournalTransaction.DoesNotExist as exc:
            raise ValidationError({'detail': 'Journal transaction was not found.'}) from exc
        except PermissionError as exc:
            raise PermissionDenied(str(exc)) from exc
        except DjangoValidationError as exc:
            raise ValidationError(django_validation_detail(exc)) from exc
        response = WarehouseCommodityTransactionResponseSerializer({
            'journal_transaction': reversal,
            'inventory_movement': movement,
            'inventory': inventory,
        }, context={'request': request})
        return Response(response.data, status=status.HTTP_201_CREATED)
