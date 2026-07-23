from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from inventory.models import Product, ProductUnit, Warehouse
from inventory.serializers import ProductSerializer, WarehouseSerializer

from .models import OfferPayment, OfferResponse, OfferResponseItem, SupplyOffer, SupplyOfferAttachment, SupplyOfferItem, SupplyOfferStatusHistory
from .services import validate_product_unit


class SupplyOfferItemSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)
    product_id = serializers.IntegerField(write_only=True)
    product_unit_id = serializers.IntegerField(write_only=True)
    customer_proposed_unit_price = serializers.DecimalField(max_digits=18, decimal_places=2, required=False)
    unit = serializers.CharField(source='unit_snapshot', read_only=True)
    proposed_unit_price = serializers.DecimalField(source='customer_proposed_unit_price', max_digits=18, decimal_places=2, write_only=True, required=False)

    class Meta:
        model = SupplyOfferItem
        fields = (
            'id', 'product', 'product_id', 'product_unit', 'product_unit_id', 'quantity',
            'customer_proposed_unit_price', 'proposed_unit_price', 'customer_proposed_line_total',
            'admin_proposed_unit_price', 'agreed_unit_price', 'agreed_line_total',
            'quality_grade', 'harvest_date', 'packaging_details', 'item_notes',
            'product_name_snapshot', 'unit_snapshot', 'unit', 'accepted_quantity', 'rejected_quantity',
        )
        read_only_fields = (
            'id', 'product', 'product_unit', 'customer_proposed_line_total',
            'admin_proposed_unit_price', 'agreed_unit_price', 'agreed_line_total',
            'product_name_snapshot', 'unit_snapshot', 'unit', 'accepted_quantity', 'rejected_quantity',
        )


class SupplyOfferAttachmentSerializer(serializers.ModelSerializer):
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = SupplyOfferAttachment
        fields = ('id', 'offer', 'item', 'attachment_type', 'file', 'original_filename', 'mime_type', 'file_size', 'download_url', 'created_at')
        read_only_fields = ('id', 'offer', 'file', 'original_filename', 'mime_type', 'file_size', 'download_url', 'created_at')

    def get_download_url(self, obj):
        request = self.context.get('request')
        url = f'/api/supply-offers/attachments/{obj.id}/'
        return request.build_absolute_uri(url) if request else url


class SupplyOfferTimelineSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = SupplyOfferStatusHistory
        fields = ('id', 'previous_status', 'new_status', 'actor_type', 'actor_name', 'customer_safe_note', 'created_at')

    def get_actor_name(self, obj):
        return obj.changed_by.get_full_name() or obj.changed_by.username or obj.changed_by.email


class OfferResponseItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='offer_item.product_name_snapshot', read_only=True)
    unit = serializers.CharField(source='offer_item.unit_snapshot', read_only=True)
    customer_quantity = serializers.DecimalField(source='offer_item.quantity', max_digits=18, decimal_places=3, read_only=True)
    customer_unit_price = serializers.DecimalField(source='offer_item.customer_proposed_unit_price', max_digits=18, decimal_places=2, read_only=True)
    customer_line_total = serializers.DecimalField(source='offer_item.customer_proposed_line_total', max_digits=18, decimal_places=2, read_only=True)

    class Meta:
        model = OfferResponseItem
        fields = (
            'id', 'offer_item', 'product_name', 'unit', 'customer_quantity', 'customer_unit_price',
            'customer_line_total', 'admin_proposed_quantity', 'admin_proposed_unit_price',
            'admin_proposed_line_total', 'admin_note',
        )
        read_only_fields = fields


class OfferResponseSerializer(serializers.ModelSerializer):
    items = OfferResponseItemSerializer(many=True, read_only=True)
    proposed_receiving_warehouse_name = serializers.CharField(source='proposed_receiving_warehouse.warehouse_name', read_only=True)
    is_unread = serializers.SerializerMethodField()

    class Meta:
        model = OfferResponse
        fields = (
            'id', 'response_number', 'response_version', 'status', 'customer_safe_message',
            'proposed_receipt_date', 'proposed_receiving_warehouse',
            'proposed_receiving_warehouse_name', 'expires_at', 'customer_responded_at',
            'customer_rejection_reason', 'customer_read_at', 'is_current', 'is_unread', 'proposed_total', 'items', 'created_at', 'updated_at',
        )
        read_only_fields = fields

    def get_is_unread(self, obj):
        return obj.is_current and obj.status == OfferResponse.STATUS_PENDING_CUSTOMER and obj.customer_read_at is None


class OfferPaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = OfferPayment
        fields = (
            'id', 'payment_number', 'amount', 'payment_method', 'payment_date',
            'transaction_reference', 'paying_bank', 'card_last_four', 'payment_receipt',
            'description', 'status', 'created_at',
        )
        read_only_fields = fields


class SupplyOfferSerializer(serializers.ModelSerializer):
    items = SupplyOfferItemSerializer(many=True)
    attachments = SupplyOfferAttachmentSerializer(many=True, read_only=True)
    timeline = SupplyOfferTimelineSerializer(many=True, read_only=True)
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    customer_code = serializers.CharField(source='customer.code', read_only=True)
    customer_phone = serializers.CharField(source='customer.phone', read_only=True)
    customer_type = serializers.CharField(source='customer.customer_type', read_only=True)
    product_summary = serializers.CharField(read_only=True)
    receiving_warehouse_detail = WarehouseSerializer(source='receiving_warehouse', read_only=True)
    responses = OfferResponseSerializer(many=True, read_only=True)
    current_response = serializers.SerializerMethodField()
    payments = OfferPaymentSerializer(source='offer_payments', many=True, read_only=True)
    item_count = serializers.SerializerMethodField()
    customer_proposed_total = serializers.DecimalField(source='proposed_total', max_digits=18, decimal_places=2, read_only=True)
    latest_admin_message = serializers.CharField(source='customer_safe_admin_message', read_only=True)
    current_response_id = serializers.SerializerMethodField()
    current_response_status = serializers.SerializerMethodField()
    has_unread_response = serializers.SerializerMethodField()
    unread_response_count = serializers.SerializerMethodField()
    requires_customer_action = serializers.SerializerMethodField()
    allowed_actions = serializers.SerializerMethodField()

    blocked_customer_fields = {
        'offer_number', 'customer', 'customer_id', 'status', 'admin_notes', 'reviewed_by',
        'approved_by', 'rejected_by', 'receiving_warehouse', 'receiving_warehouse_id',
        'agreed_total', 'admin_proposed_total', 'created_at', 'updated_at',
    }

    class Meta:
        model = SupplyOffer
        fields = (
            'id', 'offer_number', 'customer_name', 'customer_code', 'customer_phone', 'customer_type',
            'status', 'customer_reference', 'region', 'city', 'area', 'detailed_address',
            'latitude', 'longitude', 'availability_date', 'customer_notes',
            'rejection_reason', 'customer_safe_admin_message', 'submitted_at', 'reviewed_at',
            'approved_at', 'rejected_at', 'receiving_warehouse', 'receiving_warehouse_detail',
            'currency', 'proposed_total', 'customer_proposed_total', 'admin_proposed_total', 'agreed_total', 'paid_amount', 'payment_status',
            'product_summary', 'items', 'attachments', 'timeline', 'created_at', 'updated_at',
            'idempotency_key', 'responses', 'current_response', 'payments', 'item_count',
            'latest_admin_message', 'latest_response_at', 'current_response_id',
            'current_response_status', 'has_unread_response', 'unread_response_count',
            'requires_customer_action', 'allowed_actions',
        )
        read_only_fields = (
            'id', 'offer_number', 'status', 'customer_name', 'customer_code', 'customer_phone',
            'customer_type', 'rejection_reason', 'customer_safe_admin_message', 'submitted_at',
            'reviewed_at', 'approved_at', 'rejected_at', 'receiving_warehouse',
            'receiving_warehouse_detail', 'currency', 'proposed_total', 'admin_proposed_total',
            'agreed_total', 'paid_amount', 'payment_status', 'product_summary', 'attachments', 'timeline', 'created_at', 'updated_at',
            'responses', 'current_response', 'payments', 'item_count', 'customer_proposed_total',
            'latest_admin_message', 'latest_response_at', 'current_response_id',
            'current_response_status', 'has_unread_response', 'unread_response_count',
            'requires_customer_action', 'allowed_actions',
        )

    def _current_response(self, obj):
        prefetched = getattr(obj, '_prefetched_objects_cache', {}).get('responses')
        if prefetched is not None:
            for response in prefetched:
                if response.is_current:
                    return response
            return None
        return obj.responses.filter(is_current=True).prefetch_related('items__offer_item').first()

    def get_current_response(self, obj):
        response = self._current_response(obj)
        if not response:
            return None
        return OfferResponseSerializer(response, context=self.context).data

    def get_item_count(self, obj):
        return obj.items.count()

    def get_current_response_id(self, obj):
        response = self._current_response(obj)
        return response.id if response else None

    def get_current_response_status(self, obj):
        response = self._current_response(obj)
        return response.status if response else ''

    def get_has_unread_response(self, obj):
        response = self._current_response(obj)
        return bool(response and response.status == OfferResponse.STATUS_PENDING_CUSTOMER and response.customer_read_at is None)

    def get_unread_response_count(self, obj):
        return 1 if self.get_has_unread_response(obj) else 0

    def get_requires_customer_action(self, obj):
        response = self._current_response(obj)
        return bool(response and response.status == OfferResponse.STATUS_PENDING_CUSTOMER and response.is_current)

    def get_allowed_actions(self, obj):
        response = self._current_response(obj)
        return {
            'can_accept_response': bool(response and response.status == OfferResponse.STATUS_PENDING_CUSTOMER and response.is_current),
            'can_reject_response': bool(response and response.status == OfferResponse.STATUS_PENDING_CUSTOMER and response.is_current),
            'can_withdraw_offer': obj.status in SupplyOffer.WITHDRAWABLE_STATUSES,
        }

    def to_internal_value(self, data):
        if self.context.get('viewer') == 'customer':
            blocked = self.blocked_customer_fields.intersection(data.keys())
            if blocked:
                raise serializers.ValidationError({field: ['This field cannot be supplied by the customer.'] for field in blocked})
        return super().to_internal_value(data)

    def validate_items(self, items):
        if not items:
            raise serializers.ValidationError('At least one item is required.')
        seen = set()
        for item in items:
            product, product_unit = validate_product_unit(item['product_id'], item['product_unit_id'])
            key = (product.id, product_unit.id)
            if key in seen:
                raise serializers.ValidationError('Duplicate product and unit lines are not allowed.')
            seen.add(key)
            item['product'] = product
            item['product_unit'] = product_unit
            price = item.get('customer_proposed_unit_price') or item.get('proposed_unit_price')
            if price is None:
                raise serializers.ValidationError('Proposed unit price is required.')
            if item.get('quantity') is None or item['quantity'] <= 0:
                raise serializers.ValidationError('Quantity must be greater than zero.')
            if price <= 0:
                raise serializers.ValidationError('Proposed unit price must be greater than zero.')
            item['customer_proposed_unit_price'] = price
        return items

    def create(self, validated_data):
        request = self.context['request']
        customer = self.context['customer']
        items = validated_data.pop('items', [])
        idempotency_key = (validated_data.pop('idempotency_key', '') or request.headers.get('Idempotency-Key') or '').strip()
        if idempotency_key:
            existing = SupplyOffer.objects.filter(customer=customer, idempotency_key=idempotency_key).first()
            if existing:
                return existing
        offer = SupplyOffer.objects.create(customer=customer, idempotency_key=idempotency_key, **validated_data)
        for row in items:
            SupplyOfferItem.objects.create(
                offer=offer,
                product=row['product'],
                product_unit=row['product_unit'],
                quantity=row['quantity'],
                customer_proposed_unit_price=row['customer_proposed_unit_price'],
                quality_grade=row.get('quality_grade', ''),
                harvest_date=row.get('harvest_date'),
                packaging_details=row.get('packaging_details', ''),
                item_notes=row.get('item_notes', ''),
            )
        offer.recalculate_totals()
        try:
            offer.full_clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict) from exc
        offer.save(update_fields=['proposed_total', 'admin_proposed_total', 'agreed_total', 'updated_at'])
        SupplyOfferStatusHistory.objects.create(
            offer=offer,
            previous_status='',
            new_status=offer.status,
            changed_by=request.user,
            actor_type=SupplyOfferStatusHistory.ACTOR_CUSTOMER,
            customer_safe_note='Draft offer created.',
        )
        return offer


class SupplyOfferAttachmentUploadSerializer(serializers.Serializer):
    file = serializers.FileField()
    attachment_type = serializers.ChoiceField(choices=SupplyOfferAttachment.TYPE_CHOICES, default=SupplyOfferAttachment.TYPE_PRODUCT_IMAGE)
    item_id = serializers.IntegerField(required=False, allow_null=True)

    def validate_file(self, value):
        allowed = {
            'image/jpeg': 5 * 1024 * 1024,
            'image/png': 5 * 1024 * 1024,
            'image/webp': 5 * 1024 * 1024,
            'application/pdf': 10 * 1024 * 1024,
        }
        mime = getattr(value, 'content_type', '') or ''
        if mime not in allowed:
            raise serializers.ValidationError('Only JPG, PNG, WebP, or PDF files are allowed.')
        if value.size > allowed[mime]:
            raise serializers.ValidationError('File is too large.')
        return value

    def validate(self, attrs):
        offer = self.context['offer']
        item_id = attrs.get('item_id')
        attrs['item'] = None
        if item_id:
            try:
                attrs['item'] = offer.items.get(pk=item_id)
            except SupplyOfferItem.DoesNotExist as exc:
                raise serializers.ValidationError({'item_id': 'Offer item was not found.'}) from exc
        if attrs['attachment_type'] == SupplyOfferAttachment.TYPE_PRODUCT_IMAGE:
            count = offer.attachments.filter(attachment_type=SupplyOfferAttachment.TYPE_PRODUCT_IMAGE).count()
            if count >= 6:
                raise serializers.ValidationError({'file': 'Maximum product images is 6.'})
        return attrs


class AdminCounterOfferSerializer(serializers.Serializer):
    message = serializers.CharField(required=False, allow_blank=True)
    items = serializers.ListField(child=serializers.DictField(), allow_empty=False)


class AdminOfferResponseSerializer(serializers.Serializer):
    customer_safe_message = serializers.CharField(required=False, allow_blank=True)
    proposed_receipt_date = serializers.DateField(required=False, allow_null=True)
    proposed_receiving_warehouse_id = serializers.IntegerField(required=False, allow_null=True)
    expires_at = serializers.DateTimeField(required=False, allow_null=True)
    response_notes = serializers.CharField(required=False, allow_blank=True)
    idempotency_key = serializers.CharField(required=False, allow_blank=True)
    items = serializers.ListField(child=serializers.DictField(), allow_empty=False)

    def validate_proposed_receiving_warehouse_id(self, value):
        if not value:
            return None
        try:
            return Warehouse.objects.get(pk=value)
        except Warehouse.DoesNotExist as exc:
            raise serializers.ValidationError('Warehouse was not found.') from exc


class CustomerResponseRejectSerializer(serializers.Serializer):
    reason = serializers.CharField()


class AdminRejectSerializer(serializers.Serializer):
    rejection_reason = serializers.CharField()


class AdminApproveSerializer(serializers.Serializer):
    customer_safe_message = serializers.CharField(required=False, allow_blank=True)
    receiving_warehouse_id = serializers.IntegerField(required=False, allow_null=True)

    def validate_receiving_warehouse_id(self, value):
        if not value:
            return None
        try:
            return Warehouse.objects.get(pk=value)
        except Warehouse.DoesNotExist as exc:
            raise serializers.ValidationError('Warehouse was not found.') from exc


class ReceiptSerializer(serializers.Serializer):
    receiving_warehouse_id = serializers.IntegerField()
    items = serializers.ListField(child=serializers.DictField(), allow_empty=False)
    idempotency_key = serializers.CharField(required=False, allow_blank=True)

    def validate_receiving_warehouse_id(self, value):
        try:
            return Warehouse.objects.get(pk=value)
        except Warehouse.DoesNotExist as exc:
            raise serializers.ValidationError('Warehouse was not found.') from exc


class PaymentSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=18, decimal_places=2)
    payment_method = serializers.ChoiceField(choices=OfferPayment.METHOD_CHOICES)
    payment_date = serializers.DateField(required=False)
    transaction_reference = serializers.CharField(required=False, allow_blank=True)
    electronic_reference = serializers.CharField(required=False, allow_blank=True)
    paying_bank = serializers.CharField(required=False, allow_blank=True)
    card_last_four = serializers.CharField(required=False, allow_blank=True, max_length=4)
    payment_receipt = serializers.FileField(required=False, allow_null=True)
    description = serializers.CharField(required=False, allow_blank=True)
    idempotency_key = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        full_card_fields = {'card_number', 'full_card_number', 'cvv', 'cvc', 'pin', 'otp'}
        blocked = full_card_fields.intersection(self.initial_data.keys())
        if blocked:
            raise serializers.ValidationError({field: 'This field is not supported.' for field in blocked})
        method = attrs.get('payment_method')
        attrs['transaction_reference'] = (attrs.get('transaction_reference') or attrs.get('electronic_reference') or '').strip()
        if method == OfferPayment.METHOD_BANK_OF_KHARTOUM and not attrs['transaction_reference']:
            raise serializers.ValidationError({'transaction_reference': 'Transfer reference is required.'})
        if method in {OfferPayment.METHOD_BANK_OF_KHARTOUM, OfferPayment.METHOD_VISA, OfferPayment.METHOD_MASTERCARD} and not attrs.get('payment_receipt'):
            raise serializers.ValidationError({'payment_receipt': 'Payment receipt is required.'})
        if method in {OfferPayment.METHOD_VISA, OfferPayment.METHOD_MASTERCARD} and not attrs['transaction_reference']:
            raise serializers.ValidationError({'transaction_reference': 'External transaction reference is required.'})
        card_last_four = (attrs.get('card_last_four') or '').strip()
        if card_last_four and (not card_last_four.isdigit() or len(card_last_four) != 4):
            raise serializers.ValidationError({'card_last_four': 'Enter the last four digits only.'})
        attrs['card_last_four'] = card_last_four
        return attrs
