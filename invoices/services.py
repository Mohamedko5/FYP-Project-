from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from accounts.models import UserProfile
from customers.models import CustomerCashTransaction
from daily_journal.models import JournalTransaction
from orders.models import Order
from orders.services import mark_order_invoiced, mark_order_ready_for_shipment

from .models import Invoice, InvoiceItem, InvoicePayment


def user_role(user):
    return getattr(getattr(user, 'profile', None), 'role', UserProfile.ROLE_ADMIN)


def user_name(user):
    if not user:
        return ''
    return user.get_full_name() or user.username or user.email


def invoice_charge_reference(invoice):
    return invoice.invoice_number


@transaction.atomic
def create_invoice_from_order(order, user, notes=''):
    order = Order.objects.select_for_update().prefetch_related('items').get(id=order.id)
    if order.status != Order.STATUS_RECEIVED:
        raise ValidationError({'order': 'Only received orders can be invoiced.'})
    if order.customer.is_deleted or not order.customer.is_active:
        raise ValidationError({'customer': 'Customer must be active.'})
    items = list(order.items.select_related('product', 'product_unit'))
    if not items:
        raise ValidationError({'items': 'Order must contain at least one item.'})
    if Invoice.objects.filter(order=order).exclude(status=Invoice.STATUS_CANCELLED).exists():
        raise ValidationError({'order': 'This order already has an active invoice.'})

    invoice = Invoice.objects.create(
        order=order,
        customer=order.customer,
        subtotal=order.subtotal,
        discount_amount=order.discount_amount,
        total_amount=order.total_amount,
        currency=order.currency,
        notes=(notes or '').strip(),
        issued_by=user,
    )
    InvoiceItem.objects.bulk_create([
        InvoiceItem(
            invoice=invoice,
            order_item=item,
            product=item.product,
            product_unit=item.product_unit,
            product_code_snapshot=item.product_code_snapshot,
            product_name_en_snapshot=item.product_name_en_snapshot,
            product_name_ar_snapshot=item.product_name_ar_snapshot,
            unit_snapshot=item.unit_snapshot,
            quantity=item.quantity,
            unit_price=item.unit_price,
            line_total=item.line_total,
            notes=item.notes,
        )
        for item in items
    ])
    CustomerCashTransaction.objects.get_or_create(
        customer=invoice.customer,
        transaction_type=CustomerCashTransaction.INVOICE_CHARGE,
        source_type=CustomerCashTransaction.SOURCE_INVOICE,
        source_reference=invoice_charge_reference(invoice),
        defaults={
            'amount': invoice.total_amount,
            'description': f'Invoice charge {invoice.invoice_number}',
            'is_system_generated': True,
            'created_by': user,
        },
    )
    mark_order_invoiced(order, invoice, user)
    return invoice


@transaction.atomic
def mark_invoice_paid(invoice, user, payment_method, payment_reference=''):
    invoice = Invoice.objects.select_for_update().select_related('order', 'customer').get(id=invoice.id)
    order = Order.objects.select_for_update().get(id=invoice.order_id)
    if invoice.status != Invoice.STATUS_ISSUED or invoice.payment_status != Invoice.PAYMENT_UNPAID:
        raise ValidationError({'invoice': 'Invoice cannot be paid.'})
    if order.status != Order.STATUS_INVOICED:
        raise ValidationError({'order': 'Related order must be invoiced.'})
    if payment_method not in dict(InvoicePayment.PAYMENT_METHOD_CHOICES):
        raise ValidationError({'payment_method': 'Choose cash or online.'})
    if hasattr(invoice, 'payment'):
        raise ValidationError({'invoice': 'Invoice is already paid.'})

    customer_payment, _ = CustomerCashTransaction.objects.get_or_create(
        customer=invoice.customer,
        transaction_type=CustomerCashTransaction.PAYMENT_RECEIVED,
        source_type=CustomerCashTransaction.SOURCE_INVOICE,
        source_reference=invoice.invoice_number,
        defaults={
            'payment_method': payment_method,
            'amount': invoice.total_amount,
            'description': f'Payment received for {invoice.invoice_number}',
            'is_system_generated': True,
            'created_by': user,
        },
    )
    journal = JournalTransaction.objects.create(
        journal_type=JournalTransaction.JOURNAL_CASH,
        cash_type=JournalTransaction.CASH_INCOME,
        payment_method=payment_method,
        amount=invoice.total_amount,
        party=invoice.customer.name,
        description=f'Payment received for {invoice.invoice_number}',
        source_type=JournalTransaction.SOURCE_INVOICE,
        source_reference=invoice.invoice_number,
        is_system_generated=True,
        created_by=user,
    )
    payment = InvoicePayment.objects.create(
        invoice=invoice,
        amount=invoice.total_amount,
        payment_method=payment_method,
        payment_reference=(payment_reference or '').strip(),
        linked_customer_transaction=customer_payment,
        linked_journal_transaction=journal,
        received_by=user,
    )
    invoice.status = Invoice.STATUS_PAID
    invoice.payment_status = Invoice.PAYMENT_PAID
    invoice.paid_at = timezone.now()
    invoice.paid_by = user
    invoice.save(update_fields=['status', 'payment_status', 'paid_at', 'paid_by', 'updated_at'])
    mark_order_ready_for_shipment(order, invoice, user)

    from shipments.services import create_shipment_from_paid_invoice

    create_shipment_from_paid_invoice(invoice, user)
    return payment


@transaction.atomic
def cancel_invoice(invoice, user, reason):
    if user_role(user) != UserProfile.ROLE_ADMIN:
        raise PermissionError('Only admin users can cancel invoices.')
    reason = (reason or '').strip()
    if not reason:
        raise ValidationError({'reason': 'Cancellation reason is required.'})
    invoice = Invoice.objects.select_for_update().select_related('order', 'customer').get(id=invoice.id)
    order = Order.objects.select_for_update().get(id=invoice.order_id)
    if invoice.status != Invoice.STATUS_ISSUED or invoice.payment_status != Invoice.PAYMENT_UNPAID:
        raise ValidationError({'invoice': 'Only unpaid issued invoices can be cancelled.'})
    if invoice.shipments.filter(status__in=['processing', 'completed']).exists():
        raise ValidationError({'shipment': 'Invoice with processing or completed shipment cannot be cancelled.'})
    invoice.status = Invoice.STATUS_CANCELLED
    invoice.cancelled_at = timezone.now()
    invoice.cancelled_by = user
    invoice.cancellation_reason = reason
    invoice.save(update_fields=['status', 'cancelled_at', 'cancelled_by', 'cancellation_reason', 'updated_at'])
    order.status = Order.STATUS_RECEIVED
    order.updated_by = user
    order.save(update_fields=['status', 'updated_by', 'updated_at'])
    CustomerCashTransaction.objects.create(
        customer=invoice.customer,
        transaction_type=CustomerCashTransaction.ADJUSTMENT_CREDIT,
        source_type=CustomerCashTransaction.SOURCE_INVOICE,
        source_reference=f'{invoice.invoice_number}-CANCEL',
        amount=invoice.total_amount,
        description=f'Reversal of cancelled Invoice {invoice.invoice_number}',
        is_system_generated=True,
        created_by=user,
    )
    invoice.shipments.filter(status='ready_for_shipment').update(status='cancelled', cancelled_at=timezone.now(), cancelled_by=user, cancellation_reason='Invoice cancelled')
    return invoice
