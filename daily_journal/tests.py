from datetime import datetime, time, timedelta
from decimal import Decimal
from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase, override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from .models import JournalTransaction


class JournalTransactionAPITests(APITestCase):
    url = '/api/journal/transactions/'
    summary_url = '/api/journal/transactions/daily-summary/'

    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username='admin', email='admin@bayad.com', password='admin123')
        self.other_user = User.objects.create_user(username='manager', email='manager@bayad.com', password='admin123')

    def authenticate(self):
        self.client.force_authenticate(self.user)

    def cash_payload(self, **overrides):
        payload = {
            'journal_type': 'cash',
            'cash_type': 'income',
            'payment_method': 'cash',
            'amount': '1000.00',
            'party': 'Al-Noor Trading',
            'description': 'Cash payment',
        }
        payload.update(overrides)
        return payload

    def commodity_payload(self, **overrides):
        payload = {
            'journal_type': 'commodity',
            'product_name': 'White Sesame',
            'quantity': '5.000',
            'unit': 'Qintar',
            'estimated_value': '500.00',
            'party': 'Al-Noor Trading',
            'description': 'Commodity received',
        }
        payload.update(overrides)
        return payload

    def create_transaction(self, payload=None):
        self.authenticate()
        response = self.client.post(self.url, payload or self.cash_payload(), format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        return JournalTransaction.objects.get(id=response.data['id'])

    def move_created_at(self, transaction, day, hour=9):
        current_timezone = timezone.get_current_timezone()
        created_at = timezone.make_aware(datetime.combine(day, datetime.min.time()).replace(hour=hour), current_timezone)
        JournalTransaction.objects.filter(id=transaction.id).update(created_at=created_at)
        transaction.refresh_from_db()
        return transaction

    def test_unauthenticated_list_request_returns_401(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_authenticated_cash_transaction_creation_succeeds(self):
        transaction = self.create_transaction()
        self.assertEqual(transaction.journal_type, JournalTransaction.JOURNAL_CASH)
        self.assertEqual(transaction.payment_method, JournalTransaction.PAYMENT_CASH)
        self.assertEqual(transaction.amount, Decimal('1000.00'))

    def test_cash_transaction_with_payment_method_cash_succeeds(self):
        transaction = self.create_transaction(self.cash_payload(payment_method='cash'))
        self.assertEqual(transaction.payment_method, JournalTransaction.PAYMENT_CASH)

    def receipt_file(self, name='receipt.jpg'):
        return SimpleUploadedFile(name, b'receipt image bytes', content_type='image/jpeg')

    def electronic_payload(self, **overrides):
        payload = self.cash_payload(
            payment_method='electronic',
            electronic_reference='TRX-12345',
            payment_receipt=self.receipt_file(),
        )
        payload.update(overrides)
        return payload

    def test_cash_transaction_with_payment_method_electronic_succeeds(self):
        self.authenticate()
        response = self.client.post(self.url, self.electronic_payload(), format='multipart')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        transaction = JournalTransaction.objects.get(id=response.data['id'])
        self.assertEqual(transaction.payment_method, JournalTransaction.PAYMENT_ELECTRONIC)
        self.assertEqual(transaction.electronic_reference, 'TRX-12345')
        self.assertTrue(transaction.payment_receipt)

    def test_electronic_payment_requires_reference_and_receipt(self):
        self.authenticate()
        missing_reference = self.client.post(self.url, self.cash_payload(payment_method='electronic'), format='multipart')
        self.assertEqual(missing_reference.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('electronic_reference', missing_reference.data)
        self.assertIn('payment_receipt', missing_reference.data)

    def test_cash_payment_clears_electronic_reference_and_receipt(self):
        self.authenticate()
        response = self.client.post(self.url, self.cash_payload(electronic_reference='TRX-1', payment_receipt=self.receipt_file()), format='multipart')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        transaction = JournalTransaction.objects.get(id=response.data['id'])
        self.assertEqual(transaction.electronic_reference, '')
        self.assertFalse(transaction.payment_receipt)

    def test_created_by_is_assigned_automatically(self):
        transaction = self.create_transaction()
        self.assertEqual(transaction.created_by, self.user)

    def test_date_and_time_are_generated_automatically(self):
        self.authenticate()
        response = self.client.post(self.url, self.cash_payload(), format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertIn('date', response.data)
        self.assertIn('time', response.data)
        self.assertRegex(response.data['date'], r'^\d{4}-\d{2}-\d{2}$')
        self.assertRegex(response.data['time'], r'^\d{2}:\d{2}$')

    def test_user_supplied_backend_owned_fields_cannot_override_values(self):
        self.authenticate()
        payload = self.cash_payload(
            date='2000-01-01',
            time='01:02',
            created_by=self.other_user.id,
            source_type='invoice',
            is_system_generated=True,
        )
        response = self.client.post(self.url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        transaction = JournalTransaction.objects.get(id=response.data['id'])
        self.assertEqual(transaction.created_by, self.user)
        self.assertEqual(transaction.source_type, JournalTransaction.SOURCE_MANUAL)
        self.assertFalse(transaction.is_system_generated)
        self.assertNotEqual(response.data['date'], '2000-01-01')

    def test_cash_amount_zero_is_rejected(self):
        self.authenticate()
        response = self.client.post(self.url, self.cash_payload(amount='0'), format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('amount', response.data)

    def test_negative_cash_amount_is_rejected(self):
        self.authenticate()
        response = self.client.post(self.url, self.cash_payload(amount='-1'), format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('amount', response.data)

    def test_cash_transaction_without_cash_type_is_rejected(self):
        self.authenticate()
        response = self.client.post(self.url, self.cash_payload(cash_type=''), format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('cash_type', response.data)

    def test_cash_transaction_without_payment_method_fails(self):
        self.authenticate()
        response = self.client.post(self.url, self.cash_payload(payment_method=''), format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('payment_method', response.data)

    def test_invalid_payment_method_fails(self):
        self.authenticate()
        for payment_method in ('bank', 'card', 'transfer', 'mobile'):
            response = self.client.post(self.url, self.cash_payload(payment_method=payment_method), format='json')
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertIn('payment_method', response.data)

    def test_commodity_transaction_with_payment_method_fails(self):
        self.authenticate()
        response = self.client.post(self.url, self.commodity_payload(payment_method='cash'), format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('payment_method', response.data)

    def test_commodity_transaction_creation_succeeds(self):
        transaction = self.create_transaction(self.commodity_payload())
        self.assertEqual(transaction.journal_type, JournalTransaction.JOURNAL_COMMODITY)
        self.assertEqual(transaction.quantity, Decimal('5.000'))

    def test_commodity_creation_succeeds_without_commodity_direction(self):
        self.authenticate()
        response = self.client.post(self.url, self.commodity_payload(), format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

    def test_commodity_direction_is_not_returned_by_api(self):
        transaction = self.create_transaction(self.commodity_payload())

        self.authenticate()
        response = self.client.get(f'{self.url}{transaction.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotIn('commodity_direction', response.data)

    def test_commodity_direction_sent_by_client_is_rejected(self):
        self.authenticate()
        response = self.client.post(self.url, self.commodity_payload(commodity_direction='lahu'), format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['commodity_direction'][0], 'This field is not supported.')

    def test_invalid_commodity_unit_combination_is_rejected(self):
        self.authenticate()
        response = self.client.post(self.url, self.commodity_payload(product_name='Plastic', unit='Qintar'), format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('unit', response.data)

    def test_white_sesame_with_qintar_succeeds(self):
        transaction = self.create_transaction(self.commodity_payload(product_name='White Sesame', unit='Qintar'))
        self.assertEqual(transaction.unit, 'Qintar')

    def test_corn_with_kg_succeeds(self):
        transaction = self.create_transaction(self.commodity_payload(product_name='Corn', unit='KG'))
        self.assertEqual(transaction.unit, 'KG')

    def test_corn_with_bag_succeeds(self):
        transaction = self.create_transaction(self.commodity_payload(product_name='Corn', unit='Bag'))
        self.assertEqual(transaction.unit, 'Bag')

    def test_corn_with_qintar_fails(self):
        self.authenticate()
        response = self.client.post(self.url, self.commodity_payload(product_name='Corn', unit='Qintar'), format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('unit', response.data)

    def test_supply_product_with_bale_succeeds(self):
        transaction = self.create_transaction(self.commodity_payload(product_name='Dabara', unit='Bale'))
        self.assertEqual(transaction.unit, 'Bale')

    def test_commodity_quantity_zero_or_negative_is_rejected(self):
        self.authenticate()
        zero_response = self.client.post(self.url, self.commodity_payload(quantity='0'), format='json')
        negative_response = self.client.post(self.url, self.commodity_payload(quantity='-1'), format='json')
        self.assertEqual(zero_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(negative_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('quantity', zero_response.data)
        self.assertIn('quantity', negative_response.data)

    def test_date_filtering_works(self):
        today = timezone.localdate()
        yesterday = today - timedelta(days=1)
        today_transaction = self.move_created_at(self.create_transaction(), today)
        self.move_created_at(self.create_transaction(self.cash_payload(party='Yesterday')), yesterday)

        self.authenticate()
        response = self.client.get(self.url, {'date': today.isoformat()})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([row['id'] for row in response.data], [today_transaction.id])

    def test_journal_type_filtering_works(self):
        cash = self.create_transaction()
        self.create_transaction(self.commodity_payload())

        self.authenticate()
        response = self.client.get(self.url, {'journal_type': 'cash'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([row['id'] for row in response.data], [cash.id])

    def test_search_works(self):
        target = self.create_transaction(self.cash_payload(party='Special Buyer'))
        self.create_transaction(self.cash_payload(party='Other Buyer'))

        self.authenticate()
        response = self.client.get(self.url, {'search': 'Special'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([row['id'] for row in response.data], [target.id])

    def test_filtering_by_payment_method_cash_works(self):
        cash = self.create_transaction(self.cash_payload(payment_method='cash'))
        self.authenticate()
        electronic = self.client.post(self.url, self.electronic_payload(), format='multipart')
        self.assertEqual(electronic.status_code, status.HTTP_201_CREATED, electronic.data)

        self.authenticate()
        response = self.client.get(self.url, {'journal_type': 'cash', 'payment_method': 'cash'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([row['id'] for row in response.data], [cash.id])

    def test_filtering_by_payment_method_electronic_works(self):
        self.create_transaction(self.cash_payload(payment_method='cash'))
        self.authenticate()
        electronic_response = self.client.post(self.url, self.electronic_payload(), format='multipart')
        self.assertEqual(electronic_response.status_code, status.HTTP_201_CREATED, electronic_response.data)

        self.authenticate()
        response = self.client.get(self.url, {'journal_type': 'cash', 'payment_method': 'electronic'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([row['id'] for row in response.data], [electronic_response.data['id']])

    def test_patch_preserves_created_at_and_created_by(self):
        transaction = self.create_transaction()
        created_at = transaction.created_at

        self.authenticate()
        response = self.client.patch(f'{self.url}{transaction.id}/', {'amount': '1200.00', 'created_by': self.other_user.id}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        transaction.refresh_from_db()
        self.assertEqual(transaction.created_at, created_at)
        self.assertEqual(transaction.created_by, self.user)
        self.assertEqual(transaction.updated_by, self.user)
        self.assertEqual(transaction.amount, Decimal('1200.00'))

    def test_delete_performs_soft_deletion(self):
        transaction = self.create_transaction()

        self.authenticate()
        response = self.client.delete(f'{self.url}{transaction.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        transaction.refresh_from_db()
        self.assertTrue(transaction.is_deleted)
        self.assertEqual(transaction.deleted_by, self.user)
        self.assertIsNotNone(transaction.deleted_at)

    def test_soft_deleted_transactions_do_not_appear_in_lists(self):
        transaction = self.create_transaction()
        transaction.is_deleted = True
        transaction.deleted_by = self.user
        transaction.deleted_at = timezone.now()
        transaction.save()

        self.authenticate()
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])

    def test_soft_deleted_transactions_do_not_affect_summaries(self):
        today = timezone.localdate()
        transaction = self.move_created_at(self.create_transaction(self.cash_payload(amount='999.00')), today)
        transaction.is_deleted = True
        transaction.deleted_by = self.user
        transaction.deleted_at = timezone.now()
        transaction.save()

        self.authenticate()
        response = self.client.get(self.summary_url, {'date': today.isoformat()})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['cash']['total_income'], '0.00')

    def test_opening_balance_is_isolated_per_date_and_zero_by_default(self):
        today = timezone.localdate()
        yesterday = today - timedelta(days=1)
        self.move_created_at(self.create_transaction(self.cash_payload(amount='1000.00', cash_type='income')), yesterday)

        self.authenticate()
        response = self.client.get(self.summary_url, {'date': today.isoformat()})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['cash']['opening_balance'], '0.00')

    def test_opening_balance_is_fetched_correctly(self):
        today = timezone.localdate()
        from .models import DailyOpeningBalance
        DailyOpeningBalance.objects.create(journal_date=today, amount=Decimal('5000.00'), created_by=self.user)
        
        self.authenticate()
        response = self.client.get(self.summary_url, {'date': today.isoformat()})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['cash']['opening_balance'], '5000.00')
        self.assertTrue(response.data['cash']['is_opening_balance_set'])

    def test_daily_income_expenses_net_and_closing_balance_are_correct(self):
        today = timezone.localdate()
        yesterday = today - timedelta(days=1)
        self.move_created_at(self.create_transaction(self.cash_payload(amount='500.00', cash_type='income')), yesterday)
        self.move_created_at(self.create_transaction(self.cash_payload(amount='1000.00', cash_type='income')), today)
        self.move_created_at(self.create_transaction(self.cash_payload(amount='200.00', cash_type='expense')), today)

        self.authenticate()
        response = self.client.get(self.summary_url, {'date': today.isoformat()})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['cash']['opening_balance'], '0.00')
        self.assertEqual(response.data['cash']['total_income'], '1000.00')
        self.assertEqual(response.data['cash']['total_expenses'], '200.00')
        self.assertEqual(response.data['cash']['net'], '800.00')
        self.assertEqual(response.data['cash']['closing_balance'], '800.00')

    def test_dashboard_daily_summary_never_falls_back_to_latest_transaction_date(self):
        july_29 = datetime.strptime('2026-07-29', '%Y-%m-%d').date()
        july_30 = datetime.strptime('2026-07-30', '%Y-%m-%d').date()
        income = self.move_created_at(self.create_transaction(self.cash_payload(amount='200000.00', cash_type='income')), july_29)
        expense = self.move_created_at(self.create_transaction(self.cash_payload(amount='10000.00', cash_type='expense')), july_29)

        self.authenticate()
        july_29_response = self.client.get(self.summary_url, {'date': july_29.isoformat()})
        self.assertEqual(july_29_response.status_code, status.HTTP_200_OK)
        self.assertEqual(july_29_response.data['business_date'], '2026-07-29')
        self.assertEqual(july_29_response.data['today_income'], '200000.00')
        self.assertEqual(july_29_response.data['today_expenses'], '10000.00')
        self.assertEqual(july_29_response.data['today_net_movement'], '190000.00')

        july_30_response = self.client.get(self.summary_url, {'date': july_30.isoformat()})
        self.assertEqual(july_30_response.status_code, status.HTTP_200_OK)
        self.assertEqual(july_30_response.data['business_date'], '2026-07-30')
        self.assertEqual(july_30_response.data['today_income'], '0.00')
        self.assertEqual(july_30_response.data['today_expenses'], '0.00')
        self.assertEqual(july_30_response.data['today_net_movement'], '0.00')
        self.assertEqual(july_30_response.data['cash']['total_income'], '0.00')
        self.assertEqual(july_30_response.data['cash']['total_expenses'], '0.00')
        self.assertEqual(july_30_response.data['cash']['net'], '0.00')

        july_30_income = self.move_created_at(self.create_transaction(self.cash_payload(amount='5000.00', cash_type='income')), july_30)
        july_30_after_income = self.client.get(self.summary_url, {'date': july_30.isoformat()})
        self.assertEqual(july_30_after_income.status_code, status.HTTP_200_OK)
        self.assertEqual(july_30_after_income.data['business_date'], '2026-07-30')
        self.assertEqual(july_30_after_income.data['today_income'], '5000.00')
        self.assertEqual(july_30_after_income.data['today_expenses'], '0.00')
        self.assertEqual(july_30_after_income.data['today_net_movement'], '5000.00')

        income.refresh_from_db()
        expense.refresh_from_db()
        july_30_income.refresh_from_db()
        self.assertEqual(timezone.localtime(income.created_at).date(), july_29)
        self.assertEqual(timezone.localtime(expense.created_at).date(), july_29)
        self.assertEqual(timezone.localtime(july_30_income.created_at).date(), july_30)

    def test_reversed_cash_transactions_are_excluded_from_daily_summary(self):
        today = timezone.localdate()
        transaction = self.move_created_at(self.create_transaction(self.cash_payload(amount='999.00', cash_type='income')), today)
        transaction.is_reversed = True
        transaction.reversed_at = timezone.now()
        transaction.reversed_by = self.user
        transaction.reversal_reason = 'Voided test entry'
        transaction.save(update_fields=['is_reversed', 'reversed_at', 'reversed_by', 'reversal_reason'])

        self.authenticate()
        response = self.client.get(self.summary_url, {'date': today.isoformat()})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['today_income'], '0.00')
        self.assertEqual(response.data['today_net_movement'], '0.00')

    @override_settings(TIME_ZONE='Asia/Kuala_Lumpur')
    def test_daily_summary_uses_configured_local_timezone_boundaries(self):
        current_timezone = timezone.get_current_timezone()
        july_30 = datetime.strptime('2026-07-30', '%Y-%m-%d').date()
        local_early_morning = timezone.make_aware(datetime.combine(july_30, time(1, 30)), current_timezone)
        transaction = self.create_transaction(self.cash_payload(amount='1234.00', cash_type='income'))
        JournalTransaction.objects.filter(id=transaction.id).update(created_at=local_early_morning)

        self.authenticate()
        july_29_response = self.client.get(self.summary_url, {'date': '2026-07-29'})
        july_30_response = self.client.get(self.summary_url, {'date': '2026-07-30'})
        self.assertEqual(july_29_response.status_code, status.HTTP_200_OK)
        self.assertEqual(july_30_response.status_code, status.HTTP_200_OK)
        self.assertEqual(july_29_response.data['today_income'], '0.00')
        self.assertEqual(july_30_response.data['business_date'], '2026-07-30')
        self.assertEqual(july_30_response.data['today_income'], '1234.00')

    def test_payment_method_does_not_change_financial_summary_calculations(self):
        today = timezone.localdate()
        self.move_created_at(self.create_transaction(self.cash_payload(amount='700.00', cash_type='income', payment_method='cash')), today)
        self.authenticate()
        electronic_income = self.client.post(self.url, self.electronic_payload(amount='300.00', cash_type='income', payment_receipt=self.receipt_file('income.jpg')), format='multipart')
        electronic_expense = self.client.post(self.url, self.electronic_payload(amount='100.00', cash_type='expense', payment_receipt=self.receipt_file('expense.jpg')), format='multipart')
        self.assertEqual(electronic_income.status_code, status.HTTP_201_CREATED, electronic_income.data)
        self.assertEqual(electronic_expense.status_code, status.HTTP_201_CREATED, electronic_expense.data)
        self.move_created_at(JournalTransaction.objects.get(id=electronic_income.data['id']), today)
        self.move_created_at(self.create_transaction(self.cash_payload(amount='100.00', cash_type='expense', payment_method='cash')), today)
        self.move_created_at(JournalTransaction.objects.get(id=electronic_expense.data['id']), today)

        self.authenticate()
        response = self.client.get(self.summary_url, {'date': today.isoformat()})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['cash']['total_income'], '1000.00')
        self.assertEqual(response.data['cash']['total_expenses'], '200.00')
        self.assertEqual(response.data['cash']['net'], '800.00')
        self.assertEqual(response.data['cash']['closing_balance'], '800.00')
        self.assertEqual(response.data['cash']['payment_methods']['cash']['income'], '700.00')
        self.assertEqual(response.data['cash']['payment_methods']['cash']['expenses'], '100.00')
        self.assertEqual(response.data['cash']['payment_methods']['electronic']['income'], '300.00')
        self.assertEqual(response.data['cash']['payment_methods']['electronic']['expenses'], '100.00')

    def test_commodity_summary_groups_by_product_name_and_unit(self):
        today = timezone.localdate()
        self.move_created_at(self.create_transaction(self.commodity_payload(product_name='Corn', unit='KG', quantity='12.500')), today)
        self.move_created_at(self.create_transaction(self.commodity_payload(product_name='Corn', unit='Bag', quantity='3.000')), today)
        self.move_created_at(self.create_transaction(self.commodity_payload(product_name='Corn', unit='KG', quantity='2.500')), today)

        self.authenticate()
        response = self.client.get(self.summary_url, {'date': today.isoformat()})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        groups = response.data['commodity']['groups']
        self.assertIn({'product_name': 'Corn', 'unit': 'KG', 'quantity': '15.000', 'estimated_value': '1000.00', 'transaction_count': 2}, groups)
        self.assertIn({'product_name': 'Corn', 'unit': 'Bag', 'quantity': '3.000', 'estimated_value': '500.00', 'transaction_count': 1}, groups)

    def test_commodity_summary_calculates_estimated_values_correctly(self):
        today = timezone.localdate()
        self.move_created_at(self.create_transaction(self.commodity_payload(product_name='Plastic', unit='Bale', estimated_value='120.50')), today)
        self.move_created_at(self.create_transaction(self.commodity_payload(product_name='Plastic', unit='Bale', estimated_value='79.50')), today)

        self.authenticate()
        response = self.client.get(self.summary_url, {'date': today.isoformat()})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['commodity']['transaction_count'], 2)
        self.assertEqual(response.data['commodity']['estimated_total_value'], '200.00')
        self.assertEqual(response.data['commodity']['groups'][0]['estimated_value'], '200.00')

    def test_different_units_are_never_combined(self):
        today = timezone.localdate()
        self.move_created_at(self.create_transaction(self.commodity_payload(product_name='Corn', unit='KG', quantity='10.000')), today)
        self.move_created_at(self.create_transaction(self.commodity_payload(product_name='Corn', unit='Bag', quantity='10.000')), today)

        self.authenticate()
        response = self.client.get(self.summary_url, {'date': today.isoformat()})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        groups = response.data['commodity']['groups']
        self.assertEqual(len(groups), 2)
        self.assertIn({'product_name': 'Corn', 'unit': 'KG', 'quantity': '10.000', 'estimated_value': '500.00', 'transaction_count': 1}, groups)
        self.assertIn({'product_name': 'Corn', 'unit': 'Bag', 'quantity': '10.000', 'estimated_value': '500.00', 'transaction_count': 1}, groups)

    def test_existing_commodity_records_remain_after_migration(self):
        transaction = self.create_transaction(self.commodity_payload())
        transaction.refresh_from_db()
        self.assertEqual(JournalTransaction.objects.filter(id=transaction.id, journal_type='commodity').count(), 1)

    def test_white_sesame_accepts_qintar_only(self):
        self.authenticate()
        valid = self.client.post(self.url, self.commodity_payload(product_name='White Sesame', unit='Qintar'), format='json')
        invalid = self.client.post(self.url, self.commodity_payload(product_name='White Sesame', unit='KG'), format='json')
        self.assertEqual(valid.status_code, status.HTTP_201_CREATED, valid.data)
        self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('unit', invalid.data)

    def test_corn_accepts_kg_and_bag_only(self):
        self.authenticate()
        kg = self.client.post(self.url, self.commodity_payload(product_name='Corn', unit='KG'), format='json')
        bag = self.client.post(self.url, self.commodity_payload(product_name='Corn', unit='Bag'), format='json')
        qintar = self.client.post(self.url, self.commodity_payload(product_name='Corn', unit='Qintar'), format='json')
        self.assertEqual(kg.status_code, status.HTTP_201_CREATED, kg.data)
        self.assertEqual(bag.status_code, status.HTTP_201_CREATED, bag.data)
        self.assertEqual(qintar.status_code, status.HTTP_400_BAD_REQUEST)

    def test_supply_products_accept_bale_and_unit_only(self):
        self.authenticate()
        for product_name in ('Dabara', 'Sacks / Khaysh', 'Plastic'):
            bale = self.client.post(self.url, self.commodity_payload(product_name=product_name, unit='Bale'), format='json')
            unit = self.client.post(self.url, self.commodity_payload(product_name=product_name, unit='Unit'), format='json')
            qintar = self.client.post(self.url, self.commodity_payload(product_name=product_name, unit='Qintar'), format='json')
            self.assertEqual(bale.status_code, status.HTTP_201_CREATED, bale.data)
            self.assertEqual(unit.status_code, status.HTTP_201_CREATED, unit.data)
            self.assertEqual(qintar.status_code, status.HTTP_400_BAD_REQUEST)

    def test_one_user_cannot_set_audit_fields_manually(self):
        self.authenticate()
        response = self.client.post(
            self.url,
            self.cash_payload(created_by=self.other_user.id, updated_by=self.other_user.id, deleted_by=self.other_user.id),
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        transaction = JournalTransaction.objects.get(id=response.data['id'])
        self.assertEqual(transaction.created_by, self.user)
        self.assertIsNone(transaction.updated_by)
        self.assertIsNone(transaction.deleted_by)

    def test_cash_search_input_is_no_longer_rendered_in_frontend(self):
        page = Path(__file__).resolve().parents[1] / 'src' / 'pages' / 'DailyJournal.jsx'
        source = page.read_text(encoding='utf-8')
        self.assertNotIn('cashFilters.search', source)
        self.assertNotIn("placeholder={t('journal.searchPlaceholder')}", source.split("journalType === 'cash'")[1].split(") : (")[0])

    def test_payment_method_segment_displays_cash_and_electronic(self):
        form = Path(__file__).resolve().parents[1] / 'src' / 'components' / 'journal' / 'CashJournalForm.jsx'
        source = form.read_text(encoding='utf-8')
        self.assertIn('name="paymentMethod"', source)
        self.assertIn('value="cash"', source)
        self.assertIn('value="electronic"', source)

    def test_dashboard_uses_local_business_date_for_daily_summary_request(self):
        page = Path(__file__).resolve().parents[1] / 'src' / 'pages' / 'Dashboard.jsx'
        source = page.read_text(encoding='utf-8')
        self.assertIn('function toLocalDateString', source)
        self.assertIn("getDailyJournalSummary({ date: requestedBusinessDate })", source)
        self.assertNotIn('toISOString().slice(0, 10)', source)

    def test_dashboard_today_cards_render_backend_business_date(self):
        page = Path(__file__).resolve().parents[1] / 'src' / 'pages' / 'Dashboard.jsx'
        source = page.read_text(encoding='utf-8')
        self.assertIn("data.journalSummary?.business_date || data.journalSummary?.date || businessDate", source)
        self.assertIn('note={dailyBusinessDate}', source)
        self.assertIn('data.journalSummary?.today_income ?? cash.total_income', source)
        self.assertIn('data.journalSummary?.today_expenses ?? cash.total_expenses', source)
        self.assertIn('data.journalSummary?.today_net_movement ?? cash.net', source)


class PaymentMethodMigrationTests(TransactionTestCase):
    migrate_from = [('daily_journal', '0002_remove_journaltransaction_commodity_direction')]
    migrate_to = [('daily_journal', '0003_journaltransaction_payment_method_and_more')]

    def test_existing_cash_transactions_are_migrated_to_cash_safely(self):
        executor = MigrationExecutor(connection)
        executor.migrate(self.migrate_from)
        old_apps = executor.loader.project_state(self.migrate_from).apps

        User = old_apps.get_model('auth', 'User')
        JournalTransaction = old_apps.get_model('daily_journal', 'JournalTransaction')
        user = User.objects.create_user(username='legacy-admin', email='legacy@bayad.com', password='admin123')
        transaction = JournalTransaction.objects.create(
            journal_type='cash',
            cash_type='income',
            amount=Decimal('25.00'),
            party='Legacy Buyer',
            description='Legacy cash transaction',
            source_type='manual',
            is_system_generated=False,
            created_by=user,
        )

        executor = MigrationExecutor(connection)
        executor.migrate(self.migrate_to)
        new_apps = executor.loader.project_state(self.migrate_to).apps
        MigratedJournalTransaction = new_apps.get_model('daily_journal', 'JournalTransaction')
        migrated = MigratedJournalTransaction.objects.get(id=transaction.id)
        self.assertEqual(migrated.payment_method, 'cash')

# Create your tests here.
