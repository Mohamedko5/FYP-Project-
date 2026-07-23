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

from .models import OfferPayment, OfferResponse, OfferResponseItem, SupplyOffer, SupplyOfferStatusHistory


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


def _response_allowed_statuses():
    return {
        SupplyOffer.STATUS_SUBMITTED,
        SupplyOffer.STATUS_UNDER_REVIEW,
        SupplyOffer.STATUS_COUNTER_OFFERED,
        SupplyOffer.STATUS_CUSTOMER_DECLINED,
    }


@transaction.atomic
def respond_to_offer(*, offer, items, user, customer_safe_message='', proposed_receipt_date=None, proposed_receiving_warehouse=None, expires_at=None, response_notes='', idempotency_key=''):
    offer = SupplyOffer.objects.select_for_update().get(pk=offer.pk)
    if offer.status not in _response_allowed_statuses():
        raise ValidationError({'status': 'This offer cannot receive a new response.'})
    if idempotency_key:
        existing = offer.responses.filter(idempotency_key=idempotency_key).first()
        if existing:
            return existing

    offer_items = {item.id: item for item in offer.items.all()}
    if not items:
        raise ValidationError({'items': 'At least one response item is required.'})

    response_rows = []
    proposed_total = Decimal('0.00')
    for row in items:
        try:
            offer_item_id = int(row.get('offer_item_id') or 0)
        except (TypeError, ValueError) as exc:
            raise ValidationError({'items': 'Offer item was not found.'}) from exc
        offer_item = offer_items.get(offer_item_id)
        if not offer_item:
            raise ValidationError({'items': 'Offer item was not found.'})
        quantity = parse_decimal(row.get('admin_proposed_quantity') or offer_item.quantity, 'admin_proposed_quantity', '0.001')
        price = parse_decimal(row.get('admin_proposed_unit_price'), 'admin_proposed_unit_price', '0.01')
        if quantity > offer_item.quantity:
            raise ValidationError({'admin_proposed_quantity': 'Admin proposed quantity cannot exceed customer quantity.'})
        line_total = (quantity * price).quantize(Decimal('0.01'))
        proposed_total += line_total
        response_rows.append((offer_item, quantity, price, line_total, (row.get('admin_note') or '').strip()))

    current = offer.responses.filter(is_current=True).first()
    if current:
        current.status = OfferResponse.STATUS_SUPERSEDED
        current.is_current = False
        current.save(update_fields=['status', 'is_current', 'updated_at'])

    response = OfferResponse.objects.create(
        offer=offer,
        status=OfferResponse.STATUS_PENDING_CUSTOMER,
        customer_safe_message=(customer_safe_message or '').strip(),
        proposed_receipt_date=proposed_receipt_date,
        proposed_receiving_warehouse=proposed_receiving_warehouse,
        expires_at=expires_at,
        created_by=user,
        idempotency_key=idempotency_key or '',
        proposed_total=proposed_total,
    )
    for offer_item, quantity, price, line_total, note in response_rows:
        OfferResponseItem.objects.create(
            response=response,
            offer_item=offer_item,
            admin_proposed_quantity=quantity,
            admin_proposed_unit_price=price,
            admin_proposed_line_total=line_total,
            admin_note=note,
        )
        offer_item.admin_proposed_unit_price = price
        offer_item.save(update_fields=['admin_proposed_unit_price', 'updated_at'])

    offer.admin_proposed_total = proposed_total
    previous = offer.status
    offer.status = SupplyOffer.STATUS_COUNTER_OFFERED
    offer.customer_safe_admin_message = response.customer_safe_message
    offer.latest_response_at = response.created_at
    if proposed_receiving_warehouse:
        offer.receiving_warehouse = proposed_receiving_warehouse
    offer.save(update_fields=['status', 'admin_proposed_total', 'customer_safe_admin_message', 'latest_response_at', 'receiving_warehouse', 'updated_at'])
    add_history(offer, previous, offer.status, user, SupplyOfferStatusHistory.ACTOR_ADMIN, response.customer_safe_message, response_notes)
    create_offer_card_message(offer, user, f'Offer response sent: {offer.offer_number}')
    return response


def _current_response_for_customer(offer, response_id):
    response = offer.responses.prefetch_related('items__offer_item').filter(pk=response_id, is_current=True).first()
    if not response:
        raise ValidationError({'response': 'Current response was not found.'})
    if response.status != OfferResponse.STATUS_PENDING_CUSTOMER:
        raise ValidationError({'response': 'This response is no longer available.'})
    if response.expires_at and timezone.now() > response.expires_at:
        response.status = OfferResponse.STATUS_EXPIRED
        response.is_current = False
        response.save(update_fields=['status', 'is_current', 'updated_at'])
        raise ValidationError({'response': 'This response has expired.'})
    return response


@transaction.atomic
def accept_offer_response(*, offer, response_id, user):
    offer = SupplyOffer.objects.select_for_update().get(pk=offer.pk)
    response = _current_response_for_customer(offer, response_id)
    agreed_total = Decimal('0.00')
    for response_item in response.items.select_related('offer_item'):
        item = response_item.offer_item
        item.accepted_quantity = response_item.admin_proposed_quantity
        item.agreed_unit_price = response_item.admin_proposed_unit_price
        item.agreed_line_total = response_item.admin_proposed_line_total
        item.save(update_fields=['accepted_quantity', 'agreed_unit_price', 'agreed_line_total', 'updated_at'])
        agreed_total += response_item.admin_proposed_line_total
    response.status = OfferResponse.STATUS_ACCEPTED_BY_CUSTOMER
    response.customer_responded_at = timezone.now()
    response.customer_read_at = response.customer_read_at or timezone.now()
    response.save(update_fields=['status', 'customer_responded_at', 'customer_read_at', 'updated_at'])
    offer.agreed_total = agreed_total
    previous = offer.status
    offer.status = SupplyOffer.STATUS_CUSTOMER_ACCEPTED
    offer.save(update_fields=['agreed_total', 'status', 'updated_at'])
    add_history(offer, previous, offer.status, user, SupplyOfferStatusHistory.ACTOR_CUSTOMER, 'Customer accepted the admin offer.')
    create_offer_card_message(offer, user, f'Offer accepted by customer: {offer.offer_number}')
    return response


@transaction.atomic
def reject_offer_response(*, offer, response_id, user, reason):
    offer = SupplyOffer.objects.select_for_update().get(pk=offer.pk)
    response = _current_response_for_customer(offer, response_id)
    response.status = OfferResponse.STATUS_REJECTED_BY_CUSTOMER
    response.customer_responded_at = timezone.now()
    response.customer_rejection_reason = (reason or '').strip()
    response.customer_read_at = response.customer_read_at or timezone.now()
    response.is_current = False
    response.save(update_fields=['status', 'customer_responded_at', 'customer_rejection_reason', 'customer_read_at', 'is_current', 'updated_at'])
    previous = offer.status
    offer.status = SupplyOffer.STATUS_CUSTOMER_DECLINED
    offer.rejection_reason = response.customer_rejection_reason
    offer.save(update_fields=['status', 'rejection_reason', 'updated_at'])
    add_history(offer, previous, offer.status, user, SupplyOfferStatusHistory.ACTOR_CUSTOMER, 'Customer rejected the admin offer.')
    create_offer_card_message(offer, user, f'Offer rejected by customer: {offer.offer_number}')
    return response


@transaction.atomic
def final_approve_offer(*, offer, user, customer_safe_message='', receiving_warehouse=None):
    if offer.status != SupplyOffer.STATUS_CUSTOMER_ACCEPTED:
        raise ValidationError({'status': 'Final approval requires customer acceptance.'})
    current = offer.responses.filter(is_current=True, status=OfferResponse.STATUS_ACCEPTED_BY_CUSTOMER).first()
    if current:
        current.status = OfferResponse.STATUS_FINAL_APPROVED
        current.save(update_fields=['status', 'updated_at'])
    if receiving_warehouse:
        offer.receiving_warehouse = receiving_warehouse
    offer.recalculate_totals()
    previous = offer.status
    offer.status = SupplyOffer.STATUS_APPROVED
    offer.approved_at = timezone.now()
    offer.approved_by = user
    offer.save(update_fields=['status', 'approved_at', 'approved_by', 'receiving_warehouse', 'agreed_total', 'updated_at'])
    add_history(offer, previous, offer.status, user, SupplyOfferStatusHistory.ACTOR_ADMIN, customer_safe_message or 'Offer final approved.')
    create_offer_card_message(offer, user, f'Offer final approved: {offer.offer_number}')
    return offer


@transaction.atomic
def record_offer_payment(*, offer, amount, payment_method, user, payment_date=None, transaction_reference='', electronic_reference='', paying_bank='', card_last_four='', payment_receipt=None, description='', idempotency_key=''):
    if offer.status not in {SupplyOffer.STATUS_APPROVED, SupplyOffer.STATUS_AWAITING_RECEIPT, SupplyOffer.STATUS_RECEIVED}:
        raise ValidationError({'status': 'Payment can be recorded only after final approval.'})
    if idempotency_key:
        existing = offer.offer_payments.filter(idempotency_key=idempotency_key).first()
        if existing:
            return existing
    if offer.offer_payments.filter(is_reversed=False).exists():
        raise ValidationError({'detail': 'Payment has already been recorded.'})
    amount = parse_decimal(amount, 'amount', '0.01')
    agreed_total = Decimal(str(offer.agreed_total or offer.proposed_total or '0')).quantize(Decimal('0.01'))
    if amount != agreed_total:
        raise ValidationError({'amount': 'Full payment amount must equal the agreed total.'})
    if payment_method not in dict(OfferPayment.METHOD_CHOICES):
        raise ValidationError({'payment_method': 'Choose a valid payment method.'})
    if card_last_four and (not str(card_last_four).isdigit() or len(str(card_last_four)) != 4):
        raise ValidationError({'card_last_four': 'Enter the last four digits only.'})
    transaction_reference = (transaction_reference or electronic_reference or '').strip()
    if payment_method in {OfferPayment.METHOD_BANK_OF_KHARTOUM, OfferPayment.METHOD_VISA, OfferPayment.METHOD_MASTERCARD}:
        if not transaction_reference:
            raise ValidationError({'transaction_reference': 'Transaction reference is required.'})
        if not payment_receipt:
            raise ValidationError({'payment_receipt': 'Payment receipt is required.'})

    offer_payment = OfferPayment.objects.create(
        offer=offer,
        customer=offer.customer,
        amount=amount,
        payment_method=payment_method,
        payment_date=payment_date or timezone.localdate(),
        transaction_reference=transaction_reference,
        paying_bank=(paying_bank or '').strip(),
        card_last_four=(card_last_four or '').strip(),
        payment_receipt=payment_receipt,
        description=(description or f'Full payment for {offer.offer_number}').strip(),
        created_by=user,
        idempotency_key=idempotency_key or '',
    )
    journal_method = JournalTransaction.PAYMENT_CASH if payment_method == OfferPayment.METHOD_CASH else JournalTransaction.PAYMENT_ELECTRONIC
    journal = JournalTransaction(
        journal_type=JournalTransaction.JOURNAL_CASH,
        cash_type=JournalTransaction.CASH_EXPENSE,
        payment_method=journal_method,
        electronic_reference='' if journal_method == JournalTransaction.PAYMENT_CASH else transaction_reference,
        payment_receipt=None if journal_method == JournalTransaction.PAYMENT_CASH else payment_receipt,
        amount=amount,
        party=offer.customer.name,
        description=offer_payment.description,
        source_type=JournalTransaction.SOURCE_OFFER_PAYMENT,
        source_reference=offer_payment.payment_number,
        is_system_generated=True,
        idempotency_key=idempotency_key or '',
        created_by=user,
    )
    journal.full_clean()
    journal.save()
    customer_payment_method = CustomerCashTransaction.PAYMENT_CASH if payment_method == OfferPayment.METHOD_CASH else CustomerCashTransaction.PAYMENT_ONLINE
    customer_transaction = CustomerCashTransaction.objects.create(
        customer=offer.customer,
        transaction_type=CustomerCashTransaction.CUSTOMER_EXPENSE,
        payment_method=customer_payment_method,
        amount=amount,
        description=offer_payment.description,
        source_type=CustomerCashTransaction.SOURCE_OFFER_PAYMENT,
        source_reference=offer_payment.payment_number,
        is_system_generated=True,
        linked_journal_transaction=journal,
        idempotency_key=idempotency_key or '',
        created_by=user,
    )
    offer_payment.linked_customer_transaction = customer_transaction
    offer_payment.linked_journal_transaction = journal
    offer_payment.status = OfferPayment.STATUS_CONFIRMED
    offer_payment.save(update_fields=['linked_customer_transaction', 'linked_journal_transaction', 'status'])
    previous = offer.status
    offer.linked_payment = customer_transaction
    offer.linked_journal = journal
    offer.payment_recorded_at = timezone.now()
    offer.payment_recorded_by = user
    offer.paid_amount = amount
    offer.payment_status = 'paid'
    offer.status = SupplyOffer.STATUS_PAID if previous != SupplyOffer.STATUS_RECEIVED else SupplyOffer.STATUS_COMPLETED
    offer.save(update_fields=['linked_payment', 'linked_journal', 'payment_recorded_at', 'payment_recorded_by', 'paid_amount', 'payment_status', 'status', 'updated_at'])
    add_history(offer, previous, offer.status, user, SupplyOfferStatusHistory.ACTOR_ADMIN, 'Payment recorded.')
    return offer_payment


@transaction.atomic
def record_receipt(*, offer, warehouse, items, user, idempotency_key=''):
    if offer.status not in {SupplyOffer.STATUS_APPROVED, SupplyOffer.STATUS_AWAITING_RECEIPT, SupplyOffer.STATUS_PAID}:
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

    previous_status = offer.status
    offer.receiving_warehouse = warehouse
    offer.receipt_recorded_at = timezone.now()
    offer.receipt_recorded_by = user
    offer.status = SupplyOffer.STATUS_RECEIVED
    offer.save(update_fields=['receiving_warehouse', 'receipt_recorded_at', 'receipt_recorded_by', 'status', 'updated_at'])
    add_history(offer, previous_status, SupplyOffer.STATUS_RECEIVED, user, SupplyOfferStatusHistory.ACTOR_ADMIN, 'Products received.')
    return movements


@transaction.atomic
def record_payment(*, offer, amount, payment_method, user, electronic_reference='', payment_receipt=None, description='', idempotency_key=''):
    method = OfferPayment.METHOD_CASH if payment_method == JournalTransaction.PAYMENT_CASH else OfferPayment.METHOD_BANK_OF_KHARTOUM
    offer_payment = record_offer_payment(
        offer=offer,
        amount=amount,
        payment_method=method,
        user=user,
        transaction_reference=electronic_reference,
        payment_receipt=payment_receipt,
        description=description,
        idempotency_key=idempotency_key,
    )
    return offer_payment.linked_customer_transaction, offer_payment.linked_journal_transaction
