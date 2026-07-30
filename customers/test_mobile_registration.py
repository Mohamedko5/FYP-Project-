from unittest.mock import patch

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
        verify = self.client.post('/api/mobile/auth/verify-email/', {'email': registration.email, 'code': code}, format='json')
        self.assertEqual(verify.status_code, status.HTTP_200_OK)
        registration.refresh_from_db()
        return registration

    def test_valid_registration_hashes_password_and_code(self):
        response = self.register()
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[-1].to, [self.payload['email']])
        self.assertTrue(mail.outbox[-1].subject)
        self.assertTrue(mail.outbox[-1].body)
        self.assertTrue(mail.outbox[-1].alternatives)
        self.assertNotIn(self.payload['password'], mail.outbox[-1].body)
        registration = CustomerRegistrationRequest.objects.get(id=response.data['registration_id'])
        self.assertNotEqual(registration.password_hash, self.payload['password'])
        self.assertTrue(registration.check_registration_password(self.payload['password']))
        self.assertNotIn(self.code_from_email(), registration.verification_code_hash)
        self.assertEqual(registration.status, CustomerRegistrationRequest.STATUS_EMAIL_PENDING)
        self.assertFalse(registration.email_verified)
        self.assertIsNone(registration.created_user)
        self.assertNotIn('verification_code', response.data)
        self.assertTrue(response.data['verification_required'])

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
        wrong = self.client.post('/api/mobile/auth/verify-email/', {'email': registration.email, 'code': '000000'}, format='json')
        self.assertEqual(wrong.status_code, status.HTTP_400_BAD_REQUEST)
        registration.refresh_from_db()
        registration.verification_attempts = 5
        registration.save(update_fields=['verification_attempts'])
        blocked = self.client.post('/api/mobile/auth/verify-email/', {'email': registration.email, 'code': self.code_from_email()}, format='json')
        self.assertEqual(blocked.status_code, status.HTTP_400_BAD_REQUEST)

        other = {**self.payload, 'email': 'expired@example.com', 'phone': '+249912345670'}
        expired_response = self.register(other)
        expired = CustomerRegistrationRequest.objects.get(id=expired_response.data['registration_id'])
        expired.verification_code_expires_at = timezone.now() - timezone.timedelta(minutes=1)
        expired.save(update_fields=['verification_code_expires_at'])
        expired_verify = self.client.post('/api/mobile/auth/verify-email/', {'email': expired.email, 'code': self.code_from_email()}, format='json')
        self.assertEqual(expired_verify.status_code, status.HTTP_400_BAD_REQUEST)

    @override_settings(CUSTOMER_EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS=0)
    def test_resend_invalidates_previous_code(self):
        response = self.register()
        old_code = self.code_from_email()
        registration = CustomerRegistrationRequest.objects.get(id=response.data['registration_id'])
        resend = self.client.post('/api/mobile/auth/resend-verification/', {'email': self.payload['email']}, format='json')
        self.assertEqual(resend.status_code, status.HTTP_200_OK)
        new_code = self.code_from_email()
        self.assertNotEqual(old_code, new_code)
        registration.refresh_from_db()
        self.assertEqual(registration.verification_resend_count, 1)
        old_verify = self.client.post('/api/mobile/auth/verify-email/', {'email': registration.email, 'code': old_code}, format='json')
        self.assertEqual(old_verify.status_code, status.HTTP_400_BAD_REQUEST)

    def test_resend_cooldown_is_enforced(self):
        self.register()
        resend = self.client.post('/api/mobile/auth/resend-verification/', {'email': self.payload['email']}, format='json')
        self.assertEqual(resend.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(resend.data['code'], 'resend_cooldown')

    @override_settings(CUSTOMER_EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS=0, CUSTOMER_EMAIL_VERIFICATION_MAX_RESENDS=1)
    def test_resend_limit_is_enforced(self):
        self.register()
        self.assertEqual(self.client.post('/api/mobile/auth/resend-verification/', {'email': self.payload['email']}, format='json').status_code, status.HTTP_200_OK)
        limited = self.client.post('/api/mobile/auth/resend-verification/', {'email': self.payload['email']}, format='json')
        self.assertEqual(limited.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(limited.data['code'], 'resend_limit')

    def test_registration_email_delivery_failure_returns_safe_error(self):
        with patch('customers.email_service.EmailMultiAlternatives.send', side_effect=OSError('ConnectionRefusedError')):
            response = self.register()
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['code'], 'email_delivery_failed')
        self.assertIn('verification email', response.data['detail'])
        self.assertNotIn('ConnectionRefusedError', str(response.data))
        self.assertTrue(CustomerRegistrationRequest.objects.filter(email=self.payload['email']).exists())

    def test_unverified_pending_approved_and_rejected_login_behaviors(self):
        response = self.register()
        pending_login = self.client.post('/api/mobile/auth/login/', {'email': self.payload['email'], 'password': self.payload['password']}, format='json')
        self.assertEqual(pending_login.status_code, status.HTTP_403_FORBIDDEN)
        registration = CustomerRegistrationRequest.objects.get(id=response.data['registration_id'])
        code = self.code_from_email()
        verify = self.client.post('/api/mobile/auth/verify-email/', {'email': registration.email, 'code': code}, format='json')
        self.assertEqual(verify.data['next'], 'pending_approval')
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

    def test_used_code_cannot_be_reused_and_arabic_name_works(self):
        payload = {**self.payload, 'full_name': 'أحمد محمد', 'email': 'arabic@example.com', 'phone': '+249912345681'}
        response = self.register(payload)
        registration = CustomerRegistrationRequest.objects.get(id=response.data['registration_id'])
        code = self.code_from_email()
        first = self.client.post('/api/mobile/auth/verify-email/', {'email': registration.email, 'code': code}, format='json')
        self.assertEqual(first.status_code, status.HTTP_200_OK)
        reused = self.client.post('/api/mobile/auth/verify-email/', {'email': registration.email, 'code': code}, format='json')
        self.assertEqual(reused.status_code, status.HTTP_400_BAD_REQUEST)
        registration.refresh_from_db()
        self.assertEqual(registration.full_name, 'أحمد محمد')
        self.assertEqual(registration.status, CustomerRegistrationRequest.STATUS_PENDING_APPROVAL)
        self.assertIsNone(registration.created_user)
        self.assertIsNone(registration.created_customer)

    def test_forgot_password_generic_and_reset_token_single_use(self):
        registration = self.verified_registration()
        approve_registration(registration, self.admin)
        registration.refresh_from_db()
        response = self.client.post('/api/mobile/auth/forgot-password/', {'email': self.payload['email']}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(mail.outbox[-1].alternatives)
        self.assertNotIn(self.payload['password'], mail.outbox[-1].body)
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

    def test_forgot_password_email_delivery_failure_returns_safe_error(self):
        registration = self.verified_registration()
        approve_registration(registration, self.admin)
        with patch('customers.email_service.EmailMultiAlternatives.send', side_effect=TimeoutError('socket timeout')):
            response = self.client.post('/api/mobile/auth/forgot-password/', {'email': self.payload['email']}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['code'], 'email_delivery_failed')
        self.assertNotIn('socket timeout', str(response.data))

    def test_approval_notification_failure_does_not_block_approval(self):
        registration = self.verified_registration()
        with patch('customers.email_service.EmailMultiAlternatives.send', side_effect=OSError('SMTPAuthenticationError')):
            approve_registration(registration, self.admin)
        registration.refresh_from_db()
        self.assertEqual(registration.status, CustomerRegistrationRequest.STATUS_APPROVED)
