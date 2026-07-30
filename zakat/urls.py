from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    CropMovementPermitViewSet,
    CropZakatAssessmentViewSet,
    PreviousZakatReceiptEvidenceViewSet,
    TradeZakatAssessmentViewSet,
    ZakatAuditLogViewSet,
    ZakatDashboardView,
    ZakatPerformanceCertificateViewSet,
    ZakatReceiptViewSet,
    ZakatReportsView,
    ZakatRuleViewSet,
)

router = DefaultRouter()
router.register('rules', ZakatRuleViewSet, basename='zakat-rule')
router.register('previous-receipts', PreviousZakatReceiptEvidenceViewSet, basename='zakat-previous-receipt')
router.register('crop-assessments', CropZakatAssessmentViewSet, basename='zakat-crop-assessment')
router.register('trade-assessments', TradeZakatAssessmentViewSet, basename='zakat-trade-assessment')
router.register('receipts', ZakatReceiptViewSet, basename='zakat-receipt')
router.register('certificates', ZakatPerformanceCertificateViewSet, basename='zakat-certificate')
router.register('movement-permits', CropMovementPermitViewSet, basename='zakat-movement-permit')
router.register('audit-history', ZakatAuditLogViewSet, basename='zakat-audit')

urlpatterns = [
    path('dashboard/', ZakatDashboardView.as_view(), name='zakat-dashboard'),
    path('reports/', ZakatReportsView.as_view(), name='zakat-reports'),
]
urlpatterns += router.urls
