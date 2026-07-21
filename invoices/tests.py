from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import UserProfile
from customers.models import Customer, CustomerCashTransaction
from daily_journal.models import JournalTransaction
from inventory.models import Inventory, InventoryMovement, Product, Warehouse
from orders.models import Order
from orders.services import create_order
from shipments.models import Shipment

from .models import Invoice, InvoiceItem, InvoicePayment


class InvoiceAPITests(APITestCase):
    url = '/api/invoices/'

    def setUp(self):
        User = get_user_model()
        self.admin = User.objects.create_user(username='invoice-admin', password='pass12345')
        self.manager = User.objects.create_user(username='invoice-manager', password='pass12345')
        UserProfile.objects.create(user=self.admin, role=UserProfile.ROLE_ADMIN)
        UserProfile.objects.create(user=self.manager, role=UserProfile.ROLE_MANAGER)
        self.customer = Customer.objects.create(name='Invoice Customer', phone='+249222222222', address='Sudan', customer_type=Customer.TYPE_FARMER, created_by=self.admin)
        self.white = Product.objects.get(name_en='White Sesame')
        self.unit = self.white.units.get(unit='Qintar')
        self.unit.selling_price = Decimal('100.00')
        self.unit.save()
        self.order = create_order(
            user=self.admin,
            customer_id=self.customer.id,
            discount_amount='10.00',
            items=[{'product_id': self.white.id, 'product_unit_id': self.unit.id, 'quantity': '2.000'}],
        )

    def auth_admin(self):
        self.client.force_authenticate(self.admin)

    def auth_manager(self):
        self.client.force_authenticate(self.manager)

    def create_invoice(self, user='admin', order=None):
        self.auth_admin() if user == 'admin' else self.auth_manager()
        response = self.client.post(f'{self.url}from-order/{(order or self.order).id}/', {'notes': 'Invoice note'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        return response

    def test_unauthenticated_invoice_request_returns_401(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_admin_and_manager_can_create_invoice_from_received_order(self):
        response = self.create_invoice()
        self.assertRegex(response.data['invoice_number'], r'^INV-\d{4}-\d{6}$')
        self.assertEqual(response.data['status'], Invoice.STATUS_ISSUED)
        self.assertEqual(response.data['payment_status'], Invoice.PAYMENT_UNPAID)
        second_order = create_order(user=self.admin, customer_id=self.customer.id, discount_amount='0', items=[{'product_id': self.white.id, 'product_unit_id': self.unit.id, 'quantity': '1.000'}])
        manager_response = self.create_invoice(user='manager', order=second_order)
        self.assertEqual(manager_response.status_code, status.HTTP_201_CREATED)

    def test_invoice_creation_validates_order_state_and_duplicates(self):
        pending = Order.objects.create(customer=self.customer, status=Order.STATUS_PENDING, source_channel=Order.SOURCE_CUSTOMER_APP, subtotal='10.00', total_amount='10.00', created_by=self.admin)
        self.auth_admin()
        pending_response = self.client.post(f'{self.url}from-order/{pending.id}/', {}, format='json')
        self.assertEqual(pending_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.create_invoice()
        duplicate = self.client.post(f'{self.url}from-order/{self.order.id}/', {}, format='json')
        self.assertEqual(duplicate.status_code, status.HTTP_400_BAD_REQUEST)

    def test_invoice_items_snapshots_totals_and_customer_charge_are_created(self):
        response = self.create_invoice()
        invoice = Invoice.objects.get(id=response.data['id'])
        self.assertEqual(invoice.items.count(), self.order.items.count())
        item = invoice.items.get()
        self.assertEqual(item.product_name_en_snapshot, 'White Sesame')
        self.assertEqual(invoice.subtotal, self.order.subtotal)
        self.assertEqual(invoice.discount_amount, self.order.discount_amount)
        self.assertEqual(invoice.total_amount, self.order.total_amount)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, Order.STATUS_INVOICED)
        self.assertTrue(CustomerCashTransaction.objects.filter(transaction_type=CustomerCashTransaction.INVOICE_CHARGE, source_reference=invoice.invoice_number, is_system_generated=True).exists())
        self.assertEqual(JournalTransaction.objects.count(), 0)
        self.assertEqual(Shipment.objects.count(), 0)

    def test_invoice_creation_does_not_change_inventory_or_movements(self):
        warehouse = Warehouse.objects.create(warehouse_name='Invoice Stock', location='Sudan', primary_product=self.white, capacity='100.000', capacity_unit='Qintar', manager_name='M', guard_name='G', created_by=self.admin)
        Inventory.objects.create(warehouse=warehouse, product=self.white, unit='Qintar', quantity='50.000', minimum_threshold='5.000')
        self.create_invoice()
        self.assertEqual(Inventory.objects.get(warehouse=warehouse).quantity, Decimal('50.000'))
        self.assertEqual(InventoryMovement.objects.count(), 0)

    def test_invoice_creation_is_atomic(self):
        self.auth_admin()
        with patch('invoices.services.InvoiceItem.objects.bulk_create', side_effect=RuntimeError('boom')):
            with self.assertRaises(RuntimeError):
                self.client.post(f'{self.url}from-order/{self.order.id}/', {}, format='json')
        self.assertEqual(Invoice.objects.count(), 0)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, Order.STATUS_RECEIVED)

    def test_mark_paid_cash_and_online_workflow(self):
        response = self.create_invoice()
        invoice_id = response.data['id']
        self.auth_admin()
        paid = self.client.post(f'{self.url}{invoice_id}/mark-paid/', {'payment_method': 'cash'}, format='json')
        self.assertEqual(paid.status_code, status.HTTP_200_OK, paid.data)
        invoice = Invoice.objects.get(id=invoice_id)
        self.assertEqual(invoice.status, Invoice.STATUS_PAID)
        self.assertEqual(invoice.payment_status, Invoice.PAYMENT_PAID)
        self.assertTrue(InvoicePayment.objects.filter(invoice=invoice, amount=invoice.total_amount).exists())
        self.assertTrue(CustomerCashTransaction.objects.filter(transaction_type=CustomerCashTransaction.PAYMENT_RECEIVED, source_reference=invoice.invoice_number).exists())
        self.assertTrue(JournalTransaction.objects.filter(cash_type=JournalTransaction.CASH_INCOME, source_reference=invoice.invoice_number).exists())
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, Order.STATUS_READY_FOR_SHIPMENT)
        self.assertTrue(Shipment.objects.filter(invoice=invoice, status='ready_for_shipment').exists())
        twice = self.client.post(f'{self.url}{invoice_id}/mark-paid/', {'payment_method': 'cash'}, format='json')
        self.assertEqual(twice.status_code, status.HTTP_400_BAD_REQUEST)

        second_order = create_order(user=self.admin, customer_id=self.customer.id, discount_amount='0', items=[{'product_id': self.white.id, 'product_unit_id': self.unit.id, 'quantity': '1.000'}])
        second = self.create_invoice(order=second_order)
        online = self.client.post(f'{self.url}{second.data["id"]}/mark-paid/', {'payment_method': 'online', 'payment_reference': 'ONLINE-1'}, format='json')
        self.assertEqual(online.status_code, status.HTTP_200_OK, online.data)

    def test_invalid_payment_and_atomic_failure(self):
        response = self.create_invoice()
        self.auth_admin()
        invalid = self.client.post(f'{self.url}{response.data["id"]}/mark-paid/', {'payment_method': 'cheque'}, format='json')
        self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST)
        with patch('invoices.services.JournalTransaction.objects.create', side_effect=RuntimeError('journal down')):
            with self.assertRaises(RuntimeError):
                self.client.post(f'{self.url}{response.data["id"]}/mark-paid/', {'payment_method': 'cash'}, format='json')
        invoice = Invoice.objects.get(id=response.data['id'])
        self.assertEqual(invoice.payment_status, Invoice.PAYMENT_UNPAID)
        self.assertEqual(InvoicePayment.objects.count(), 0)
        self.assertEqual(Shipment.objects.count(), 0)

    def test_invoice_cancellation_rules(self):
        response = self.create_invoice()
        invoice_id = response.data['id']
        self.auth_manager()
        denied = self.client.post(f'{self.url}{invoice_id}/cancel/', {'reason': 'Wrong'}, format='json')
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)
        self.auth_admin()
        missing = self.client.post(f'{self.url}{invoice_id}/cancel/', {'reason': ''}, format='json')
        self.assertEqual(missing.status_code, status.HTTP_400_BAD_REQUEST)
        cancelled = self.client.post(f'{self.url}{invoice_id}/cancel/', {'reason': 'Wrong data'}, format='json')
        self.assertEqual(cancelled.status_code, status.HTTP_200_OK, cancelled.data)
        invoice = Invoice.objects.get(id=invoice_id)
        self.assertEqual(invoice.status, Invoice.STATUS_CANCELLED)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, Order.STATUS_RECEIVED)
        self.assertTrue(CustomerCashTransaction.objects.filter(transaction_type=CustomerCashTransaction.ADJUSTMENT_CREDIT, source_reference=f'{invoice.invoice_number}-CANCEL').exists())
        self.assertEqual(JournalTransaction.objects.count(), 0)

    def test_paid_invoice_cannot_be_cancelled_or_deleted(self):
        response = self.create_invoice()
        self.auth_admin()
        self.client.post(f'{self.url}{response.data["id"]}/mark-paid/', {'payment_method': 'cash'}, format='json')
        cancel = self.client.post(f'{self.url}{response.data["id"]}/cancel/', {'reason': 'No'}, format='json')
        delete = self.client.delete(f'{self.url}{response.data["id"]}/')
        self.assertEqual(cancel.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(delete.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
