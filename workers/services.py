from decimal import Decimal, InvalidOperation

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from daily_journal.models import JournalTransaction
from inventory.models import Warehouse

from .models import Worker, WorkerWorkRecord


def parse_decimal(value, field_name, *, places='0.01', required=True):
    if value in (None, ''):
        if required:
            raise ValidationError({field_name: 'This field is required.'})
        return None
    try:
        decimal_value = Decimal(str(value)).quantize(Decimal(places))
    except (InvalidOperation, ValueError) as exc:
        raise ValidationError({field_name: 'Enter a valid decimal value.'}) from exc
    if not decimal_value.is_finite() or decimal_value <= 0:
        raise ValidationError({field_name: 'Value must be greater than zero.'})
    return decimal_value


def money(value):
    return f'{(value or Decimal("0.00")):.2f}'


def calculate_total_wage(worker, calculation_method, daily_wage=None, number_of_bags=None, price_per_bag=None):
    errors = {}
    daily = parse_decimal(daily_wage, 'daily_wage', required=False)
    bags = parse_decimal(number_of_bags, 'number_of_bags', places='0.001', required=False)
    price = parse_decimal(price_per_bag, 'price_per_bag', required=False)

    if worker.worker_type == Worker.TYPE_GENERAL and calculation_method != WorkerWorkRecord.METHOD_DAILY:
        errors['calculation_method'] = 'General Worker accepts Daily Wage only.'
    if worker.worker_type == Worker.TYPE_BAG and calculation_method != WorkerWorkRecord.METHOD_BAG:
        errors['calculation_method'] = 'Bag Carrying Worker accepts Bag Based only.'
    if calculation_method not in dict(WorkerWorkRecord.CALCULATION_METHOD_CHOICES):
        errors['calculation_method'] = 'Choose a valid calculation method.'

    if calculation_method == WorkerWorkRecord.METHOD_DAILY:
        if daily is None:
            errors['daily_wage'] = 'Daily wage is required.'
        if bags is not None:
            errors['number_of_bags'] = 'Number of bags must be empty for daily wage.'
        if price is not None:
            errors['price_per_bag'] = 'Price per bag must be empty for daily wage.'
        total = daily
    elif calculation_method == WorkerWorkRecord.METHOD_BAG:
        if bags is None:
            errors['number_of_bags'] = 'Number of bags is required.'
        if price is None:
            errors['price_per_bag'] = 'Price per bag is required.'
        if daily is not None:
            errors['daily_wage'] = 'Daily wage must be empty for bag based work.'
        total = bags * price if bags is not None and price is not None else None
    else:
        total = None

    if errors:
        raise ValidationError(errors)
    return total.quantize(Decimal('0.01')), daily, bags, price


def validate_worker_open(worker):
    if worker.is_deleted or not worker.is_active:
        raise ValidationError({'worker': 'Archived workers cannot receive work records.'})


def validate_warehouse_open(warehouse):
    if warehouse.is_deleted or not warehouse.is_active:
        raise ValidationError({'warehouse': 'Only active warehouses may be selected.'})


def create_work_record(*, worker, user, warehouse_id, calculation_method, work_description, notes='', daily_wage=None, number_of_bags=None, price_per_bag=None):
    with transaction.atomic():
        worker = Worker.objects.select_for_update().get(pk=worker.pk)
        warehouse = Warehouse.objects.get(pk=warehouse_id)
        validate_worker_open(worker)
        validate_warehouse_open(warehouse)
        total, daily, bags, price = calculate_total_wage(worker, calculation_method, daily_wage, number_of_bags, price_per_bag)
        record = WorkerWorkRecord(
            worker=worker,
            warehouse=warehouse,
            calculation_method=calculation_method,
            daily_wage=daily,
            number_of_bags=bags,
            price_per_bag=price,
            total_wage=total,
            work_description=work_description,
            notes=notes or '',
            payment_status=WorkerWorkRecord.PAYMENT_UNPAID,
            source_type=WorkerWorkRecord.SOURCE_MANUAL,
            is_system_generated=False,
            created_by=user,
        )
        record.full_clean()
        record.save()
        record.source_reference = record.code
        record.save(update_fields=['source_reference'])
        return record


def update_work_record(*, record, user, **changes):
    if record.is_system_generated:
        raise ValidationError({'detail': 'System-generated work records cannot be edited here.'})
    if record.payment_status == WorkerWorkRecord.PAYMENT_PAID:
        allowed = {'notes'}
        disallowed = set(changes) - allowed
        if disallowed:
            raise ValidationError({field: 'Paid work records cannot edit this field.' for field in disallowed})
        record.notes = changes.get('notes', record.notes)
        record.full_clean()
        record.save(update_fields=['notes', 'updated_at'])
        return record

    warehouse_id = changes.get('warehouse_id', record.warehouse_id)
    calculation_method = changes.get('calculation_method', record.calculation_method)
    daily_wage = changes.get('daily_wage', record.daily_wage)
    number_of_bags = changes.get('number_of_bags', record.number_of_bags)
    price_per_bag = changes.get('price_per_bag', record.price_per_bag)
    with transaction.atomic():
        record = WorkerWorkRecord.objects.select_for_update().select_related('worker').get(pk=record.pk)
        warehouse = Warehouse.objects.get(pk=warehouse_id)
        validate_warehouse_open(warehouse)
        total, daily, bags, price = calculate_total_wage(record.worker, calculation_method, daily_wage, number_of_bags, price_per_bag)
        record.warehouse = warehouse
        record.calculation_method = calculation_method
        record.daily_wage = daily
        record.number_of_bags = bags
        record.price_per_bag = price
        record.total_wage = total
        record.work_description = changes.get('work_description', record.work_description)
        record.notes = changes.get('notes', record.notes)
        record.full_clean()
        record.save()
        return record


def mark_work_record_paid(*, record_id, user, payment_method):
    if payment_method not in dict(WorkerWorkRecord.PAYMENT_METHOD_CHOICES):
        raise ValidationError({'payment_method': 'Choose cash or online.'})
    with transaction.atomic():
        record = WorkerWorkRecord.objects.select_for_update().select_related('worker').get(pk=record_id, is_deleted=False)
        if record.worker.is_deleted or not record.worker.is_active:
            raise ValidationError({'worker': 'Archived worker records cannot be paid.'})
        if record.payment_status == WorkerWorkRecord.PAYMENT_PAID:
            raise ValidationError({'payment_status': 'This work record is already paid.'})
        if record.total_wage <= 0:
            raise ValidationError({'total_wage': 'Total wage must be greater than zero.'})
        journal, _ = JournalTransaction.objects.get_or_create(
            source_type=JournalTransaction.SOURCE_WORKER,
            source_reference=record.code,
            defaults={
                'journal_type': JournalTransaction.JOURNAL_CASH,
                'cash_type': JournalTransaction.CASH_EXPENSE,
                'payment_method': payment_method,
                'amount': record.total_wage,
                'party': record.worker.name,
                'description': f'Worker payment for {record.code}',
                'is_system_generated': True,
                'created_by': user,
            },
        )
        record.payment_status = WorkerWorkRecord.PAYMENT_PAID
        record.payment_method = payment_method
        record.paid_at = timezone.now()
        record.paid_by = user
        record.linked_journal_transaction = journal
        record.full_clean()
        record.save(update_fields=['payment_status', 'payment_method', 'paid_at', 'paid_by', 'linked_journal_transaction', 'updated_at'])
        return record


def soft_delete_work_record(*, record, user):
    if record.payment_status == WorkerWorkRecord.PAYMENT_PAID:
        raise ValidationError({'detail': 'Paid work records cannot be deleted.'})
    if record.is_system_generated:
        raise ValidationError({'detail': 'System-generated work records cannot be deleted here.'})
    if record.is_deleted:
        raise ValidationError({'detail': 'Work record is already deleted.'})
    record.is_deleted = True
    record.deleted_by = user
    record.deleted_at = timezone.now()
    record.save(update_fields=['is_deleted', 'deleted_by', 'deleted_at', 'updated_at'])


def work_totals(records):
    paid = records.filter(payment_status=WorkerWorkRecord.PAYMENT_PAID).aggregate(total=Sum('total_wage'))['total'] or Decimal('0.00')
    unpaid = records.filter(payment_status=WorkerWorkRecord.PAYMENT_UNPAID).aggregate(total=Sum('total_wage'))['total'] or Decimal('0.00')
    return paid, unpaid
