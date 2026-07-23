from decimal import Decimal, InvalidOperation

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from communications.models import ChatMessage
from communications.services import active_or_reopened_conversation, create_chat_message
from customers.models import CustomerCashTransaction
from daily_journal.models import JournalTransaction
from inventory.models import InventoryMovement, Product, ProductUnit, Warehouse
from inventory.services import add_stock

from .models import SupplyOffer, SupplyOfferStatusHistory


def customer_for_request(request):
    return request.user.customer_account.customer


def parse_decimal(value, field, places):
    try:
        parsed = Decimal(str(value)).quantize(Decimal(places))
    except (InvalidOperation, ValueError) as exc:
        raise ValidationError({field: 'Enter a valid decimal value.'}) from exc
    if not parsed.is_finite() or parsed <= 0:
        raise ValidationError({field: 'Value must be greater than zero.'})
    return parsed


def add_history(offer, previous, new, user, actor_type, customer_safe_note='', internal_note=''):
    return SupplyOfferStatusHistory.objects.create(
        offer=offer,
        previous_status=previous or '',
        new_status=new,
        changed_by=user,
        actor_type=actor_type,
        customer_safe_note=(customer_safe_note or '').strip(),
        internal_note=(internal_note or '').strip(),
    )


def set_status(offer, new_status, user, actor_type, customer_safe_note='', internal_note=''):
    previous = offer.status
    offer.status = new_status
    now = timezone.now()
    if new_status == SupplyOffer.STATUS_SUBMITTED:
        offer.submitted_at = now
    elif new_status == SupplyOffer.STATUS_UNDER_REVIEW:
        offer.reviewed_at = now
        offer.reviewed_by = user
    elif new_status in {SupplyOffer.STATUS_APPROVED, SupplyOffer.STATUS_AWAITING_RECEIPT}:
        offer.approved_at = now
        offer.approved_by = user
    elif new_status == SupplyOffer.STATUS_REJECTED:
        offer.rejected_at = now
        offer.rejected_by = user
    if customer_safe_note:
        offer.customer_safe_admin_message = customer_safe_note.strip()
    offer.save()
    add_history(offer, previous, new_status, user, actor_type, customer_safe_note, internal_note)
    return offer


def validate_product_unit(product_id, product_unit_id):
    try:
        product = Product.objects.get(pk=product_id)
        product_unit = ProductUnit.objects.get(pk=product_unit_id)
    except (Product.DoesNotExist, ProductUnit.DoesNotExist) as exc:
        raise ValidationError({'items': 'Product or unit was not found.'}) from exc
    if product.is_deleted or not product.is_active:
        raise ValidationError({'product_id': 'Product must be active.'})
    if not product_unit.is_active or product_unit.product_id != product.id:
        raise ValidationError({'product_unit_id': 'Unit does not belong to this product.'})
    return product, product_unit


def create_offer_card_message(offer, user, message):
    conversation = active_or_reopened_conversation(offer.customer)
    snapshot = {
        'supply_offer_id': offer.id,
        'offer_number': offer.offer_number,
        'product_summary': offer.product_summary,
        'proposed_total': f'{offer.proposed_total:.2f}',
        'status': offer.status,
    }
    return create_chat_message(
        conversation=conversation,
        user=user,
        sender_type=ChatMessage.SENDER_SYSTEM,
        message_type=ChatMessage.TYPE_SYSTEM,
        body=message,
        card_snapshot=snapshot,
    )


@transaction.atomic
def record_receipt(*, offer, warehouse, items, user, idempotency_key=''):
    if offer.status not in {SupplyOffer.STATUS_APPROVED, SupplyOffer.STATUS_AWAITING_RECEIPT}:
        raise ValidationError({'status': 'Only approved offers can be received.'})
    if offer.receipt_recorded_at:
        raise ValidationError({'detail': 'Receipt has already been recorded.'})
    if warehouse.is_deleted or not warehouse.is_active:
        raise ValidationError({'receiving_warehouse_id': 'Warehouse must be active.'})

    movements = []
    offer_items = {item.id: item for item in offer.items.select_related('product', 'product_unit')}
    if not items:
        raise ValidationError({'items': 'At least one received item is required.'})
    for row in items:
        item = offer_items.get(int(row.get('offer_item_id') or 0))
        if not item:
            raise ValidationError({'items': 'Offer item was not found.'})
        accepted = parse_decimal(row.get('accepted_quantity'), 'accepted_quantity', '0.001')
        rejected = Decimal(str(row.get('rejected_quantity') or '0')).quantize(Decimal('0.001'))
        if accepted > item.quantity:
            raise ValidationError({'accepted_quantity': 'Accepted quantity cannot exceed offered quantity.'})
        inventory, movement = add_stock(
            warehouse_id=warehouse.id,
            product_id=item.product_id,
            quantity=accepted,
            unit=item.unit_snapshot,
            minimum_threshold='0',
            notes=row.get('receipt_note') or f'Received from {offer.offer_number}',
            user=user,
            source_type='supply_offer',
            source_reference=offer.offer_number,
        )
        item.accepted_quantity = accepted
        item.rejected_quantity = rejected
        item.save(update_fields=['accepted_quantity', 'rejected_quantity', 'updated_at'])
        movements.append(movement)

    offer.receiving_warehouse = warehouse
    offer.receipt_recorded_at = timezone.now()
    offer.receipt_recorded_by = user
    offer.status = SupplyOffer.STATUS_RECEIVED
    offer.save(update_fields=['receiving_warehouse', 'receipt_recorded_at', 'receipt_recorded_by', 'status', 'updated_at'])
    add_history(offer, SupplyOffer.STATUS_AWAITING_RECEIPT, SupplyOffer.STATUS_RECEIVED, user, SupplyOfferStatusHistory.ACTOR_ADMIN, 'Products received.')
    return movements


@transaction.atomic
def record_payment(*, offer, amount, payment_method, user, electronic_reference='', payment_receipt=None, description='', idempotency_key=''):
    if offer.status not in {SupplyOffer.STATUS_RECEIVED, SupplyOffer.STATUS_COMPLETED}:
        raise ValidationError({'status': 'Payment can be recorded only after receipt.'})
    if offer.linked_payment_id:
        raise ValidationError({'detail': 'Payment has already been recorded.'})
    amount = parse_decimal(amount, 'amount', '0.01')
    if payment_method not in dict(JournalTransaction.PAYMENT_METHOD_CHOICES):
        raise ValidationError({'payment_method': 'Choose cash or electronic.'})
    journal = JournalTransaction(
        journal_type=JournalTransaction.JOURNAL_CASH,
        cash_type=JournalTransaction.CASH_EXPENSE,
        payment_method=payment_method,
        electronic_reference=(electronic_reference or '').strip(),
        payment_receipt=payment_receipt,
        amount=amount,
        party=offer.customer.name,
        description=(description or f'Supplier payment for {offer.offer_number}').strip(),
        source_type=JournalTransaction.SOURCE_CUSTOMER,
        source_reference=f'{offer.offer_number}-PAY',
        is_system_generated=True,
        idempotency_key=idempotency_key or '',
        created_by=user,
    )
    journal.full_clean()
    journal.save()
    payment = CustomerCashTransaction.objects.create(
        customer=offer.customer,
        transaction_type=CustomerCashTransaction.CUSTOMER_EXPENSE,
        payment_method=CustomerCashTransaction.PAYMENT_CASH if payment_method == JournalTransaction.PAYMENT_CASH else CustomerCashTransaction.PAYMENT_ONLINE,
        amount=amount,
        description=journal.description,
        source_type=CustomerCashTransaction.SOURCE_SYSTEM,
        source_reference=offer.offer_number,
        is_system_generated=True,
        linked_journal_transaction=journal,
        idempotency_key=idempotency_key or '',
        created_by=user,
    )
    offer.linked_payment = payment
    offer.linked_journal = journal
    offer.payment_recorded_at = timezone.now()
    offer.payment_recorded_by = user
    offer.status = SupplyOffer.STATUS_COMPLETED
    offer.save(update_fields=['linked_payment', 'linked_journal', 'payment_recorded_at', 'payment_recorded_by', 'status', 'updated_at'])
    add_history(offer, SupplyOffer.STATUS_RECEIVED, SupplyOffer.STATUS_COMPLETED, user, SupplyOfferStatusHistory.ACTOR_ADMIN, 'Payment recorded.')
    return payment, journal
