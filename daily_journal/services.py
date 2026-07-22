import hashlib
import json
from decimal import Decimal, InvalidOperation

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from accounts.models import UserProfile
from inventory.models import Inventory, InventoryMovement, Product, Warehouse
from inventory.services import add_stock, withdraw_stock

from .models import JournalTransaction


def parse_decimal(value, field_name, places='0.001', allow_zero=False):
    if value in (None, ''):
        raise ValidationError({field_name: 'This field is required.'})
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


def user_role(user):
    return getattr(getattr(user, 'profile', None), 'role', UserProfile.ROLE_ADMIN)


def quantity(value):
    return f'{(value or Decimal("0.000")):.3f}'


def money(value):
    return f'{(value or Decimal("0.00")):.2f}'


def warehouse_summary(warehouse):
    warehouse.refresh_from_db()
    return {
        'used_capacity': quantity(warehouse.used_capacity),
        'available_capacity': quantity(warehouse.available_capacity),
        'usage_percent': f'{warehouse.usage_percent:.2f}',
        'status': warehouse.status,
    }


def operation_hash(*, warehouse_id, product_id, unit, quantity_value, warehouse_operation, party, estimated_value, description, driver_name, minimum_threshold):
    payload = {
        'warehouse_id': warehouse_id,
        'product_id': product_id,
        'unit': unit,
        'quantity': quantity(quantity_value),
        'warehouse_operation': warehouse_operation,
        'party': (party or '').strip(),
        'estimated_value': money(estimated_value),
        'description': (description or '').strip(),
        'driver_name': (driver_name or '').strip(),
        'minimum_threshold': quantity(minimum_threshold or Decimal('0.000')),
    }
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode('utf-8')).hexdigest()


def journal_reference(journal):
    return f'JRN-COM-{timezone.localdate().year}-{journal.id:06d}'


def validate_common(*, warehouse_operation, party, description):
    if warehouse_operation not in dict(JournalTransaction.WAREHOUSE_OPERATION_CHOICES):
        raise ValidationError({'warehouse_operation': 'Choose Add Stock or Manual Withdrawal.'})
    if not (party or '').strip():
        raise ValidationError({'party': 'Party is required.'})
    if not (description or '').strip():
        raise ValidationError({'description': 'Description is required.'})


def record_warehouse_commodity_transaction(
    *,
    warehouse,
    product,
    unit,
    quantity,
    warehouse_operation,
    party,
    estimated_value,
    description,
    user,
    minimum_threshold=None,
    driver_name='',
    idempotency_key='',
):
    validate_common(warehouse_operation=warehouse_operation, party=party, description=description)
    quantity_value = parse_decimal(quantity, 'quantity')
    estimated = parse_decimal(estimated_value, 'estimated_value', places='0.01', allow_zero=True)
    threshold = parse_decimal(minimum_threshold or '0', 'minimum_threshold', allow_zero=True)
    idempotency_key = (idempotency_key or '').strip()
    idem_hash = operation_hash(
        warehouse_id=warehouse.id,
        product_id=product.id,
        unit=unit,
        quantity_value=quantity_value,
        warehouse_operation=warehouse_operation,
        party=party,
        estimated_value=estimated,
        description=description,
        driver_name=driver_name,
        minimum_threshold=threshold,
    )

    with transaction.atomic():
        if idempotency_key:
            existing = JournalTransaction.objects.select_related('linked_inventory_movement', 'warehouse').filter(created_by=user, idempotency_key=idempotency_key).first()
            if existing:
                if existing.idempotency_hash != idem_hash:
                    raise ValidationError({'idempotency_key': 'This idempotency key was already used with different data.'})
                movement = existing.linked_inventory_movement
                inventory = None
                if movement:
                    inventory = Inventory.objects.get(
                        warehouse=movement.warehouse,
                        product=movement.product,
                        unit=movement.unit,
                    )
                return existing, movement, inventory

        if warehouse_operation == JournalTransaction.WAREHOUSE_STOCK_IN:
            inventory, movement = add_stock(
                warehouse_id=warehouse.id,
                product_id=product.id,
                quantity=quantity_value,
                unit=unit,
                minimum_threshold=threshold,
                driver_name=driver_name,
                notes=description,
                user=user,
                source_type=InventoryMovement.SOURCE_DAILY_JOURNAL,
            )
        else:
            inventory, movement = withdraw_stock(
                warehouse_id=warehouse.id,
                product_id=product.id,
                quantity=quantity_value,
                unit=unit,
                driver_name=driver_name,
                notes=description,
                user=user,
                source_type=InventoryMovement.SOURCE_DAILY_JOURNAL,
            )

        journal = JournalTransaction.objects.create(
            journal_type=JournalTransaction.JOURNAL_COMMODITY,
            party=(party or '').strip(),
            description=(description or '').strip(),
            source_type=JournalTransaction.SOURCE_WAREHOUSE,
            is_system_generated=True,
            linked_inventory_movement=movement,
            warehouse_operation=warehouse_operation,
            warehouse=warehouse,
            idempotency_key=idempotency_key,
            idempotency_hash=idem_hash if idempotency_key else '',
            product_name=product.name_en,
            quantity=quantity_value,
            unit=unit,
            estimated_value=estimated,
            created_by=user,
        )
        journal.source_reference = journal_reference(journal)
        journal.full_clean()
        journal.save(update_fields=['source_reference'])
        movement.source_reference = journal.source_reference
        movement.save(update_fields=['source_reference'])
        return journal, movement, inventory


def reverse_warehouse_commodity_transaction(*, journal, user, reason):
    if user_role(user) != UserProfile.ROLE_ADMIN:
        raise PermissionError('Only admin users can reverse warehouse journal transactions.')
    reason = (reason or '').strip()
    if not reason:
        raise ValidationError({'reason': 'Reversal reason is required.'})
    if journal.is_reversed:
        raise ValidationError({'detail': 'Transaction has already been reversed.'})
    if not journal.linked_inventory_movement_id or not journal.warehouse_operation:
        raise ValidationError({'detail': 'Only warehouse-linked commodity transactions can be reversed here.'})

    with transaction.atomic():
        journal = JournalTransaction.objects.select_for_update().select_related('linked_inventory_movement', 'warehouse').get(pk=journal.pk)
        movement = journal.linked_inventory_movement
        if journal.warehouse_operation == JournalTransaction.WAREHOUSE_STOCK_IN:
            inventory, reversal_movement = withdraw_stock(
                warehouse_id=movement.warehouse_id,
                product_id=movement.product_id,
                quantity=movement.quantity,
                unit=movement.unit,
                notes=f'Reversal of {journal.source_reference}: {reason}',
                user=user,
                source_type=InventoryMovement.SOURCE_DAILY_JOURNAL,
            )
            reversal_operation = JournalTransaction.WAREHOUSE_MANUAL_WITHDRAWAL
        else:
            current_inventory = Inventory.objects.filter(
                warehouse_id=movement.warehouse_id,
                product_id=movement.product_id,
                unit=movement.unit,
            ).first()
            inventory, reversal_movement = add_stock(
                warehouse_id=movement.warehouse_id,
                product_id=movement.product_id,
                quantity=movement.quantity,
                unit=movement.unit,
                minimum_threshold=current_inventory.minimum_threshold if current_inventory else '0',
                notes=f'Reversal of {journal.source_reference}: {reason}',
                user=user,
                source_type=InventoryMovement.SOURCE_DAILY_JOURNAL,
            )
            reversal_operation = JournalTransaction.WAREHOUSE_STOCK_IN

        reversal = JournalTransaction.objects.create(
            journal_type=JournalTransaction.JOURNAL_COMMODITY,
            party=journal.party,
            description=f'Reversal of {journal.source_reference}: {reason}',
            source_type=JournalTransaction.SOURCE_WAREHOUSE,
            is_system_generated=True,
            linked_inventory_movement=reversal_movement,
            warehouse_operation=reversal_operation,
            warehouse=journal.warehouse,
            product_name=journal.product_name,
            quantity=journal.quantity,
            unit=journal.unit,
            estimated_value=journal.estimated_value,
            created_by=user,
            reversal_transaction=journal,
        )
        reversal.source_reference = f'{journal.source_reference}-REV'
        reversal.full_clean()
        reversal.save(update_fields=['source_reference'])
        reversal_movement.source_reference = reversal.source_reference
        reversal_movement.save(update_fields=['source_reference'])
        journal.is_reversed = True
        journal.reversed_at = timezone.now()
        journal.reversed_by = user
        journal.reversal_reason = reason
        journal.reversal_transaction = reversal
        journal.save(update_fields=['is_reversed', 'reversed_at', 'reversed_by', 'reversal_reason', 'reversal_transaction'])
        return reversal, reversal_movement, inventory
