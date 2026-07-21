from datetime import datetime, time
from decimal import Decimal

from django.db.models import Sum
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from customers.models import Customer
from customers.services import customer_cash_balance, customer_cash_status, customer_cash_totals, customer_commodity_balances
from daily_journal.models import JournalTransaction
from inventory.models import Inventory, Product, Warehouse
from invoices.models import Invoice, InvoicePayment
from orders.models import Order
from shipments.models import Shipment
from workers.models import Worker, WorkerWorkRecord


def money(value):
    return f'{(value or Decimal("0.00")):.2f}'


def qty(value):
    return f'{(value or Decimal("0.000")):.3f}'


def local_dt(value):
    return timezone.localtime(value).isoformat() if value else None


def parse_date(value, field):
    try:
        return datetime.strptime(value, '%Y-%m-%d').date()
    except ValueError as exc:
        raise ValidationError({field: 'Use YYYY-MM-DD format.'}) from exc


def date_bounds(params):
    start_date = parse_date(params['date'], 'date') if params.get('date') else (parse_date(params['date_from'], 'date_from') if params.get('date_from') else None)
    end_date = parse_date(params['date'], 'date') if params.get('date') else (parse_date(params['date_to'], 'date_to') if params.get('date_to') else None)
    if start_date and end_date and start_date > end_date:
        raise ValidationError({'date_from': 'date_from cannot be after date_to.'})
    tz = timezone.get_current_timezone()
    start = timezone.make_aware(datetime.combine(start_date, time.min), tz) if start_date else None
    end = timezone.make_aware(datetime.combine(end_date, time.max), tz) if end_date else None
    return start, end


def apply_created_range(queryset, params, field='created_at'):
    start, end = date_bounds(params)
    if start:
        queryset = queryset.filter(**{f'{field}__gte': start})
    if end:
        queryset = queryset.filter(**{f'{field}__lte': end})
    return queryset


def report_response(report_type, request, summary, results):
    return Response({
        'report_type': report_type,
        'generated_at': timezone.localtime(timezone.now()).isoformat(),
        'filters': dict(request.query_params),
        'summary': summary,
        'results': results,
        'pagination': {'count': len(results)},
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def options(request):
    return report_response('options', request, {}, {
        'customers': list(Customer.objects.filter(is_active=True, is_deleted=False).values('id', 'code', 'name')),
        'products': list(Product.objects.filter(is_active=True, is_deleted=False).values('id', 'code', 'name_en', 'name_ar')),
        'warehouses': list(Warehouse.objects.filter(is_active=True, is_deleted=False).values('id', 'code', 'warehouse_name')),
        'workers': list(Worker.objects.filter(is_active=True, is_deleted=False).values('id', 'code', 'name')),
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def daily_journal(request):
    rows = JournalTransaction.objects.filter(is_deleted=False, journal_type=JournalTransaction.JOURNAL_CASH)
    start, _ = date_bounds(request.query_params)
    opening_qs = rows.filter(created_at__lt=start) if start else rows.none()
    opening_income = opening_qs.filter(cash_type=JournalTransaction.CASH_INCOME).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
    opening_expenses = opening_qs.filter(cash_type=JournalTransaction.CASH_EXPENSE).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
    rows = apply_created_range(rows, request.query_params)
    if request.query_params.get('payment_method'):
        rows = rows.filter(payment_method=request.query_params['payment_method'])
    if request.query_params.get('transaction_type'):
        rows = rows.filter(cash_type=request.query_params['transaction_type'])
    income = rows.filter(cash_type=JournalTransaction.CASH_INCOME).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
    expenses = rows.filter(cash_type=JournalTransaction.CASH_EXPENSE).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
    opening = opening_income - opening_expenses
    return report_response('daily-journal', request, {
        'opening_balance': money(opening),
        'total_income': money(income),
        'total_expenses': money(expenses),
        'net_movement': money(income - expenses),
        'closing_balance': money(opening + income - expenses),
        'cash_total': money(rows.filter(payment_method=JournalTransaction.PAYMENT_CASH).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')),
        'online_total': money(rows.filter(payment_method=JournalTransaction.PAYMENT_ONLINE).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')),
    }, [
        {'id': row.id, 'date': local_dt(row.created_at), 'type': row.cash_type, 'payment_method': row.payment_method, 'party': row.party, 'amount': money(row.amount), 'description': row.description}
        for row in rows
    ])


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def inventory(request):
    rows = Inventory.objects.select_related('product', 'warehouse').filter(warehouse__is_deleted=False, product__is_deleted=False)
    if request.query_params.get('warehouse'):
        rows = rows.filter(warehouse_id=request.query_params['warehouse'])
    if request.query_params.get('product'):
        rows = rows.filter(product_id=request.query_params['product'])
    if request.query_params.get('unit'):
        rows = rows.filter(unit=request.query_params['unit'])
    results = [{
        'id': row.id,
        'product_code': row.product.code,
        'product_name': row.product.name_en,
        'warehouse_code': row.warehouse.code,
        'warehouse_name': row.warehouse.warehouse_name,
        'quantity': qty(row.quantity),
        'unit': row.unit,
        'minimum_threshold': qty(row.minimum_threshold),
        'stock_status': row.status,
        'warehouse_capacity': qty(row.warehouse.capacity),
        'warehouse_used_capacity': qty(row.warehouse.used_capacity),
        'available_capacity': qty(row.warehouse.available_capacity),
    } for row in rows]
    groups = rows.values('product_id', 'product__name_en', 'unit').annotate(quantity=Sum('quantity'))
    return report_response('inventory', request, {'groups': [{'product_id': g['product_id'], 'product_name': g['product__name_en'], 'unit': g['unit'], 'quantity': qty(g['quantity'])} for g in groups]}, results)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def customer_accounts(request):
    rows = Customer.objects.filter(is_deleted=False).prefetch_related('cash_transactions', 'commodity_transactions')
    if request.query_params.get('customer'):
        rows = rows.filter(id=request.query_params['customer'])
    results = []
    for customer in rows:
        debits, credits, payments = customer_cash_totals(customer)
        invoices = customer.invoices.exclude(status=Invoice.STATUS_CANCELLED)
        paid = invoices.filter(payment_status=Invoice.PAYMENT_PAID).aggregate(total=Sum('total_amount'))['total'] or Decimal('0.00')
        outstanding = invoices.filter(payment_status=Invoice.PAYMENT_UNPAID).aggregate(total=Sum('total_amount'))['total'] or Decimal('0.00')
        results.append({'id': customer.id, 'customer_code': customer.code, 'customer_name': customer.name, 'customer_type': customer.customer_type, 'phone': customer.phone, 'cash_balance': money(customer_cash_balance(customer)), 'cash_status': customer_cash_status(customer), 'total_debits': money(debits), 'total_credits': money(credits), 'total_payments_received': money(payments), 'commodity_balances': customer_commodity_balances(customer), 'order_count': customer.orders.count(), 'invoice_count': invoices.count(), 'paid_invoice_value': money(paid), 'outstanding_invoice_value': money(outstanding)})
    return report_response('customer-accounts', request, {'total_customers': len(results)}, results)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def workers(request):
    qs = Worker.objects.filter(is_deleted=False).prefetch_related('work_records')
    if request.query_params.get('worker'):
        qs = qs.filter(id=request.query_params['worker'])
    results = []
    for worker in qs:
        records = worker.work_records.filter(is_deleted=False)
        results.append({'id': worker.id, 'worker_code': worker.code, 'worker_name': worker.name, 'worker_type': worker.worker_type, 'status': worker.status, 'total_work_records': records.count(), 'paid_wages': money(records.filter(payment_status=WorkerWorkRecord.PAYMENT_PAID).aggregate(total=Sum('total_wage'))['total'] or Decimal('0.00')), 'unpaid_wages': money(records.filter(payment_status=WorkerWorkRecord.PAYMENT_UNPAID).aggregate(total=Sum('total_wage'))['total'] or Decimal('0.00')), 'cash_wage_payments': money(records.filter(payment_method=WorkerWorkRecord.PAYMENT_CASH).aggregate(total=Sum('total_wage'))['total'] or Decimal('0.00')), 'online_wage_payments': money(records.filter(payment_method=WorkerWorkRecord.PAYMENT_ONLINE).aggregate(total=Sum('total_wage'))['total'] or Decimal('0.00')), 'last_work_date': local_dt(worker.last_work_at)})
    return report_response('workers', request, {'total_workers': len(results)}, results)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def orders(request):
    qs = apply_created_range(Order.objects.select_related('customer').prefetch_related('items'), request.query_params)
    if request.query_params.get('order_status'):
        qs = qs.filter(status=request.query_params['order_status'])
    if request.query_params.get('customer'):
        qs = qs.filter(customer_id=request.query_params['customer'])
    results = [{'id': o.id, 'order_number': o.order_number, 'customer': o.customer.name, 'product_summary': o.items.first().product_name_en_snapshot if o.items.exists() else '', 'item_count': o.items.count(), 'subtotal': money(o.subtotal), 'discount': money(o.discount_amount), 'total': money(o.total_amount), 'status': o.status, 'created_at': local_dt(o.created_at), 'received_at': local_dt(o.received_at), 'linked_invoice': o.invoices.exclude(status=Invoice.STATUS_CANCELLED).first().invoice_number if o.invoices.exclude(status=Invoice.STATUS_CANCELLED).exists() else None, 'linked_shipment': o.shipments.exclude(status=Shipment.STATUS_CANCELLED).first().shipment_number if o.shipments.exclude(status=Shipment.STATUS_CANCELLED).exists() else None} for o in qs]
    return report_response('orders', request, {'active_value': money(qs.exclude(status=Order.STATUS_CANCELLED).aggregate(total=Sum('total_amount'))['total'] or Decimal('0.00'))}, results)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def invoices(request):
    qs = apply_created_range(Invoice.objects.select_related('order', 'customer').prefetch_related('items'), request.query_params, 'issued_at')
    if request.query_params.get('payment_status'):
        qs = qs.filter(payment_status=request.query_params['payment_status'])
    paid = qs.exclude(status=Invoice.STATUS_CANCELLED).filter(payment_status=Invoice.PAYMENT_PAID)
    unpaid = qs.exclude(status=Invoice.STATUS_CANCELLED).filter(payment_status=Invoice.PAYMENT_UNPAID)
    results = [{'id': inv.id, 'invoice_number': inv.invoice_number, 'order_number': inv.order.order_number, 'customer': inv.customer.name, 'item_count': inv.items.count(), 'total': money(inv.total_amount), 'status': inv.status, 'payment_status': inv.payment_status, 'payment_method': getattr(getattr(inv, 'payment', None), 'payment_method', ''), 'issued_at': local_dt(inv.issued_at), 'paid_at': local_dt(inv.paid_at), 'outstanding_amount': money(Decimal('0.00') if inv.payment_status == Invoice.PAYMENT_PAID or inv.status == Invoice.STATUS_CANCELLED else inv.total_amount)} for inv in qs]
    return report_response('invoices', request, {'paid_count': paid.count(), 'unpaid_count': unpaid.count(), 'cancelled_count': qs.filter(status=Invoice.STATUS_CANCELLED).count(), 'total_paid_value': money(paid.aggregate(total=Sum('total_amount'))['total'] or Decimal('0.00')), 'total_outstanding_value': money(unpaid.aggregate(total=Sum('total_amount'))['total'] or Decimal('0.00'))}, results)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def shipments(request):
    qs = apply_created_range(Shipment.objects.select_related('order', 'invoice', 'customer').prefetch_related('items__warehouse'), request.query_params)
    if request.query_params.get('shipment_status'):
        qs = qs.filter(status=request.query_params['shipment_status'])
    results = []
    for shipment in qs:
        for item in shipment.items.all():
            results.append({'id': f'{shipment.id}-{item.id}', 'shipment_number': shipment.shipment_number, 'order_number': shipment.order.order_number, 'invoice_number': shipment.invoice.invoice_number, 'customer': shipment.customer.name, 'status': shipment.status, 'driver': shipment.driver_name, 'vehicle': shipment.vehicle_number, 'product': item.product_name_en_snapshot, 'warehouse': item.warehouse.warehouse_name if item.warehouse else '', 'requested_quantity': qty(item.requested_quantity), 'actual_quantity': qty(item.actual_quantity), 'unit': item.unit_snapshot, 'number_of_bags': item.number_of_bags, 'total_weight_kg': qty(item.total_weight_kg), 'average_bag_weight_kg': qty(item.average_bag_weight_kg), 'started_at': local_dt(shipment.started_at), 'completed_at': local_dt(shipment.completed_at)})
    groups = Shipment.objects.filter(status=Shipment.STATUS_COMPLETED).values('items__product_id', 'items__product_name_en_snapshot', 'items__unit_snapshot').annotate(quantity=Sum('items__actual_quantity'))
    return report_response('shipments', request, {'completed_item_groups': [{'product_id': g['items__product_id'], 'product_name': g['items__product_name_en_snapshot'], 'unit': g['items__unit_snapshot'], 'quantity': qty(g['quantity'])} for g in groups]}, results)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def financial_summary(request):
    cash_rows = apply_created_range(JournalTransaction.objects.filter(is_deleted=False, journal_type=JournalTransaction.JOURNAL_CASH), request.query_params)
    income = cash_rows.filter(cash_type=JournalTransaction.CASH_INCOME).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
    expenses = cash_rows.filter(cash_type=JournalTransaction.CASH_EXPENSE).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
    active_invoices = Invoice.objects.exclude(status=Invoice.STATUS_CANCELLED)
    customers = Customer.objects.filter(is_deleted=False)
    balances = [customer_cash_balance(c) for c in customers]
    worker_records = WorkerWorkRecord.objects.filter(is_deleted=False)
    summary = {
        'cash': {'opening_balance': money(Decimal('0.00')), 'income': money(income), 'expenses': money(expenses), 'net': money(income - expenses), 'closing_balance': money(income - expenses), 'cash_method_total': money(cash_rows.filter(payment_method='cash').aggregate(total=Sum('amount'))['total'] or Decimal('0.00')), 'online_method_total': money(cash_rows.filter(payment_method='online').aggregate(total=Sum('amount'))['total'] or Decimal('0.00'))},
        'invoices': {'issued_value': money(active_invoices.aggregate(total=Sum('total_amount'))['total'] or Decimal('0.00')), 'paid_value': money(active_invoices.filter(payment_status=Invoice.PAYMENT_PAID).aggregate(total=Sum('total_amount'))['total'] or Decimal('0.00')), 'outstanding_value': money(active_invoices.filter(payment_status=Invoice.PAYMENT_UNPAID).aggregate(total=Sum('total_amount'))['total'] or Decimal('0.00'))},
        'customers': {'total_debt': money(sum((b for b in balances if b > 0), Decimal('0.00'))), 'total_credit': money(abs(sum((b for b in balances if b < 0), Decimal('0.00'))))},
        'workers': {'paid_wages': money(worker_records.filter(payment_status=WorkerWorkRecord.PAYMENT_PAID).aggregate(total=Sum('total_wage'))['total'] or Decimal('0.00')), 'unpaid_wages': money(worker_records.filter(payment_status=WorkerWorkRecord.PAYMENT_UNPAID).aggregate(total=Sum('total_wage'))['total'] or Decimal('0.00'))},
    }
    return report_response('financial-summary', request, summary, [])
