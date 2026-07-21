from datetime import datetime, timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import UserProfile
from .models import Inventory, InventoryMovement, Product, ProductUnit, Warehouse


class InventoryAPITests(APITestCase):
    warehouse_url = '/api/inventory/warehouses/'
    product_url = '/api/inventory/products/'
    stock_url = '/api/inventory/stocks/'
    movement_url = '/api/inventory/movements/'
    summary_url = '/api/inventory/summary/'

    def setUp(self):
        User = get_user_model()
        self.admin = User.objects.create_user(username='admin', email='admin@example.com', password='admin123')
        self.manager = User.objects.create_user(username='manager', email='manager@example.com', password='admin123')
        UserProfile.objects.create(user=self.admin, role=UserProfile.ROLE_ADMIN)
        UserProfile.objects.create(user=self.manager, role=UserProfile.ROLE_MANAGER)
        self.white = Product.objects.get(name_en='White Sesame')
        self.red = Product.objects.get(name_en='Red Sesame')
        self.corn = Product.objects.get(name_en='Corn')
        self.plastic = Product.objects.get(name_en='Plastic')

    def auth_admin(self):
        self.client.force_authenticate(self.admin)

    def auth_manager(self):
        self.client.force_authenticate(self.manager)

    def warehouse_payload(self, **overrides):
        payload = {
            'warehouse_name': 'Main Warehouse',
            'location': 'Market Road',
            'primary_product_id': self.white.id,
            'capacity': '1000.000',
            'capacity_unit': 'Qintar',
            'manager_name': 'Mohamed Ahmed',
            'guard_name': 'Hassan Ali',
            'notes': '',
        }
        payload.update(overrides)
        return payload

    def create_warehouse(self, **overrides):
        self.auth_admin()
        response = self.client.post(self.warehouse_url, self.warehouse_payload(**overrides), format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        return Warehouse.objects.get(id=response.data['id'])

    def add_stock_payload(self, product=None, **overrides):
        payload = {
            'product_id': (product or self.white).id,
            'quantity': '100.000',
            'unit': 'Qintar',
            'minimum_threshold': '50.000',
            'driver_name': 'Ahmed Ali',
            'notes': 'Stock received',
            'created_by': 999,
            'created_at': '2000-01-01T00:00:00Z',
        }
        payload.update(overrides)
        return payload

    def withdraw_payload(self, product=None, **overrides):
        payload = {
            'product_id': (product or self.white).id,
            'quantity': '20.000',
            'unit': 'Qintar',
            'driver_name': '',
            'notes': 'Damaged stock adjustment',
        }
        payload.update(overrides)
        return payload

    def add_stock(self, warehouse, payload=None):
        self.auth_admin()
        response = self.client.post(f'{self.warehouse_url}{warehouse.id}/add-stock/', payload or self.add_stock_payload(), format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        return response

    def test_unauthenticated_warehouse_request_returns_401(self):
        response = self.client.get(self.warehouse_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_authenticated_warehouse_list_succeeds(self):
        self.auth_manager()
        response = self.client.get(self.warehouse_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_admin_can_create_warehouse(self):
        warehouse = self.create_warehouse()
        self.assertEqual(warehouse.created_by, self.admin)

    def test_manager_cannot_create_warehouse(self):
        self.auth_manager()
        response = self.client.post(self.warehouse_url, self.warehouse_payload(warehouse_name='Manager Store'), format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_warehouse_capacity_must_be_greater_than_zero(self):
        self.auth_admin()
        response = self.client.post(self.warehouse_url, self.warehouse_payload(capacity='0'), format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('capacity', response.data)

    def test_invalid_primary_product_and_capacity_unit_combination_fails(self):
        self.auth_admin()
        response = self.client.post(self.warehouse_url, self.warehouse_payload(primary_product_id=self.white.id, capacity_unit='KG'), format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('capacity_unit', response.data)

    def test_product_unit_rules_are_seeded_correctly(self):
        rules = {
            'White Sesame': {'Qintar'},
            'Red Sesame': {'Qintar'},
            'Corn': {'KG', 'Bag'},
            'Dabara': {'Bale', 'Unit'},
            'Sacks / Khaysh': {'Bale', 'Unit'},
            'Plastic': {'Bale', 'Unit'},
        }
        for product_name, units in rules.items():
            product = Product.objects.get(name_en=product_name)
            self.assertEqual(set(product.units.values_list('unit', flat=True)), units)

    def test_add_stock_succeeds(self):
        warehouse = self.create_warehouse()
        response = self.add_stock(warehouse)
        self.assertEqual(response.data['inventory_item']['quantity'], '100.000')

    def test_add_stock_creates_inventory_record(self):
        warehouse = self.create_warehouse()
        self.add_stock(warehouse)
        self.assertTrue(Inventory.objects.filter(warehouse=warehouse, product=self.white, unit='Qintar').exists())

    def test_add_stock_creates_inventory_movement_record(self):
        warehouse = self.create_warehouse()
        self.add_stock(warehouse)
        self.assertTrue(InventoryMovement.objects.filter(warehouse=warehouse, movement_type='stock_in').exists())

    def test_add_stock_assigns_created_by_automatically(self):
        warehouse = self.create_warehouse()
        self.add_stock(warehouse)
        self.assertEqual(InventoryMovement.objects.get(warehouse=warehouse).created_by, self.admin)

    def test_add_stock_date_and_time_are_automatic(self):
        warehouse = self.create_warehouse()
        response = self.add_stock(warehouse)
        self.assertRegex(response.data['movement']['date'], r'^\d{4}-\d{2}-\d{2}$')
        self.assertRegex(response.data['movement']['time'], r'^\d{2}:\d{2}$')

    def test_client_cannot_override_created_by_or_created_at(self):
        warehouse = self.create_warehouse()
        self.add_stock(warehouse)
        movement = InventoryMovement.objects.get(warehouse=warehouse)
        self.assertEqual(movement.created_by, self.admin)
        self.assertNotEqual(movement.created_at.year, 2000)

    def test_zero_quantity_is_rejected(self):
        warehouse = self.create_warehouse()
        self.auth_admin()
        response = self.client.post(f'{self.warehouse_url}{warehouse.id}/add-stock/', self.add_stock_payload(quantity='0'), format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_negative_quantity_is_rejected(self):
        warehouse = self.create_warehouse()
        self.auth_admin()
        response = self.client.post(f'{self.warehouse_url}{warehouse.id}/add-stock/', self.add_stock_payload(quantity='-1'), format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_invalid_product_unit_combination_is_rejected(self):
        warehouse = self.create_warehouse()
        self.auth_admin()
        response = self.client.post(f'{self.warehouse_url}{warehouse.id}/add-stock/', self.add_stock_payload(unit='KG'), format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_warehouse_unit_mismatch_is_rejected(self):
        warehouse = self.create_warehouse(primary_product_id=self.plastic.id, capacity_unit='Bale')
        self.auth_admin()
        response = self.client.post(
            f'{self.warehouse_url}{warehouse.id}/add-stock/',
            self.add_stock_payload(product=self.plastic, unit='Unit'),
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_adding_stock_over_warehouse_capacity_is_rejected(self):
        warehouse = self.create_warehouse(capacity='50.000')
        self.auth_admin()
        response = self.client.post(f'{self.warehouse_url}{warehouse.id}/add-stock/', self.add_stock_payload(quantity='60.000'), format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_failed_add_stock_operation_does_not_partially_update_quantity(self):
        warehouse = self.create_warehouse(capacity='50.000')
        self.auth_admin()
        self.client.post(f'{self.warehouse_url}{warehouse.id}/add-stock/', self.add_stock_payload(quantity='60.000'), format='json')
        self.assertFalse(Inventory.objects.filter(warehouse=warehouse).exists())

    def test_adding_same_product_and_unit_updates_existing_inventory_record(self):
        warehouse = self.create_warehouse()
        self.add_stock(warehouse)
        self.add_stock(warehouse, self.add_stock_payload(quantity='25.000'))
        self.assertEqual(Inventory.objects.get(warehouse=warehouse, product=self.white).quantity, Decimal('125.000'))

    def test_manual_withdrawal_succeeds_with_sufficient_stock(self):
        warehouse = self.create_warehouse()
        self.add_stock(warehouse)
        self.auth_admin()
        response = self.client.post(f'{self.warehouse_url}{warehouse.id}/withdraw-stock/', self.withdraw_payload(), format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data['inventory_item']['quantity'], '80.000')

    def test_manual_withdrawal_without_notes_fails(self):
        warehouse = self.create_warehouse()
        self.add_stock(warehouse)
        self.auth_admin()
        response = self.client.post(f'{self.warehouse_url}{warehouse.id}/withdraw-stock/', self.withdraw_payload(notes=''), format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_manual_withdrawal_with_insufficient_stock_fails(self):
        warehouse = self.create_warehouse()
        self.add_stock(warehouse)
        self.auth_admin()
        response = self.client.post(f'{self.warehouse_url}{warehouse.id}/withdraw-stock/', self.withdraw_payload(quantity='500.000'), format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_failed_withdrawal_leaves_stock_unchanged(self):
        warehouse = self.create_warehouse()
        self.add_stock(warehouse)
        self.auth_admin()
        self.client.post(f'{self.warehouse_url}{warehouse.id}/withdraw-stock/', self.withdraw_payload(quantity='500.000'), format='json')
        self.assertEqual(Inventory.objects.get(warehouse=warehouse).quantity, Decimal('100.000'))

    def test_stock_can_never_become_negative(self):
        warehouse = self.create_warehouse()
        self.add_stock(warehouse)
        self.auth_admin()
        self.client.post(f'{self.warehouse_url}{warehouse.id}/withdraw-stock/', self.withdraw_payload(quantity='101.000'), format='json')
        self.assertGreaterEqual(Inventory.objects.get(warehouse=warehouse).quantity, 0)

    def test_manual_withdrawal_creates_audit_movement(self):
        warehouse = self.create_warehouse()
        self.add_stock(warehouse)
        self.auth_admin()
        self.client.post(f'{self.warehouse_url}{warehouse.id}/withdraw-stock/', self.withdraw_payload(), format='json')
        self.assertTrue(InventoryMovement.objects.filter(warehouse=warehouse, movement_type='manual_withdrawal').exists())

    def test_manual_request_cannot_create_shipment_out_movement(self):
        warehouse = self.create_warehouse()
        self.add_stock(warehouse)
        self.auth_admin()
        response = self.client.post(
            f'{self.warehouse_url}{warehouse.id}/withdraw-stock/',
            self.withdraw_payload(source_type='shipment', movement_type='shipment_out'),
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_inventory_quantity_cannot_be_directly_edited(self):
        warehouse = self.create_warehouse()
        self.add_stock(warehouse)
        stock = Inventory.objects.get(warehouse=warehouse)
        self.auth_admin()
        response = self.client.patch(f'{self.stock_url}{stock.id}/', {'quantity': '1.000'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_movement_records_cannot_be_edited(self):
        warehouse = self.create_warehouse()
        self.add_stock(warehouse)
        movement = InventoryMovement.objects.get(warehouse=warehouse)
        self.auth_admin()
        response = self.client.patch(f'{self.movement_url}{movement.id}/', {'quantity': '1.000'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_movement_records_cannot_be_deleted(self):
        warehouse = self.create_warehouse()
        self.add_stock(warehouse)
        movement = InventoryMovement.objects.get(warehouse=warehouse)
        self.auth_admin()
        response = self.client.delete(f'{self.movement_url}{movement.id}/')
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_warehouse_capacity_fields_are_correct(self):
        warehouse = self.create_warehouse(capacity='1000.000')
        self.add_stock(warehouse, self.add_stock_payload(quantity='250.000'))
        self.auth_admin()
        response = self.client.get(f'{self.warehouse_url}{warehouse.id}/')
        self.assertEqual(response.data['used_capacity'], '250.000')
        self.assertEqual(response.data['available_capacity'], '750.000')
        self.assertEqual(response.data['usage_percent'], '25.00')

    def test_almost_full_status_is_correct_at_80_percent_or_above(self):
        warehouse = self.create_warehouse(capacity='1000.000')
        self.add_stock(warehouse, self.add_stock_payload(quantity='800.000'))
        self.auth_admin()
        response = self.client.get(f'{self.warehouse_url}{warehouse.id}/')
        self.assertEqual(response.data['status'], 'Almost Full')

    def test_full_status_is_correct_at_100_percent(self):
        warehouse = self.create_warehouse(capacity='1000.000')
        self.add_stock(warehouse, self.add_stock_payload(quantity='1000.000'))
        self.auth_admin()
        response = self.client.get(f'{self.warehouse_url}{warehouse.id}/')
        self.assertEqual(response.data['status'], 'Full')

    def test_low_stock_inventory_filtering_works(self):
        warehouse = self.create_warehouse()
        self.add_stock(warehouse, self.add_stock_payload(quantity='25.000', minimum_threshold='50.000'))
        self.auth_admin()
        response = self.client.get(self.stock_url, {'low_stock': 'true'})
        self.assertEqual(len(response.data), 1)

    def test_product_filtering_works(self):
        warehouse = self.create_warehouse()
        self.add_stock(warehouse)
        self.auth_admin()
        response = self.client.get(self.stock_url, {'product': self.white.id})
        self.assertEqual(len(response.data), 1)

    def test_warehouse_search_works(self):
        warehouse = self.create_warehouse(warehouse_name='Searchable Warehouse')
        self.auth_admin()
        response = self.client.get(self.warehouse_url, {'search': 'Searchable'})
        self.assertEqual([row['id'] for row in response.data], [warehouse.id])

    def test_movement_date_filtering_works(self):
        warehouse = self.create_warehouse()
        self.add_stock(warehouse)
        movement = InventoryMovement.objects.get(warehouse=warehouse)
        yesterday = timezone.now() - timedelta(days=1)
        InventoryMovement.objects.filter(id=movement.id).update(created_at=yesterday)
        self.auth_admin()
        response = self.client.get(f'{self.warehouse_url}{warehouse.id}/movements/', {'date': timezone.localdate(yesterday).isoformat()})
        self.assertEqual(len(response.data), 1)

    def test_warehouse_with_positive_stock_cannot_be_archived(self):
        warehouse = self.create_warehouse()
        self.add_stock(warehouse)
        self.auth_admin()
        response = self.client.delete(f'{self.warehouse_url}{warehouse.id}/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_empty_warehouse_can_be_soft_deleted(self):
        warehouse = self.create_warehouse()
        self.auth_admin()
        response = self.client.delete(f'{self.warehouse_url}{warehouse.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        warehouse.refresh_from_db()
        self.assertTrue(warehouse.is_deleted)

    def test_archived_warehouse_does_not_accept_stock_operations(self):
        warehouse = self.create_warehouse()
        warehouse.is_deleted = True
        warehouse.is_active = False
        warehouse.save()
        self.auth_admin()
        response = self.client.post(f'{self.warehouse_url}{warehouse.id}/add-stock/', self.add_stock_payload(), format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_different_physical_units_are_never_combined_in_summaries(self):
        bale_warehouse = self.create_warehouse(warehouse_name='Bale Store', primary_product_id=self.plastic.id, capacity_unit='Bale')
        unit_warehouse = self.create_warehouse(warehouse_name='Unit Store', primary_product_id=self.plastic.id, capacity_unit='Unit')
        self.add_stock(bale_warehouse, self.add_stock_payload(product=self.plastic, unit='Bale', quantity='10.000'))
        self.add_stock(unit_warehouse, self.add_stock_payload(product=self.plastic, unit='Unit', quantity='10.000'))
        self.auth_admin()
        response = self.client.get(self.summary_url)
        groups = response.data['inventory_groups']
        self.assertIn({'product_id': self.plastic.id, 'product_name': 'Plastic', 'unit': 'Bale', 'quantity': '10.000'}, groups)
        self.assertIn({'product_id': self.plastic.id, 'product_name': 'Plastic', 'unit': 'Unit', 'quantity': '10.000'}, groups)

    def test_inventory_summary_groups_by_product_and_unit(self):
        warehouse = self.create_warehouse()
        self.add_stock(warehouse, self.add_stock_payload(quantity='10.000'))
        self.add_stock(warehouse, self.add_stock_payload(quantity='15.000'))
        self.auth_admin()
        response = self.client.get(self.summary_url)
        self.assertIn({'product_id': self.white.id, 'product_name': 'White Sesame', 'unit': 'Qintar', 'quantity': '25.000'}, response.data['inventory_groups'])

    def test_all_stock_operations_are_atomic(self):
        warehouse = self.create_warehouse()
        with patch('inventory.services.InventoryMovement.objects.create', side_effect=RuntimeError('boom')):
            self.auth_admin()
            with self.assertRaises(RuntimeError):
                self.client.post(f'{self.warehouse_url}{warehouse.id}/add-stock/', self.add_stock_payload(), format='json')
        self.assertFalse(Inventory.objects.filter(warehouse=warehouse).exists())


class ProductManagementAPITests(APITestCase):
    product_url = '/api/products/'
    warehouse_url = '/api/inventory/warehouses/'

    def setUp(self):
        User = get_user_model()
        self.admin = User.objects.create_user(username='product-admin', email='product-admin@example.com', password='admin123')
        self.manager = User.objects.create_user(username='product-manager', email='product-manager@example.com', password='admin123')
        UserProfile.objects.create(user=self.admin, role=UserProfile.ROLE_ADMIN)
        UserProfile.objects.create(user=self.manager, role=UserProfile.ROLE_MANAGER)
        self.white = Product.objects.get(name_en='White Sesame')
        self.corn = Product.objects.get(name_en='Corn')

    def auth_admin(self):
        self.client.force_authenticate(self.admin)

    def auth_manager(self):
        self.client.force_authenticate(self.manager)

    def payload(self, **overrides):
        data = {
            'name_en': 'Groundnut',
            'name_ar': 'Groundnut AR',
            'category': 'commodity',
            'description': 'Commodity product',
            'notes': '',
            'is_active': True,
            'units': [
                {
                    'unit': 'KG',
                    'is_default': True,
                    'purchase_price': '10.00',
                    'selling_price': '12.00',
                    'minimum_selling_price': '11.00',
                    'is_active': True,
                },
            ],
        }
        data.update(overrides)
        return data

    def create_product(self, **overrides):
        self.auth_admin()
        response = self.client.post(self.product_url, self.payload(**overrides), format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        return response

    def create_warehouse_with_stock(self, product=None, quantity='100.000', threshold='50.000'):
        product = product or self.white
        self.auth_admin()
        warehouse = Warehouse.objects.create(
            warehouse_name='Product Stock Store',
            location='Market Road',
            primary_product=product,
            capacity='1000.000',
            capacity_unit=product.units.filter(is_default=True).first().unit,
            manager_name='Mohamed Ahmed',
            guard_name='Hassan Ali',
            created_by=self.admin,
        )
        Inventory.objects.create(
            warehouse=warehouse,
            product=product,
            unit=warehouse.capacity_unit,
            quantity=quantity,
            minimum_threshold=threshold,
        )
        return warehouse

    def test_manager_can_list_products(self):
        self.auth_manager()
        response = self.client.get(self.product_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_manager_cannot_create_product(self):
        self.auth_manager()
        response = self.client.post(self.product_url, self.payload(name_en='Manager Product'), format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_create_product_with_generated_prd_code(self):
        response = self.create_product()
        self.assertRegex(response.data['code'], r'^PRD-\d{4}$')
        self.assertEqual(response.data['created_by'], self.admin.id)

    def test_product_requires_at_least_one_unit(self):
        self.auth_admin()
        response = self.client.post(self.product_url, self.payload(units=[]), format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('units', response.data)

    def test_product_requires_exactly_one_default_unit(self):
        self.auth_admin()
        response = self.client.post(
            self.product_url,
            self.payload(units=[
                {'unit': 'KG', 'is_default': False, 'purchase_price': '1.00', 'selling_price': '2.00', 'is_active': True},
                {'unit': 'Bag', 'is_default': False, 'purchase_price': '1.00', 'selling_price': '2.00', 'is_active': True},
            ]),
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_duplicate_units_are_rejected(self):
        self.auth_admin()
        response = self.client.post(
            self.product_url,
            self.payload(units=[
                {'unit': 'KG', 'is_default': True, 'purchase_price': '1.00', 'selling_price': '2.00', 'is_active': True},
                {'unit': 'KG', 'is_default': False, 'purchase_price': '1.00', 'selling_price': '2.00', 'is_active': True},
            ]),
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_known_bayad_product_unit_rules_are_enforced(self):
        self.auth_admin()
        response = self.client.post(self.product_url, self.payload(name_en='White Sesame', name_ar='New Arabic', units=[{'unit': 'KG', 'is_default': True, 'purchase_price': '1.00', 'selling_price': '2.00', 'is_active': True}]), format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_negative_prices_are_rejected(self):
        self.auth_admin()
        response = self.client.post(self.product_url, self.payload(units=[{'unit': 'KG', 'is_default': True, 'purchase_price': '-1.00', 'selling_price': '2.00', 'is_active': True}]), format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_minimum_selling_price_cannot_exceed_selling_price(self):
        self.auth_admin()
        response = self.client.post(self.product_url, self.payload(units=[{'unit': 'KG', 'is_default': True, 'purchase_price': '1.00', 'selling_price': '2.00', 'minimum_selling_price': '3.00', 'is_active': True}]), format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_product_update_preserves_and_updates_existing_unit(self):
        response = self.create_product()
        unit = response.data['units'][0]
        self.auth_admin()
        update = self.payload(name_en='Groundnut Premium', units=[{**unit, 'selling_price': '14.00'}])
        response = self.client.patch(f'{self.product_url}{response.data["id"]}/', update, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data['units'][0]['selling_price'], '14.00')
        self.assertEqual(ProductUnit.objects.filter(product_id=response.data['id']).count(), 1)

    def test_soft_archived_product_is_hidden_from_product_lists(self):
        response = self.create_product()
        self.auth_admin()
        self.client.delete(f'{self.product_url}{response.data["id"]}/')
        response = self.client.get(self.product_url, {'search': 'Groundnut'})
        self.assertEqual(response.data['count'], 0)

    def test_product_with_positive_stock_cannot_be_archived(self):
        self.create_warehouse_with_stock()
        self.auth_admin()
        response = self.client.delete(f'{self.product_url}{self.white.id}/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_product_with_zero_stock_can_be_archived(self):
        self.create_warehouse_with_stock(quantity='0.000')
        self.auth_admin()
        response = self.client.delete(f'{self.product_url}{self.white.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.white.refresh_from_db()
        self.assertTrue(self.white.is_deleted)

    def test_unit_with_positive_stock_cannot_be_removed(self):
        self.create_warehouse_with_stock(product=self.corn)
        self.auth_admin()
        response = self.client.patch(
            f'{self.product_url}{self.corn.id}/',
            {
                'units': [
                    {'id': self.corn.units.get(unit='Bag').id, 'unit': 'Bag', 'is_default': True, 'purchase_price': '0.00', 'selling_price': '0.00', 'is_active': True},
                ],
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_unit_with_positive_stock_cannot_be_deactivated(self):
        self.create_warehouse_with_stock(product=self.corn)
        self.auth_admin()
        response = self.client.patch(
            f'{self.product_url}{self.corn.id}/',
            {
                'units': [
                    {'id': self.corn.units.get(unit='KG').id, 'unit': 'KG', 'is_default': False, 'purchase_price': '0.00', 'selling_price': '0.00', 'is_active': False},
                    {'id': self.corn.units.get(unit='Bag').id, 'unit': 'Bag', 'is_default': True, 'purchase_price': '0.00', 'selling_price': '0.00', 'is_active': True},
                ],
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_stock_endpoint_groups_read_only_stock_by_unit(self):
        self.create_warehouse_with_stock(quantity='25.000', threshold='50.000')
        self.auth_manager()
        response = self.client.get(f'{self.product_url}{self.white.id}/stock/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['stock_summary'], [{'unit': 'Qintar', 'quantity': '25.000'}])
        self.assertEqual(response.data['stock_status'], 'Low Stock')

    def test_summary_endpoint_returns_stock_counts(self):
        self.create_warehouse_with_stock(quantity='0.000')
        self.auth_manager()
        response = self.client.get(f'{self.product_url}summary/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('out_of_stock_products', response.data)
        self.assertGreaterEqual(response.data['total_products'], 1)

    def test_options_endpoint_returns_active_units_only(self):
        unit = self.corn.units.get(unit='Bag')
        unit.is_active = False
        unit.save()
        self.auth_manager()
        response = self.client.get(f'{self.product_url}options/')
        corn = next(row for row in response.data if row['id'] == self.corn.id)
        self.assertEqual([row['unit'] for row in corn['units']], ['KG'])

    def test_inventory_product_endpoint_hides_archived_products(self):
        self.white.is_deleted = True
        self.white.is_active = False
        self.white.save()
        self.auth_manager()
        response = self.client.get('/api/inventory/products/', {'search': 'White Sesame'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])

    def test_archived_product_is_rejected_for_new_warehouse(self):
        self.white.is_deleted = True
        self.white.is_active = False
        self.white.save()
        self.auth_admin()
        response = self.client.post(
            self.warehouse_url,
            {
                'warehouse_name': 'Archived Product Store',
                'location': 'North',
                'primary_product_id': self.white.id,
                'capacity': '100.000',
                'capacity_unit': 'Qintar',
                'manager_name': 'Manager',
                'guard_name': 'Guard',
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

# Create your tests here.
