from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Q
from decimal import Decimal
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from inventory.models import Inventory, InventoryMovement

from .models import OfferResponse, SupplyOffer, SupplyOfferAttachment, SupplyOfferStatusHistory
from .permissions import IsAdminOrManager, IsMobileCustomer, is_admin_or_manager
from .serializers import (
    AdminApproveSerializer,
    AdminCounterOfferSerializer,
    AdminOfferResponseSerializer,
    AdminRejectSerializer,
    CustomerResponseRejectSerializer,
    PaymentSerializer,
    ReceiptSerializer,
    SupplyOfferAttachmentSerializer,
    SupplyOfferAttachmentUploadSerializer,
    SupplyOfferSerializer,
    SupplyOfferTimelineSerializer,
)
from .services import accept_offer_response, create_offer_card_message, customer_for_request, final_approve_offer, record_offer_payment, record_payment, record_receipt, reject_offer_response, respond_to_offer, set_status


class SupplyOfferPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


def paginate(view, queryset, serializer_class, request, context=None):
    paginator = SupplyOfferPagination()
    page = paginator.paginate_queryset(queryset, request, view=view)
    serializer = serializer_class(page, many=True, context={'request': request, **(context or {})})
    return paginator.get_paginated_response(serializer.data)


class MobileSupplyOfferListCreateView(APIView):
    permission_classes = [IsMobileCustomer]

    def get(self, request):
        customer = customer_for_request(request)
        queryset = SupplyOffer.objects.filter(customer=customer).prefetch_related('items__product__units', 'attachments', 'timeline')
        status_filter = request.query_params.get('status', '').strip()
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        return paginate(self, queryset, SupplyOfferSerializer, request, {'viewer': 'customer'})

    def post(self, request):
        customer = customer_for_request(request)
        serializer = SupplyOfferSerializer(data=request.data, context={'request': request, 'customer': customer, 'viewer': 'customer'})
        serializer.is_valid(raise_exception=True)
        offer = serializer.save()
        return Response(SupplyOfferSerializer(offer, context={'request': request, 'viewer': 'customer'}).data, status=status.HTTP_201_CREATED)


class MobileSupplyOfferDetailView(APIView):
    permission_classes = [IsMobileCustomer]

    def get_offer(self, request, offer_id):
        return get_object_or_404(SupplyOffer.objects.prefetch_related('items__product__units', 'attachments', 'timeline'), pk=offer_id, customer=customer_for_request(request))

    def get(self, request, offer_id):
        return Response(SupplyOfferSerializer(self.get_offer(request, offer_id), context={'request': request, 'viewer': 'customer'}).data)

    def patch(self, request, offer_id):
        offer = self.get_offer(request, offer_id)
        if offer.status != SupplyOffer.STATUS_DRAFT:
            raise ValidationError({'status': 'Only draft offers can be edited.'})
        serializer = SupplyOfferSerializer(offer, data=request.data, partial=True, context={'request': request, 'customer': offer.customer, 'viewer': 'customer'})
        serializer.is_valid(raise_exception=True)
        offer = serializer.save()
        return Response(SupplyOfferSerializer(offer, context={'request': request, 'viewer': 'customer'}).data)


class MobileOfferActionView(APIView):
    permission_classes = [IsMobileCustomer]

    def post(self, request, offer_id, action):
        offer = get_object_or_404(SupplyOffer.objects.prefetch_related('items'), pk=offer_id, customer=customer_for_request(request))
        if action == 'submit':
            if offer.status != SupplyOffer.STATUS_DRAFT:
                raise ValidationError({'status': 'Only draft offers can be submitted.'})
            if not offer.items.exists():
                raise ValidationError({'items': 'At least one item is required.'})
            set_status(offer, SupplyOffer.STATUS_SUBMITTED, request.user, SupplyOfferStatusHistory.ACTOR_CUSTOMER, 'Offer submitted.')
            create_offer_card_message(offer, request.user, f'Supply offer submitted: {offer.offer_number}')
        elif action == 'withdraw':
            if offer.status not in SupplyOffer.WITHDRAWABLE_STATUSES:
                raise ValidationError({'status': 'This offer cannot be withdrawn.'})
            set_status(offer, SupplyOffer.STATUS_WITHDRAWN, request.user, SupplyOfferStatusHistory.ACTOR_CUSTOMER, 'Offer withdrawn.')
        elif action == 'accept-counter-offer':
            if offer.status != SupplyOffer.STATUS_COUNTER_OFFERED:
                raise ValidationError({'status': 'No counter-offer is available.'})
            response = offer.responses.filter(is_current=True).first()
            if response:
                try:
                    accept_offer_response(offer=offer, response_id=response.id, user=request.user)
                except DjangoValidationError as exc:
                    raise ValidationError(exc.message_dict if hasattr(exc, 'message_dict') else exc.messages) from exc
            else:
                for item in offer.items.all():
                    item.agreed_unit_price = item.admin_proposed_unit_price
                    item.agreed_line_total = Decimal(str(item.quantity)) * Decimal(str(item.agreed_unit_price))
                    item.save(update_fields=['agreed_unit_price', 'agreed_line_total', 'updated_at'])
                offer.recalculate_totals()
                offer.save(update_fields=['proposed_total', 'admin_proposed_total', 'agreed_total', 'updated_at'])
                set_status(offer, SupplyOffer.STATUS_CUSTOMER_ACCEPTED, request.user, SupplyOfferStatusHistory.ACTOR_CUSTOMER, 'Customer accepted the counter-offer.')
        elif action == 'decline-counter-offer':
            if offer.status != SupplyOffer.STATUS_COUNTER_OFFERED:
                raise ValidationError({'status': 'No counter-offer is available.'})
            set_status(offer, SupplyOffer.STATUS_CUSTOMER_DECLINED, request.user, SupplyOfferStatusHistory.ACTOR_CUSTOMER, 'Customer declined the counter-offer.')
        elif action == 'chat-card':
            create_offer_card_message(offer, request.user, f'Supply offer reference: {offer.offer_number}')
        else:
            raise ValidationError({'action': 'Unsupported action.'})
        return Response(SupplyOfferSerializer(offer, context={'request': request, 'viewer': 'customer'}).data)


class MobileOfferResponseActionView(APIView):
    permission_classes = [IsMobileCustomer]

    def post(self, request, offer_id, response_id, action):
        offer = get_object_or_404(SupplyOffer.objects.prefetch_related('responses__items__offer_item', 'items'), pk=offer_id, customer=customer_for_request(request))
        try:
            if action == 'accept':
                accept_offer_response(offer=offer, response_id=response_id, user=request.user)
            elif action == 'reject':
                serializer = CustomerResponseRejectSerializer(data=request.data)
                serializer.is_valid(raise_exception=True)
                reject_offer_response(offer=offer, response_id=response_id, user=request.user, reason=serializer.validated_data['reason'])
            elif action == 'read':
                response = get_object_or_404(OfferResponse, pk=response_id, offer=offer, is_current=True)
                if response.customer_read_at is None:
                    response.customer_read_at = timezone.now()
                    response.save(update_fields=['customer_read_at', 'updated_at'])
            else:
                raise ValidationError({'action': 'Unsupported action.'})
        except DjangoValidationError as exc:
            raise ValidationError(exc.message_dict if hasattr(exc, 'message_dict') else exc.messages) from exc
        offer.refresh_from_db()
        return Response(SupplyOfferSerializer(offer, context={'request': request, 'viewer': 'customer'}).data)


class MobileOfferAttachmentView(APIView):
    permission_classes = [IsMobileCustomer]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, offer_id):
        offer = get_object_or_404(SupplyOffer, pk=offer_id, customer=customer_for_request(request))
        serializer = SupplyOfferAttachmentUploadSerializer(data=request.data, context={'offer': offer})
        serializer.is_valid(raise_exception=True)
        file_obj = serializer.validated_data['file']
        attachment = SupplyOfferAttachment.objects.create(
            offer=offer,
            item=serializer.validated_data.get('item'),
            attachment_type=serializer.validated_data['attachment_type'],
            file=file_obj,
            original_filename=file_obj.name or 'attachment',
            mime_type=getattr(file_obj, 'content_type', '') or '',
            file_size=getattr(file_obj, 'size', 0) or 0,
            uploaded_by=request.user,
        )
        return Response(SupplyOfferAttachmentSerializer(attachment, context={'request': request}).data, status=status.HTTP_201_CREATED)


class MobileOfferTimelineView(APIView):
    permission_classes = [IsMobileCustomer]

    def get(self, request, offer_id):
        offer = get_object_or_404(SupplyOffer, pk=offer_id, customer=customer_for_request(request))
        return Response(SupplyOfferTimelineSerializer(offer.timeline.all(), many=True).data)


class AdminSupplyOfferListView(APIView):
    permission_classes = [IsAdminOrManager]

    def get(self, request):
        queryset = SupplyOffer.objects.select_related('customer', 'receiving_warehouse').prefetch_related('items__product__units', 'attachments')
        search = request.query_params.get('search', '').strip()
        if search:
            queryset = queryset.filter(
                Q(offer_number__icontains=search)
                | Q(customer__name__icontains=search)
                | Q(customer__code__icontains=search)
                | Q(customer__phone__icontains=search)
                | Q(city__icontains=search)
                | Q(items__product__name_en__icontains=search)
                | Q(items__product__name_ar__icontains=search)
            ).distinct()
        status_filter = request.query_params.get('status', '').strip()
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        return paginate(self, queryset, SupplyOfferSerializer, request, {'viewer': 'admin'})


class AdminSupplyOfferDetailView(APIView):
    permission_classes = [IsAdminOrManager]

    def get(self, request, offer_id):
        offer = get_object_or_404(SupplyOffer.objects.select_related('customer', 'receiving_warehouse').prefetch_related('items__product__units', 'attachments', 'timeline'), pk=offer_id)
        return Response(SupplyOfferSerializer(offer, context={'request': request, 'viewer': 'admin'}).data)


class AdminOfferActionView(APIView):
    permission_classes = [IsAdminOrManager]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def post(self, request, offer_id, action):
        offer = get_object_or_404(SupplyOffer.objects.prefetch_related('items'), pk=offer_id)
        if action == 'start-review':
            if offer.status != SupplyOffer.STATUS_SUBMITTED:
                raise ValidationError({'status': 'Only submitted offers can enter review.'})
            set_status(offer, SupplyOffer.STATUS_UNDER_REVIEW, request.user, SupplyOfferStatusHistory.ACTOR_ADMIN, 'Offer is under review.')
        elif action == 'approve':
            serializer = AdminApproveSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            if offer.status == SupplyOffer.STATUS_CUSTOMER_ACCEPTED:
                try:
                    final_approve_offer(
                        offer=offer,
                        user=request.user,
                        customer_safe_message=serializer.validated_data.get('customer_safe_message') or '',
                        receiving_warehouse=serializer.validated_data.get('receiving_warehouse_id'),
                    )
                except DjangoValidationError as exc:
                    raise ValidationError(exc.message_dict if hasattr(exc, 'message_dict') else exc.messages) from exc
                offer.refresh_from_db()
                return Response(SupplyOfferSerializer(offer, context={'request': request, 'viewer': 'admin'}).data)
            warehouse = serializer.validated_data.get('receiving_warehouse_id')
            for item in offer.items.all():
                item.agreed_unit_price = item.admin_proposed_unit_price or item.customer_proposed_unit_price
                item.agreed_line_total = Decimal(str(item.quantity)) * Decimal(str(item.agreed_unit_price))
                item.save(update_fields=['agreed_unit_price', 'agreed_line_total', 'updated_at'])
            offer.recalculate_totals()
            if warehouse:
                offer.receiving_warehouse = warehouse
            offer.save(update_fields=['proposed_total', 'admin_proposed_total', 'agreed_total', 'receiving_warehouse', 'updated_at'])
            set_status(offer, SupplyOffer.STATUS_AWAITING_RECEIPT, request.user, SupplyOfferStatusHistory.ACTOR_ADMIN, serializer.validated_data.get('customer_safe_message') or 'Your offer has been approved.')
            create_offer_card_message(offer, request.user, f'Supply offer approved: {offer.offer_number}')
        elif action == 'counter-offer':
            serializer = AdminCounterOfferSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            items = []
            offer_items = {item.id: item for item in offer.items.all()}
            for row in serializer.validated_data['items']:
                item = offer_items.get(int(row.get('offer_item_id') or 0))
                if not item:
                    raise ValidationError({'items': 'Offer item was not found.'})
                items.append({
                    'offer_item_id': item.id,
                    'admin_proposed_quantity': row.get('admin_proposed_quantity') or item.quantity,
                    'admin_proposed_unit_price': row.get('admin_proposed_unit_price'),
                })
            try:
                respond_to_offer(offer=offer, items=items, user=request.user, customer_safe_message=serializer.validated_data.get('message', 'Bayad proposed a new price.'))
            except DjangoValidationError as exc:
                raise ValidationError(exc.message_dict if hasattr(exc, 'message_dict') else exc.messages) from exc
        elif action == 'respond':
            serializer = AdminOfferResponseSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            try:
                respond_to_offer(
                    offer=offer,
                    items=serializer.validated_data['items'],
                    user=request.user,
                    customer_safe_message=serializer.validated_data.get('customer_safe_message') or '',
                    proposed_receipt_date=serializer.validated_data.get('proposed_receipt_date'),
                    proposed_receiving_warehouse=serializer.validated_data.get('proposed_receiving_warehouse_id'),
                    expires_at=serializer.validated_data.get('expires_at'),
                    response_notes=serializer.validated_data.get('response_notes') or '',
                    idempotency_key=serializer.validated_data.get('idempotency_key') or '',
                )
            except DjangoValidationError as exc:
                raise ValidationError(exc.message_dict if hasattr(exc, 'message_dict') else exc.messages) from exc
        elif action == 'reject':
            serializer = AdminRejectSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            offer.rejection_reason = serializer.validated_data['rejection_reason']
            offer.save(update_fields=['rejection_reason', 'updated_at'])
            set_status(offer, SupplyOffer.STATUS_REJECTED, request.user, SupplyOfferStatusHistory.ACTOR_ADMIN, offer.rejection_reason)
        elif action == 'select-warehouse':
            serializer = AdminApproveSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            warehouse = serializer.validated_data.get('receiving_warehouse_id')
            if not warehouse:
                raise ValidationError({'receiving_warehouse_id': 'Warehouse is required.'})
            offer.receiving_warehouse = warehouse
            offer.save(update_fields=['receiving_warehouse', 'updated_at'])
        elif action == 'record-receipt':
            serializer = ReceiptSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            try:
                movements = record_receipt(offer=offer, warehouse=serializer.validated_data['receiving_warehouse_id'], items=serializer.validated_data['items'], user=request.user, idempotency_key=serializer.validated_data.get('idempotency_key', ''))
            except DjangoValidationError as exc:
                raise ValidationError(exc.message_dict if hasattr(exc, 'message_dict') else exc.messages) from exc
            return Response({'movement_ids': [movement.id for movement in movements], 'status': offer.status}, status=status.HTTP_201_CREATED)
        elif action == 'record-payment':
            serializer = PaymentSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            try:
                payment = record_offer_payment(offer=offer, user=request.user, **serializer.validated_data)
            except DjangoValidationError as exc:
                raise ValidationError(exc.message_dict if hasattr(exc, 'message_dict') else exc.messages) from exc
            return Response({'payment_id': payment.id, 'journal_id': payment.linked_journal_transaction_id, 'status': offer.status}, status=status.HTTP_201_CREATED)
        else:
            raise ValidationError({'action': 'Unsupported action.'})
        offer.refresh_from_db()
        return Response(SupplyOfferSerializer(offer, context={'request': request, 'viewer': 'admin'}).data)


class AdminOfferTimelineView(APIView):
    permission_classes = [IsAdminOrManager]

    def get(self, request, offer_id):
        offer = get_object_or_404(SupplyOffer, pk=offer_id)
        return Response(SupplyOfferTimelineSerializer(offer.timeline.all(), many=True).data)


class SupplyOfferAttachmentDownloadView(APIView):
    def get(self, request, attachment_id):
        if not request.user or not request.user.is_authenticated:
            raise PermissionDenied()
        attachment = get_object_or_404(SupplyOfferAttachment.objects.select_related('offer__customer'), pk=attachment_id)
        if not is_admin_or_manager(request.user) and getattr(getattr(request.user, 'customer_account', None), 'customer_id', None) != attachment.offer.customer_id:
            raise PermissionDenied()
        response = FileResponse(attachment.file.open('rb'), content_type=attachment.mime_type or 'application/octet-stream')
        response['Content-Disposition'] = f'attachment; filename="{attachment.original_filename}"'
        return response


class AdminSupplyOfferUnreadView(APIView):
    permission_classes = [IsAdminOrManager]

    def get(self, request):
        count = SupplyOffer.objects.filter(status__in=[SupplyOffer.STATUS_SUBMITTED, SupplyOffer.STATUS_COUNTER_OFFERED, SupplyOffer.STATUS_CUSTOMER_ACCEPTED]).count()
        return Response({'pending_count': count})
