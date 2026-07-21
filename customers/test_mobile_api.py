import os
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import UserProfile
from customers.models import Customer, CustomerAccount


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
