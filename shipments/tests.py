from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import UserProfile
from customers.models import Customer
from inventory.models import Inventory, InventoryMovement, Product, Warehouse
from invoices.models import Invoice
from invoices.services import create_invoice_from_order, mark_invoice_paid
from orders.models import Order
from orders.services import create_order

from .models import Shipment
from .services import create_shipment_from_paid_invoice


class ShipmentAPITests(APITestCase):
    url = '/api/shipments/'

    def setUp(self):
        User = get_user_model()
        self.admin = User.objects.create_user(username='shipment-admin', password='pass12345')
        self.manager = User.objects.create_user(username='shipment-manager', password='pass12345')
        UserProfile.objects.create(user=self.admin, role=UserProfile.ROLE_ADMIN)
        UserProfile.objects.create(user=self.manager, role=UserProfile.ROLE_MANAGER)
        self.customer = Customer.objects.create(name='Shipment Customer', phone='+249333333333', address='Sudan', customer_type=Customer.TYPE_FARMER, created_by=self.admin)
        self.white = Product.objects.get(name_en='White Sesame')
        self.unit = self.white.units.get(unit='Qintar')
        self.unit.selling_price = Decimal('100.00')
        self.unit.save()
        self.warehouse = Warehouse.objects.create(warehouse_name='Shipment Stock', location='Sudan', primary_product=self.white, capacity='1000.000', capacity_unit='Qintar', manager_name='M', guard_name='G', created_by=self.admin)
        Inventory.objects.create(warehouse=self.warehouse, product=self.white, unit='Qintar', quantity='100.000', minimum_threshold='5.000')
        self.order = create_order(user=self.admin, customer_id=self.customer.id, discount_amount='0', items=[{'product_id': self.white.id, 'product_unit_id': self.unit.id, 'quantity': '10.000'}])
        self.invoice = create_invoice_from_order(self.order, self.admin)
        mark_invoice_paid(self.invoice, self.admin, 'cash')
        self.shipment = Shipment.objects.get(invoice=self.invoice)

    def auth_admin(self):
        self.client.force_authenticate(self.admin)

    def auth_manager(self):
        self.client.force_authenticate(self.manager)

    def processing_payload(self, shipment=None, warehouse=None, quantity='10.000'):
        shipment = shipment or self.shipment
        item = shipment.items.first()
        return {
            'driver_name': 'Driver One',
            'vehicle_number': 'TRK-1',
            'items': [
                {
                    'id': item.id,
                    'warehouse_id': (warehouse or self.warehouse).id,
                    'actual_quantity': quantity,
                    'number_of_bags': 5,
                    'total_weight_kg': '500.000',
                    'average_bag_weight_kg': '999.000',
                },
            ],
        }

    def test_unauthenticated_shipment_request_returns_401(self):
        self.client.force_authenticate(user=None)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_shipment_created_for_paid_invoice_with_matching_items(self):
        self.assertEqual(self.shipment.status, Shipment.STATUS_READY)
        self.assertEqual(self.shipment.items.count(), self.invoice.items.count())
        item = self.shipment.items.get()
        self.assertEqual(item.requested_quantity, Decimal('10.000'))
        self.assertEqual(item.unit_snapshot, 'Qintar')

    def test_create_shipment_requires_paid_invoice(self):
        second_order = create_order(user=self.admin, customer_id=self.customer.id, discount_amount='0', items=[{'product_id': self.white.id, 'product_unit_id': self.unit.id, 'quantity': '1.000'}])
        unpaid = create_invoice_from_order(second_order, self.admin)
        with self.assertRaises(Exception):
            create_shipment_from_paid_invoice(unpaid, self.admin)

    def test_start_processing_validates_driver_items_warehouse_and_stock(self):
        self.auth_admin()
        no_driver = self.client.post(f'{self.url}{self.shipment.id}/start-processing/', {**self.processing_payload(), 'driver_name': ''}, format='json')
        self.assertEqual(no_driver.status_code, status.HTTP_400_BAD_REQUEST)
        inactive = Warehouse.objects.create(warehouse_name='Inactive', location='Sudan', primary_product=self.white, capacity='10.000', capacity_unit='Qintar', manager_name='M', guard_name='G', is_active=False, created_by=self.admin)
        bad_wh = self.client.post(f'{self.url}{self.shipment.id}/start-processing/', self.processing_payload(warehouse=inactive), format='json')
        self.assertEqual(bad_wh.status_code, status.HTTP_400_BAD_REQUEST)
        insufficient = self.client.post(f'{self.url}{self.shipment.id}/start-processing/', self.processing_payload(quantity='20.000'), format='json')
        self.assertEqual(insufficient.status_code, status.HTTP_400_BAD_REQUEST)

    def test_processing_does_not_deduct_inventory_or_create_movement_and_updates_order(self):
        self.auth_admin()
        response = self.client.post(f'{self.url}{self.shipment.id}/start-processing/', self.processing_payload(), format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(Inventory.objects.get(warehouse=self.warehouse).quantity, Decimal('100.000'))
        self.assertEqual(InventoryMovement.objects.count(), 0)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, Order.STATUS_PROCESSING)
        average = self.shipment.items.get().average_bag_weight_kg
        self.assertEqual(average, Decimal('100.000'))

    def test_partial_actual_quantity_is_rejected(self):
        self.auth_admin()
        response = self.client.post(f'{self.url}{self.shipment.id}/start-processing/', self.processing_payload(quantity='5.000'), format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_completion_deducts_inventory_once_and_creates_movement(self):
        self.auth_admin()
        self.client.post(f'{self.url}{self.shipment.id}/start-processing/', self.processing_payload(), format='json')
        response = self.client.post(f'{self.url}{self.shipment.id}/complete/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(Inventory.objects.get(warehouse=self.warehouse).quantity, Decimal('90.000'))
        movement = InventoryMovement.objects.get()
        self.assertEqual(movement.quantity_before, Decimal('100.000'))
        self.assertEqual(movement.quantity_after, Decimal('90.000'))
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, Order.STATUS_COMPLETED)
        again = self.client.post(f'{self.url}{self.shipment.id}/complete/', {}, format='json')
        self.assertEqual(again.status_code, status.HTTP_400_BAD_REQUEST)

    def test_completion_is_atomic_when_stock_changes(self):
        self.auth_admin()
        self.client.post(f'{self.url}{self.shipment.id}/start-processing/', self.processing_payload(), format='json')
        with patch('shipments.services.InventoryMovement.objects.create', side_effect=RuntimeError('boom')):
            with self.assertRaises(RuntimeError):
                self.client.post(f'{self.url}{self.shipment.id}/complete/', {}, format='json')
        self.assertEqual(Inventory.objects.get(warehouse=self.warehouse).quantity, Decimal('100.000'))

    def test_cancellation_rules(self):
        self.auth_manager()
        denied = self.client.post(f'{self.url}{self.shipment.id}/cancel/', {'reason': 'No'}, format='json')
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)
        self.auth_admin()
        missing = self.client.post(f'{self.url}{self.shipment.id}/cancel/', {'reason': ''}, format='json')
        self.assertEqual(missing.status_code, status.HTTP_400_BAD_REQUEST)
        ok = self.client.post(f'{self.url}{self.shipment.id}/cancel/', {'reason': 'Customer changed plan'}, format='json')
        self.assertEqual(ok.status_code, status.HTTP_200_OK, ok.data)
        self.assertEqual(Inventory.objects.get(warehouse=self.warehouse).quantity, Decimal('100.000'))
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, Order.STATUS_READY_FOR_SHIPMENT)

    def test_completed_shipment_cannot_be_cancelled_and_units_are_not_combined(self):
        self.auth_admin()
        self.client.post(f'{self.url}{self.shipment.id}/start-processing/', self.processing_payload(), format='json')
        self.client.post(f'{self.url}{self.shipment.id}/complete/', {}, format='json')
        cancel = self.client.post(f'{self.url}{self.shipment.id}/cancel/', {'reason': 'No'}, format='json')
        self.assertEqual(cancel.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Inventory.objects.filter(product=self.white, unit='KG').exists())
