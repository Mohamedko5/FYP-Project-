import os
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import UserProfile
from customers.models import Customer, CustomerAccount
from daily_journal.models import JournalTransaction
from inventory.models import Inventory, Product, ProductUnit, Warehouse
from invoices.models import Invoice, InvoiceItem
from orders.models import Order, OrderItem
from shipments.models import Shipment, ShipmentItem


class MobileCustomerApiTests(APITestCase):
    def setUp(self):
        self.User = get_user_model()
        self.admin = self.User.objects.create_superuser(
            username='admin',
            email='admin@example.com',
            password='AdminPass123!',
        )
        UserProfile.objects.create(user=self.admin, role=UserProfile.ROLE_ADMIN)
        self.manager = self.User.objects.create_user(
            username='manager',
            email='manager@example.com',
            password='ManagerPass123!',
        )
        UserProfile.objects.create(user=self.manager, role=UserProfile.ROLE_MANAGER)
        self.customer = Customer.objects.create(
            name='Ahmed Trading',
            phone='+249123456789',
            secondary_phone='',
            address='Omdurman',
            customer_type=Customer.TYPE_EXPORTER,
            created_by=self.admin,
            updated_by=self.admin,
        )
        self.customer_user = self.User.objects.create_user(
            username='customer',
            email='customer@example.com',
            password='CustomerPass123!',
        )
        self.account = CustomerAccount.objects.create(user=self.customer_user, customer=self.customer)

    def login(self, email='customer@example.com', password='CustomerPass123!'):
        return self.client.post('/api/mobile/auth/login/', {'email': email, 'password': password}, format='json')

    def authenticate_customer(self):
        login = self.login()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")

    def create_product_stack(self, active=True, deleted=False):
        suffix = Product.objects.count() + 1
        product = Product.objects.create(
            name_en=f'White Sesame {suffix}',
            name_ar=f'سمسم أبيض {suffix}',
            category=Product.CATEGORY_COMMODITY,
            description='High quality white sesame',
            is_active=active,
            is_deleted=deleted,
            created_by=self.admin,
            updated_by=self.admin,
        )
        unit = ProductUnit.objects.create(
            product=product,
            unit='Qintar',
            is_default=True,
            purchase_price=Decimal('80000.00'),
            selling_price=Decimal('110000.00'),
            minimum_selling_price=Decimal('100000.00'),
        )
        warehouse = Warehouse.objects.create(
            warehouse_name='Internal Warehouse',
            location='Secret Location',
            primary_product=product,
            capacity=Decimal('1000.000'),
            capacity_unit='Qintar',
            manager_name='Manager',
            guard_name='Guard',
            created_by=self.admin,
            updated_by=self.admin,
        )
        inventory = Inventory.objects.create(
            warehouse=warehouse,
            product=product,
            unit='Qintar',
            quantity=Decimal('500.000'),
            minimum_threshold=Decimal('20.000'),
        )
        return product, unit, warehouse, inventory

    def create_customer_order(self, customer=None, user=None, status_value=Order.STATUS_PENDING):
        customer = customer or self.customer
        user = user or self.customer_user
        product, unit, _, _ = self.create_product_stack()
        order = Order.objects.create(
            customer=customer,
            status=status_value,
            source_channel=Order.SOURCE_CUSTOMER_APP,
            subtotal=Decimal('220000.00'),
            total_amount=Decimal('220000.00'),
            currency='SDG',
            created_by=user,
        )
        OrderItem.objects.create(
            order=order,
            product=product,
            product_unit=unit,
            product_code_snapshot=product.code,
            product_name_en_snapshot=product.name_en,
            product_name_ar_snapshot=product.name_ar,
            unit_snapshot=unit.unit,
            quantity=Decimal('2.000'),
            unit_price=Decimal('110000.00'),
            line_total=Decimal('220000.00'),
        )
        return order, product, unit

    def create_invoice_and_shipment(self):
        order, product, unit = self.create_customer_order(status_value=Order.STATUS_READY_FOR_SHIPMENT)
        invoice = Invoice.objects.create(
            order=order,
            customer=self.customer,
            status=Invoice.STATUS_ISSUED,
            payment_status=Invoice.PAYMENT_UNPAID,
            subtotal=order.subtotal,
            total_amount=order.total_amount,
            currency='SDG',
            issued_by=self.admin,
        )
        invoice_item = InvoiceItem.objects.create(
            invoice=invoice,
            order_item=order.items.first(),
            product=product,
            product_unit=unit,
            product_code_snapshot=product.code,
            product_name_en_snapshot=product.name_en,
            product_name_ar_snapshot=product.name_ar,
            unit_snapshot=unit.unit,
            quantity=Decimal('2.000'),
            unit_price=Decimal('110000.00'),
            line_total=Decimal('220000.00'),
        )
        shipment = Shipment.objects.create(
            order=order,
            invoice=invoice,
            customer=self.customer,
            status=Shipment.STATUS_READY,
            created_by=self.admin,
        )
        ShipmentItem.objects.create(
            shipment=shipment,
            invoice_item=invoice_item,
            order_item=order.items.first(),
            product=product,
            product_unit=unit,
            product_code_snapshot=product.code,
            product_name_en_snapshot=product.name_en,
            product_name_ar_snapshot=product.name_ar,
            unit_snapshot=unit.unit,
            requested_quantity=Decimal('2.000'),
        )
        return invoice, shipment

    def test_valid_customer_login_succeeds(self):
        response = self.login()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertEqual(response.data['customer']['id'], self.customer.id)

    def test_wrong_password_returns_401(self):
        response = self.login(password='wrong-password')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.data['detail'], 'Invalid email or password.')

    def test_unknown_email_returns_safe_401(self):
        response = self.login(email='unknown@example.com')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.data['detail'], 'Invalid email or password.')

    def test_admin_cannot_use_mobile_login(self):
        response = self.login(email='admin@example.com', password='AdminPass123!')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_manager_cannot_use_mobile_login(self):
        response = self.login(email='manager@example.com', password='ManagerPass123!')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_inactive_user_cannot_login(self):
        self.customer_user.is_active = False
        self.customer_user.save(update_fields=['is_active'])
        response = self.login()
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_inactive_customer_cannot_login(self):
        self.customer.is_active = False
        self.customer.save(update_fields=['is_active'])
        response = self.login()
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_archived_customer_cannot_login(self):
        self.customer.is_deleted = True
        self.customer.is_active = False
        self.customer.save(update_fields=['is_deleted', 'is_active'])
        response = self.login()
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_requires_jwt(self):
        response = self.client.get('/api/mobile/me/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_returns_linked_customer(self):
        login = self.login()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        response = self.client.get('/api/mobile/me/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['id'], self.customer.id)

    def test_customer_cannot_access_another_customer(self):
        other = Customer.objects.create(
            name='Other Customer',
            phone='+249123456780',
            address='Khartoum',
            customer_type=Customer.TYPE_FARMER,
            created_by=self.admin,
            updated_by=self.admin,
        )
        login = self.login()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        response = self.client.get('/api/mobile/me/?customer_id=%s' % other.id)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['id'], self.customer.id)

    def test_password_is_hashed(self):
        self.customer_user.refresh_from_db()
        self.assertNotEqual(self.customer_user.password, 'CustomerPass123!')
        self.assertTrue(self.customer_user.check_password('CustomerPass123!'))

    def test_refresh_returns_access_token(self):
        login = self.login()
        response = self.client.post('/api/mobile/auth/refresh/', {'refresh': login.data['refresh']}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertEqual(response.data['customer']['id'], self.customer.id)

    def test_logout_succeeds(self):
        login = self.login()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        response = self.client.post('/api/mobile/auth/logout/', {'refresh': login.data['refresh']}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    @override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.PBKDF2PasswordHasher'])
    def test_ensure_mobile_customer_command_is_idempotent(self):
        env = {
            'BAYAD_CUSTOMER_EMAIL': 'devcustomer@bayad.com',
            'BAYAD_CUSTOMER_PASSWORD': 'BayadCustomer@2026!',
        }
        with patch.dict(os.environ, env):
            call_command('ensure_mobile_customer', verbosity=0)
            call_command('ensure_mobile_customer', verbosity=0)
        self.assertEqual(CustomerAccount.objects.filter(user__email='devcustomer@bayad.com').count(), 1)
        user = self.User.objects.get(email='devcustomer@bayad.com')
        self.assertTrue(user.check_password('BayadCustomer@2026!'))

    def test_mobile_product_list_requires_customer_authentication(self):
        response = self.client.get('/api/mobile/products/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_mobile_product_list_excludes_archived_and_internal_fields(self):
        self.create_product_stack()
        archived, _, _, _ = self.create_product_stack(active=False, deleted=True)
        self.authenticate_customer()
        response = self.client.get('/api/mobile/products/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        row = response.data['results'][0]
        ids = [item['id'] for item in response.data['results']]
        self.assertNotIn(archived.id, ids)
        self.assertNotIn('purchase_price', str(row))
        self.assertNotIn('minimum_selling_price', str(row))
        self.assertNotIn('Internal Warehouse', str(row))
        self.assertIn('available_quantity', row['units'][0])

    def test_customer_can_create_pending_order_for_self_with_backend_prices(self):
        product, unit, _, inventory = self.create_product_stack()
        before_quantity = inventory.quantity
        self.authenticate_customer()
        response = self.client.post('/api/mobile/orders/', {
            'customer_id': 9999,
            'status': 'completed',
            'items': [{'product_id': product.id, 'product_unit_id': unit.id, 'quantity': '2.000', 'unit_price': '1.00'}],
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        order = Order.objects.get(id=response.data['id'])
        self.assertEqual(order.customer, self.customer)
        self.assertEqual(order.status, Order.STATUS_PENDING)
        self.assertEqual(order.source_channel, Order.SOURCE_CUSTOMER_APP)
        self.assertIsNone(order.received_by)
        self.assertEqual(order.total_amount, Decimal('220000.00'))
        self.assertEqual(order.items.first().unit_price, Decimal('110000.00'))
        inventory.refresh_from_db()
        self.assertEqual(inventory.quantity, before_quantity)
        self.assertFalse(Invoice.objects.filter(order=order).exists())
        self.assertFalse(Shipment.objects.filter(order=order).exists())
        self.assertEqual(JournalTransaction.objects.count(), 0)

    def test_invalid_product_unit_and_quantity_fail(self):
        product, unit, _, _ = self.create_product_stack()
        other_product = Product.objects.create(name_en='Corn Test', name_ar='ذرة اختبار', category=Product.CATEGORY_COMMODITY, description='Corn', created_by=self.admin, updated_by=self.admin)
        wrong_unit = ProductUnit.objects.create(product=other_product, unit='KG', selling_price=Decimal('10.00'))
        self.authenticate_customer()
        bad_unit = self.client.post('/api/mobile/orders/', {'items': [{'product_id': product.id, 'product_unit_id': wrong_unit.id, 'quantity': '1.000'}]}, format='json')
        self.assertEqual(bad_unit.status_code, status.HTTP_400_BAD_REQUEST)
        zero = self.client.post('/api/mobile/orders/', {'items': [{'product_id': product.id, 'product_unit_id': unit.id, 'quantity': '0'}]}, format='json')
        self.assertEqual(zero.status_code, status.HTTP_400_BAD_REQUEST)

    def test_duplicate_idempotency_key_does_not_create_duplicate_order(self):
        product, unit, _, _ = self.create_product_stack()
        self.authenticate_customer()
        payload = {'items': [{'product_id': product.id, 'product_unit_id': unit.id, 'quantity': '1.000'}]}
        first = self.client.post('/api/mobile/orders/', payload, format='json', HTTP_IDEMPOTENCY_KEY='same-key')
        second = self.client.post('/api/mobile/orders/', payload, format='json', HTTP_IDEMPOTENCY_KEY='same-key')
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(Order.objects.filter(customer=self.customer).count(), 1)

    def test_customer_sees_only_their_orders_invoices_and_shipments(self):
        own_order, _, _ = self.create_customer_order()
        own_invoice, own_shipment = self.create_invoice_and_shipment()
        other_customer = Customer.objects.create(name='Other', phone='+249123456780', address='Khartoum', customer_type=Customer.TYPE_FARMER, created_by=self.admin, updated_by=self.admin)
        other_user = self.User.objects.create_user(username='other', email='other@example.com', password='OtherPass123!')
        CustomerAccount.objects.create(user=other_user, customer=other_customer)
        other_order, _, _ = self.create_customer_order(customer=other_customer, user=other_user)
        self.authenticate_customer()
        orders = self.client.get('/api/mobile/orders/')
        self.assertContains(orders, own_order.order_number)
        self.assertNotContains(orders, other_order.order_number)
        self.assertEqual(self.client.get(f'/api/mobile/orders/{other_order.id}/').status_code, status.HTTP_404_NOT_FOUND)
        invoices = self.client.get('/api/mobile/invoices/')
        self.assertContains(invoices, own_invoice.invoice_number)
        shipments = self.client.get('/api/mobile/shipments/')
        self.assertContains(shipments, own_shipment.shipment_number)

    def test_customer_read_only_invoice_and_shipment_endpoints(self):
        invoice, shipment = self.create_invoice_and_shipment()
        self.authenticate_customer()
        self.assertEqual(self.client.post(f'/api/mobile/invoices/{invoice.id}/', {}).status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertEqual(self.client.post(f'/api/mobile/shipments/{shipment.id}/', {}).status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_home_summary_is_customer_specific(self):
        self.create_invoice_and_shipment()
        other_customer = Customer.objects.create(name='Other', phone='+249123456780', address='Khartoum', customer_type=Customer.TYPE_FARMER, created_by=self.admin, updated_by=self.admin)
        other_user = self.User.objects.create_user(username='other', email='other@example.com', password='OtherPass123!')
        CustomerAccount.objects.create(user=other_user, customer=other_customer)
        self.create_customer_order(customer=other_customer, user=other_user)
        self.authenticate_customer()
        response = self.client.get('/api/mobile/home-summary/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['customer']['code'], self.customer.code)
        self.assertEqual(response.data['orders']['total'], 1)
        self.assertEqual(response.data['invoices']['unpaid'], 1)
        self.assertEqual(response.data['shipments']['ready'], 1)

    def test_admin_cannot_use_customer_mobile_apis(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get('/api/mobile/products/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
