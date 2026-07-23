from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import UserProfile
from communications.models import ChatMessage
from customers.models import Customer, CustomerAccount, CustomerCashTransaction
from daily_journal.models import JournalTransaction
from inventory.models import Inventory, InventoryMovement, Product, ProductUnit, Warehouse

from .models import SupplyOffer, SupplyOfferAttachment


@override_settings(MEDIA_ROOT='test_media')
class SupplyOfferAPITests(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.admin = User.objects.create_user(username='admin', email='admin@bayad.com', password='admin123')
        UserProfile.objects.create(user=self.admin, role='admin')
        self.customer_user = User.objects.create_user(username='cust1', email='cust1@example.com', password='pass12345')
        self.other_user = User.objects.create_user(username='cust2', email='cust2@example.com', password='pass12345')
        self.customer = Customer.objects.create(name='Ahmed Trading', phone='+249111111111', address='Kosti', customer_type=Customer.TYPE_SUPPLIER, created_by=self.admin)
        self.other_customer = Customer.objects.create(name='Other Supplier', phone='+249222222222', address='Sennar', customer_type=Customer.TYPE_SUPPLIER, created_by=self.admin)
        CustomerAccount.objects.create(user=self.customer_user, customer=self.customer)
        CustomerAccount.objects.create(user=self.other_user, customer=self.other_customer)
        self.sesame = Product.objects.get(name_en='White Sesame')
        self.corn = Product.objects.get(name_en='Corn')
        self.qintar = ProductUnit.objects.get(product=self.sesame, unit='Qintar')
        self.kg = ProductUnit.objects.get(product=self.corn, unit='KG')
        self.bag = ProductUnit.objects.get(product=self.corn, unit='Bag')
        self.warehouse = Warehouse.objects.create(
            warehouse_name='Main Sesame Warehouse',
            location='Kosti',
            primary_product=self.sesame,
            capacity=Decimal('500.000'),
            capacity_unit='Qintar',
            manager_name='Manager',
            guard_name='Guard',
            created_by=self.admin,
        )

    def auth_customer(self):
        self.client.force_authenticate(self.customer_user)

    def auth_other_customer(self):
        self.client.force_authenticate(self.other_user)

    def auth_admin(self):
        self.client.force_authenticate(self.admin)

    def payload(self, **extra):
        data = {
            'customer_reference': 'July offer',
            'region': 'White Nile',
            'city': 'Kosti',
            'area': 'Al Rabwa',
            'detailed_address': 'Farm near Kosti market',
            'availability_date': '2026-07-30',
            'customer_notes': 'Ready for inspection.',
            'items': [
                {
                    'product_id': self.sesame.id,
                    'product_unit_id': self.qintar.id,
                    'quantity': '100.000',
                    'proposed_unit_price': '120000.00',
                    'quality_grade': 'Grade A',
                    'packaging_details': 'Sealed bags',
                }
            ],
        }
        data.update(extra)
        return data

    def create_offer(self):
        self.auth_customer()
        response = self.client.post('/api/supply-offers/mobile/supply-offers/', self.payload(), format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        return SupplyOffer.objects.get(id=response.data['id'])

    def test_customer_authentication_is_required(self):
        response = self.client.get('/api/supply-offers/mobile/supply-offers/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_customer_can_create_draft_and_is_derived_from_user(self):
        offer = self.create_offer()
        self.assertEqual(offer.customer, self.customer)
        self.assertEqual(offer.status, SupplyOffer.STATUS_DRAFT)

    def test_customer_cannot_submit_customer_or_status_fields(self):
        self.auth_customer()
        response = self.client.post('/api/supply-offers/mobile/supply-offers/', self.payload(customer_id=self.other_customer.id, status='approved'), format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_offer_number_and_totals_are_backend_generated(self):
        self.auth_customer()
        response = self.client.post('/api/supply-offers/mobile/supply-offers/', self.payload(offer_number='SUP-FAKE', proposed_total='1.00'), format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        offer = self.create_offer()
        self.assertTrue(offer.offer_number.startswith('SUP-'))
        self.assertEqual(offer.proposed_total, Decimal('12000000.00'))

    def test_offer_requires_at_least_one_item(self):
        self.auth_customer()
        response = self.client.post('/api/supply-offers/mobile/supply-offers/', self.payload(items=[]), format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_quantity_and_price_must_be_positive(self):
        self.auth_customer()
        bad_quantity = self.payload(items=[{'product_id': self.sesame.id, 'product_unit_id': self.qintar.id, 'quantity': '0', 'proposed_unit_price': '120000.00'}])
        self.assertEqual(self.client.post('/api/supply-offers/mobile/supply-offers/', bad_quantity, format='json').status_code, status.HTTP_400_BAD_REQUEST)
        bad_price = self.payload(items=[{'product_id': self.sesame.id, 'product_unit_id': self.qintar.id, 'quantity': '1', 'proposed_unit_price': '0'}])
        self.assertEqual(self.client.post('/api/supply-offers/mobile/supply-offers/', bad_price, format='json').status_code, status.HTTP_400_BAD_REQUEST)

    def test_product_unit_combination_is_validated_and_duplicates_rejected(self):
        self.auth_customer()
        invalid = self.payload(items=[{'product_id': self.sesame.id, 'product_unit_id': self.kg.id, 'quantity': '1', 'proposed_unit_price': '1'}])
        self.assertEqual(self.client.post('/api/supply-offers/mobile/supply-offers/', invalid, format='json').status_code, status.HTTP_400_BAD_REQUEST)
        duplicate_item = {'product_id': self.sesame.id, 'product_unit_id': self.qintar.id, 'quantity': '1', 'proposed_unit_price': '1'}
        duplicate = self.payload(items=[duplicate_item, duplicate_item])
        self.assertEqual(self.client.post('/api/supply-offers/mobile/supply-offers/', duplicate, format='json').status_code, status.HTTP_400_BAD_REQUEST)

    def test_multiple_items_may_be_submitted(self):
        self.auth_customer()
        payload = self.payload(items=[
            {'product_id': self.sesame.id, 'product_unit_id': self.qintar.id, 'quantity': '100', 'proposed_unit_price': '120000'},
            {'product_id': self.corn.id, 'product_unit_id': self.kg.id, 'quantity': '100', 'proposed_unit_price': '900'},
        ])
        response = self.client.post('/api/supply-offers/mobile/supply-offers/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(len(response.data['items']), 2)

    def test_customer_cannot_set_agreed_prices_or_warehouse(self):
        self.auth_customer()
        payload = self.payload(receiving_warehouse_id=self.warehouse.id, agreed_total='20.00')
        response = self.client.post('/api/supply-offers/mobile/supply-offers/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_customer_sees_only_their_offers(self):
        offer = self.create_offer()
        self.auth_other_customer()
        response = self.client.get(f'/api/supply-offers/mobile/supply-offers/{offer.id}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_submit_changes_status_and_creates_offer_card_message(self):
        offer = self.create_offer()
        response = self.client.post(f'/api/supply-offers/mobile/supply-offers/{offer.id}/submit/')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        offer.refresh_from_db()
        self.assertEqual(offer.status, SupplyOffer.STATUS_SUBMITTED)
        self.assertTrue(ChatMessage.objects.filter(card_snapshot__supply_offer_id=offer.id).exists())

    def submit_and_review(self):
        offer = self.create_offer()
        self.client.post(f'/api/supply-offers/mobile/supply-offers/{offer.id}/submit/')
        self.auth_admin()
        response = self.client.post(f'/api/supply-offers/admin/supply-offers/{offer.id}/start-review/')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        offer.refresh_from_db()
        return offer

    def test_admin_can_start_review(self):
        offer = self.submit_and_review()
        self.assertEqual(offer.status, SupplyOffer.STATUS_UNDER_REVIEW)

    def test_approval_does_not_change_inventory_journal_or_payment(self):
        offer = self.submit_and_review()
        before_inventory = Inventory.objects.count()
        before_movements = InventoryMovement.objects.count()
        before_journal = JournalTransaction.objects.count()
        before_payments = CustomerCashTransaction.objects.count()
        response = self.client.post(f'/api/supply-offers/admin/supply-offers/{offer.id}/approve/', {'receiving_warehouse_id': self.warehouse.id}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(Inventory.objects.count(), before_inventory)
        self.assertEqual(InventoryMovement.objects.count(), before_movements)
        self.assertEqual(JournalTransaction.objects.count(), before_journal)
        self.assertEqual(CustomerCashTransaction.objects.count(), before_payments)

    def test_admin_counter_offer_and_customer_accept_or_decline(self):
        offer = self.submit_and_review()
        item = offer.items.first()
        response = self.client.post(f'/api/supply-offers/admin/supply-offers/{offer.id}/counter-offer/', {'items': [{'offer_item_id': item.id, 'admin_proposed_unit_price': '115000.00'}]}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.auth_customer()
        accepted = self.client.post(f'/api/supply-offers/mobile/supply-offers/{offer.id}/accept-counter-offer/')
        self.assertEqual(accepted.status_code, status.HTTP_200_OK, accepted.data)
        offer.refresh_from_db()
        self.assertEqual(offer.status, SupplyOffer.STATUS_CUSTOMER_ACCEPTED)

        second = self.create_offer()
        self.client.post(f'/api/supply-offers/mobile/supply-offers/{second.id}/submit/')
        self.auth_admin()
        self.client.post(f'/api/supply-offers/admin/supply-offers/{second.id}/start-review/')
        item = second.items.first()
        self.client.post(f'/api/supply-offers/admin/supply-offers/{second.id}/counter-offer/', {'items': [{'offer_item_id': item.id, 'admin_proposed_unit_price': '110000.00'}]}, format='json')
        self.auth_customer()
        declined = self.client.post(f'/api/supply-offers/mobile/supply-offers/{second.id}/decline-counter-offer/')
        self.assertEqual(declined.status_code, status.HTTP_200_OK, declined.data)

    def test_admin_can_reject_with_customer_safe_reason(self):
        offer = self.submit_and_review()
        response = self.client.post(f'/api/supply-offers/admin/supply-offers/{offer.id}/reject/', {'rejection_reason': 'Price too high.'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data['rejection_reason'], 'Price too high.')

    def test_customer_may_withdraw_eligible_offer_but_not_approved_offer(self):
        offer = self.create_offer()
        response = self.client.post(f'/api/supply-offers/mobile/supply-offers/{offer.id}/withdraw/')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        approved = self.submit_and_review()
        self.auth_admin()
        self.client.post(f'/api/supply-offers/admin/supply-offers/{approved.id}/approve/', {'receiving_warehouse_id': self.warehouse.id}, format='json')
        self.auth_customer()
        blocked = self.client.post(f'/api/supply-offers/mobile/supply-offers/{approved.id}/withdraw/')
        self.assertEqual(blocked.status_code, status.HTTP_400_BAD_REQUEST)

    def test_attachments_are_protected(self):
        offer = self.create_offer()
        upload = self.client.post(
            f'/api/supply-offers/mobile/supply-offers/{offer.id}/attachments/',
            {'attachment_type': 'product_image', 'file': SimpleUploadedFile('sesame.jpg', b'image', content_type='image/jpeg')},
            format='multipart',
        )
        self.assertEqual(upload.status_code, status.HTTP_201_CREATED, upload.data)
        attachment = SupplyOfferAttachment.objects.get(id=upload.data['id'])
        self.auth_other_customer()
        response = self.client.get(f'/api/supply-offers/attachments/{attachment.id}/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_record_receipt_increases_inventory_once_and_duplicate_is_blocked(self):
        offer = self.submit_and_review()
        self.auth_admin()
        self.client.post(f'/api/supply-offers/admin/supply-offers/{offer.id}/approve/', {'receiving_warehouse_id': self.warehouse.id}, format='json')
        item = offer.items.first()
        response = self.client.post(
            f'/api/supply-offers/admin/supply-offers/{offer.id}/record-receipt/',
            {'receiving_warehouse_id': self.warehouse.id, 'items': [{'offer_item_id': item.id, 'accepted_quantity': '100.000', 'rejected_quantity': '0'}]},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(Inventory.objects.get(warehouse=self.warehouse, product=self.sesame, unit='Qintar').quantity, Decimal('100.000'))
        self.assertEqual(InventoryMovement.objects.filter(source_reference=offer.offer_number).count(), 1)
        duplicate = self.client.post(
            f'/api/supply-offers/admin/supply-offers/{offer.id}/record-receipt/',
            {'receiving_warehouse_id': self.warehouse.id, 'items': [{'offer_item_id': item.id, 'accepted_quantity': '100.000'}]},
            format='json',
        )
        self.assertEqual(duplicate.status_code, status.HTTP_400_BAD_REQUEST)

    def test_payment_is_not_automatic_and_is_separate_after_receipt(self):
        offer = self.submit_and_review()
        self.auth_admin()
        self.client.post(f'/api/supply-offers/admin/supply-offers/{offer.id}/approve/', {'receiving_warehouse_id': self.warehouse.id}, format='json')
        self.assertEqual(JournalTransaction.objects.count(), 0)
        item = offer.items.first()
        self.client.post(
            f'/api/supply-offers/admin/supply-offers/{offer.id}/record-receipt/',
            {'receiving_warehouse_id': self.warehouse.id, 'items': [{'offer_item_id': item.id, 'accepted_quantity': '100.000'}]},
            format='json',
        )
        response = self.client.post(
            f'/api/supply-offers/admin/supply-offers/{offer.id}/record-payment/',
            {'amount': '12000000.00', 'payment_method': 'cash', 'description': 'Paid supplier'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(JournalTransaction.objects.filter(cash_type=JournalTransaction.CASH_EXPENSE).count(), 1)
        self.assertEqual(CustomerCashTransaction.objects.count(), 1)

    def test_idempotency_prevents_duplicate_offer_submission(self):
        self.auth_customer()
        first = self.client.post('/api/supply-offers/mobile/supply-offers/', self.payload(idempotency_key='same-1'), format='json')
        second = self.client.post('/api/supply-offers/mobile/supply-offers/', self.payload(idempotency_key='same-1'), format='json')
        self.assertEqual(first.status_code, status.HTTP_201_CREATED, first.data)
        self.assertEqual(second.status_code, status.HTTP_201_CREATED, second.data)
        self.assertEqual(first.data['id'], second.data['id'])
