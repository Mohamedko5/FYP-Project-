from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import UserProfile
from daily_journal.models import JournalTransaction
from inventory.models import Inventory, InventoryMovement, Product, Warehouse
from inventory.services import add_stock
from shipments.models import Shipment


class WarehouseCommodityJournalAPITests(APITestCase):
    url = '/api/journal/warehouse-commodity-transactions/'
    generic_url = '/api/journal/transactions/'

    def setUp(self):
        User = get_user_model()
        self.admin = User.objects.create_user(username='journal-admin', email='admin@example.com', password='admin123')
        self.manager = User.objects.create_user(username='journal-manager', email='manager@example.com', password='admin123')
        self.customer_user = User.objects.create_user(username='journal-customer', email='customer@example.com', password='admin123')
        UserProfile.objects.create(user=self.admin, role=UserProfile.ROLE_ADMIN)
        UserProfile.objects.create(user=self.manager, role=UserProfile.ROLE_MANAGER)
        UserProfile.objects.create(user=self.customer_user, role='customer')
        self.white = Product.objects.get(name_en='White Sesame')
        self.corn = Product.objects.get(name_en='Corn')
        self.warehouse = Warehouse.objects.create(
            warehouse_name='Main Warehouse',
            location='Market Road',
            primary_product=self.white,
            capacity='1000.000',
            capacity_unit='Qintar',
            manager_name='Mohamed Ahmed',
            guard_name='Hassan Ali',
            created_by=self.admin,
        )

    def auth_admin(self):
        self.client.force_authenticate(self.admin)

    def auth_manager(self):
        self.client.force_authenticate(self.manager)

    def payload(self, **overrides):
        data = {
            'warehouse_operation': 'stock_in',
            'warehouse_id': self.warehouse.id,
            'product_id': self.white.id,
            'unit': 'Qintar',
            'quantity': '100.000',
            'minimum_threshold': '20.000',
            'party': 'Ahmed Supplier',
            'estimated_value': '500000.00',
            'driver_name': 'Mohamed Ali',
            'description': 'White sesame received from supplier',
            'idempotency_key': 'stock-in-key',
        }
        data.update(overrides)
        return data

    def stock_in(self, user=None, **overrides):
        self.client.force_authenticate(user or self.admin)
        response = self.client.post(self.url, self.payload(**overrides), format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        return response

    def seed_stock(self, quantity='100.000'):
        return add_stock(
            warehouse_id=self.warehouse.id,
            product_id=self.white.id,
            quantity=quantity,
            unit='Qintar',
            minimum_threshold='20.000',
            notes='Seed stock',
            user=self.admin,
        )

    def test_unauthenticated_request_returns_401(self):
        response = self.client.post(self.url, self.payload(), format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_customer_user_cannot_record_warehouse_journal_transaction(self):
        self.client.force_authenticate(self.customer_user)
        response = self.client.post(self.url, self.payload(), format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_add_stock_through_daily_journal(self):
        response = self.stock_in()
        journal = JournalTransaction.objects.get(id=response.data['journal_transaction']['id'])
        movement = InventoryMovement.objects.get(id=response.data['inventory_movement']['id'])
        inventory = Inventory.objects.get(warehouse=self.warehouse, product=self.white, unit='Qintar')
        self.assertEqual(inventory.quantity, Decimal('100.000'))
        self.assertEqual(movement.quantity_before, Decimal('0.000'))
        self.assertEqual(movement.quantity_after, Decimal('100.000'))
        self.assertEqual(movement.source_type, InventoryMovement.SOURCE_DAILY_JOURNAL)
        self.assertEqual(journal.linked_inventory_movement, movement)
        self.assertEqual(journal.warehouse_operation, JournalTransaction.WAREHOUSE_STOCK_IN)
        self.assertEqual(journal.product_name, movement.product.name_en)
        self.assertEqual(journal.quantity, movement.quantity)
        self.assertEqual(journal.unit, movement.unit)

    def test_manager_can_add_stock_through_daily_journal(self):
        response = self.stock_in(self.manager, idempotency_key='manager-key')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_add_stock_over_capacity_fails_without_partial_records(self):
        self.auth_admin()
        response = self.client.post(self.url, self.payload(quantity='1001.000', idempotency_key='over-capacity'), format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Inventory.objects.filter(warehouse=self.warehouse).exists())
        self.assertFalse(InventoryMovement.objects.exists())
        self.assertFalse(JournalTransaction.objects.exists())

    def test_failed_journal_creation_rolls_back_inventory(self):
        self.auth_admin()
        with patch('daily_journal.services.JournalTransaction.objects.create', side_effect=RuntimeError('boom')):
            with self.assertRaises(RuntimeError):
                self.client.post(self.url, self.payload(idempotency_key='rollback-key'), format='json')
        self.assertFalse(Inventory.objects.filter(warehouse=self.warehouse).exists())
        self.assertFalse(InventoryMovement.objects.exists())

    def test_manual_withdrawal_decreases_inventory_and_does_not_create_shipment(self):
        self.seed_stock('100.000')
        before_shipments = Shipment.objects.count()
        self.auth_admin()
        response = self.client.post(
            self.url,
            self.payload(
                warehouse_operation='manual_withdrawal',
                quantity='10.000',
                description='Damaged sesame removed from stock',
                idempotency_key='withdraw-key',
            ),
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        inventory = Inventory.objects.get(warehouse=self.warehouse, product=self.white, unit='Qintar')
        movement = InventoryMovement.objects.get(id=response.data['inventory_movement']['id'])
        self.assertEqual(inventory.quantity, Decimal('90.000'))
        self.assertEqual(movement.movement_type, InventoryMovement.MANUAL_WITHDRAWAL)
        self.assertEqual(movement.source_type, InventoryMovement.SOURCE_DAILY_JOURNAL)
        self.assertEqual(Shipment.objects.count(), before_shipments)

    def test_manual_withdrawal_requires_reason(self):
        self.seed_stock()
        self.auth_admin()
        response = self.client.post(
            self.url,
            self.payload(warehouse_operation='manual_withdrawal', description='', idempotency_key='no-reason'),
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_insufficient_stock_fails_and_inventory_remains_unchanged(self):
        self.seed_stock('10.000')
        self.auth_admin()
        response = self.client.post(
            self.url,
            self.payload(warehouse_operation='manual_withdrawal', quantity='20.000', description='Damaged stock', idempotency_key='too-much'),
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Inventory.objects.get(warehouse=self.warehouse).quantity, Decimal('10.000'))
        self.assertEqual(JournalTransaction.objects.count(), 0)

    def test_invalid_product_unit_and_warehouse_states_fail(self):
        self.auth_admin()
        invalid_unit = self.client.post(self.url, self.payload(unit='KG', idempotency_key='bad-unit'), format='json')
        self.assertEqual(invalid_unit.status_code, status.HTTP_400_BAD_REQUEST)

        self.warehouse.is_active = False
        self.warehouse.save()
        inactive = self.client.post(self.url, self.payload(idempotency_key='inactive-warehouse'), format='json')
        self.assertEqual(inactive.status_code, status.HTTP_400_BAD_REQUEST)

        self.warehouse.is_active = True
        self.warehouse.is_deleted = True
        self.warehouse.save()
        archived = self.client.post(self.url, self.payload(idempotency_key='archived-warehouse'), format='json')
        self.assertEqual(archived.status_code, status.HTTP_400_BAD_REQUEST)

    def test_corn_accepts_kg_and_bag_but_rejects_qintar(self):
        kg_warehouse = Warehouse.objects.create(
            warehouse_name='Corn KG Warehouse',
            location='Market Road',
            primary_product=self.corn,
            capacity='1000.000',
            capacity_unit='KG',
            manager_name='Mohamed Ahmed',
            guard_name='Hassan Ali',
            created_by=self.admin,
        )
        self.auth_admin()
        kg = self.client.post(self.url, self.payload(warehouse_id=kg_warehouse.id, product_id=self.corn.id, unit='KG', idempotency_key='corn-kg'), format='json')
        qintar = self.client.post(self.url, self.payload(warehouse_id=kg_warehouse.id, product_id=self.corn.id, unit='Qintar', idempotency_key='corn-qintar'), format='json')
        self.assertEqual(kg.status_code, status.HTTP_201_CREATED, kg.data)
        self.assertEqual(qintar.status_code, status.HTTP_400_BAD_REQUEST)

    def test_client_cannot_send_shipment_or_movement_fields(self):
        self.auth_admin()
        response = self.client.post(
            self.url,
            self.payload(source_type='shipment', movement_type='shipment_out', quantity_before='999.000', created_by=self.manager.id),
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('source_type', response.data)
        self.assertFalse(InventoryMovement.objects.exists())

    def test_generic_journal_endpoint_cannot_bypass_warehouse_validation(self):
        self.auth_admin()
        response = self.client.post(
            self.generic_url,
            {
                'journal_type': 'commodity',
                'warehouse_operation': 'stock_in',
                'warehouse_id': self.warehouse.id,
                'product_name': 'White Sesame',
                'quantity': '5.000',
                'unit': 'Qintar',
                'estimated_value': '500.00',
                'party': 'Supplier',
                'description': 'Bypass attempt',
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_idempotency_key_reuse_returns_existing_records_without_duplicate_stock(self):
        first = self.stock_in(idempotency_key='same-key')
        second = self.stock_in(idempotency_key='same-key')
        self.assertEqual(first.data['journal_transaction']['id'], second.data['journal_transaction']['id'])
        self.assertEqual(Inventory.objects.get(warehouse=self.warehouse).quantity, Decimal('100.000'))
        self.assertEqual(JournalTransaction.objects.count(), 1)
        self.assertEqual(InventoryMovement.objects.count(), 1)

    def test_same_idempotency_key_with_different_data_is_rejected(self):
        self.stock_in(idempotency_key='same-key')
        self.auth_admin()
        response = self.client.post(self.url, self.payload(quantity='101.000', idempotency_key='same-key'), format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_linked_journal_record_is_read_only_on_generic_endpoint(self):
        response = self.stock_in()
        journal_id = response.data['journal_transaction']['id']
        self.auth_admin()
        patch_response = self.client.patch(f'{self.generic_url}{journal_id}/', {'quantity': '1.000'}, format='json')
        delete_response = self.client.delete(f'{self.generic_url}{journal_id}/')
        self.assertEqual(patch_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(delete_response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_admin_can_reverse_stock_in_safely(self):
        response = self.stock_in()
        journal_id = response.data['journal_transaction']['id']
        self.auth_admin()
        reverse = self.client.post(f'{self.url}{journal_id}/reverse/', {'reason': 'Entered wrong quantity'}, format='json')
        self.assertEqual(reverse.status_code, status.HTTP_201_CREATED, reverse.data)
        self.assertEqual(Inventory.objects.get(warehouse=self.warehouse).quantity, Decimal('0.000'))
        original = JournalTransaction.objects.get(id=journal_id)
        self.assertTrue(original.is_reversed)
        self.assertIsNotNone(original.reversal_transaction)

    def test_admin_can_reverse_manual_withdrawal_safely(self):
        self.seed_stock('100.000')
        self.auth_admin()
        withdrawal = self.client.post(
            self.url,
            self.payload(warehouse_operation='manual_withdrawal', quantity='10.000', description='Damaged stock', idempotency_key='withdraw-rev'),
            format='json',
        )
        self.assertEqual(withdrawal.status_code, status.HTTP_201_CREATED, withdrawal.data)
        reverse = self.client.post(f'{self.url}{withdrawal.data["journal_transaction"]["id"]}/reverse/', {'reason': 'Approved correction'}, format='json')
        self.assertEqual(reverse.status_code, status.HTTP_201_CREATED, reverse.data)
        self.assertEqual(Inventory.objects.get(warehouse=self.warehouse).quantity, Decimal('100.000'))

    def test_manager_cannot_reverse_and_transaction_cannot_be_reversed_twice(self):
        response = self.stock_in()
        journal_id = response.data['journal_transaction']['id']
        self.auth_manager()
        manager_reverse = self.client.post(f'{self.url}{journal_id}/reverse/', {'reason': 'Manager attempt'}, format='json')
        self.assertEqual(manager_reverse.status_code, status.HTTP_403_FORBIDDEN)
        self.auth_admin()
        first = self.client.post(f'{self.url}{journal_id}/reverse/', {'reason': 'Admin correction'}, format='json')
        second = self.client.post(f'{self.url}{journal_id}/reverse/', {'reason': 'Again'}, format='json')
        self.assertEqual(first.status_code, status.HTTP_201_CREATED, first.data)
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)
