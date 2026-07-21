from decimal import Decimal, InvalidOperation

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from daily_journal.models import JournalTransaction
from inventory.models import Product, ProductUnit

from .models import Customer, CustomerCashTransaction, CustomerCommodityTransaction


def parse_decimal(value, field_name, *, places='0.01', required=True, allow_zero=False):
    if value in (None, ''):
        if required:
            raise ValidationError({field_name: 'This field is required.'})
        return None
    try:
        decimal_value = Decimal(str(value)).quantize(Decimal(places))
    except (InvalidOperation, ValueError) as exc:
        raise ValidationError({field_name: 'Enter a valid decimal value.'}) from exc
    if not decimal_value.is_finite():
        raise ValidationError({field_name: 'Enter a finite decimal value.'})
    if allow_zero:
        if decimal_value < 0:
            raise ValidationError({field_name: 'Value cannot be negative.'})
    elif decimal_value <= 0:
        raise ValidationError({field_name: 'Value must be greater than zero.'})
    return decimal_value


def money(value):
    return f'{(value or Decimal("0.00")):.2f}'


def quantity(value):
    return f'{(value or Decimal("0.000")):.3f}'


def customer_cash_totals(customer):
    transactions = CustomerCashTransaction.objects.filter(customer=customer, is_deleted=False)
    debits = transactions.filter(transaction_type__in=CustomerCashTransaction.DEBIT_TYPES).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
    credits = transactions.filter(transaction_type__in=CustomerCashTransaction.CREDIT_TYPES).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
    payments = transactions.filter(transaction_type=CustomerCashTransaction.PAYMENT_RECEIVED).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
    return debits, credits, payments


def customer_cash_balance(customer):
    debits, credits, _ = customer_cash_totals(customer)
    return debits - credits


def customer_cash_status(customer):
    balance = customer_cash_balance(customer)
    if balance > 0:
        return 'Debtor'
    if balance < 0:
        return 'Creditor'
    return 'Balanced'


def commodity_balance_for(customer, product, unit):
    base = CustomerCommodityTransaction.objects.filter(customer=customer, product=product, unit=unit, is_deleted=False)
    increases = base.filter(transaction_type__in=CustomerCommodityTransaction.INCREASE_TYPES).aggregate(total=Sum('quantity'))['total'] or Decimal('0.000')
    decreases = base.filter(transaction_type__in=CustomerCommodityTransaction.DECREASE_TYPES).aggregate(total=Sum('quantity'))['total'] or Decimal('0.000')
    return increases - decreases


def customer_commodity_balances(customer):
    rows = []
    keys = CustomerCommodityTransaction.objects.filter(customer=customer, is_deleted=False).values(
        'product_id', 'product__name_en', 'product__name_ar', 'unit'
    ).distinct()
    for key in keys:
        balance = commodity_balance_for(customer, key['product_id'], key['unit'])
        rows.append({
            'product_id': key['product_id'],
            'product_name': key['product__name_en'],
            'product_name_ar': key['product__name_ar'],
            'unit': key['unit'],
            'quantity': quantity(balance),
        })
    return rows


def validate_customer_open(customer):
    if customer.is_deleted or not customer.is_active:
        raise ValidationError({'customer': 'Archived customers cannot receive transactions.'})


def validate_product_unit(product, unit):
    if not ProductUnit.objects.filter(product=product, unit=unit).exists():
        raise ValidationError({'unit': f'{unit} is not valid for {product.name_en}.'})


def create_customer_with_opening(*, user, opening_balance_amount=None, opening_balance_type='', **customer_data):
    opening_amount = parse_decimal(opening_balance_amount, 'opening_balance_amount', required=False) if opening_balance_amount not in (None, '') else None
    if opening_amount and opening_balance_type not in ('customer_owes_company', 'company_owes_customer'):
        raise ValidationError({'opening_balance_type': 'Choose a valid opening balance type.'})
    if not opening_amount and opening_balance_type:
        raise ValidationError({'opening_balance_amount': 'Opening balance amount is required.'})

    with transaction.atomic():
        customer = Customer(created_by=user, **customer_data)
        customer.full_clean()
        customer.save()
        if opening_amount:
            transaction_type = (
                CustomerCashTransaction.OPENING_DEBT
                if opening_balance_type == 'customer_owes_company'
                else CustomerCashTransaction.OPENING_CREDIT
            )
            cash = CustomerCashTransaction(
                customer=customer,
                transaction_type=transaction_type,
                amount=opening_amount,
                description='Opening balance',
                source_type=CustomerCashTransaction.SOURCE_SYSTEM,
                is_system_generated=True,
                created_by=user,
            )
            cash.full_clean()
            cash.save()
        return customer


def update_customer_basic(*, customer, user, **customer_data):
    for field, value in customer_data.items():
        setattr(customer, field, value)
    customer.updated_by = user
    customer.full_clean()
    customer.save()
    return customer


def create_cash_transaction(*, customer, user, transaction_type, amount, description, payment_method=None):
    if transaction_type not in CustomerCashTransaction.MANUAL_TYPES:
        raise ValidationError({'transaction_type': 'Manual requests may only create Payment Received, Payment Owed, or Customer Expense.'})
    amount = parse_decimal(amount, 'amount')

    with transaction.atomic():
        customer = Customer.objects.select_for_update().get(pk=customer.pk)
        validate_customer_open(customer)
        cash = CustomerCashTransaction(
            customer=customer,
            transaction_type=transaction_type,
            payment_method=payment_method or None,
            amount=amount,
            description=description,
            source_type=CustomerCashTransaction.SOURCE_MANUAL,
            is_system_generated=False,
            created_by=user,
        )
        cash.full_clean()
        cash.save()
        cash.source_reference = f'CASH-{cash.id:06d}'

        if transaction_type in (CustomerCashTransaction.PAYMENT_RECEIVED, CustomerCashTransaction.CUSTOMER_EXPENSE):
            journal_type = (
                JournalTransaction.CASH_INCOME
                if transaction_type == CustomerCashTransaction.PAYMENT_RECEIVED
                else JournalTransaction.CASH_EXPENSE
            )
            journal, _ = JournalTransaction.objects.get_or_create(
                source_type=JournalTransaction.SOURCE_CUSTOMER,
                source_reference=cash.source_reference,
                defaults={
                    'journal_type': JournalTransaction.JOURNAL_CASH,
                    'cash_type': journal_type,
                    'payment_method': cash.payment_method,
                    'amount': cash.amount,
                    'party': customer.name,
                    'description': cash.description,
                    'is_system_generated': True,
                    'created_by': user,
                },
            )
            cash.linked_journal_transaction = journal
        cash.full_clean()
        cash.save(update_fields=['source_reference', 'linked_journal_transaction'])
        return cash


def soft_delete_cash_transaction(*, transaction_obj, user):
    if transaction_obj.is_system_generated:
        raise ValidationError({'detail': 'System-generated transactions cannot be deleted here.'})
    if transaction_obj.is_deleted:
        raise ValidationError({'detail': 'Transaction is already deleted.'})
    with transaction.atomic():
        transaction_obj.is_deleted = True
        transaction_obj.deleted_by = user
        transaction_obj.deleted_at = timezone.now()
        transaction_obj.save(update_fields=['is_deleted', 'deleted_by', 'deleted_at'])
        journal = transaction_obj.linked_journal_transaction
        if journal and not journal.is_deleted:
            journal.is_deleted = True
            journal.deleted_by = user
            journal.deleted_at = timezone.now()
            journal.save(update_fields=['is_deleted', 'deleted_by', 'deleted_at', 'updated_at'])


def create_commodity_transaction(*, customer, user, transaction_type, product_id, quantity_value, unit, description, estimated_value=None, warehouse=None):
    if transaction_type not in CustomerCommodityTransaction.MANUAL_TYPES:
        raise ValidationError({'transaction_type': 'Manual requests may only create Product Received or Product Delivered.'})
    quantity_decimal = parse_decimal(quantity_value, 'quantity', places='0.001')
    estimated = parse_decimal(estimated_value, 'estimated_value', required=False, allow_zero=True) if estimated_value not in (None, '') else None

    with transaction.atomic():
        customer = Customer.objects.select_for_update().get(pk=customer.pk)
        validate_customer_open(customer)
        product = Product.objects.get(pk=product_id)
        validate_product_unit(product, unit)
        if transaction_type == CustomerCommodityTransaction.PRODUCT_DELIVERED:
            current_balance = commodity_balance_for(customer, product, unit)
            if current_balance < quantity_decimal:
                raise ValidationError({'quantity': 'Product Delivered cannot make commodity balance negative.'})
        commodity = CustomerCommodityTransaction(
            customer=customer,
            transaction_type=transaction_type,
            product=product,
            quantity=quantity_decimal,
            unit=unit,
            warehouse=warehouse,
            estimated_value=estimated,
            description=description,
            source_type=CustomerCommodityTransaction.SOURCE_MANUAL,
            is_system_generated=False,
            created_by=user,
        )
        commodity.full_clean()
        commodity.save()
        commodity.source_reference = f'COM-{commodity.id:06d}'
        commodity.save(update_fields=['source_reference'])
        return commodity


def soft_delete_commodity_transaction(*, transaction_obj, user):
    if transaction_obj.is_system_generated:
        raise ValidationError({'detail': 'System-generated transactions cannot be deleted here.'})
    if transaction_obj.is_deleted:
        raise ValidationError({'detail': 'Transaction is already deleted.'})
    with transaction.atomic():
        transaction_obj.is_deleted = True
        transaction_obj.deleted_by = user
        transaction_obj.deleted_at = timezone.now()
        transaction_obj.save(update_fields=['is_deleted', 'deleted_by', 'deleted_at'])
