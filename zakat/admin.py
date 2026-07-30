from django.contrib import admin

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


class CropZakatAssessmentItemInline(admin.TabularInline):
    model = CropZakatAssessmentItem
    extra = 0


@admin.register(CropZakatAssessment)
class CropZakatAssessmentAdmin(admin.ModelAdmin):
    list_display = ('assessment_number', 'assessment_date', 'seller_name_snapshot', 'assessment_status', 'payment_status')
    list_filter = ('assessment_status', 'payment_status', 'irrigation_method')
    search_fields = ('assessment_number', 'seller_name_snapshot', 'zakat_file_number')
    inlines = [CropZakatAssessmentItemInline]


class CropMovementPermitItemInline(admin.TabularInline):
    model = CropMovementPermitItem
    extra = 0


@admin.register(CropMovementPermit)
class CropMovementPermitAdmin(admin.ModelAdmin):
    list_display = ('permit_number', 'issue_date', 'expiry_date', 'status', 'vehicle_number')
    inlines = [CropMovementPermitItemInline]


admin.site.register(ZakatRule)
admin.site.register(PreviousZakatReceiptEvidence)
admin.site.register(TradeZakatAssessment)
admin.site.register(ZakatReceipt)
admin.site.register(ZakatPerformanceCertificate)
admin.site.register(ZakatAuditLog)
