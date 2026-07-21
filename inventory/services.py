from decimal import Decimal, InvalidOperation

from django.core.exceptions import ValidationError
from django.db import transaction

from .models import Inventory, InventoryMovement, Product, ProductUnit, Warehouse


def parse_positive_decimal(value, field_name='quantity'):
    try:
        decimal_value = Decimal(str(value))
    except (InvalidOperation, ValueError) as exc:
        raise ValidationError({field_name: 'Enter a valid decimal value.'}) from exc
    if not decimal_value.is_finite() or decimal_value <= 0:
        raise ValidationError({field_name: 'Quantity must be greater than zero.'})
    return decimal_value


def parse_non_negative_decimal(value, field_name):
    try:
        decimal_value = Decimal(str(value or 0))
    except (InvalidOperation, ValueError) as exc:
        raise ValidationError({field_name: 'Enter a valid decimal value.'}) from exc
    if not decimal_value.is_finite() or decimal_value < 0:
        raise ValidationError({field_name: 'Value cannot be negative.'})
    return decimal_value


def validate_product_unit(product, unit):
    if product.is_deleted or not product.is_active:
        raise ValidationError({'product_id': 'Product must be active.'})
    if not ProductUnit.objects.filter(product=product, unit=unit, is_active=True).exists():
        raise ValidationError({'unit': f'{unit} is not valid for {product.name_en}.'})


def validate_warehouse_open(warehouse):
    if warehouse.is_deleted or not warehouse.is_active:
        raise ValidationError({'warehouse': 'Archived warehouses cannot receive or withdraw stock.'})


def warehouse_used_capacity(warehouse):
    return sum((item.quantity for item in warehouse.inventory_items.select_for_update()), Decimal('0.000'))


def add_stock(*, warehouse_id, product_id, quantity, unit, minimum_threshold=0, driver_name='', notes='', user):
    quantity = parse_positive_decimal(quantity)
    minimum_threshold = parse_non_negative_decimal(minimum_threshold, 'minimum_threshold')
    with transaction.atomic():
        warehouse = Warehouse.objects.select_for_update().get(id=warehouse_id)
        product = Product.objects.get(id=product_id)
        validate_warehouse_open(warehouse)
        validate_product_unit(product, unit)
        if unit != warehouse.capacity_unit:
            raise ValidationError({'unit': 'Unit must match warehouse capacity unit.'})

        inventory, _ = Inventory.objects.select_for_update().get_or_create(
            warehouse=warehouse,
            product=product,
            unit=unit,
            defaults={'quantity': Decimal('0.000'), 'minimum_threshold': minimum_threshold},
        )
        used_before = warehouse_used_capacity(warehouse)
        if used_before + quantity > warehouse.capacity:
            raise ValidationError({'quantity': 'Adding this stock would exceed warehouse capacity.'})

        quantity_before = inventory.quantity
        inventory.quantity = quantity_before + quantity
        inventory.minimum_threshold = minimum_threshold
        inventory.full_clean()
        inventory.save()

        movement = InventoryMovement.objects.create(
            warehouse=warehouse,
            product=product,
            movement_type=InventoryMovement.STOCK_IN,
            quantity=quantity,
            unit=unit,
            quantity_before=quantity_before,
            quantity_after=inventory.quantity,
            driver_name=(driver_name or '').strip(),
            notes=(notes or '').strip(),
            source_type=InventoryMovement.SOURCE_MANUAL,
            created_by=user,
        )
        return inventory, movement


def withdraw_stock(*, warehouse_id, product_id, quantity, unit, driver_name='', notes='', user, source_type=None, movement_type=None):
    if source_type == InventoryMovement.SOURCE_SHIPMENT or movement_type == InventoryMovement.SHIPMENT_OUT:
        raise ValidationError({'source_type': 'Manual withdrawal cannot be used for shipment deductions.'})
    if not (notes or '').strip():
        raise ValidationError({'notes': 'Notes are required for manual withdrawal.'})
    quantity = parse_positive_decimal(quantity)
    with transaction.atomic():
        warehouse = Warehouse.objects.select_for_update().get(id=warehouse_id)
        product = Product.objects.get(id=product_id)
        validate_warehouse_open(warehouse)
        try:
            inventory = Inventory.objects.select_for_update().get(warehouse=warehouse, product=product, unit=unit)
        except Inventory.DoesNotExist as exc:
            raise ValidationError({'product_id': 'Product does not exist in this warehouse.'}) from exc
        if inventory.quantity < quantity:
            raise ValidationError({'quantity': 'Insufficient stock.'})

        quantity_before = inventory.quantity
        inventory.quantity = quantity_before - quantity
        inventory.full_clean()
        inventory.save()

        movement = InventoryMovement.objects.create(
            warehouse=warehouse,
            product=product,
            movement_type=InventoryMovement.MANUAL_WITHDRAWAL,
            quantity=quantity,
            unit=unit,
            quantity_before=quantity_before,
            quantity_after=inventory.quantity,
            driver_name=(driver_name or '').strip(),
            notes=notes.strip(),
            source_type=InventoryMovement.SOURCE_MANUAL,
            created_by=user,
        )
        return inventory, movement


def deduct_completed_shipment_stock(*, warehouse_id, product_id, quantity, unit, shipment_reference, user, is_completed=False):
    if not is_completed:
        raise ValidationError({'shipment': 'Inventory can only be deducted after shipment completion.'})
    quantity = parse_positive_decimal(quantity)
    with transaction.atomic():
        warehouse = Warehouse.objects.select_for_update().get(id=warehouse_id)
        product = Product.objects.get(id=product_id)
        validate_warehouse_open(warehouse)
        inventory = Inventory.objects.select_for_update().get(warehouse=warehouse, product=product, unit=unit)
        if inventory.quantity < quantity:
            raise ValidationError({'quantity': 'Insufficient stock.'})
        quantity_before = inventory.quantity
        inventory.quantity = quantity_before - quantity
        inventory.full_clean()
        inventory.save()
        return InventoryMovement.objects.create(
            warehouse=warehouse,
            product=product,
            movement_type=InventoryMovement.SHIPMENT_OUT,
            quantity=quantity,
            unit=unit,
            quantity_before=quantity_before,
            quantity_after=inventory.quantity,
            source_type=InventoryMovement.SOURCE_SHIPMENT,
            source_reference=shipment_reference,
            created_by=user,
        )
