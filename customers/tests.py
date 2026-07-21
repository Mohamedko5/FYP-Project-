from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import UserProfile
from daily_journal.models import JournalTransaction
from inventory.models import Inventory, InventoryMovement, Product, Warehouse

from .models import Customer, CustomerCashTransaction, CustomerCommodityTransaction
from .services import customer_cash_balance, customer_commodity_balances


User = get_user_model()


class CustomerAPITests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(username='admin', password='pass')
        self.manager = User.objects.create_user(username='manager', password='pass')
        UserProfile.objects.create(user=self.admin, role=UserProfile.ROLE_ADMIN)
        UserProfile.objects.create(user=self.manager, role=UserProfile.ROLE_MANAGER)
        self.client.force_authenticate(self.admin)
        self.product = Product.objects.get(name_en='White Sesame')
        self.corn = Product.objects.get(name_en='Corn')

    def customer_payload(self, **overrides):
        payload = {
            'name': 'Mohamed Ahmed',
            'phone': '+249912345678',
            'secondary_phone': '',
            'address': 'Khartoum Market',
            'customer_type': Customer.TYPE_FARMER,
            'notes': 'Trusted buyer',
        }
        payload.update(overrides)
        return payload

    def create_customer(self, **overrides):
        customer = Customer(created_by=self.admin, **self.customer_payload(**overrides))
        customer.full_clean()
        customer.save()
        return customer

    def cash_payload(self, **overrides):
        payload = {
            'transaction_type': CustomerCashTransaction.PAYMENT_RECEIVED,
            'payment_method': CustomerCashTransaction.PAYMENT_CASH,
            'amount': '100.00',
            'description': 'Cash payment',
        }
        payload.update(overrides)
        return payload

    def commodity_payload(self, **overrides):
        payload = {
            'transaction_type': CustomerCommodityTransaction.PRODUCT_RECEIVED,
            'product_id': self.product.id,
            'quantity': '5.000',
            'unit': 'Qintar',
            'estimated_value': '500.00',
            'description': 'Product received',
        }
        payload.update(overrides)
        return payload

    def customer_url(self, customer):
        return reverse('customer-detail', args=[customer.id])

    def cash_url(self, customer):
        return reverse('customer-cash-transactions', args=[customer.id])

    def commodity_url(self, customer):
        return reverse('customer-commodity-transactions', args=[customer.id])

    def test_unauthenticated_customer_list_returns_401(self):
        self.client.force_authenticate(None)
        response = self.client.get(reverse('customer-list'))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_admin_can_create_customer(self):
        response = self.client.post(reverse('customer-list'), self.customer_payload(), format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_manager_can_create_customer(self):
        self.client.force_authenticate(self.manager)
        response = self.client.post(reverse('customer-list'), self.customer_payload(), format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_customer_code_is_generated_automatically(self):
        response = self.client.post(reverse('customer-list'), {**self.customer_payload(), 'code': 'CUS-9999'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['code'].startswith('CUS-'))
        self.assertNotEqual(response.data['code'], 'CUS-9999')

    def test_duplicate_phone_is_rejected(self):
        self.create_customer()
        response = self.client.post(reverse('customer-list'), self.customer_payload(name='Ali'), format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_required_customer_fields_are_validated(self):
        response = self.client.post(reverse('customer-list'), {'name': '', 'phone': '', 'address': '', 'customer_type': ''}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_invalid_photo_type_is_rejected(self):
        image = SimpleUploadedFile('bad.gif', b'abc', content_type='image/gif')
        response = self.client.post(reverse('customer-list'), {**self.customer_payload(), 'photo': image}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_oversized_photo_is_rejected(self):
        image = SimpleUploadedFile('large.jpg', b'a' * (2 * 1024 * 1024 + 1), content_type='image/jpeg')
        response = self.client.post(reverse('customer-list'), {**self.customer_payload(), 'photo': image}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_opening_debt_creates_correct_cash_transaction(self):
        response = self.client.post(reverse('customer-list'), {
            **self.customer_payload(),
            'opening_balance_amount': '250.00',
            'opening_balance_type': 'customer_owes_company',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        transaction = CustomerCashTransaction.objects.get(customer_id=response.data['id'])
        self.assertEqual(transaction.transaction_type, CustomerCashTransaction.OPENING_DEBT)

    def test_opening_credit_creates_correct_cash_transaction(self):
        response = self.client.post(reverse('customer-list'), {
            **self.customer_payload(),
            'opening_balance_amount': '250.00',
            'opening_balance_type': 'company_owes_customer',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        transaction = CustomerCashTransaction.objects.get(customer_id=response.data['id'])
        self.assertEqual(transaction.transaction_type, CustomerCashTransaction.OPENING_CREDIT)

    def test_customer_creation_rolls_back_if_opening_transaction_fails(self):
        response = self.client.post(reverse('customer-list'), {
            **self.customer_payload(),
            'opening_balance_amount': '250.00',
            'opening_balance_type': '',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Customer.objects.exists())

    def test_cash_balance_is_calculated_correctly(self):
        customer = self.create_customer()
        CustomerCashTransaction.objects.create(customer=customer, transaction_type='payment_owed', amount='300.00', description='Debt', created_by=self.admin)
        CustomerCashTransaction.objects.create(customer=customer, transaction_type='payment_received', payment_method='cash', amount='125.00', description='Paid', created_by=self.admin)
        self.assertEqual(customer_cash_balance(customer), Decimal('175.00'))

    def test_debtor_status_is_calculated_correctly(self):
        customer = self.create_customer()
        CustomerCashTransaction.objects.create(customer=customer, transaction_type='payment_owed', amount='1.00', description='Debt', created_by=self.admin)
        response = self.client.get(self.customer_url(customer))
        self.assertEqual(response.data['cash_status'], 'Debtor')

    def test_creditor_status_is_calculated_correctly(self):
        customer = self.create_customer()
        CustomerCashTransaction.objects.create(customer=customer, transaction_type='payment_received', payment_method='cash', amount='1.00', description='Paid', created_by=self.admin)
        response = self.client.get(self.customer_url(customer))
        self.assertEqual(response.data['cash_status'], 'Creditor')

    def test_balanced_status_is_calculated_correctly(self):
        customer = self.create_customer()
        response = self.client.get(self.customer_url(customer))
        self.assertEqual(response.data['cash_status'], 'Balanced')

    def test_payment_received_decreases_customer_debt(self):
        customer = self.create_customer()
        CustomerCashTransaction.objects.create(customer=customer, transaction_type='payment_owed', amount='300.00', description='Debt', created_by=self.admin)
        response = self.client.post(self.cash_url(customer), self.cash_payload(amount='100.00'), format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(customer_cash_balance(customer), Decimal('200.00'))

    def test_payment_owed_increases_customer_debt(self):
        customer = self.create_customer()
        response = self.client.post(self.cash_url(customer), self.cash_payload(transaction_type='payment_owed', payment_method='', amount='100.00'), format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(customer_cash_balance(customer), Decimal('100.00'))

    def test_customer_expense_increases_customer_debt(self):
        customer = self.create_customer()
        response = self.client.post(self.cash_url(customer), self.cash_payload(transaction_type='customer_expense', payment_method='online', amount='100.00'), format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(customer_cash_balance(customer), Decimal('100.00'))

    def test_negative_balance_is_allowed_as_customer_credit(self):
        customer = self.create_customer()
        response = self.client.post(self.cash_url(customer), self.cash_payload(amount='100.00'), format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(customer_cash_balance(customer), Decimal('-100.00'))

    def test_payment_received_requires_payment_method(self):
        customer = self.create_customer()
        response = self.client.post(self.cash_url(customer), self.cash_payload(payment_method=''), format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_customer_expense_requires_payment_method(self):
        customer = self.create_customer()
        response = self.client.post(self.cash_url(customer), self.cash_payload(transaction_type='customer_expense', payment_method=''), format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_payment_owed_rejects_payment_method(self):
        customer = self.create_customer()
        response = self.client.post(self.cash_url(customer), self.cash_payload(transaction_type='payment_owed', payment_method='cash'), format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_invalid_payment_method_is_rejected(self):
        customer = self.create_customer()
        response = self.client.post(self.cash_url(customer), self.cash_payload(payment_method='card'), format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_zero_cash_amount_is_rejected(self):
        customer = self.create_customer()
        response = self.client.post(self.cash_url(customer), self.cash_payload(amount='0'), format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_negative_cash_amount_is_rejected(self):
        customer = self.create_customer()
        response = self.client.post(self.cash_url(customer), self.cash_payload(amount='-1'), format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_date_and_time_are_generated_automatically(self):
        customer = self.create_customer()
        response = self.client.post(self.cash_url(customer), {**self.cash_payload(), 'created_at': '2000-01-01T00:00:00Z'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('date', response.data)
        self.assertNotEqual(response.data['date'], '2000-01-01')

    def test_client_cannot_override_created_by(self):
        customer = self.create_customer()
        response = self.client.post(self.cash_url(customer), {**self.cash_payload(), 'created_by': self.manager.id}, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(CustomerCashTransaction.objects.get(id=response.data['id']).created_by, self.admin)

    def test_client_cannot_create_system_generated_transaction(self):
        customer = self.create_customer()
        response = self.client.post(self.cash_url(customer), {**self.cash_payload(), 'is_system_generated': True, 'source_type': 'system'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        transaction = CustomerCashTransaction.objects.get(id=response.data['id'])
        self.assertFalse(transaction.is_system_generated)
        self.assertEqual(transaction.source_type, 'manual')

    def test_payment_received_creates_linked_daily_journal_income(self):
        customer = self.create_customer()
        response = self.client.post(self.cash_url(customer), self.cash_payload(), format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        journal = JournalTransaction.objects.get()
        self.assertEqual(journal.cash_type, JournalTransaction.CASH_INCOME)
        self.assertEqual(journal.payment_method, 'cash')

    def test_customer_expense_creates_linked_daily_journal_expense(self):
        customer = self.create_customer()
        response = self.client.post(self.cash_url(customer), self.cash_payload(transaction_type='customer_expense', payment_method='online'), format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(JournalTransaction.objects.get().cash_type, JournalTransaction.CASH_EXPENSE)

    def test_payment_owed_does_not_create_daily_journal_transaction(self):
        customer = self.create_customer()
        response = self.client.post(self.cash_url(customer), self.cash_payload(transaction_type='payment_owed', payment_method=''), format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(JournalTransaction.objects.count(), 0)

    def test_opening_balance_does_not_create_daily_journal_transaction(self):
        response = self.client.post(reverse('customer-list'), {
            **self.customer_payload(),
            'opening_balance_amount': '250.00',
            'opening_balance_type': 'customer_owes_company',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(JournalTransaction.objects.count(), 0)

    @patch('daily_journal.models.JournalTransaction.objects.get_or_create')
    def test_customer_and_daily_journal_creation_are_atomic(self, mocked_get_or_create):
        mocked_get_or_create.side_effect = RuntimeError('journal failed')
        customer = self.create_customer()
        with self.assertRaises(RuntimeError):
            self.client.post(self.cash_url(customer), self.cash_payload(), format='json')
        self.assertEqual(CustomerCashTransaction.objects.count(), 0)

    def test_retried_request_does_not_create_duplicate_journal_for_same_reference(self):
        customer = self.create_customer()
        response = self.client.post(self.cash_url(customer), self.cash_payload(), format='json')
        transaction = CustomerCashTransaction.objects.get(id=response.data['id'])
        JournalTransaction.objects.get_or_create(
            source_type=JournalTransaction.SOURCE_CUSTOMER,
            source_reference=transaction.source_reference,
            defaults={'journal_type': 'cash', 'cash_type': 'income', 'payment_method': 'cash', 'amount': '100.00', 'party': customer.name, 'description': 'Retry', 'created_by': self.admin},
        )
        self.assertEqual(JournalTransaction.objects.count(), 1)

    def test_product_received_increases_commodity_balance(self):
        customer = self.create_customer()
        response = self.client.post(self.commodity_url(customer), self.commodity_payload(), format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Decimal(customer_commodity_balances(customer)[0]['quantity']), Decimal('5.000'))

    def test_product_delivered_decreases_commodity_balance(self):
        customer = self.create_customer()
        self.client.post(self.commodity_url(customer), self.commodity_payload(quantity='5.000'), format='json')
        response = self.client.post(self.commodity_url(customer), self.commodity_payload(transaction_type='product_delivered', quantity='2.000'), format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Decimal(customer_commodity_balances(customer)[0]['quantity']), Decimal('3.000'))

    def test_product_delivered_cannot_make_commodity_balance_negative(self):
        customer = self.create_customer()
        response = self.client.post(self.commodity_url(customer), self.commodity_payload(transaction_type='product_delivered'), format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_invalid_product_unit_combination_is_rejected(self):
        customer = self.create_customer()
        response = self.client.post(self.commodity_url(customer), self.commodity_payload(unit='KG'), format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_different_units_are_not_combined(self):
        customer = self.create_customer()
        self.client.post(self.commodity_url(customer), self.commodity_payload(product_id=self.corn.id, unit='KG', quantity='100.000'), format='json')
        self.client.post(self.commodity_url(customer), self.commodity_payload(product_id=self.corn.id, unit='Bag', quantity='4.000'), format='json')
        balances = customer_commodity_balances(customer)
        self.assertEqual(len(balances), 2)

    def test_manual_commodity_transaction_does_not_change_inventory_quantity(self):
        customer = self.create_customer()
        warehouse = Warehouse.objects.create(warehouse_name='Main', location='Market', primary_product=self.product, capacity='100.000', capacity_unit='Qintar', manager_name='M', guard_name='G', created_by=self.admin)
        Inventory.objects.create(warehouse=warehouse, product=self.product, quantity='10.000', unit='Qintar', minimum_threshold='1.000')
        self.client.post(self.commodity_url(customer), self.commodity_payload(), format='json')
        self.assertEqual(Inventory.objects.get().quantity, Decimal('10.000'))

    def test_manual_commodity_transaction_does_not_create_inventory_movement(self):
        customer = self.create_customer()
        self.client.post(self.commodity_url(customer), self.commodity_payload(), format='json')
        self.assertEqual(InventoryMovement.objects.count(), 0)

    def test_lahu_and_alayh_fields_are_rejected_safely(self):
        customer = self.create_customer()
        response = self.client.post(self.commodity_url(customer), {**self.commodity_payload(), 'lahuWaAlayh': 'Lahu'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_archived_customer_cannot_receive_transactions(self):
        customer = self.create_customer()
        customer.is_active = False
        customer.is_deleted = True
        customer.save(update_fields=['is_active', 'is_deleted'])
        response = self.client.post(self.cash_url(customer), self.cash_payload(), format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_customer_with_cash_balance_cannot_be_archived(self):
        customer = self.create_customer()
        CustomerCashTransaction.objects.create(customer=customer, transaction_type='payment_owed', amount='1.00', description='Debt', created_by=self.admin)
        response = self.client.delete(self.customer_url(customer))
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_customer_with_commodity_balance_cannot_be_archived(self):
        customer = self.create_customer()
        CustomerCommodityTransaction.objects.create(customer=customer, transaction_type='product_received', product=self.product, quantity='1.000', unit='Qintar', description='Product', created_by=self.admin)
        response = self.client.delete(self.customer_url(customer))
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_balanced_customer_can_be_soft_archived_by_admin(self):
        customer = self.create_customer()
        response = self.client.delete(self.customer_url(customer))
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        customer.refresh_from_db()
        self.assertTrue(customer.is_deleted)

    def test_manager_cannot_archive_customer(self):
        customer = self.create_customer()
        self.client.force_authenticate(self.manager)
        response = self.client.delete(self.customer_url(customer))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_search_works(self):
        self.create_customer(name='Search Target', phone='+249900000001')
        response = self.client.get(reverse('customer-list'), {'search': 'Target'})
        self.assertEqual(response.data['count'], 1)

    def test_customer_type_filter_works(self):
        self.create_customer(customer_type='exporter')
        response = self.client.get(reverse('customer-list'), {'customer_type': 'exporter'})
        self.assertEqual(response.data['count'], 1)

    def test_cash_status_filter_works(self):
        customer = self.create_customer()
        CustomerCashTransaction.objects.create(customer=customer, transaction_type='payment_owed', amount='1.00', description='Debt', created_by=self.admin)
        response = self.client.get(reverse('customer-list'), {'cash_status': 'debtor'})
        self.assertEqual(response.data['count'], 1)

    def test_customer_statement_totals_are_correct(self):
        customer = self.create_customer()
        self.client.post(self.cash_url(customer), self.cash_payload(transaction_type='payment_owed', payment_method='', amount='300.00'), format='json')
        self.client.post(self.cash_url(customer), self.cash_payload(amount='100.00'), format='json')
        response = self.client.get(reverse('customer-statement', args=[customer.id]))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['cash_balance'], '200.00')
        self.assertEqual(response.data['total_debits'], '300.00')
        self.assertEqual(response.data['total_credits'], '100.00')

    def test_soft_deleted_transactions_do_not_affect_balances(self):
        customer = self.create_customer()
        transaction_obj = CustomerCashTransaction.objects.create(customer=customer, transaction_type='payment_owed', amount='50.00', description='Debt', created_by=self.admin)
        response = self.client.delete(reverse('customer-cash-transaction-detail', args=[transaction_obj.id]))
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(customer_cash_balance(customer), Decimal('0.00'))
