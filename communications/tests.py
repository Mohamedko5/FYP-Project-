from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import UserProfile
from customers.models import Customer, CustomerAccount

from .models import ChatAttachment, ChatConversation, ChatMessage


@override_settings(MEDIA_ROOT='test_media')
class ChatAPITests(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.admin = User.objects.create_user(username='admin', email='admin@bayad.com', password='admin123')
        UserProfile.objects.create(user=self.admin, role='admin')
        self.worker = User.objects.create_user(username='worker', email='worker@bayad.com', password='admin123')
        self.customer_user = User.objects.create_user(username='cust1', email='cust1@example.com', password='pass12345')
        self.other_user = User.objects.create_user(username='cust2', email='cust2@example.com', password='pass12345')
        self.customer = Customer.objects.create(
            name='Ahmed Trading',
            phone='+249111111111',
            secondary_phone='+249222222222',
            address='Omdurman',
            customer_type=Customer.TYPE_EXPORTER,
            created_by=self.admin,
        )
        self.other_customer = Customer.objects.create(
            name='Nile Exporters',
            phone='+249333333333',
            address='Khartoum',
            customer_type=Customer.TYPE_SUPPLIER,
            created_by=self.admin,
        )
        CustomerAccount.objects.create(user=self.customer_user, customer=self.customer)
        CustomerAccount.objects.create(user=self.other_user, customer=self.other_customer)

    def auth_customer(self):
        self.client.force_authenticate(self.customer_user)

    def auth_other_customer(self):
        self.client.force_authenticate(self.other_user)

    def auth_admin(self):
        self.client.force_authenticate(self.admin)

    def auth_worker(self):
        self.client.force_authenticate(self.worker)

    def create_customer_message(self, body='Hello Admin', client_message_id='m-1'):
        self.auth_customer()
        response = self.client.post('/api/chat/mobile/messages/', {'body': body, 'client_message_id': client_message_id}, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        return response

    def test_customer_authentication_is_required(self):
        response = self.client.get('/api/chat/mobile/conversation/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_admin_authentication_is_required(self):
        response = self.client.get('/api/chat/admin/conversations/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_customer_conversation_is_created_safely_and_not_duplicated(self):
        self.auth_customer()
        first = self.client.get('/api/chat/mobile/conversation/')
        second = self.client.get('/api/chat/mobile/conversation/')
        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(first.data['id'], second.data['id'])
        self.assertEqual(ChatConversation.objects.filter(customer=self.customer).count(), 1)

    def test_customer_can_send_text_and_cannot_impersonate_admin(self):
        self.auth_customer()
        response = self.client.post('/api/chat/mobile/messages/', {'body': 'Need help', 'sender_type': 'admin'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        message = ChatMessage.objects.get(id=response.data['id'])
        self.assertEqual(message.sender_type, ChatMessage.SENDER_CUSTOMER)
        self.assertEqual(message.conversation.status, ChatConversation.STATUS_WAITING_ADMIN)

    def test_customer_cannot_access_another_customer_conversation_or_attachment(self):
        own_message = self.create_customer_message()
        attachment = ChatAttachment.objects.create(
            message=ChatMessage.objects.get(id=own_message.data['id']),
            file=SimpleUploadedFile('safe.pdf', b'%PDF-1.4', content_type='application/pdf'),
            original_filename='safe.pdf',
            stored_filename='',
            mime_type='application/pdf',
            file_size=8,
            attachment_type=ChatAttachment.TYPE_DOCUMENT,
        )
        self.auth_other_customer()
        response = self.client.get(f'/api/chat/attachments/{attachment.id}/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_customer_card_uses_authenticated_customer_and_excludes_sensitive_fields(self):
        self.auth_customer()
        response = self.client.post('/api/chat/mobile/customer-card/', {'message': 'My details', 'customer_id': self.other_customer.id}, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        snapshot = response.data['card_snapshot']
        self.assertEqual(snapshot['customer_id'], self.customer.id)
        self.assertEqual(snapshot['customer_code'], self.customer.code)
        self.assertNotIn('password', snapshot)
        self.assertNotIn('cash_balance', snapshot)

    def test_admin_can_list_open_conversation_and_reply(self):
        customer_response = self.create_customer_message()
        conversation_id = customer_response.data['conversation']
        self.auth_admin()
        list_response = self.client.get('/api/chat/admin/conversations/')
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(list_response.data['results'][0]['id'], conversation_id)
        reply = self.client.post(f'/api/chat/admin/conversations/{conversation_id}/messages/', {'body': 'We received your message.'}, format='json')
        self.assertEqual(reply.status_code, status.HTTP_201_CREATED, reply.data)
        conversation = ChatConversation.objects.get(id=conversation_id)
        self.assertEqual(conversation.status, ChatConversation.STATUS_WAITING_CUSTOMER)

    def test_worker_cannot_access_admin_chat(self):
        self.auth_worker()
        response = self.client.get('/api/chat/admin/conversations/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_client_message_id_prevents_duplicates_and_rejects_changed_content(self):
        first = self.create_customer_message(body='Same', client_message_id='dup-1')
        second = self.client.post('/api/chat/mobile/messages/', {'body': 'Same', 'client_message_id': 'dup-1'}, format='json')
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(first.data['id'], second.data['id'])
        changed = self.client.post('/api/chat/mobile/messages/', {'body': 'Changed', 'client_message_id': 'dup-1'}, format='json')
        self.assertEqual(changed.status_code, status.HTTP_400_BAD_REQUEST)

    def test_image_and_pdf_attachments_are_accepted_and_html_is_rejected(self):
        self.auth_customer()
        image = self.client.post('/api/chat/mobile/messages/', {
            'body': '',
            'attachment': SimpleUploadedFile('receipt.jpg', b'image', content_type='image/jpeg'),
        }, format='multipart')
        self.assertEqual(image.status_code, status.HTTP_201_CREATED, image.data)
        pdf = self.client.post('/api/chat/mobile/messages/', {
            'attachment': SimpleUploadedFile('document.pdf', b'%PDF', content_type='application/pdf'),
        }, format='multipart')
        self.assertEqual(pdf.status_code, status.HTTP_201_CREATED, pdf.data)
        html = self.client.post('/api/chat/mobile/messages/', {
            'attachment': SimpleUploadedFile('bad.html', b'<html>', content_type='text/html'),
        }, format='multipart')
        self.assertEqual(html.status_code, status.HTTP_400_BAD_REQUEST)

    def test_oversized_attachment_is_rejected(self):
        self.auth_customer()
        oversized = SimpleUploadedFile('large.jpg', b'x' * (5 * 1024 * 1024 + 1), content_type='image/jpeg')
        response = self.client.post('/api/chat/mobile/messages/', {'attachment': oversized}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_unread_counts_and_read_status(self):
        customer_response = self.create_customer_message()
        conversation_id = customer_response.data['conversation']
        self.auth_admin()
        unread = self.client.get('/api/chat/admin/unread-count/')
        self.assertEqual(unread.data['unread_count'], 1)
        self.client.post(f'/api/chat/admin/conversations/{conversation_id}/read/')
        self.assertEqual(self.client.get('/api/chat/admin/unread-count/').data['unread_count'], 0)
        self.client.post(f'/api/chat/admin/conversations/{conversation_id}/messages/', {'body': 'Reply'}, format='json')
        self.auth_customer()
        self.assertEqual(self.client.get('/api/chat/mobile/unread-count/').data['unread_count'], 1)
        self.client.post('/api/chat/mobile/messages/read/')
        self.assertEqual(self.client.get('/api/chat/mobile/unread-count/').data['unread_count'], 0)

    def test_closing_and_customer_reopening_work(self):
        message = self.create_customer_message()
        conversation_id = message.data['conversation']
        self.auth_admin()
        close = self.client.post(f'/api/chat/admin/conversations/{conversation_id}/close/')
        self.assertEqual(close.data['status'], ChatConversation.STATUS_CLOSED)
        self.auth_customer()
        reopened = self.client.post('/api/chat/mobile/messages/', {'body': 'New question'}, format='json')
        self.assertEqual(reopened.status_code, status.HTTP_201_CREATED, reopened.data)
        self.assertEqual(ChatConversation.objects.get(id=conversation_id).status, ChatConversation.STATUS_WAITING_ADMIN)
