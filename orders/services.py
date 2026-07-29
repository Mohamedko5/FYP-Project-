from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from accounts.models import UserProfile
from customers.models import Customer
from inventory.models import Inventory, Product, ProductUnit

from .models import Order, OrderItem


MONEY_QUANT = Decimal('0.01')
QTY_QUANT = Decimal('0.001')


def user_role(user):
    return getattr(getattr(user, 'profile', None), 'role', UserProfile.ROLE_ADMIN)


def decimal_value(value, field, places, required=True, allow_zero=True):
    if value in (None, ''):
        if required:
            raise ValidationError({field: 'This field is required.'})
        return None
    try:
        parsed = Decimal(str(value))
    except (InvalidOperation, ValueError) as exc:
        raise ValidationError({field: 'Enter a valid decimal value.'}) from exc
    if not parsed.is_finite():
        raise ValidationError({field: 'Enter a finite decimal value.'})
    if parsed < 0 or (parsed == 0 and not allow_zero):
        raise ValidationError({field: 'Value must be greater than zero.' if not allow_zero else 'Value cannot be negative.'})
    return parsed.quantize(places, rounding=ROUND_HALF_UP)


def money(value):
    return f'{(value or Decimal("0.00")):.2f}'


def quantity(value):
    return f'{(value or Decimal("0.000")):.3f}'


def stock_availability(product, unit, ordered_quantity):
    available = Inventory.objects.filter(
        warehouse__is_active=True,
        warehouse__is_deleted=False,
        product=product,
        unit=unit,
    ).aggregate(total=Sum('quantity'))['total'] or Decimal('0.000')
    shortage = max(Decimal('0.000'), ordered_quantity - available)
    sufficient = shortage == 0
    return {
        'available_quantity': quantity(available),
        'ordered_quantity': quantity(ordered_quantity),
        'shortage_quantity': quantity(shortage),
        'is_stock_sufficient': sufficient,
        'availability_status': 'Stock Sufficient' if sufficient else 'Stock Shortage',
    }


def validate_customer(customer_id):
    try:
        customer = Customer.objects.get(id=customer_id)
    except Customer.DoesNotExist as exc:
        raise ValidationError({'customer': 'Customer was not found.'}) from exc
    if customer.is_deleted or not customer.is_active:
        raise ValidationError({'customer': 'Customer must be active.'})
    return customer


def validate_item_payload(row, user, existing_item=None):
    errors = {}
    product_id = row.get('product') or row.get('product_id')
    unit_id = row.get('product_unit') or row.get('product_unit_id')
    if isinstance(product_id, Product):
        product_id = product_id.id
    if isinstance(unit_id, ProductUnit):
        unit_id = unit_id.id
    try:
        product = Product.objects.get(id=product_id)
    except (Product.DoesNotExist, TypeError, ValueError):
        raise ValidationError({'product_id': 'Product was not found.'})
    if product.is_deleted or not product.is_active:
        errors['product_id'] = 'Product must be active.'

    try:
        product_unit = ProductUnit.objects.get(id=unit_id)
    except (ProductUnit.DoesNotExist, TypeError, ValueError):
        raise ValidationError({'product_unit_id': 'Product unit was not found.'})
    if product_unit.product_id != product.id:
        errors['product_unit_id'] = 'Unit must belong to the selected product.'
    if not product_unit.is_active:
        errors['product_unit_id'] = 'Product unit must be active.'

    quantity_value = decimal_value(row.get('quantity'), 'quantity', QTY_QUANT, allow_zero=False)
    if row.get('unit_price') in (None, ''):
        unit_price = product_unit.selling_price
    else:
        unit_price = decimal_value(row.get('unit_price'), 'unit_price', MONEY_QUANT, allow_zero=True)

    minimum = product_unit.minimum_selling_price
    reason = (row.get('price_override_reason') or '').strip()
    if not reason and existing_item is not None:
        reason = existing_item.price_override_reason or ''
    if minimum is not None and unit_price < minimum:
        if user_role(user) != UserProfile.ROLE_ADMIN:
            errors['unit_price'] = 'Manager cannot sell below minimum selling price.'
        elif not reason:
            errors['price_override_reason'] = 'Price override reason is required.'

    notes = (row.get('notes') or '').strip()
    if not notes and existing_item is not None:
        notes = existing_item.notes or ''
    if errors:
        raise ValidationError(errors)

    line_total = (quantity_value * unit_price).quantize(MONEY_QUANT, rounding=ROUND_HALF_UP)
    return {
        'product': product,
        'product_unit': product_unit,
        'product_code_snapshot': product.code,
        'product_name_en_snapshot': product.name_en,
        'product_name_ar_snapshot': product.name_ar,
        'unit_snapshot': product_unit.unit,
        'quantity': quantity_value,
        'unit_price': unit_price,
        'line_total': line_total,
        'price_override_reason': reason,
        'notes': notes,
    }


def validate_items(items, user, existing_items=None):
    if not items:
        raise ValidationError({'items': 'At least one item is required.'})
    def key_value(value):
        if isinstance(value, (Product, ProductUnit)):
            return value.id
        try:
            return int(value)
        except (TypeError, ValueError):
            return value

    existing_by_key = {
        (item.product_id, item.product_unit_id): item
        for item in existing_items or []
    }
    seen = set()
    cleaned = []
    for index, row in enumerate(items):
        product_id = row.get('product') or row.get('product_id')
        unit_id = row.get('product_unit') or row.get('product_unit_id')
        product_id = key_value(product_id)
        unit_id = key_value(unit_id)
        existing_item = existing_by_key.get((product_id, unit_id))
        item = validate_item_payload(row, user, existing_item=existing_item)
        key = (item['product'].id, item['product_unit'].id)
        if key in seen:
            raise ValidationError({'items': f'Duplicate product and unit line at item {index + 1}.'})
        seen.add(key)
        cleaned.append(item)
    return cleaned


def calculate_totals(items, discount_amount):
    subtotal = sum((item['line_total'] for item in items), Decimal('0.00')).quantize(MONEY_QUANT)
    discount = decimal_value(discount_amount or '0', 'discount_amount', MONEY_QUANT, required=False, allow_zero=True) or Decimal('0.00')
    if discount > subtotal:
        raise ValidationError({'discount_amount': 'Discount cannot exceed subtotal.'})
    total = (subtotal - discount).quantize(MONEY_QUANT)
    if total < 0:
        raise ValidationError({'total_amount': 'Total amount cannot be negative.'})
    return subtotal, discount, total


@transaction.atomic
def create_order(*, user, customer_id, items, discount_amount='0', customer_reference='', customer_notes='', internal_notes=''):
    customer = validate_customer(customer_id)
    cleaned_items = validate_items(items, user)
    subtotal, discount, total = calculate_totals(cleaned_items, discount_amount)
    order = Order(
        customer=customer,
        status=Order.STATUS_RECEIVED,
        source_channel=Order.SOURCE_ADMIN,
        customer_reference=(customer_reference or '').strip(),
        customer_notes=(customer_notes or '').strip(),
        internal_notes=(internal_notes or '').strip(),
        subtotal=subtotal,
        discount_amount=discount,
        total_amount=total,
        currency='SDG',
        received_by=user,
        received_at=timezone.now(),
        created_by=user,
    )
    order.full_clean()
    order.save()
    OrderItem.objects.bulk_create([OrderItem(order=order, **item) for item in cleaned_items])
    return order


@transaction.atomic
def update_order(*, order, user, customer_id=None, items=None, discount_amount=None, customer_reference=None, customer_notes=None, internal_notes=None):
    if not order.can_edit:
        raise ValidationError({'status': 'Only pending or received orders can be edited.'})
    if customer_id is not None:
        order.customer = validate_customer(customer_id)
    if customer_reference is not None:
        order.customer_reference = (customer_reference or '').strip()
    if customer_notes is not None:
        order.customer_notes = (customer_notes or '').strip()
    if internal_notes is not None:
        order.internal_notes = (internal_notes or '').strip()
    existing_items = list(order.items.all())
    cleaned_items = validate_items(items, user, existing_items=existing_items) if items is not None else [
        {
            'line_total': item.line_total,
            'product': item.product,
            'product_unit': item.product_unit,
        }
        for item in existing_items
    ]
    subtotal, discount, total = calculate_totals(cleaned_items, order.discount_amount if discount_amount is None else discount_amount)
    order.subtotal = subtotal
    order.discount_amount = discount
    order.total_amount = total
    order.updated_by = user
    order.full_clean()
    order.save()
    if items is not None:
        order.items.all().delete()
        OrderItem.objects.bulk_create([OrderItem(order=order, **item) for item in cleaned_items])
    return order


def mark_order_received(order, user):
    if order.status != Order.STATUS_PENDING:
        raise ValidationError({'status': 'Only pending orders can be received.'})
    order.status = Order.STATUS_RECEIVED
    order.received_by = user
    order.received_at = timezone.now()
    order.updated_by = user
    order.full_clean()
    order.save()
    return order


def mark_order_invoiced(order, invoice, user):
    if order.status != Order.STATUS_RECEIVED:
        raise ValidationError({'status': 'Only received orders can be invoiced.'})
    order.status = Order.STATUS_INVOICED
    order.updated_by = user
    order.save(update_fields=['status', 'updated_by', 'updated_at'])
    return order


def mark_order_ready_for_shipment(order, invoice, user):
    if order.status != Order.STATUS_INVOICED:
        raise ValidationError({'status': 'Only invoiced orders can become ready for shipment.'})
    order.status = Order.STATUS_READY_FOR_SHIPMENT
    order.updated_by = user
    order.save(update_fields=['status', 'updated_by', 'updated_at'])
    return order


def mark_order_processing(order, shipment, user):
    if order.status != Order.STATUS_READY_FOR_SHIPMENT:
        raise ValidationError({'status': 'Only ready orders can be processed.'})
    order.status = Order.STATUS_PROCESSING
    order.updated_by = user
    order.save(update_fields=['status', 'updated_by', 'updated_at'])
    return order


def mark_order_completed(order, shipment, user):
    if order.status != Order.STATUS_PROCESSING:
        raise ValidationError({'status': 'Only processing orders can be completed.'})
    order.status = Order.STATUS_COMPLETED
    order.updated_by = user
    order.save(update_fields=['status', 'updated_by', 'updated_at'])
    return order


def cancel_order(order, reason, user):
    reason = (reason or '').strip()
    if user_role(user) != UserProfile.ROLE_ADMIN:
        raise PermissionError('Only admin users can cancel orders.')
    if not reason:
        raise ValidationError({'reason': 'Cancellation reason is required.'})
    if order.status not in {Order.STATUS_PENDING, Order.STATUS_RECEIVED}:
        raise ValidationError({'status': 'Only pending or received orders can be cancelled.'})
    order.status = Order.STATUS_CANCELLED
    order.cancelled_by = user
    order.cancelled_at = timezone.now()
    order.cancellation_reason = reason
    order.updated_by = user
    order.full_clean()
    order.save()
    return order
