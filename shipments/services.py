from decimal import Decimal, ROUND_HALF_UP

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from accounts.models import UserProfile
from daily_journal.models import JournalTransaction
from inventory.models import Inventory, InventoryMovement, Warehouse
from orders.models import Order

from .models import Shipment, ShipmentItem


def user_role(user):
    return getattr(getattr(user, 'profile', None), 'role', UserProfile.ROLE_ADMIN)


def quantity(value, field, allow_null=False):
    if value in (None, ''):
        if allow_null:
            return None
        raise ValidationError({field: 'This field is required.'})
    value = Decimal(str(value))
    if not value.is_finite() or value <= 0:
        raise ValidationError({field: 'Value must be greater than zero.'})
    return value.quantize(Decimal('0.001'), rounding=ROUND_HALF_UP)


def user_name(user):
    if not user:
        return ''
    return user.get_full_name() or user.username or user.email


def shipment_item_description(shipment, item):
    return (
        f'Shipment {shipment.shipment_number} completed for Invoice {shipment.invoice.invoice_number}: '
        f'{item.actual_quantity} {item.unit_snapshot} of {item.product.name_en} withdrawn from {item.warehouse.warehouse_name} '
        f'for {shipment.customer.name}.'
    )


def create_shipment_commodity_journal(shipment, item, movement, user):
    existing = getattr(movement, 'journal_transaction', None)
    if existing:
        return existing
    return JournalTransaction.objects.create(
        journal_type=JournalTransaction.JOURNAL_COMMODITY,
        party=shipment.customer.name,
        description=shipment_item_description(shipment, item),
        source_type=JournalTransaction.SOURCE_SHIPMENT,
        source_reference=f'{shipment.shipment_number}-{item.id}',
        is_system_generated=True,
        linked_inventory_movement=movement,
        warehouse_operation=JournalTransaction.WAREHOUSE_SHIPMENT_OUT,
        warehouse=item.warehouse,
        product_name=item.product.name_en,
        quantity=item.actual_quantity,
        unit=item.unit_snapshot,
        estimated_value=item.invoice_item.line_total if item.invoice_item_id else Decimal('0.00'),
        created_by=user,
    )


@transaction.atomic
def create_shipment_from_paid_invoice(invoice, user):
    invoice.refresh_from_db()
    order = Order.objects.select_for_update().get(id=invoice.order_id)
    if invoice.payment_status != 'paid' or invoice.status != 'paid':
        raise ValidationError({'invoice': 'Shipment requires a paid invoice.'})
    if order.status != Order.STATUS_READY_FOR_SHIPMENT:
        raise ValidationError({'order': 'Order must be ready for shipment.'})
    shipment = Shipment.objects.filter(invoice=invoice).exclude(status=Shipment.STATUS_CANCELLED).first()
    if shipment:
        return shipment
    shipment = Shipment.objects.create(order=order, invoice=invoice, customer=invoice.customer, created_by=user)
    ShipmentItem.objects.bulk_create([
        ShipmentItem(
            shipment=shipment,
            invoice_item=item,
            order_item=item.order_item,
            product=item.product,
            product_unit=item.product_unit,
            product_code_snapshot=item.product_code_snapshot,
            product_name_en_snapshot=item.product_name_en_snapshot,
            product_name_ar_snapshot=item.product_name_ar_snapshot,
            unit_snapshot=item.unit_snapshot,
            requested_quantity=item.quantity,
        )
        for item in invoice.items.select_related('product', 'product_unit', 'order_item')
    ])
    return shipment


@transaction.atomic
def start_shipment_processing(shipment, user, driver_name, vehicle_number='', notes='', items=None):
    shipment = Shipment.objects.select_for_update().get(id=shipment.id)
    if shipment.status != Shipment.STATUS_READY:
        raise ValidationError({'status': 'Only ready shipments can start processing.'})
    driver_name = (driver_name or '').strip()
    if not driver_name:
        raise ValidationError({'driver_name': 'Driver name is required.'})
    item_payloads = {str(row.get('id')): row for row in (items or [])}
    shipment_items = list(shipment.items.select_for_update().select_related('product', 'product_unit'))
    if len(item_payloads) != len(shipment_items):
        raise ValidationError({'items': 'Every shipment item must be prepared.'})
    for item in shipment_items:
        row = item_payloads.get(str(item.id))
        if not row:
            raise ValidationError({'items': 'Every shipment item must be prepared.'})
        try:
            warehouse = Warehouse.objects.get(id=row.get('warehouse_id'), is_active=True, is_deleted=False)
        except Warehouse.DoesNotExist as exc:
            raise ValidationError({'warehouse_id': 'Warehouse must be active.'}) from exc
        actual = quantity(row.get('actual_quantity'), 'actual_quantity')
        if actual != item.requested_quantity:
            raise ValidationError({'actual_quantity': 'Partial shipment completion is not supported.'})
        stock = Inventory.objects.filter(warehouse=warehouse, product=item.product, unit=item.unit_snapshot).first()
        if not stock or stock.quantity < actual:
            raise ValidationError({'stock': 'Insufficient stock.'})
        raw_bags = row.get('number_of_bags')
        bags = None
        if raw_bags not in (None, ''):
            bags = int(raw_bags)
            if bags <= 0:
                raise ValidationError({'number_of_bags': 'Number of bags must be greater than zero.'})
        total_weight = quantity(row.get('total_weight_kg'), 'total_weight_kg', allow_null=True)
        average = (total_weight / Decimal(bags)).quantize(Decimal('0.001')) if bags and total_weight else None
        item.warehouse = warehouse
        item.actual_quantity = actual
        item.number_of_bags = bags
        item.total_weight_kg = total_weight
        item.average_bag_weight_kg = average
        item.notes = (row.get('notes') or '').strip()
        item.save()
    shipment.status = Shipment.STATUS_PROCESSING
    shipment.driver_name = driver_name
    shipment.vehicle_number = (vehicle_number or '').strip()
    shipment.notes = (notes or shipment.notes or '').strip()
    shipment.started_by = user
    shipment.started_at = timezone.now()
    shipment.save()
    shipment.order.status = Order.STATUS_PROCESSING
    shipment.order.updated_by = user
    shipment.order.save(update_fields=['status', 'updated_by', 'updated_at'])
    return shipment


@transaction.atomic
def complete_shipment(shipment, user):
    shipment = Shipment.objects.select_for_update().get(id=shipment.id)
    if shipment.status != Shipment.STATUS_PROCESSING:
        raise ValidationError({'status': 'Only processing shipments can be completed.'})
    for item in shipment.items.select_for_update().select_related('warehouse', 'product'):
        if not item.warehouse_id or not item.actual_quantity:
            raise ValidationError({'items': 'All shipment items must be prepared before completion.'})
        stock = Inventory.objects.select_for_update().filter(warehouse=item.warehouse, product=item.product, unit=item.unit_snapshot).first()
        if not stock or stock.quantity < item.actual_quantity:
            raise ValidationError({'stock': 'Insufficient stock.'})
    for item in shipment.items.select_related('warehouse', 'product'):
        stock = Inventory.objects.select_for_update().get(warehouse=item.warehouse, product=item.product, unit=item.unit_snapshot)
        before = stock.quantity
        after = before - item.actual_quantity
        stock.quantity = after
        stock.save(update_fields=['quantity', 'updated_at'])
        movement = InventoryMovement.objects.create(
            warehouse=item.warehouse,
            product=item.product,
            movement_type=InventoryMovement.SHIPMENT_OUT,
            quantity=item.actual_quantity,
            unit=item.unit_snapshot,
            quantity_before=before,
            quantity_after=after,
            driver_name=shipment.driver_name,
            notes=f'Shipment completed {shipment.shipment_number}',
            source_type=InventoryMovement.SOURCE_SHIPMENT,
            source_reference=shipment.shipment_number,
            created_by=user,
        )
        create_shipment_commodity_journal(shipment, item, movement, user)
    shipment.status = Shipment.STATUS_COMPLETED
    shipment.completed_by = user
    shipment.completed_at = timezone.now()
    shipment.save(update_fields=['status', 'completed_by', 'completed_at', 'updated_at'])
    shipment.order.status = Order.STATUS_COMPLETED
    shipment.order.updated_by = user
    shipment.order.save(update_fields=['status', 'updated_by', 'updated_at'])
    return shipment


@transaction.atomic
def cancel_shipment(shipment, user, reason):
    if user_role(user) != UserProfile.ROLE_ADMIN:
        raise PermissionError('Only admin users can cancel shipments.')
    shipment = Shipment.objects.select_for_update().get(id=shipment.id)
    reason = (reason or '').strip()
    if not reason:
        raise ValidationError({'reason': 'Cancellation reason is required.'})
    if shipment.status == Shipment.STATUS_COMPLETED:
        raise ValidationError({'status': 'Completed shipments cannot be cancelled.'})
    shipment.status = Shipment.STATUS_CANCELLED
    shipment.cancelled_by = user
    shipment.cancelled_at = timezone.now()
    shipment.cancellation_reason = reason
    shipment.save(update_fields=['status', 'cancelled_by', 'cancelled_at', 'cancellation_reason', 'updated_at'])
    shipment.order.status = Order.STATUS_READY_FOR_SHIPMENT
    shipment.order.updated_by = user
    shipment.order.save(update_fields=['status', 'updated_by', 'updated_at'])
    return shipment
