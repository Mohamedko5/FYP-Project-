from django.contrib.auth import get_user_model
from django.core import mail
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import UserProfile
from customers.admin import approve_registration
from customers.models import Customer, CustomerAccount, CustomerPasswordResetRequest, CustomerRegistrationRequest


@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
class MobileRegistrationAndResetTests(APITestCase):
    def setUp(self):
        self.User = get_user_model()
        self.admin = self.User.objects.create_superuser(username='admin', email='admin@example.com', password='AdminPass123!')
        UserProfile.objects.create(user=self.admin, role=UserProfile.ROLE_ADMIN)
        self.manager = self.User.objects.create_user(username='manager', email='manager@example.com', password='ManagerPass123!')
        UserProfile.objects.create(user=self.manager, role=UserProfile.ROLE_MANAGER)
        self.payload = {
            'full_name': 'Ahmed Mohammed',
            'business_name': 'Ahmed Agricultural Trading',
            'email': 'ahmed@example.com',
            'phone': '+249912345678',
            'secondary_phone': '',
            'address': 'Omdurman, Sudan',
            'customer_type': Customer.TYPE_EXPORTER,
            'password': 'StrongPass123!',
            'confirm_password': 'StrongPass123!',
            'accept_terms': True,
        }

    def register(self, payload=None):
        return self.client.post('/api/mobile/auth/register/', payload or self.payload, format='json')

    def code_from_email(self):
        body = mail.outbox[-1].body
        return ''.join(char for char in body if char.isdigit())[:6]

    def verified_registration(self):
        response = self.register()
        registration = CustomerRegistrationRequest.objects.get(id=response.data['registration_id'])
        code = self.code_from_email()
        verify = self.client.post('/api/mobile/auth/verify-email/', {'registration_id': registration.id, 'verification_code': code}, format='json')
        self.assertEqual(verify.status_code, status.HTTP_200_OK)
        registration.refresh_from_db()
        return registration

    def test_valid_registration_hashes_password_and_code(self):
        response = self.register()
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        registration = CustomerRegistrationRequest.objects.get(id=response.data['registration_id'])
        self.assertNotEqual(registration.password_hash, self.payload['password'])
        self.assertTrue(registration.check_registration_password(self.payload['password']))
        self.assertNotIn(self.code_from_email(), registration.verification_code_hash)
        self.assertEqual(registration.status, CustomerRegistrationRequest.STATUS_EMAIL_PENDING)

    def test_duplicate_active_email_and_pending_email_are_rejected(self):
        self.User.objects.create_user(username='active', email=self.payload['email'], password='StrongPass123!')
        self.assertEqual(self.register().status_code, status.HTTP_400_BAD_REQUEST)
        self.User.objects.filter(email=self.payload['email']).delete()
        self.assertEqual(self.register().status_code, status.HTTP_201_CREATED)
        self.assertEqual(self.register().status_code, status.HTTP_400_BAD_REQUEST)

    def test_invalid_phone_and_weak_password_are_rejected(self):
        bad_phone = {**self.payload, 'phone': 'abc'}
        self.assertEqual(self.register(bad_phone).status_code, status.HTTP_400_BAD_REQUEST)
        weak = {**self.payload, 'email': 'weak@example.com', 'phone': '+249912345679', 'password': 'password', 'confirm_password': 'password'}
        self.assertEqual(self.register(weak).status_code, status.HTTP_400_BAD_REQUEST)

    def test_verify_email_correct_incorrect_expired_and_attempt_limit(self):
        response = self.register()
        registration = CustomerRegistrationRequest.objects.get(id=response.data['registration_id'])
        wrong = self.client.post('/api/mobile/auth/verify-email/', {'registration_id': registration.id, 'verification_code': '000000'}, format='json')
        self.assertEqual(wrong.status_code, status.HTTP_400_BAD_REQUEST)
        registration.refresh_from_db()
        registration.verification_attempts = 5
        registration.save(update_fields=['verification_attempts'])
        blocked = self.client.post('/api/mobile/auth/verify-email/', {'registration_id': registration.id, 'verification_code': self.code_from_email()}, format='json')
        self.assertEqual(blocked.status_code, status.HTTP_400_BAD_REQUEST)

        other = {**self.payload, 'email': 'expired@example.com', 'phone': '+249912345670'}
        expired_response = self.register(other)
        expired = CustomerRegistrationRequest.objects.get(id=expired_response.data['registration_id'])
        expired.verification_code_expires_at = timezone.now() - timezone.timedelta(minutes=1)
        expired.save(update_fields=['verification_code_expires_at'])
        expired_verify = self.client.post('/api/mobile/auth/verify-email/', {'registration_id': expired.id, 'verification_code': self.code_from_email()}, format='json')
        self.assertEqual(expired_verify.status_code, status.HTTP_400_BAD_REQUEST)

    def test_resend_invalidates_previous_code(self):
        response = self.register()
        old_code = self.code_from_email()
        registration = CustomerRegistrationRequest.objects.get(id=response.data['registration_id'])
        resend = self.client.post('/api/mobile/auth/resend-verification/', {'email': self.payload['email']}, format='json')
        self.assertEqual(resend.status_code, status.HTTP_200_OK)
        new_code = self.code_from_email()
        self.assertNotEqual(old_code, new_code)
        old_verify = self.client.post('/api/mobile/auth/verify-email/', {'registration_id': registration.id, 'verification_code': old_code}, format='json')
        self.assertEqual(old_verify.status_code, status.HTTP_400_BAD_REQUEST)

    def test_unverified_pending_approved_and_rejected_login_behaviors(self):
        response = self.register()
        pending_login = self.client.post('/api/mobile/auth/login/', {'email': self.payload['email'], 'password': self.payload['password']}, format='json')
        self.assertEqual(pending_login.status_code, status.HTTP_403_FORBIDDEN)
        registration = CustomerRegistrationRequest.objects.get(id=response.data['registration_id'])
        code = self.code_from_email()
        self.client.post('/api/mobile/auth/verify-email/', {'registration_id': registration.id, 'verification_code': code}, format='json')
        approval_login = self.client.post('/api/mobile/auth/login/', {'email': self.payload['email'], 'password': self.payload['password']}, format='json')
        self.assertEqual(approval_login.status_code, status.HTTP_403_FORBIDDEN)
        registration.refresh_from_db()
        approve_registration(registration, self.admin)
        approved_login = self.client.post('/api/mobile/auth/login/', {'email': self.payload['email'], 'password': self.payload['password']}, format='json')
        self.assertEqual(approved_login.status_code, status.HTTP_200_OK)

    def test_manager_cannot_approve_and_approval_creates_customer_only_user(self):
        registration = self.verified_registration()
        with self.assertRaises(PermissionError):
            approve_registration(registration, self.manager)
        approve_registration(registration, self.admin)
        registration.refresh_from_db()
        self.assertEqual(registration.status, CustomerRegistrationRequest.STATUS_APPROVED)
        self.assertTrue(CustomerAccount.objects.filter(user=registration.created_user, customer=registration.created_customer).exists())
        self.assertFalse(registration.created_user.is_staff)
        self.assertFalse(registration.created_user.is_superuser)
        self.assertFalse(hasattr(registration.created_user, 'profile'))

    def test_forgot_password_generic_and_reset_token_single_use(self):
        registration = self.verified_registration()
        approve_registration(registration, self.admin)
        registration.refresh_from_db()
        response = self.client.post('/api/mobile/auth/forgot-password/', {'email': self.payload['email']}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        unknown = self.client.post('/api/mobile/auth/forgot-password/', {'email': 'none@example.com'}, format='json')
        self.assertEqual(unknown.status_code, status.HTTP_200_OK)
        reset = CustomerPasswordResetRequest.objects.get(user=registration.created_user, is_used=False)
        code = self.code_from_email()
        self.assertNotIn(code, reset.code_hash)
        verify = self.client.post('/api/mobile/auth/verify-reset-code/', {'email': self.payload['email'], 'verification_code': code}, format='json')
        self.assertEqual(verify.status_code, status.HTTP_200_OK)
        token = verify.data['reset_token']
        reset_password = self.client.post('/api/mobile/auth/reset-password/', {
            'reset_token': token,
            'new_password': 'NewStrongPass123!',
            'confirm_password': 'NewStrongPass123!',
        }, format='json')
        self.assertEqual(reset_password.status_code, status.HTTP_200_OK)
        reuse = self.client.post('/api/mobile/auth/reset-password/', {
            'reset_token': token,
            'new_password': 'AnotherStrong123!',
            'confirm_password': 'AnotherStrong123!',
        }, format='json')
        self.assertEqual(reuse.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(self.client.login(username=registration.created_user.username, password=self.payload['password']))
        self.assertTrue(self.client.login(username=registration.created_user.username, password='NewStrongPass123!'))
