from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    CropMovementPermit,
    CropZakatAssessment,
    PreviousZakatReceiptEvidence,
    TradeZakatAssessment,
    ZakatAuditLog,
    ZakatPerformanceCertificate,
    ZakatReceipt,
    ZakatRule,
)
from .permissions import IsZakatAdminForSensitiveActions, IsZakatUser
from .serializers import (
    ApproveCropSerializer,
    CalculateCropSerializer,
    CalculateTradeSerializer,
    CropMovementPermitSerializer,
    CropZakatAssessmentSerializer,
    PreviousZakatReceiptEvidenceSerializer,
    TradeZakatAssessmentSerializer,
    VerifySerializer,
    ZakatAuditLogSerializer,
    ZakatPerformanceCertificateSerializer,
    ZakatReceiptSerializer,
    ZakatRuleSerializer,
)
from .services import dashboard_summary, report_summary, seed_draft_rules


class BaseZakatViewSet(viewsets.ModelViewSet):
    permission_classes = [IsZakatUser]
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    def perform_create(self, serializer):
        try:
            serializer.save()
        except DjangoValidationError as exc:
            raise ValidationError(exc.message_dict if hasattr(exc, 'message_dict') else exc.messages) from exc


class ZakatRuleViewSet(BaseZakatViewSet):
    queryset = ZakatRule.objects.select_related('crop_product', 'created_by', 'updated_by')
    serializer_class = ZakatRuleSerializer
    permission_classes = [IsZakatAdminForSensitiveActions]

    @action(detail=False, methods=['post'], url_path='seed-draft-rules')
    def seed_draft_rules(self, request):
        return Response(seed_draft_rules(user=request.user), status=status.HTTP_201_CREATED)


class PreviousZakatReceiptEvidenceViewSet(BaseZakatViewSet):
    queryset = PreviousZakatReceiptEvidence.objects.select_related('crop', 'created_by', 'verified_by')
    serializer_class = PreviousZakatReceiptEvidenceSerializer

    @action(detail=True, methods=['post'])
    def verify(self, request, pk=None):
        serializer = VerifySerializer(data=request.data, context={'request': request, 'target': self.get_object()})
        serializer.is_valid(raise_exception=True)
        evidence = serializer.save()
        return Response(self.get_serializer(evidence).data)


class CropZakatAssessmentViewSet(BaseZakatViewSet):
    queryset = CropZakatAssessment.objects.select_related('customer', 'selected_rule', 'previous_receipt').prefetch_related('items__product')
    serializer_class = CropZakatAssessmentSerializer

    @action(detail=True, methods=['post'])
    def calculate(self, request, pk=None):
        serializer = CalculateCropSerializer(data=request.data, context={'request': request, 'assessment': self.get_object()})
        serializer.is_valid(raise_exception=True)
        return Response(serializer.save())

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        serializer = ApproveCropSerializer(data=request.data, context={'request': request, 'assessment': self.get_object()})
        serializer.is_valid(raise_exception=True)
        assessment = serializer.save()
        return Response(self.get_serializer(assessment).data)


class TradeZakatAssessmentViewSet(BaseZakatViewSet):
    queryset = TradeZakatAssessment.objects.select_related('selected_rule', 'created_by')
    serializer_class = TradeZakatAssessmentSerializer

    @action(detail=True, methods=['post'])
    def calculate(self, request, pk=None):
        serializer = CalculateTradeSerializer(data=request.data, context={'request': request, 'assessment': self.get_object()})
        serializer.is_valid(raise_exception=True)
        return Response(serializer.save())


class ZakatReceiptViewSet(BaseZakatViewSet):
    queryset = ZakatReceipt.objects.select_related('crop_assessment', 'trade_assessment', 'customer', 'created_by', 'verified_by')
    serializer_class = ZakatReceiptSerializer

    @action(detail=True, methods=['post'])
    def verify(self, request, pk=None):
        serializer = VerifySerializer(data=request.data, context={'request': request, 'target': self.get_object()})
        serializer.is_valid(raise_exception=True)
        receipt = serializer.save()
        return Response(self.get_serializer(receipt).data)


class ZakatPerformanceCertificateViewSet(BaseZakatViewSet):
    queryset = ZakatPerformanceCertificate.objects.select_related('customer', 'created_by', 'verified_by')
    serializer_class = ZakatPerformanceCertificateSerializer


class CropMovementPermitViewSet(BaseZakatViewSet):
    queryset = CropMovementPermit.objects.select_related('shipment', 'warehouse', 'customer', 'related_zakat_assessment', 'related_zakat_receipt').prefetch_related('items__product')
    serializer_class = CropMovementPermitSerializer


class ZakatAuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ZakatAuditLog.objects.select_related('actor')
    serializer_class = ZakatAuditLogSerializer
    permission_classes = [IsZakatUser]


class ZakatDashboardView(APIView):
    permission_classes = [IsZakatUser]

    def get(self, request):
        return Response({
            **dashboard_summary(),
            'notice': 'Local Zakat rules require confirmation from the competent Zakat Chamber office in Kosti / White Nile State.',
        })


class ZakatReportsView(APIView):
    permission_classes = [IsZakatUser]

    def get(self, request):
        return Response(report_summary(request.query_params))
