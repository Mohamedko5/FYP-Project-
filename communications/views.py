from django.db import transaction
from django.db.models import Q
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ChatAttachment, ChatConversation, ChatMessage
from .permissions import IsAdminOrManager, IsMobileCustomer, is_admin_or_manager
from .serializers import ChatConversationSerializer, ChatMessageSerializer, SendMessageSerializer, ShareCustomerCardSerializer
from .services import active_or_reopened_conversation, build_customer_card_snapshot, create_chat_message, customer_for_request, idempotent_message_response, request_hash


class ChatPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 50


def paginate(view, queryset, serializer_class, request, context=None):
    paginator = ChatPagination()
    page = paginator.paginate_queryset(queryset, request, view=view)
    serializer = serializer_class(page, many=True, context={'request': request, **(context or {})})
    return paginator.get_paginated_response(serializer.data)


def create_attachment(message, file_obj, attachment_type):
    return ChatAttachment.objects.create(
        message=message,
        file=file_obj,
        original_filename=file_obj.name or 'attachment',
        stored_filename='',
        mime_type=(getattr(file_obj, 'content_type', '') or ''),
        file_size=getattr(file_obj, 'size', 0) or 0,
        attachment_type=attachment_type,
    )


def unread_for_customer(customer):
    return ChatMessage.objects.filter(conversation__customer=customer, sender_type=ChatMessage.SENDER_ADMIN, customer_read_at__isnull=True).count()


def unread_for_admin():
    return ChatMessage.objects.filter(sender_type=ChatMessage.SENDER_CUSTOMER, admin_read_at__isnull=True, conversation__is_archived=False).count()


class MobileConversationView(APIView):
    permission_classes = [IsMobileCustomer]

    def get(self, request):
        conversation = active_or_reopened_conversation(customer_for_request(request))
        return Response(ChatConversationSerializer(conversation, context={'request': request, 'viewer': 'customer'}).data)


class MobileMessageListCreateView(APIView):
    permission_classes = [IsMobileCustomer]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get(self, request):
        conversation = active_or_reopened_conversation(customer_for_request(request))
        queryset = conversation.messages.select_related('sender_user', 'reply_to', 'card_customer').prefetch_related('attachments').order_by('-created_at')
        return paginate(self, queryset, ChatMessageSerializer, request)

    def post(self, request):
        customer = customer_for_request(request)
        conversation = active_or_reopened_conversation(customer)
        serializer = SendMessageSerializer(data=request.data, context={'conversation': conversation})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        client_message_id = (data.get('client_message_id') or '').strip()
        payload_hash = request_hash({
            'body': data.get('body') or '',
            'message_type': data.get('message_type'),
            'attachment_name': getattr(data.get('attachment'), 'name', ''),
            'attachment_size': getattr(data.get('attachment'), 'size', 0),
        })
        existing = idempotent_message_response(request.user, client_message_id, payload_hash, ChatMessageSerializer, {'request': request})
        if existing:
            return existing
        with transaction.atomic():
            message = create_chat_message(
                conversation=conversation,
                user=request.user,
                sender_type=ChatMessage.SENDER_CUSTOMER,
                message_type=data['message_type'],
                body=data.get('body') or '',
                client_message_id=client_message_id,
                payload_hash=payload_hash,
                reply_to=data.get('reply_to'),
            )
            if data.get('attachment'):
                create_attachment(message, data['attachment'], data['attachment_type'])
        return Response(ChatMessageSerializer(message, context={'request': request}).data, status=status.HTTP_201_CREATED)


class MobileCustomerCardView(APIView):
    permission_classes = [IsMobileCustomer]

    def post(self, request):
        serializer = ShareCustomerCardSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        customer = customer_for_request(request)
        conversation = active_or_reopened_conversation(customer)
        client_message_id = (serializer.validated_data.get('client_message_id') or '').strip()
        card_snapshot = build_customer_card_snapshot(customer, request)
        payload_hash = request_hash({'message_type': ChatMessage.TYPE_CUSTOMER_CARD, 'body': serializer.validated_data.get('message') or '', 'card': card_snapshot})
        existing = idempotent_message_response(request.user, client_message_id, payload_hash, ChatMessageSerializer, {'request': request})
        if existing:
            return existing
        message = create_chat_message(
            conversation=conversation,
            user=request.user,
            sender_type=ChatMessage.SENDER_CUSTOMER,
            message_type=ChatMessage.TYPE_CUSTOMER_CARD,
            body=serializer.validated_data.get('message') or '',
            client_message_id=client_message_id,
            payload_hash=payload_hash,
            card_snapshot=card_snapshot,
            card_customer=customer,
        )
        return Response(ChatMessageSerializer(message, context={'request': request}).data, status=status.HTTP_201_CREATED)


class MobileReadView(APIView):
    permission_classes = [IsMobileCustomer]

    def post(self, request):
        conversation = active_or_reopened_conversation(customer_for_request(request))
        updated = conversation.messages.filter(sender_type=ChatMessage.SENDER_ADMIN, customer_read_at__isnull=True).update(customer_read_at=timezone.now())
        return Response({'read_count': updated, 'unread_count': unread_for_customer(conversation.customer)})


class MobileUnreadCountView(APIView):
    permission_classes = [IsMobileCustomer]

    def get(self, request):
        return Response({'unread_count': unread_for_customer(customer_for_request(request))})


class AdminConversationListView(APIView):
    permission_classes = [IsAdminOrManager]

    def get(self, request):
        queryset = ChatConversation.objects.select_related('customer').prefetch_related('messages').filter(is_archived=False)
        search = request.query_params.get('search', '').strip()
        if search:
            queryset = queryset.filter(Q(customer__name__icontains=search) | Q(customer__code__icontains=search) | Q(customer__phone__icontains=search) | Q(customer__mobile_account__user__email__icontains=search))
        status_filter = request.query_params.get('status', '').strip()
        if status_filter == 'unread':
            queryset = queryset.filter(messages__sender_type=ChatMessage.SENDER_CUSTOMER, messages__admin_read_at__isnull=True).distinct()
        elif status_filter:
            if status_filter not in dict(ChatConversation.STATUS_CHOICES):
                raise ValidationError({'status': 'Unsupported conversation status.'})
            queryset = queryset.filter(status=status_filter)
        queryset = queryset.order_by('-last_message_at')
        return paginate(self, queryset, ChatConversationSerializer, request, {'viewer': 'admin'})


class AdminConversationDetailView(APIView):
    permission_classes = [IsAdminOrManager]

    def get(self, request, conversation_id):
        conversation = get_object_or_404(ChatConversation.objects.select_related('customer'), pk=conversation_id, is_archived=False)
        return Response(ChatConversationSerializer(conversation, context={'request': request, 'viewer': 'admin'}).data)


class AdminMessageListCreateView(APIView):
    permission_classes = [IsAdminOrManager]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_conversation(self, conversation_id):
        return get_object_or_404(ChatConversation, pk=conversation_id, is_archived=False)

    def get(self, request, conversation_id):
        conversation = self.get_conversation(conversation_id)
        queryset = conversation.messages.select_related('sender_user', 'reply_to', 'card_customer').prefetch_related('attachments').order_by('-created_at')
        return paginate(self, queryset, ChatMessageSerializer, request)

    def post(self, request, conversation_id):
        conversation = self.get_conversation(conversation_id)
        serializer = SendMessageSerializer(data=request.data, context={'conversation': conversation})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        client_message_id = (data.get('client_message_id') or '').strip()
        payload_hash = request_hash({
            'body': data.get('body') or '',
            'message_type': data.get('message_type'),
            'attachment_name': getattr(data.get('attachment'), 'name', ''),
            'attachment_size': getattr(data.get('attachment'), 'size', 0),
        })
        existing = idempotent_message_response(request.user, client_message_id, payload_hash, ChatMessageSerializer, {'request': request})
        if existing:
            return existing
        with transaction.atomic():
            message = create_chat_message(
                conversation=conversation,
                user=request.user,
                sender_type=ChatMessage.SENDER_ADMIN,
                message_type=data['message_type'],
                body=data.get('body') or '',
                client_message_id=client_message_id,
                payload_hash=payload_hash,
                reply_to=data.get('reply_to'),
            )
            if data.get('attachment'):
                create_attachment(message, data['attachment'], data['attachment_type'])
        return Response(ChatMessageSerializer(message, context={'request': request}).data, status=status.HTTP_201_CREATED)


class AdminReadView(APIView):
    permission_classes = [IsAdminOrManager]

    def post(self, request, conversation_id):
        conversation = get_object_or_404(ChatConversation, pk=conversation_id, is_archived=False)
        updated = conversation.messages.filter(sender_type=ChatMessage.SENDER_CUSTOMER, admin_read_at__isnull=True).update(admin_read_at=timezone.now())
        return Response({'read_count': updated, 'unread_count': unread_for_admin()})


class AdminCloseView(APIView):
    permission_classes = [IsAdminOrManager]

    def post(self, request, conversation_id):
        conversation = get_object_or_404(ChatConversation, pk=conversation_id, is_archived=False)
        conversation.close(request.user)
        return Response(ChatConversationSerializer(conversation, context={'request': request, 'viewer': 'admin'}).data)


class AdminReopenView(APIView):
    permission_classes = [IsAdminOrManager]

    def post(self, request, conversation_id):
        conversation = get_object_or_404(ChatConversation, pk=conversation_id, is_archived=False)
        conversation.reopen()
        return Response(ChatConversationSerializer(conversation, context={'request': request, 'viewer': 'admin'}).data)


class AdminUnreadCountView(APIView):
    permission_classes = [IsAdminOrManager]

    def get(self, request):
        return Response({'unread_count': unread_for_admin()})


class ChatAttachmentDownloadView(APIView):
    def get(self, request, attachment_id):
        if not request.user or not request.user.is_authenticated:
            raise PermissionDenied()
        attachment = get_object_or_404(ChatAttachment.objects.select_related('message__conversation__customer'), pk=attachment_id)
        customer = attachment.message.conversation.customer
        if is_admin_or_manager(request.user):
            pass
        elif getattr(getattr(request.user, 'customer_account', None), 'customer_id', None) != customer.id:
            raise PermissionDenied()
        response = FileResponse(attachment.file.open('rb'), content_type=attachment.mime_type or 'application/octet-stream')
        response['Content-Disposition'] = f'attachment; filename="{attachment.original_filename}"'
        return response
