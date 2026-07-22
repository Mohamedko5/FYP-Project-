from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import UserProfile
from daily_journal.models import JournalTransaction

from .models import Customer, CustomerCashTransaction


class CustomerPaymentAPITests(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.admin = User.objects.create_user(username='payment-admin', password='pass12345')
        self.manager = User.objects.create_user(username='payment-manager', password='pass12345')
        UserProfile.objects.create(user=self.admin, role=UserProfile.ROLE_ADMIN)
        UserProfile.objects.create(user=self.manager, role=UserProfile.ROLE_MANAGER)
        self.customer = Customer.objects.create(
            name='Customer C1',
            phone='+249912300001',
            address='Sudan',
            customer_type=Customer.TYPE_EXPORTER,
            created_by=self.admin,
        )
        CustomerCashTransaction.objects.create(
            customer=self.customer,
            transaction_type=CustomerCashTransaction.OPENING_DEBT,
            amount=Decimal('5000.00'),
            description='Opening balance',
            source_type=CustomerCashTransaction.SOURCE_SYSTEM,
            is_system_generated=True,
            created_by=self.admin,
        )
        self.url = f'/api/customers/{self.customer.id}/payments/'

    def test_unauthenticated_payment_request_returns_401(self):
        response = self.client.post(self.url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_admin_records_payment_and_creates_linked_journal(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(self.url, {
            'amount': '1000.00',
            'payment_method': 'cash',
            'payment_purpose': CustomerCashTransaction.PURPOSE_PREVIOUS_BALANCE,
            'description': 'Payment for previous account balance',
            'idempotency_key': 'pay-once-1',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertRegex(response.data['payment']['reference_number'], r'^CUS-PAY-\d{4}-\d{6}$')
        payment = CustomerCashTransaction.objects.get(transaction_type=CustomerCashTransaction.PAYMENT_RECEIVED)
        journal = JournalTransaction.objects.get(source_type=JournalTransaction.SOURCE_CUSTOMER)
        self.assertEqual(payment.amount, Decimal('1000.00'))
        self.assertEqual(journal.amount, payment.amount)
        self.assertEqual(journal.payment_method, payment.payment_method)
        self.assertEqual(payment.linked_journal_transaction, journal)
        self.assertEqual(journal.source_reference, payment.reference_number)
        self.assertEqual(response.data['customer_account']['previous_balance'], '5000.00')
        self.assertEqual(response.data['customer_account']['new_balance'], '4000.00')
        self.assertEqual(response.data['customer_account']['cash_status'], 'Debtor')

    def test_manager_can_record_advance_payment_and_credit_balance(self):
        self.customer.cash_transactions.all().delete()
        self.client.force_authenticate(self.manager)
        response = self.client.post(self.url, {
            'amount': '1000.00',
            'payment_method': 'online',
            'payment_purpose': CustomerCashTransaction.PURPOSE_ADVANCE_PAYMENT,
            'description': 'Advance payment',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data['customer_account']['new_balance'], '-1000.00')
        self.assertEqual(response.data['customer_account']['cash_status'], 'Creditor')

    def test_validation_rejects_invalid_amount_method_purpose_and_audit_fields(self):
        self.client.force_authenticate(self.admin)
        for payload in [
            {'amount': '0', 'payment_method': 'cash', 'payment_purpose': CustomerCashTransaction.PURPOSE_PREVIOUS_BALANCE},
            {'amount': '-1', 'payment_method': 'cash', 'payment_purpose': CustomerCashTransaction.PURPOSE_PREVIOUS_BALANCE},
            {'amount': 'NaN', 'payment_method': 'cash', 'payment_purpose': CustomerCashTransaction.PURPOSE_PREVIOUS_BALANCE},
            {'amount': '1', 'payment_method': 'cheque', 'payment_purpose': CustomerCashTransaction.PURPOSE_PREVIOUS_BALANCE},
            {'amount': '1', 'payment_method': 'cash', 'payment_purpose': 'bad'},
            {'amount': '1', 'payment_method': 'cash', 'payment_purpose': CustomerCashTransaction.PURPOSE_PREVIOUS_BALANCE, 'created_by': self.admin.id},
        ]:
            response = self.client.post(self.url, payload, format='json')
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, response.data)

    def test_idempotency_reuses_original_and_rejects_different_payload(self):
        self.client.force_authenticate(self.admin)
        payload = {
            'amount': '1000.00',
            'payment_method': 'cash',
            'payment_purpose': CustomerCashTransaction.PURPOSE_PREVIOUS_BALANCE,
            'description': 'Same payment',
            'idempotency_key': 'same-key',
        }
        first = self.client.post(self.url, payload, format='json')
        second = self.client.post(self.url, payload, format='json')
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_201_CREATED)
        self.assertEqual(CustomerCashTransaction.objects.filter(transaction_type=CustomerCashTransaction.PAYMENT_RECEIVED).count(), 1)
        self.assertEqual(JournalTransaction.objects.filter(source_type=JournalTransaction.SOURCE_CUSTOMER).count(), 1)
        changed = self.client.post(self.url, {**payload, 'amount': '1200.00'}, format='json')
        self.assertEqual(changed.status_code, status.HTTP_400_BAD_REQUEST)

    def test_admin_can_reverse_manual_payment_manager_cannot_reverse_twice_rejected(self):
        self.client.force_authenticate(self.admin)
        payment_response = self.client.post(self.url, {
            'amount': '1000.00',
            'payment_method': 'cash',
            'payment_purpose': CustomerCashTransaction.PURPOSE_PREVIOUS_BALANCE,
            'description': 'Payment',
        }, format='json')
        payment_id = payment_response.data['payment']['id']
        self.client.force_authenticate(self.manager)
        denied = self.client.post(f'/api/customers/payments/{payment_id}/reverse/', {'reason': 'Wrong amount'}, format='json')
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)
        self.client.force_authenticate(self.admin)
        reversed_response = self.client.post(f'/api/customers/payments/{payment_id}/reverse/', {'reason': 'Wrong amount'}, format='json')
        self.assertEqual(reversed_response.status_code, status.HTTP_201_CREATED, reversed_response.data)
        original = CustomerCashTransaction.objects.get(pk=payment_id)
        self.assertTrue(original.is_reversed)
        self.assertEqual(CustomerCashTransaction.objects.filter(transaction_type=CustomerCashTransaction.ADJUSTMENT_DEBIT).count(), 1)
        self.assertEqual(JournalTransaction.objects.filter(cash_type=JournalTransaction.CASH_EXPENSE).count(), 1)
        twice = self.client.post(f'/api/customers/payments/{payment_id}/reverse/', {'reason': 'Again'}, format='json')
        self.assertEqual(twice.status_code, status.HTTP_400_BAD_REQUEST)
