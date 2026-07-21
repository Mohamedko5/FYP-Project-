from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import UserProfile
from customers.models import Customer
from daily_journal.models import JournalTransaction
from inventory.models import Inventory, Product, Warehouse
from invoices.services import create_invoice_from_order, mark_invoice_paid
from orders.models import Order
from orders.services import create_order
from workers.models import Worker, WorkerWorkRecord


class ReportAPITests(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.admin = User.objects.create_user(username='report-admin', password='pass12345')
        UserProfile.objects.create(user=self.admin, role=UserProfile.ROLE_ADMIN)
        self.client.force_authenticate(self.admin)
        self.customer = Customer.objects.create(name='Report Customer', phone='+249444444444', address='Sudan', customer_type=Customer.TYPE_FARMER, created_by=self.admin)
        self.white = Product.objects.get(name_en='White Sesame')
        self.unit = self.white.units.get(unit='Qintar')
        self.unit.selling_price = Decimal('100.00')
        self.unit.save()
        self.warehouse = Warehouse.objects.create(warehouse_name='Report Warehouse', location='Sudan', primary_product=self.white, capacity='1000.000', capacity_unit='Qintar', manager_name='M', guard_name='G', created_by=self.admin)
        Inventory.objects.create(warehouse=self.warehouse, product=self.white, unit='Qintar', quantity='100.000', minimum_threshold='5.000')
        self.order = create_order(user=self.admin, customer_id=self.customer.id, discount_amount='0', items=[{'product_id': self.white.id, 'product_unit_id': self.unit.id, 'quantity': '10.000'}])
        self.invoice = create_invoice_from_order(self.order, self.admin)
        mark_invoice_paid(self.invoice, self.admin, 'cash')
        self.shipment = self.invoice.shipments.get()
        item = self.shipment.items.get()
        self.client.post(f'/api/shipments/{self.shipment.id}/start-processing/', {'driver_name': 'Driver', 'items': [{'id': item.id, 'warehouse_id': self.warehouse.id, 'actual_quantity': '10.000'}]}, format='json')
        self.client.post(f'/api/shipments/{self.shipment.id}/complete/', {}, format='json')
        self.worker = Worker.objects.create(name='Report Worker', phone='+249555555555', worker_type=Worker.TYPE_GENERAL, assigned_work='Loading', created_by=self.admin)
        WorkerWorkRecord.objects.create(worker=self.worker, warehouse=self.warehouse, calculation_method=WorkerWorkRecord.METHOD_DAILY, daily_wage='100.00', total_wage='100.00', work_description='Work', payment_status=WorkerWorkRecord.PAYMENT_UNPAID, created_by=self.admin)

    def test_unauthenticated_report_request_returns_401(self):
        self.client.force_authenticate(user=None)
        response = self.client.get('/api/reports/options/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_invalid_date_range_returns_400(self):
        response = self.client.get('/api/reports/daily-journal/', {'date_from': '2026-07-22', 'date_to': '2026-07-21'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_daily_journal_income_and_payment_method_filter(self):
        response = self.client.get('/api/reports/daily-journal/', {'payment_method': 'cash'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['summary']['total_income'], '1000.00')
        self.assertEqual(response.data['summary']['cash_total'], '1000.00')

    def test_inventory_report_uses_real_stock_and_units(self):
        response = self.client.get('/api/reports/inventory/', {'product': self.white.id})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        groups = response.data['summary']['groups']
        self.assertIn({'product_id': self.white.id, 'product_name': 'White Sesame', 'unit': 'Qintar', 'quantity': '90.000'}, groups)

    def test_customer_accounts_report_balances_and_soft_delete_exclusion(self):
        archived = Customer.objects.create(name='Archived', phone='+249666666666', address='Sudan', customer_type=Customer.TYPE_FARMER, is_active=False, is_deleted=True, created_by=self.admin)
        response = self.client.get('/api/reports/customer-accounts/')
        names = [row['customer_name'] for row in response.data['results']]
        self.assertIn(self.customer.name, names)
        self.assertNotIn(archived.name, names)
        self.assertEqual(response.data['results'][0]['cash_status'], 'Balanced')

    def test_workers_report_totals(self):
        response = self.client.get('/api/reports/workers/')
        row = response.data['results'][0]
        self.assertEqual(row['unpaid_wages'], '100.00')
        self.assertEqual(row['total_work_records'], 1)

    def test_orders_invoices_shipments_reports(self):
        orders = self.client.get('/api/reports/orders/')
        invoices = self.client.get('/api/reports/invoices/')
        shipments = self.client.get('/api/reports/shipments/', {'shipment_status': 'completed'})
        self.assertEqual(orders.data['results'][0]['status'], Order.STATUS_COMPLETED)
        self.assertEqual(invoices.data['summary']['total_paid_value'], '1000.00')
        self.assertEqual(shipments.data['results'][0]['status'], 'completed')
        self.assertEqual(shipments.data['summary']['completed_item_groups'][0]['unit'], 'Qintar')

    def test_financial_summary_does_not_double_count_invoice_payment(self):
        response = self.client.get('/api/reports/financial-summary/')
        self.assertEqual(response.data['summary']['cash']['income'], '1000.00')
        self.assertEqual(response.data['summary']['invoices']['paid_value'], '1000.00')
