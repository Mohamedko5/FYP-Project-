import hashlib
import json

from django.db import transaction
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.response import Response

from .models import ChatConversation, ChatMessage


def customer_for_request(request):
    return request.user.customer_account.customer


def active_or_reopened_conversation(customer):
    conversation = ChatConversation.objects.filter(
        customer=customer,
        status__in=ChatConversation.ACTIVE_STATUSES,
        is_archived=False,
    ).order_by('-last_message_at').first()
    if conversation:
        return conversation
    closed = ChatConversation.objects.filter(customer=customer, is_archived=False).order_by('-last_message_at').first()
    if closed:
        closed.reopen()
        return closed
    return ChatConversation.objects.create(customer=customer)


def request_hash(payload):
    return hashlib.sha256(json.dumps(payload, sort_keys=True, default=str).encode('utf-8')).hexdigest()


def idempotent_message_response(user, client_message_id, payload_hash, serializer_class, context):
    if not client_message_id:
        return None
    existing = ChatMessage.objects.filter(sender_user=user, client_message_id=client_message_id).first()
    if not existing:
        return None
    if existing.idempotency_hash != payload_hash:
        raise serializers.ValidationError({'client_message_id': 'This client message id was already used with different content.'})
    return Response(serializer_class(existing, context=context).data, status=status.HTTP_200_OK)


def build_customer_card_snapshot(customer, request=None):
    photo_url = None
    if customer.photo:
        try:
            photo_url = customer.photo.url
            if request:
                photo_url = request.build_absolute_uri(photo_url)
        except ValueError:
            photo_url = None
    return {
        'customer_id': customer.id,
        'customer_code': customer.code,
        'customer_name': customer.name,
        'business_name': customer.name,
        'customer_type': customer.customer_type,
        'email': getattr(getattr(customer, 'mobile_account', None), 'user', None).email if hasattr(customer, 'mobile_account') else '',
        'phone': customer.phone,
        'secondary_phone': customer.secondary_phone,
        'address': customer.address,
        'profile_image_url': photo_url,
        'account_status': 'active' if customer.is_active and not customer.is_deleted else 'inactive',
    }


@transaction.atomic
def create_chat_message(*, conversation, user, sender_type, message_type, body='', client_message_id='', payload_hash='', reply_to=None, card_snapshot=None, card_customer=None):
    message = ChatMessage.objects.create(
        conversation=conversation,
        sender_user=user,
        sender_type=sender_type,
        message_type=message_type,
        body=(body or '').strip(),
        client_message_id=(client_message_id or '').strip(),
        idempotency_hash=payload_hash,
        reply_to=reply_to,
        card_snapshot=card_snapshot,
        card_customer=card_customer,
        is_system_message=message_type == ChatMessage.TYPE_SYSTEM,
        customer_read_at=timezone.now() if sender_type == ChatMessage.SENDER_CUSTOMER else None,
        admin_read_at=timezone.now() if sender_type == ChatMessage.SENDER_ADMIN else None,
    )
    if sender_type == ChatMessage.SENDER_CUSTOMER:
        conversation.mark_open_after_customer_message()
    elif sender_type == ChatMessage.SENDER_ADMIN:
        conversation.mark_waiting_customer()
    else:
        conversation.last_message_at = timezone.now()
        conversation.save(update_fields=['last_message_at', 'updated_at'])
    return message
