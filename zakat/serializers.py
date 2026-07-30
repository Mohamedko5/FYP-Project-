from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied

from customers.models import Customer
from inventory.models import Product

from .models import (
    CropMovementPermit,
    CropMovementPermitItem,
    CropZakatAssessment,
    CropZakatAssessmentItem,
    PreviousZakatReceiptEvidence,
    TradeZakatAssessment,
    ZakatAuditLog,
    ZakatPerformanceCertificate,
    ZakatReceipt,
    ZakatRule,
)
from .services import (
    approve_crop_assessment,
    calculate_crop_zakat,
    calculate_trade_zakat,
    verify_previous_receipt,
    verify_zakat_receipt,
)

ALLOWED_DOCUMENT_TYPES = {'application/pdf', 'image/jpeg', 'image/png'}
ALLOWED_DOCUMENT_EXTENSIONS = ('.pdf', '.jpg', '.jpeg', '.png')
MAX_DOCUMENT_SIZE = 5 * 1024 * 1024


def validate_document_file(value):
    if value in (None, ''):
        return value
    content_type = getattr(value, 'content_type', '')
    name = getattr(value, 'name', '').lower()
    if content_type and content_type not in ALLOWED_DOCUMENT_TYPES:
        raise serializers.ValidationError('Upload PDF, JPG, JPEG, or PNG documents only.')
    if name and not name.endswith(ALLOWED_DOCUMENT_EXTENSIONS):
        raise serializers.ValidationError('Upload PDF, JPG, JPEG, or PNG documents only.')
    if getattr(value, 'size', 0) and value.size > MAX_DOCUMENT_SIZE:
        raise serializers.ValidationError('Document must not exceed 5 MB.')
    return value


class ZakatRuleSerializer(serializers.ModelSerializer):
    crop_product_name = serializers.CharField(source='crop_product.name_en', read_only=True)

    class Meta:
        model = ZakatRule
        fields = '__all__'
        read_only_fields = ('created_by', 'created_at', 'updated_by', 'updated_at')

    def validate_source_document(self, value):
        return validate_document_file(value)

    def create(self, validated_data):
        request = self.context['request']
        return ZakatRule.objects.create(created_by=request.user, **validated_data)

    def update(self, instance, validated_data):
        validated_data['updated_by'] = self.context['request'].user
        return super().update(instance, validated_data)


class PreviousZakatReceiptEvidenceSerializer(serializers.ModelSerializer):
    crop_name = serializers.CharField(source='crop.name_en', read_only=True)

    class Meta:
        model = PreviousZakatReceiptEvidence
        fields = '__all__'
        read_only_fields = ('created_by', 'created_at', 'updated_by', 'updated_at', 'verified_by', 'verified_at')

    def validate_document_file(self, value):
        return validate_document_file(value)

    def create(self, validated_data):
        return PreviousZakatReceiptEvidence.objects.create(created_by=self.context['request'].user, **validated_data)

    def update(self, instance, validated_data):
        validated_data['updated_by'] = self.context['request'].user
        return super().update(instance, validated_data)


class CropZakatAssessmentItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name_en', read_only=True)

    class Meta:
        model = CropZakatAssessmentItem
        fields = '__all__'
        read_only_fields = (
            'assessment', 'product_name_snapshot', 'threshold_quantity_snapshot', 'applied_rate_snapshot',
            'valuation_price_snapshot', 'estimated_crop_value', 'zakat_quantity', 'zakat_monetary_value',
            'conversion_snapshot',
        )
        extra_kwargs = {
            'agricultural_season': {'required': False, 'allow_blank': True},
        }


class CropZakatAssessmentSerializer(serializers.ModelSerializer):
    items = CropZakatAssessmentItemSerializer(many=True, required=False)
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    selected_rule_code = serializers.CharField(source='selected_rule.rule_code', read_only=True)

    class Meta:
        model = CropZakatAssessment
        fields = '__all__'
        read_only_fields = (
            'assessment_number', 'created_by', 'created_at', 'updated_by', 'updated_at',
            'reviewed_by', 'reviewed_at', 'approved_by', 'approved_at', 'cancelled_by', 'cancelled_at',
            'selected_rule', 'official_reference_snapshot', 'total_assessed_value', 'total_zakat_quantity',
            'total_zakat_value',
        )

    def create(self, validated_data):
        items = validated_data.pop('items', [])
        request = self.context['request']
        customer = validated_data.get('customer')
        if customer and not validated_data.get('seller_name_snapshot'):
            validated_data['seller_name_snapshot'] = customer.name
            validated_data['seller_phone_snapshot'] = customer.phone
        assessment = CropZakatAssessment.objects.create(created_by=request.user, **validated_data)
        for item in items:
            product = item['product']
            CropZakatAssessmentItem.objects.create(
                assessment=assessment,
                product_name_snapshot=product.name_en,
                agricultural_season=item.get('agricultural_season') or assessment.agricultural_season,
                **item,
            )
        return assessment

    def update(self, instance, validated_data):
        validated_data['updated_by'] = self.context['request'].user
        items = validated_data.pop('items', None)
        instance = super().update(instance, validated_data)
        if items is not None and instance.assessment_status == CropZakatAssessment.STATUS_DRAFT:
            instance.items.all().delete()
            for item in items:
                product = item['product']
                CropZakatAssessmentItem.objects.create(
                    assessment=instance,
                    product_name_snapshot=product.name_en,
                    agricultural_season=item.get('agricultural_season') or instance.agricultural_season,
                    **item,
                )
        return instance


class CalculateCropSerializer(serializers.Serializer):
    def save(self, **kwargs):
        return calculate_crop_zakat(assessment=self.context['assessment'], user=self.context['request'].user)


class ApproveCropSerializer(serializers.Serializer):
    def save(self, **kwargs):
        try:
            return approve_crop_assessment(assessment=self.context['assessment'], user=self.context['request'].user)
        except PermissionError as exc:
            raise PermissionDenied(str(exc)) from exc


class TradeZakatAssessmentSerializer(serializers.ModelSerializer):
    selected_rule_code = serializers.CharField(source='selected_rule.rule_code', read_only=True)

    class Meta:
        model = TradeZakatAssessment
        fields = '__all__'
        read_only_fields = (
            'assessment_number', 'net_assessable_base', 'monetary_threshold', 'applied_rate', 'zakat_due',
            'created_by', 'created_at', 'updated_by', 'updated_at', 'reviewed_by', 'approved_by',
        )

    def validate_supporting_document(self, value):
        return validate_document_file(value)

    def create(self, validated_data):
        return TradeZakatAssessment.objects.create(created_by=self.context['request'].user, **validated_data)

    def update(self, instance, validated_data):
        validated_data['updated_by'] = self.context['request'].user
        return super().update(instance, validated_data)


class CalculateTradeSerializer(serializers.Serializer):
    def save(self, **kwargs):
        return calculate_trade_zakat(assessment=self.context['assessment'], user=self.context['request'].user)


class ZakatReceiptSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.name', read_only=True)

    class Meta:
        model = ZakatReceipt
        fields = '__all__'
        read_only_fields = ('created_by', 'created_at', 'updated_by', 'updated_at', 'verified_by', 'verified_at')

    def validate_document_file(self, value):
        return validate_document_file(value)

    def create(self, validated_data):
        return ZakatReceipt.objects.create(created_by=self.context['request'].user, **validated_data)

    def update(self, instance, validated_data):
        validated_data['updated_by'] = self.context['request'].user
        return super().update(instance, validated_data)


class VerifySerializer(serializers.Serializer):
    notes = serializers.CharField(required=False, allow_blank=True)

    def save(self, **kwargs):
        target = self.context['target']
        user = self.context['request'].user
        notes = self.validated_data.get('notes', '')
        try:
            if isinstance(target, PreviousZakatReceiptEvidence):
                return verify_previous_receipt(evidence=target, user=user, notes=notes)
            return verify_zakat_receipt(receipt=target, user=user, notes=notes)
        except PermissionError as exc:
            raise PermissionDenied(str(exc)) from exc


class ZakatPerformanceCertificateSerializer(serializers.ModelSerializer):
    computed_status = serializers.CharField(read_only=True)
    customer_name = serializers.CharField(source='customer.name', read_only=True)

    class Meta:
        model = ZakatPerformanceCertificate
        fields = '__all__'
        read_only_fields = ('created_by', 'created_at', 'updated_by', 'updated_at', 'verified_by', 'verified_at', 'computed_status')

    def validate_document_file(self, value):
        return validate_document_file(value)

    def create(self, validated_data):
        return ZakatPerformanceCertificate.objects.create(created_by=self.context['request'].user, **validated_data)

    def update(self, instance, validated_data):
        validated_data['updated_by'] = self.context['request'].user
        return super().update(instance, validated_data)


class CropMovementPermitItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name_en', read_only=True)
    warehouse_name = serializers.CharField(source='warehouse.warehouse_name', read_only=True)

    class Meta:
        model = CropMovementPermitItem
        fields = '__all__'
        read_only_fields = ('permit',)


class CropMovementPermitSerializer(serializers.ModelSerializer):
    items = CropMovementPermitItemSerializer(many=True, required=False)
    computed_status = serializers.CharField(read_only=True)
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    warehouse_name = serializers.CharField(source='warehouse.warehouse_name', read_only=True)

    class Meta:
        model = CropMovementPermit
        fields = '__all__'
        read_only_fields = ('created_by', 'created_at', 'updated_by', 'updated_at', 'verified_by', 'verified_at', 'computed_status')

    def validate_document_file(self, value):
        return validate_document_file(value)

    def create(self, validated_data):
        items = validated_data.pop('items', [])
        permit = CropMovementPermit.objects.create(created_by=self.context['request'].user, **validated_data)
        for item in items:
            CropMovementPermitItem.objects.create(permit=permit, **item)
        return permit

    def update(self, instance, validated_data):
        items = validated_data.pop('items', None)
        validated_data['updated_by'] = self.context['request'].user
        instance = super().update(instance, validated_data)
        if items is not None and instance.status == CropMovementPermit.STATUS_DRAFT:
            instance.items.all().delete()
            for item in items:
                CropMovementPermitItem.objects.create(permit=instance, **item)
        return instance


class ZakatAuditLogSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = ZakatAuditLog
        fields = '__all__'
        read_only_fields = fields

    def get_actor_name(self, obj):
        return obj.actor.get_full_name() or obj.actor.username or obj.actor.email
