from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import UserProfile
from customers.models import Customer, CustomerCashTransaction
from daily_journal.models import JournalTransaction
from inventory.models import Inventory, InventoryMovement, Product, ProductUnit, Warehouse

from .models import Order, OrderItem
from .services import mark_order_invoiced


class OrderAPITests(APITestCase):
    url = '/api/orders/'

    def setUp(self):
        User = get_user_model()
        self.admin = User.objects.create_user(username='orders-admin', email='orders-admin@example.com', password='admin123')
        self.manager = User.objects.create_user(username='orders-manager', email='orders-manager@example.com', password='admin123')
        UserProfile.objects.create(user=self.admin, role=UserProfile.ROLE_ADMIN)
        UserProfile.objects.create(user=self.manager, role=UserProfile.ROLE_MANAGER)
        self.customer = Customer.objects.create(
            name='Ahmed Customer',
            phone='+249111111111',
            address='Sudan',
            customer_type=Customer.TYPE_FARMER,
            created_by=self.admin,
        )
        self.white = Product.objects.get(name_en='White Sesame')
        self.corn = Product.objects.get(name_en='Corn')
        self.plastic = Product.objects.get(name_en='Plastic')
        self.white_unit = self.white.units.get(unit='Qintar')
        self.corn_kg = self.corn.units.get(unit='KG')
        self.corn_bag = self.corn.units.get(unit='Bag')
        self.white_unit.selling_price = Decimal('100.00')
        self.white_unit.minimum_selling_price = Decimal('90.00')
        self.white_unit.save()
        self.corn_kg.selling_price = Decimal('10.00')
        self.corn_kg.save()
        self.corn_bag.selling_price = Decimal('200.00')
        self.corn_bag.save()

    def auth_admin(self):
        self.client.force_authenticate(self.admin)

    def auth_manager(self):
        self.client.force_authenticate(self.manager)

    def item(self, product=None, unit=None, **overrides):
        product = product or self.white
        unit = unit or self.white_unit
        payload = {
            'product_id': product.id,
            'product_unit_id': unit.id,
            'quantity': '2.000',
            'unit_price': '',
            'notes': '',
        }
        payload.update(overrides)
        return payload

    def payload(self, **overrides):
        data = {
            'customer_id': self.customer.id,
            'customer_reference': 'REF-1',
            'customer_notes': 'Customer note',
            'internal_notes': 'Internal note',
            'discount_amount': '10.00',
            'items': [self.item()],
        }
        data.update(overrides)
        return data

    def create_order(self, user='admin', **overrides):
        self.auth_admin() if user == 'admin' else self.auth_manager()
        response = self.client.post(self.url, self.payload(**overrides), format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        return response

    def test_unauthenticated_order_list_returns_401(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_admin_can_create_order(self):
        response = self.create_order()
        self.assertEqual(response.data['customer']['id'], self.customer.id)

    def test_manager_can_create_order(self):
        response = self.create_order(user='manager')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_order_number_status_and_audit_are_backend_controlled(self):
        self.auth_admin()
        response = self.client.post(self.url, self.payload(order_number='BAD', status='completed', created_by=999), format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertRegex(response.data['order_number'], r'^ORD-\d{4}-\d{6}$')
        self.assertEqual(response.data['status'], 'received')
        self.assertEqual(response.data['created_by'], self.admin.id)
        self.assertIsNotNone(response.data['created_at'])
        self.assertIsNotNone(response.data['received_at'])
        self.assertEqual(response.data['received_by'], self.admin.id)

    def test_archived_or_inactive_customer_is_rejected(self):
        self.customer.is_deleted = True
        self.customer.is_active = False
        self.customer.save()
        self.auth_admin()
        response = self.client.post(self.url, self.payload(), format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_order_requires_at_least_one_item(self):
        self.auth_admin()
        response = self.client.post(self.url, self.payload(items=[]), format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_order_creation_with_multiple_items_succeeds(self):
        response = self.create_order(items=[self.item(), self.item(self.corn, self.corn_kg)])
        self.assertEqual(response.data['item_count'], 2)

    def test_product_and_unit_validation_rules(self):
        self.auth_admin()
        bad_product = self.client.post(self.url, self.payload(items=[self.item(product=self.white, unit=self.corn_kg)]), format='json')
        self.assertEqual(bad_product.status_code, status.HTTP_400_BAD_REQUEST)
        archived = Product.objects.create(name_en='Archived Product', name_ar='Archived AR', category='commodity', is_active=False, is_deleted=True)
        archived_unit = ProductUnit.objects.create(product=archived, unit='KG', is_default=True)
        archived_response = self.client.post(self.url, self.payload(items=[self.item(product=archived, unit=archived_unit)]), format='json')
        self.assertEqual(archived_response.status_code, status.HTTP_400_BAD_REQUEST)
        inactive_unit = self.corn_bag
        inactive_unit.is_active = False
        inactive_unit.save()
        inactive_response = self.client.post(self.url, self.payload(items=[self.item(product=self.corn, unit=inactive_unit)]), format='json')
        self.assertEqual(inactive_response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_known_unit_rules_are_supported(self):
        self.create_order(items=[self.item(self.white, self.white_unit)])
        self.create_order(items=[self.item(self.corn, self.corn_kg)])
        self.create_order(items=[self.item(self.corn, self.corn_bag)])
        self.auth_admin()
        response = self.client.post(self.url, self.payload(items=[self.item(self.corn, self.white_unit)]), format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_quantity_and_decimal_validation(self):
        self.auth_admin()
        for value in ['0', '-1', 'NaN', 'Infinity']:
            response = self.client.post(self.url, self.payload(items=[self.item(quantity=value)]), format='json')
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_backend_calculates_totals_and_ignores_frontend_line_total(self):
        self.auth_admin()
        response = self.client.post(self.url, self.payload(items=[self.item(quantity='3.000', unit_price='100.00', line_total='1.00')]), format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data['items'][0]['line_total'], '300.00')
        self.assertEqual(response.data['subtotal'], '300.00')
        self.assertEqual(response.data['discount_amount'], '10.00')
        self.assertEqual(response.data['total_amount'], '290.00')

    def test_discount_greater_than_subtotal_is_rejected(self):
        self.auth_admin()
        response = self.client.post(self.url, self.payload(discount_amount='999.00'), format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_duplicate_product_unit_lines_are_rejected(self):
        self.auth_admin()
        response = self.client.post(self.url, self.payload(items=[self.item(), self.item()]), format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_price_snapshot_survives_later_product_price_change(self):
        response = self.create_order(items=[self.item(unit_price='110.00')])
        item_id = response.data['items'][0]['id']
        self.white_unit.selling_price = Decimal('999.00')
        self.white_unit.save()
        self.auth_admin()
        detail = self.client.get(f'{self.url}{response.data["id"]}/')
        self.assertEqual(next(row for row in detail.data['items'] if row['id'] == item_id)['unit_price'], '110.00')

    def test_minimum_price_permissions(self):
        self.auth_manager()
        manager_response = self.client.post(self.url, self.payload(items=[self.item(unit_price='80.00')]), format='json')
        self.assertEqual(manager_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.auth_admin()
        admin_missing_reason = self.client.post(self.url, self.payload(items=[self.item(unit_price='80.00')]), format='json')
        self.assertEqual(admin_missing_reason.status_code, status.HTTP_400_BAD_REQUEST)
        admin_ok = self.client.post(self.url, self.payload(items=[self.item(unit_price='80.00', price_override_reason='Approved discount')]), format='json')
        self.assertEqual(admin_ok.status_code, status.HTTP_201_CREATED, admin_ok.data)

    def test_failed_item_validation_rolls_back_complete_order(self):
        self.auth_admin()
        self.client.post(self.url, self.payload(items=[self.item(), self.item(product=self.white, unit=self.corn_kg)]), format='json')
        self.assertEqual(Order.objects.count(), 0)

    def test_order_creation_does_not_touch_inventory_financial_or_journal_records(self):
        warehouse = Warehouse.objects.create(warehouse_name='Order Store', location='Sudan', primary_product=self.white, capacity='100.000', capacity_unit='Qintar', manager_name='Manager', guard_name='Guard', created_by=self.admin)
        Inventory.objects.create(warehouse=warehouse, product=self.white, unit='Qintar', quantity='80.000', minimum_threshold='10.000')
        self.create_order()
        self.assertEqual(Inventory.objects.get(warehouse=warehouse).quantity, Decimal('80.000'))
        self.assertEqual(InventoryMovement.objects.count(), 0)
        self.assertEqual(JournalTransaction.objects.count(), 0)
        self.assertEqual(CustomerCashTransaction.objects.count(), 0)

    def test_stock_availability_uses_matching_product_and_unit_without_deduction(self):
        wh1 = Warehouse.objects.create(warehouse_name='KG Store', location='A', primary_product=self.corn, capacity='1000.000', capacity_unit='KG', manager_name='Manager', guard_name='Guard', created_by=self.admin)
        wh2 = Warehouse.objects.create(warehouse_name='Bag Store', location='B', primary_product=self.corn, capacity='1000.000', capacity_unit='Bag', manager_name='Manager', guard_name='Guard', created_by=self.admin)
        Inventory.objects.create(warehouse=wh1, product=self.corn, unit='KG', quantity='60.000', minimum_threshold='10.000')
        Inventory.objects.create(warehouse=wh2, product=self.corn, unit='Bag', quantity='60.000', minimum_threshold='10.000')
        response = self.create_order(items=[self.item(self.corn, self.corn_bag, quantity='100.000')], discount_amount='0')
        availability = response.data['items'][0]['availability']
        self.assertFalse(availability['is_stock_sufficient'])
        self.assertEqual(availability['available_quantity'], '60.000')
        self.assertEqual(availability['shortage_quantity'], '40.000')
        self.assertEqual(Inventory.objects.get(warehouse=wh2).quantity, Decimal('60.000'))

    def test_pending_order_can_be_marked_received_once(self):
        order = Order.objects.create(customer=self.customer, status=Order.STATUS_PENDING, source_channel=Order.SOURCE_CUSTOMER_APP, subtotal='100.00', total_amount='100.00', created_by=self.admin)
        OrderItem.objects.create(order=order, product=self.white, product_unit=self.white_unit, product_code_snapshot=self.white.code, product_name_en_snapshot=self.white.name_en, product_name_ar_snapshot=self.white.name_ar, unit_snapshot='Qintar', quantity='1.000', unit_price='100.00', line_total='100.00')
        self.auth_manager()
        response = self.client.post(f'{self.url}{order.id}/mark-received/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        second = self.client.post(f'{self.url}{order.id}/mark-received/', {}, format='json')
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)

    def test_received_can_be_edited_but_invoiced_cannot(self):
        response = self.create_order()
        order_id = response.data['id']
        self.auth_admin()
        edit = self.client.patch(f'{self.url}{order_id}/', {'discount_amount': '0.00'}, format='json')
        self.assertEqual(edit.status_code, status.HTTP_200_OK, edit.data)
        order = Order.objects.get(id=order_id)
        mark_order_invoiced(order, None, self.admin)
        blocked = self.client.patch(f'{self.url}{order_id}/', {'discount_amount': '1.00'}, format='json')
        self.assertEqual(blocked.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cancellation_rules_and_delete_block(self):
        pending = Order.objects.create(customer=self.customer, status=Order.STATUS_PENDING, source_channel=Order.SOURCE_CUSTOMER_APP, subtotal='100.00', total_amount='100.00', created_by=self.admin)
        received = Order.objects.create(customer=self.customer, status=Order.STATUS_RECEIVED, source_channel=Order.SOURCE_ADMIN, subtotal='100.00', total_amount='100.00', created_by=self.admin, received_by=self.admin, received_at=timezone.now())
        self.auth_manager()
        denied = self.client.post(f'{self.url}{pending.id}/cancel/', {'reason': 'No'}, format='json')
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)
        self.auth_admin()
        missing_reason = self.client.post(f'{self.url}{pending.id}/cancel/', {'reason': ''}, format='json')
        self.assertEqual(missing_reason.status_code, status.HTTP_400_BAD_REQUEST)
        ok_pending = self.client.post(f'{self.url}{pending.id}/cancel/', {'reason': 'Customer cancelled'}, format='json')
        ok_received = self.client.post(f'{self.url}{received.id}/cancel/', {'reason': 'Customer cancelled'}, format='json')
        self.assertEqual(ok_pending.status_code, status.HTTP_200_OK)
        self.assertEqual(ok_received.status_code, status.HTTP_200_OK)
        invoiced = Order.objects.create(customer=self.customer, status=Order.STATUS_INVOICED, source_channel=Order.SOURCE_ADMIN, subtotal='100.00', total_amount='100.00', created_by=self.admin)
        blocked = self.client.post(f'{self.url}{invoiced.id}/cancel/', {'reason': 'No'}, format='json')
        self.assertEqual(blocked.status_code, status.HTTP_400_BAD_REQUEST)
        delete = self.client.delete(f'{self.url}{invoiced.id}/')
        self.assertEqual(delete.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_search_and_filters_and_summary(self):
        response = self.create_order()
        order_id = response.data['id']
        self.auth_admin()
        self.assertEqual(self.client.get(self.url, {'search': 'Ahmed'}).data['count'], 1)
        self.assertEqual(self.client.get(self.url, {'status': 'received'}).data['count'], 1)
        self.assertEqual(self.client.get(self.url, {'customer': self.customer.id}).data['count'], 1)
        self.assertEqual(self.client.get(self.url, {'product': self.white.id}).data['count'], 1)
        self.assertEqual(self.client.get(self.url, {'date': timezone.localdate().isoformat()}).data['count'], 1)
        summary = self.client.get(f'{self.url}summary/')
        self.assertEqual(summary.status_code, status.HTTP_200_OK)
        self.assertEqual(summary.data['total_orders'], 1)
        self.assertEqual(summary.data['received_orders'], 1)
        detail = self.client.get(f'{self.url}{order_id}/')
        self.assertEqual(detail.data['customer']['id'], self.customer.id)

    def test_order_and_items_are_created_atomically(self):
        self.auth_admin()
        with patch('orders.services.OrderItem.objects.bulk_create', side_effect=RuntimeError('boom')):
            with self.assertRaises(RuntimeError):
                self.client.post(self.url, self.payload(), format='json')
        self.assertEqual(Order.objects.count(), 0)
