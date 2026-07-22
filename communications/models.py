import os
import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q
from django.utils import timezone


def chat_attachment_path(instance, filename):
    extension = os.path.splitext(filename or '')[1].lower()
    return f'chat/{timezone.now():%Y/%m}/{uuid.uuid4().hex}{extension}'


class ChatConversation(models.Model):
    STATUS_OPEN = 'open'
    STATUS_WAITING_ADMIN = 'waiting_admin'
    STATUS_WAITING_CUSTOMER = 'waiting_customer'
    STATUS_CLOSED = 'closed'
    STATUS_CHOICES = [
        (STATUS_OPEN, 'Open'),
        (STATUS_WAITING_ADMIN, 'Waiting for Admin'),
        (STATUS_WAITING_CUSTOMER, 'Waiting for Customer'),
        (STATUS_CLOSED, 'Closed'),
    ]
    ACTIVE_STATUSES = {STATUS_OPEN, STATUS_WAITING_ADMIN, STATUS_WAITING_CUSTOMER}

    customer = models.ForeignKey('customers.Customer', on_delete=models.PROTECT, related_name='chat_conversations')
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default=STATUS_OPEN)
    subject = models.CharField(max_length=150, blank=True)
    last_message_at = models.DateTimeField(default=timezone.now)
    assigned_admin = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_chat_conversations')
    is_archived = models.BooleanField(default=False)
    closed_at = models.DateTimeField(null=True, blank=True)
    closed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='closed_chat_conversations')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-last_message_at']
        indexes = [
            models.Index(fields=['customer', 'status']),
            models.Index(fields=['last_message_at']),
            models.Index(fields=['status']),
            models.Index(fields=['is_archived']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['customer'],
                condition=Q(status__in=['open', 'waiting_admin', 'waiting_customer']),
                name='unique_active_chat_conversation_per_customer',
            ),
        ]

    def mark_open_after_customer_message(self):
        self.status = self.STATUS_WAITING_ADMIN
        self.closed_at = None
        self.closed_by = None
        self.last_message_at = timezone.now()
        self.save(update_fields=['status', 'closed_at', 'closed_by', 'last_message_at', 'updated_at'])

    def mark_waiting_customer(self):
        self.status = self.STATUS_WAITING_CUSTOMER
        self.last_message_at = timezone.now()
        self.save(update_fields=['status', 'last_message_at', 'updated_at'])

    def close(self, user):
        self.status = self.STATUS_CLOSED
        self.closed_at = timezone.now()
        self.closed_by = user
        self.save(update_fields=['status', 'closed_at', 'closed_by', 'updated_at'])

    def reopen(self):
        self.status = self.STATUS_OPEN
        self.closed_at = None
        self.closed_by = None
        self.last_message_at = timezone.now()
        self.save(update_fields=['status', 'closed_at', 'closed_by', 'last_message_at', 'updated_at'])

    def __str__(self):
        return f'{self.customer.code} - {self.status}'


class ChatMessage(models.Model):
    SENDER_CUSTOMER = 'customer'
    SENDER_ADMIN = 'admin'
    SENDER_SYSTEM = 'system'
    SENDER_TYPE_CHOICES = [
        (SENDER_CUSTOMER, 'Customer'),
        (SENDER_ADMIN, 'Admin'),
        (SENDER_SYSTEM, 'System'),
    ]

    TYPE_TEXT = 'text'
    TYPE_IMAGE = 'image'
    TYPE_DOCUMENT = 'document'
    TYPE_CUSTOMER_CARD = 'customer_card'
    TYPE_SYSTEM = 'system'
    MESSAGE_TYPE_CHOICES = [
        (TYPE_TEXT, 'Text'),
        (TYPE_IMAGE, 'Image'),
        (TYPE_DOCUMENT, 'Document'),
        (TYPE_CUSTOMER_CARD, 'Customer Card'),
        (TYPE_SYSTEM, 'System'),
    ]

    conversation = models.ForeignKey(ChatConversation, on_delete=models.CASCADE, related_name='messages')
    sender_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='chat_messages')
    sender_type = models.CharField(max_length=20, choices=SENDER_TYPE_CHOICES)
    message_type = models.CharField(max_length=20, choices=MESSAGE_TYPE_CHOICES, default=TYPE_TEXT)
    body = models.TextField(blank=True)
    reply_to = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='replies')
    client_message_id = models.CharField(max_length=120, blank=True)
    idempotency_hash = models.CharField(max_length=64, blank=True)
    card_customer = models.ForeignKey('customers.Customer', on_delete=models.PROTECT, null=True, blank=True, related_name='shared_chat_cards')
    card_snapshot = models.JSONField(null=True, blank=True)
    is_system_message = models.BooleanField(default=False)
    customer_read_at = models.DateTimeField(null=True, blank=True)
    admin_read_at = models.DateTimeField(null=True, blank=True)
    is_edited = models.BooleanField(default=False)
    edited_at = models.DateTimeField(null=True, blank=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['conversation', 'created_at']),
            models.Index(fields=['sender_type']),
            models.Index(fields=['message_type']),
            models.Index(fields=['admin_read_at']),
            models.Index(fields=['customer_read_at']),
            models.Index(fields=['client_message_id']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['sender_user', 'client_message_id'],
                condition=~Q(client_message_id=''),
                name='unique_chat_sender_client_message_id',
            ),
        ]

    def clean(self):
        if self.message_type == self.TYPE_CUSTOMER_CARD and not self.card_snapshot:
            raise ValidationError({'card_snapshot': 'Customer card snapshot is required.'})
        if self.message_type not in {self.TYPE_IMAGE, self.TYPE_DOCUMENT, self.TYPE_CUSTOMER_CARD, self.TYPE_SYSTEM} and not self.body.strip():
            raise ValidationError({'body': 'Message text is required.'})

    def __str__(self):
        return f'{self.conversation_id} {self.sender_type} {self.message_type}'


class ChatAttachment(models.Model):
    TYPE_IMAGE = 'image'
    TYPE_DOCUMENT = 'document'
    ATTACHMENT_TYPE_CHOICES = [
        (TYPE_IMAGE, 'Image'),
        (TYPE_DOCUMENT, 'Document'),
    ]

    message = models.ForeignKey(ChatMessage, on_delete=models.CASCADE, related_name='attachments')
    file = models.FileField(upload_to=chat_attachment_path)
    original_filename = models.CharField(max_length=255)
    stored_filename = models.CharField(max_length=255)
    mime_type = models.CharField(max_length=120)
    file_size = models.PositiveIntegerField()
    attachment_type = models.CharField(max_length=20, choices=ATTACHMENT_TYPE_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['message']),
            models.Index(fields=['attachment_type']),
            models.Index(fields=['created_at']),
        ]

    def save(self, *args, **kwargs):
        if self.file and not self.stored_filename:
            self.stored_filename = os.path.basename(self.file.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.original_filename
