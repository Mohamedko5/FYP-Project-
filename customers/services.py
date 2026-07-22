import hashlib
import json
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


def customer_payment_description(customer, payment_purpose, description='', invoice=None):
    note = (description or '').strip()
    if payment_purpose == CustomerCashTransaction.PURPOSE_INVOICE_PAYMENT and invoice:
        base = f'Payment received from {customer.name} for Invoice {invoice.invoice_number}'
    elif payment_purpose == CustomerCashTransaction.PURPOSE_PREVIOUS_BALANCE:
        base = f'Payment received from {customer.name} - Previous balance payment'
    elif payment_purpose == CustomerCashTransaction.PURPOSE_ADVANCE_PAYMENT:
        base = f'Advance payment received from {customer.name}'
    elif payment_purpose == CustomerCashTransaction.PURPOSE_GENERAL_ACCOUNT_PAYMENT:
        base = f'General account payment received from {customer.name}'
    else:
        base = f'Customer payment received from {customer.name}'
    return f'{base} - {note}' if note else base


def payment_idempotency_hash(*, amount, payment_method, payment_purpose, description, invoice_id):
    payload = {
        'amount': money(amount),
        'payment_method': payment_method,
        'payment_purpose': payment_purpose,
        'description': (description or '').strip(),
        'invoice_id': invoice_id,
    }
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode('utf-8')).hexdigest()


def validate_payment_purpose(*, payment_purpose, invoice, description):
    if payment_purpose not in dict(CustomerCashTransaction.PAYMENT_PURPOSE_CHOICES):
        raise ValidationError({'payment_purpose': 'Choose a valid payment purpose.'})
    if payment_purpose == CustomerCashTransaction.PURPOSE_INVOICE_PAYMENT and invoice is None:
        raise ValidationError({'invoice_id': 'Invoice is required for invoice payments.'})
    if payment_purpose in {
        CustomerCashTransaction.PURPOSE_PREVIOUS_BALANCE,
        CustomerCashTransaction.PURPOSE_ADVANCE_PAYMENT,
        CustomerCashTransaction.PURPOSE_OTHER,
    } and invoice is not None:
        raise ValidationError({'invoice_id': 'Invoice must be empty for this payment purpose.'})
    if payment_purpose == CustomerCashTransaction.PURPOSE_OTHER and not (description or '').strip():
        raise ValidationError({'description': 'Description is required for other payments.'})


def record_customer_payment(*, customer, amount, payment_method, payment_purpose, description, user, invoice=None, idempotency_key=''):
    amount = parse_decimal(amount, 'amount')
    payment_method = (payment_method or '').strip()
    if payment_method not in dict(CustomerCashTransaction.PAYMENT_METHOD_CHOICES):
        raise ValidationError({'payment_method': 'Choose cash or online.'})
    idempotency_key = (idempotency_key or '').strip()
    validate_payment_purpose(payment_purpose=payment_purpose, invoice=invoice, description=description)

    if payment_purpose == CustomerCashTransaction.PURPOSE_INVOICE_PAYMENT:
        from invoices.models import Invoice
        from invoices.services import mark_invoice_paid

        invoice = Invoice.objects.select_related('customer').get(pk=invoice.pk)
        if invoice.customer_id != customer.id:
            raise ValidationError({'invoice_id': 'Invoice must belong to the selected customer.'})
        if amount != invoice.total_amount:
            raise ValidationError({'amount': 'Invoice payments must equal the full outstanding invoice amount.'})
        existing = None
        idem_hash = payment_idempotency_hash(
            amount=amount,
            payment_method=payment_method,
            payment_purpose=payment_purpose,
            description=description,
            invoice_id=invoice.id,
        )
        if idempotency_key:
            existing = CustomerCashTransaction.objects.filter(customer=customer, idempotency_key=idempotency_key).first()
            if existing:
                if existing.idempotency_hash != idem_hash:
                    raise ValidationError({'idempotency_key': 'This idempotency key was already used with different payment data.'})
                return existing, customer_cash_balance(customer), customer_cash_balance(customer)
        previous_balance = customer_cash_balance(customer)
        invoice_payment = mark_invoice_paid(
            invoice,
            user,
            payment_method,
            payment_reference=idempotency_key,
            customer_payment_purpose=payment_purpose,
            customer_payment_description=description,
            idempotency_key=idempotency_key,
            idempotency_hash=idem_hash,
        )
        return invoice_payment.linked_customer_transaction, previous_balance, customer_cash_balance(customer)

    with transaction.atomic():
        customer = Customer.objects.select_for_update().get(pk=customer.pk)
        validate_customer_open(customer)
        previous_balance = customer_cash_balance(customer)
        idem_hash = payment_idempotency_hash(
            amount=amount,
            payment_method=payment_method,
            payment_purpose=payment_purpose,
            description=description,
            invoice_id=None,
        )
        if idempotency_key:
            existing = CustomerCashTransaction.objects.filter(customer=customer, idempotency_key=idempotency_key).first()
            if existing:
                if existing.idempotency_hash != idem_hash:
                    raise ValidationError({'idempotency_key': 'This idempotency key was already used with different payment data.'})
                return existing, previous_balance, customer_cash_balance(customer)
        cash = CustomerCashTransaction(
            customer=customer,
            transaction_type=CustomerCashTransaction.PAYMENT_RECEIVED,
            payment_method=payment_method,
            payment_purpose=payment_purpose,
            amount=amount,
            description=(description or '').strip() or customer_payment_description(customer, payment_purpose),
            source_type=CustomerCashTransaction.SOURCE_CUSTOMER,
            is_system_generated=True,
            idempotency_key=idempotency_key,
            idempotency_hash=idem_hash if idempotency_key else '',
            created_by=user,
        )
        cash.full_clean()
        cash.save()
        cash.source_reference = cash.reference_number
        journal, _ = JournalTransaction.objects.get_or_create(
            source_type=JournalTransaction.SOURCE_CUSTOMER,
            source_reference=cash.reference_number,
            defaults={
                'journal_type': JournalTransaction.JOURNAL_CASH,
                'cash_type': JournalTransaction.CASH_INCOME,
                'payment_method': payment_method,
                'amount': amount,
                'party': customer.name,
                'description': customer_payment_description(customer, payment_purpose, description),
                'is_system_generated': True,
                'created_by': user,
            },
        )
        cash.linked_journal_transaction = journal
        cash.full_clean()
        cash.save(update_fields=['source_reference', 'linked_journal_transaction'])
        return cash, previous_balance, customer_cash_balance(customer)


def reverse_customer_payment(*, payment, user, reason):
    reason = (reason or '').strip()
    if not reason:
        raise ValidationError({'reason': 'Reversal reason is required.'})
    if payment.is_reversed:
        raise ValidationError({'detail': 'Payment has already been reversed.'})
    if payment.transaction_type != CustomerCashTransaction.PAYMENT_RECEIVED:
        raise ValidationError({'detail': 'Only customer payments can be reversed here.'})
    if payment.invoice_id:
        raise ValidationError({'detail': 'Invoice payments must be corrected through the invoice workflow.'})

    with transaction.atomic():
        payment = CustomerCashTransaction.objects.select_for_update().select_related('customer').get(pk=payment.pk)
        if payment.is_reversed:
            raise ValidationError({'detail': 'Payment has already been reversed.'})
        reversal = CustomerCashTransaction.objects.create(
            customer=payment.customer,
            transaction_type=CustomerCashTransaction.ADJUSTMENT_DEBIT,
            payment_purpose=payment.payment_purpose,
            amount=payment.amount,
            description=f'Reversal of {payment.reference_number}: {reason}',
            source_type=CustomerCashTransaction.SOURCE_CUSTOMER,
            source_reference=f'{payment.reference_number}-REV',
            is_system_generated=True,
            created_by=user,
            reversal_transaction=payment,
        )
        journal = JournalTransaction.objects.create(
            journal_type=JournalTransaction.JOURNAL_CASH,
            cash_type=JournalTransaction.CASH_EXPENSE,
            payment_method=payment.payment_method,
            amount=payment.amount,
            party=payment.customer.name,
            description=f'Reversal of customer payment {payment.reference_number}: {reason}',
            source_type=JournalTransaction.SOURCE_CUSTOMER,
            source_reference=reversal.source_reference,
            is_system_generated=True,
            created_by=user,
        )
        reversal.linked_journal_transaction = journal
        reversal.save(update_fields=['linked_journal_transaction'])
        payment.is_reversed = True
        payment.reversed_at = timezone.now()
        payment.reversed_by = user
        payment.reversal_reason = reason
        payment.reversal_transaction = reversal
        payment.save(update_fields=['is_reversed', 'reversed_at', 'reversed_by', 'reversal_reason', 'reversal_transaction'])
        return reversal


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
