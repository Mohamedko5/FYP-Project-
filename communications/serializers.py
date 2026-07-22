import os

from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers

from .models import ChatAttachment, ChatConversation, ChatMessage

IMAGE_TYPES = {'image/jpeg', 'image/png', 'image/webp'}
DOCUMENT_TYPES = {'application/pdf'}
IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp'}
DOCUMENT_EXTENSIONS = {'.pdf'}
MAX_IMAGE_SIZE = 5 * 1024 * 1024
MAX_DOCUMENT_SIZE = 10 * 1024 * 1024


def classify_attachment(file_obj):
    content_type = (getattr(file_obj, 'content_type', '') or '').lower()
    extension = os.path.splitext(getattr(file_obj, 'name', '') or '')[1].lower()
    size = getattr(file_obj, 'size', 0) or 0
    if content_type in IMAGE_TYPES and extension in IMAGE_EXTENSIONS:
        if size > MAX_IMAGE_SIZE:
            raise serializers.ValidationError('Image attachments must not exceed 5 MB.')
        return ChatAttachment.TYPE_IMAGE
    if content_type in DOCUMENT_TYPES and extension in DOCUMENT_EXTENSIONS:
        if size > MAX_DOCUMENT_SIZE:
            raise serializers.ValidationError('PDF attachments must not exceed 10 MB.')
        return ChatAttachment.TYPE_DOCUMENT
    raise serializers.ValidationError('Only JPG, PNG, WebP images and PDF documents are allowed.')


class ChatAttachmentSerializer(serializers.ModelSerializer):
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = ChatAttachment
        fields = ('id', 'original_filename', 'mime_type', 'file_size', 'attachment_type', 'download_url', 'created_at')

    def get_download_url(self, obj):
        request = self.context.get('request')
        path = f'/api/chat/attachments/{obj.id}/'
        return request.build_absolute_uri(path) if request else path


class ChatMessageSerializer(serializers.ModelSerializer):
    attachments = ChatAttachmentSerializer(many=True, read_only=True)
    sender_name = serializers.SerializerMethodField()
    reply_to_preview = serializers.SerializerMethodField()

    class Meta:
        model = ChatMessage
        fields = (
            'id',
            'conversation',
            'sender_type',
            'sender_name',
            'message_type',
            'body',
            'created_at',
            'edited_at',
            'is_edited',
            'reply_to',
            'reply_to_preview',
            'client_message_id',
            'card_customer',
            'card_snapshot',
            'is_system_message',
            'customer_read_at',
            'admin_read_at',
            'attachments',
        )
        read_only_fields = fields

    def get_sender_name(self, obj):
        user = obj.sender_user
        return user.get_full_name() or user.username or user.email or obj.sender_type

    def get_reply_to_preview(self, obj):
        if not obj.reply_to:
            return None
        return {
            'id': obj.reply_to_id,
            'sender_type': obj.reply_to.sender_type,
            'body': obj.reply_to.body[:120],
            'message_type': obj.reply_to.message_type,
        }


class ChatConversationSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    customer_code = serializers.CharField(source='customer.code', read_only=True)
    customer_type = serializers.CharField(source='customer.customer_type', read_only=True)
    customer_phone = serializers.CharField(source='customer.phone', read_only=True)
    customer_email = serializers.SerializerMethodField()
    customer_photo_url = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = ChatConversation
        fields = (
            'id',
            'customer',
            'customer_name',
            'customer_code',
            'customer_type',
            'customer_phone',
            'customer_email',
            'customer_photo_url',
            'status',
            'subject',
            'last_message_at',
            'unread_count',
            'last_message',
            'created_at',
            'updated_at',
            'closed_at',
        )
        read_only_fields = fields

    def get_customer_email(self, obj):
        account = getattr(obj.customer, 'mobile_account', None)
        return account.user.email if account else ''

    def get_customer_photo_url(self, obj):
        if not obj.customer.photo:
            return None
        try:
            request = self.context.get('request')
            url = obj.customer.photo.url
            return request.build_absolute_uri(url) if request else url
        except ValueError:
            return None

    def get_last_message(self, obj):
        message = obj.messages.order_by('-created_at').first()
        if not message:
            return None
        return {
            'id': message.id,
            'sender_type': message.sender_type,
            'message_type': message.message_type,
            'body': message.body[:160],
            'created_at': message.created_at,
        }

    def get_unread_count(self, obj):
        viewer = self.context.get('viewer')
        if viewer == 'customer':
            return obj.messages.filter(sender_type=ChatMessage.SENDER_ADMIN, customer_read_at__isnull=True).count()
        return obj.messages.filter(sender_type=ChatMessage.SENDER_CUSTOMER, admin_read_at__isnull=True).count()


class SendMessageSerializer(serializers.Serializer):
    message_type = serializers.ChoiceField(choices=[ChatMessage.TYPE_TEXT, ChatMessage.TYPE_IMAGE, ChatMessage.TYPE_DOCUMENT], required=False, default=ChatMessage.TYPE_TEXT)
    body = serializers.CharField(required=False, allow_blank=True)
    client_message_id = serializers.CharField(required=False, allow_blank=True, max_length=120)
    reply_to_id = serializers.IntegerField(required=False)
    attachment = serializers.FileField(required=False)

    def validate(self, attrs):
        attachment = attrs.get('attachment')
        body = (attrs.get('body') or '').strip()
        if attachment:
            attrs['attachment_type'] = classify_attachment(attachment)
            attrs['message_type'] = ChatMessage.TYPE_IMAGE if attrs['attachment_type'] == ChatAttachment.TYPE_IMAGE else ChatMessage.TYPE_DOCUMENT
        elif not body:
            raise serializers.ValidationError({'body': 'Message text or attachment is required.'})
        conversation = self.context.get('conversation')
        reply_to_id = attrs.get('reply_to_id')
        if reply_to_id:
            try:
                attrs['reply_to'] = ChatMessage.objects.get(pk=reply_to_id, conversation=conversation)
            except ChatMessage.DoesNotExist as exc:
                raise serializers.ValidationError({'reply_to_id': 'Reply message was not found.'}) from exc
        return attrs


class ShareCustomerCardSerializer(serializers.Serializer):
    message = serializers.CharField(required=False, allow_blank=True)
    client_message_id = serializers.CharField(required=False, allow_blank=True, max_length=120)
