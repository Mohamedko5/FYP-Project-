from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q
from django.utils import timezone

from inventory.models import UNIT_CHOICES


class TimeStampedUserModel(models.Model):
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='%(class)s_created')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='%(class)s_updated', null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class ZakatRule(TimeStampedUserModel):
    TYPE_CROP = 'crop'
    TYPE_TRADE = 'trade'
    TYPE_CHOICES = [(TYPE_CROP, 'Crop Zakat'), (TYPE_TRADE, 'Trade Zakat')]

    IRRIGATION_NATURAL = 'natural'
    IRRIGATION_ARTIFICIAL = 'artificial'
    IRRIGATION_MIXED = 'mixed'
    IRRIGATION_UNKNOWN = 'unknown'
    IRRIGATION_CHOICES = [
        (IRRIGATION_NATURAL, 'Natural'),
        (IRRIGATION_ARTIFICIAL, 'Artificial'),
        (IRRIGATION_MIXED, 'Mixed'),
        (IRRIGATION_UNKNOWN, 'Unknown'),
    ]

    METHOD_QUANTITY_PERCENTAGE = 'quantity_percentage'
    METHOD_MONETARY_PERCENTAGE = 'monetary_percentage'
    METHOD_MANUAL_OFFICIAL = 'manual_official_assessment'
    METHOD_CHOICES = [
        (METHOD_QUANTITY_PERCENTAGE, 'Quantity Percentage'),
        (METHOD_MONETARY_PERCENTAGE, 'Monetary Percentage'),
        (METHOD_MANUAL_OFFICIAL, 'Manual Official Assessment'),
    ]

    VERIFICATION_DRAFT = 'draft'
    VERIFICATION_CONFIRMED = 'locally_confirmed'
    VERIFICATION_EXPIRED = 'expired'
    VERIFICATION_SUSPENDED = 'suspended'
    VERIFICATION_CHOICES = [
        (VERIFICATION_DRAFT, 'Draft'),
        (VERIFICATION_CONFIRMED, 'Locally Confirmed'),
        (VERIFICATION_EXPIRED, 'Expired'),
        (VERIFICATION_SUSPENDED, 'Suspended'),
    ]

    rule_code = models.CharField(max_length=40, unique=True)
    name_ar = models.CharField(max_length=150)
    name_en = models.CharField(max_length=150)
    zakat_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    crop_product = models.ForeignKey('inventory.Product', on_delete=models.PROTECT, related_name='zakat_rules', null=True, blank=True)
    crop_category = models.CharField(max_length=80, blank=True)
    irrigation_method = models.CharField(max_length=20, choices=IRRIGATION_CHOICES, null=True, blank=True)
    calculation_method = models.CharField(max_length=40, choices=METHOD_CHOICES)
    rate_percentage = models.DecimalField(max_digits=8, decimal_places=4, default=Decimal('0.0000'))
    threshold_quantity = models.DecimalField(max_digits=18, decimal_places=3, null=True, blank=True)
    threshold_unit = models.CharField(max_length=20, choices=UNIT_CHOICES, null=True, blank=True)
    monetary_threshold = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=10, default='SDG')
    official_valuation_price = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True)
    valuation_unit = models.CharField(max_length=20, choices=UNIT_CHOICES, null=True, blank=True)
    effective_from = models.DateField()
    effective_to = models.DateField(null=True, blank=True)
    issuing_authority = models.CharField(max_length=180, blank=True)
    official_reference = models.CharField(max_length=180, blank=True)
    source_document = models.FileField(upload_to='zakat/rules/', null=True, blank=True)
    requires_movement_permit = models.BooleanField(default=False)
    requires_receipt = models.BooleanField(default=True)
    requires_certificate = models.BooleanField(default=False)
    verification_status = models.CharField(max_length=30, choices=VERIFICATION_CHOICES, default=VERIFICATION_DRAFT)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['-effective_from', 'rule_code']
        permissions = [
            ('view_zakat_module', 'Can view Zakat management module'),
            ('manage_zakat_rules', 'Can manage configurable Zakat rules and rates'),
            ('approve_zakat_assessment', 'Can approve Zakat assessments'),
            ('verify_zakat_receipt', 'Can verify Zakat receipts and previous payment evidence'),
            ('issue_zakat_permit', 'Can issue crop movement permits'),
            ('view_zakat_reports', 'Can view Zakat reports and audit history'),
        ]
        indexes = [
            models.Index(fields=['zakat_type', 'is_active']),
            models.Index(fields=['crop_product', 'irrigation_method']),
            models.Index(fields=['effective_from', 'effective_to']),
            models.Index(fields=['verification_status']),
        ]

    def clean(self):
        if self.effective_to and self.effective_to < self.effective_from:
            raise ValidationError({'effective_to': 'Effective-to date cannot be before effective-from date.'})
        if self.zakat_type == self.TYPE_CROP and self.calculation_method == self.METHOD_QUANTITY_PERCENTAGE:
            if not self.threshold_quantity or not self.threshold_unit:
                raise ValidationError({'threshold_quantity': 'Crop quantity rules require threshold quantity and unit.'})

    def __str__(self):
        return self.rule_code


class PreviousZakatReceiptEvidence(TimeStampedUserModel):
    STATUS_PENDING = 'pending'
    STATUS_VERIFIED = 'verified'
    STATUS_REJECTED = 'rejected'
    STATUS_EXPIRED = 'expired'
    STATUS_DUPLICATE = 'duplicate'
    STATUS_CANCELLED = 'cancelled'
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_VERIFIED, 'Verified'),
        (STATUS_REJECTED, 'Rejected'),
        (STATUS_EXPIRED, 'Expired'),
        (STATUS_DUPLICATE, 'Duplicate'),
        (STATUS_CANCELLED, 'Cancelled'),
    ]

    receipt_number = models.CharField(max_length=120)
    issue_date = models.DateField()
    issuing_state = models.CharField(max_length=120)
    issuing_locality = models.CharField(max_length=120, blank=True)
    issuing_office = models.CharField(max_length=180)
    paid_quantity = models.DecimalField(max_digits=18, decimal_places=3, null=True, blank=True)
    paid_amount = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=10, default='SDG')
    crop = models.ForeignKey('inventory.Product', on_delete=models.PROTECT, related_name='previous_zakat_evidence', null=True, blank=True)
    season = models.CharField(max_length=60, blank=True)
    payer = models.CharField(max_length=180, blank=True)
    document_file = models.FileField(upload_to='zakat/previous_receipts/', null=True, blank=True)
    verification_status = models.CharField(max_length=30, choices=STATUS_CHOICES, default=STATUS_PENDING)
    verified_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='verified_previous_zakat_evidence', null=True, blank=True)
    verified_at = models.DateTimeField(null=True, blank=True)
    verification_notes = models.TextField(blank=True)

    class Meta:
        ordering = ['-issue_date']
        constraints = [
            models.UniqueConstraint(fields=['receipt_number', 'issuing_office'], name='unique_previous_zakat_receipt_office'),
        ]

    def __str__(self):
        return self.receipt_number


class CropZakatAssessment(TimeStampedUserModel):
    STATUS_DRAFT = 'draft'
    STATUS_PENDING_INFORMATION = 'pending_information'
    STATUS_PENDING_VERIFICATION = 'pending_verification'
    STATUS_ASSESSED = 'assessed'
    STATUS_APPROVED = 'approved'
    STATUS_EXEMPT = 'exempt'
    STATUS_PREVIOUSLY_PAID = 'previously_paid'
    STATUS_PARTIALLY_PAID = 'partially_paid'
    STATUS_PAID = 'paid'
    STATUS_DISPUTED = 'disputed'
    STATUS_CANCELLED = 'cancelled'
    STATUS_CHOICES = [
        (STATUS_DRAFT, 'Draft'),
        (STATUS_PENDING_INFORMATION, 'Pending Information'),
        (STATUS_PENDING_VERIFICATION, 'Pending Verification'),
        (STATUS_ASSESSED, 'Assessed'),
        (STATUS_APPROVED, 'Approved'),
        (STATUS_EXEMPT, 'Exempt'),
        (STATUS_PREVIOUSLY_PAID, 'Previously Paid'),
        (STATUS_PARTIALLY_PAID, 'Partially Paid'),
        (STATUS_PAID, 'Paid'),
        (STATUS_DISPUTED, 'Disputed'),
        (STATUS_CANCELLED, 'Cancelled'),
    ]

    PAYMENT_UNPAID = 'unpaid'
    PAYMENT_PARTIAL = 'partial'
    PAYMENT_PAID = 'paid'
    PAYMENT_PREVIOUSLY_PAID = 'previously_paid'
    PAYMENT_CHOICES = [
        (PAYMENT_UNPAID, 'Unpaid'),
        (PAYMENT_PARTIAL, 'Partial'),
        (PAYMENT_PAID, 'Paid'),
        (PAYMENT_PREVIOUSLY_PAID, 'Previously Paid'),
    ]

    assessment_number = models.CharField(max_length=40, unique=True, blank=True)
    assessment_date = models.DateField(default=timezone.localdate)
    customer = models.ForeignKey('customers.Customer', on_delete=models.PROTECT, related_name='crop_zakat_assessments', null=True, blank=True)
    seller_name_snapshot = models.CharField(max_length=180)
    seller_phone_snapshot = models.CharField(max_length=40, blank=True)
    seller_national_id_snapshot = models.CharField(max_length=80, blank=True)
    company_registration_number = models.CharField(max_length=120, blank=True)
    zakat_file_number = models.CharField(max_length=120, blank=True)
    agricultural_season = models.CharField(max_length=60)
    production_state = models.CharField(max_length=120, default='White Nile')
    production_locality = models.CharField(max_length=120, default='Kosti')
    production_area = models.CharField(max_length=120, blank=True)
    farm_or_project_name = models.CharField(max_length=180, blank=True)
    irrigation_method = models.CharField(max_length=20, choices=ZakatRule.IRRIGATION_CHOICES, default=ZakatRule.IRRIGATION_UNKNOWN)
    assessment_status = models.CharField(max_length=40, choices=STATUS_CHOICES, default=STATUS_DRAFT)
    payment_status = models.CharField(max_length=30, choices=PAYMENT_CHOICES, default=PAYMENT_UNPAID)
    previous_zakat_paid = models.BooleanField(default=False)
    previous_receipt = models.ForeignKey(PreviousZakatReceiptEvidence, on_delete=models.PROTECT, related_name='crop_assessments', null=True, blank=True)
    previous_receipt_issuing_state = models.CharField(max_length=120, blank=True)
    selected_rule = models.ForeignKey(ZakatRule, on_delete=models.PROTECT, related_name='crop_assessments', null=True, blank=True)
    official_reference_snapshot = models.CharField(max_length=180, blank=True)
    total_assessed_value = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal('0.00'))
    total_zakat_quantity = models.DecimalField(max_digits=18, decimal_places=3, null=True, blank=True)
    total_zakat_value = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=10, default='SDG')
    assessment_notes = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='reviewed_crop_zakat_assessments', null=True, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='approved_crop_zakat_assessments', null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    cancelled_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='cancelled_crop_zakat_assessments', null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancellation_reason = models.TextField(blank=True)

    class Meta:
        ordering = ['-assessment_date', '-created_at']
        indexes = [models.Index(fields=['assessment_number']), models.Index(fields=['assessment_status']), models.Index(fields=['payment_status'])]

    def save(self, *args, **kwargs):
        if not self.assessment_number:
            year = timezone.localdate().year
            prefix = f'ZC-{year}-'
            last = CropZakatAssessment.objects.filter(assessment_number__startswith=prefix).order_by('-assessment_number').values_list('assessment_number', flat=True).first()
            next_number = int(last.rsplit('-', 1)[1]) + 1 if last else 1
            self.assessment_number = f'{prefix}{next_number:06d}'
        super().save(*args, **kwargs)

    def __str__(self):
        return self.assessment_number


class CropZakatAssessmentItem(models.Model):
    PREVIOUS_NONE = 'none'
    PREVIOUS_PENDING = 'pending_verification'
    PREVIOUS_VERIFIED = 'verified'
    PREVIOUS_CHOICES = [(PREVIOUS_NONE, 'None'), (PREVIOUS_PENDING, 'Pending Verification'), (PREVIOUS_VERIFIED, 'Verified')]

    assessment = models.ForeignKey(CropZakatAssessment, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey('inventory.Product', on_delete=models.PROTECT, related_name='crop_zakat_items')
    product_name_snapshot = models.CharField(max_length=150)
    agricultural_season = models.CharField(max_length=60)
    gross_quantity = models.DecimalField(max_digits=18, decimal_places=3)
    packaging_weight = models.DecimalField(max_digits=18, decimal_places=3, default=Decimal('0.000'))
    net_quantity = models.DecimalField(max_digits=18, decimal_places=3)
    unit = models.CharField(max_length=20, choices=UNIT_CHOICES)
    canonical_weight_kg = models.DecimalField(max_digits=18, decimal_places=3, null=True, blank=True)
    conversion_snapshot = models.JSONField(default=dict, blank=True)
    quality_grade = models.CharField(max_length=80, blank=True)
    harvest_date = models.DateField(null=True, blank=True)
    market_entry_date = models.DateField(null=True, blank=True)
    irrigation_method = models.CharField(max_length=20, choices=ZakatRule.IRRIGATION_CHOICES, default=ZakatRule.IRRIGATION_UNKNOWN)
    selected_rule = models.ForeignKey(ZakatRule, on_delete=models.PROTECT, related_name='crop_zakat_items', null=True, blank=True)
    threshold_quantity_snapshot = models.DecimalField(max_digits=18, decimal_places=3, null=True, blank=True)
    applied_rate_snapshot = models.DecimalField(max_digits=8, decimal_places=4, null=True, blank=True)
    valuation_price_snapshot = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True)
    estimated_crop_value = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal('0.00'))
    zakat_quantity = models.DecimalField(max_digits=18, decimal_places=3, null=True, blank=True)
    zakat_monetary_value = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True)
    previous_payment_status = models.CharField(max_length=30, choices=PREVIOUS_CHOICES, default=PREVIOUS_NONE)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['id']

    def save(self, *args, **kwargs):
        if not self.product_name_snapshot and self.product_id:
            self.product_name_snapshot = self.product.name_en
        if not self.agricultural_season:
            self.agricultural_season = self.assessment.agricultural_season
        super().save(*args, **kwargs)


class TradeZakatAssessment(TimeStampedUserModel):
    STATUS_DRAFT = 'draft'
    STATUS_ASSESSED = 'assessed'
    STATUS_APPROVED = 'approved'
    STATUS_PAID = 'paid'
    STATUS_CANCELLED = 'cancelled'
    STATUS_CHOICES = [(STATUS_DRAFT, 'Draft'), (STATUS_ASSESSED, 'Assessed'), (STATUS_APPROVED, 'Approved'), (STATUS_PAID, 'Paid'), (STATUS_CANCELLED, 'Cancelled')]

    assessment_number = models.CharField(max_length=40, unique=True, blank=True)
    company = models.CharField(max_length=180, default='Bayad Commercial Activities Company')
    zakat_year = models.PositiveIntegerField()
    period_start = models.DateField()
    period_end = models.DateField()
    assessment_date = models.DateField(default=timezone.localdate)
    cash_balance = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal('0.00'))
    trade_inventory_value = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal('0.00'))
    receivables_value = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal('0.00'))
    allowed_liabilities = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal('0.00'))
    other_assessable_assets = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal('0.00'))
    net_assessable_base = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal('0.00'))
    monetary_threshold = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal('0.00'))
    applied_rate = models.DecimalField(max_digits=8, decimal_places=4, default=Decimal('0.0000'))
    zakat_due = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal('0.00'))
    currency = models.CharField(max_length=10, default='SDG')
    selected_rule = models.ForeignKey(ZakatRule, on_delete=models.PROTECT, related_name='trade_assessments', null=True, blank=True)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default=STATUS_DRAFT)
    notes = models.TextField(blank=True)
    supporting_document = models.FileField(upload_to='zakat/trade_assessments/', null=True, blank=True)
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='reviewed_trade_zakat_assessments', null=True, blank=True)
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='approved_trade_zakat_assessments', null=True, blank=True)

    class Meta:
        ordering = ['-zakat_year']

    def save(self, *args, **kwargs):
        if not self.assessment_number:
            prefix = f'ZT-{self.zakat_year}-'
            last = TradeZakatAssessment.objects.filter(assessment_number__startswith=prefix).order_by('-assessment_number').values_list('assessment_number', flat=True).first()
            next_number = int(last.rsplit('-', 1)[1]) + 1 if last else 1
            self.assessment_number = f'{prefix}{next_number:06d}'
        super().save(*args, **kwargs)


class ZakatReceipt(TimeStampedUserModel):
    TYPE_CROP = 'crop_zakat'
    TYPE_TRADE = 'trade_zakat'
    TYPE_EXTERNAL = 'official_external_receipt'
    TYPE_INTERNAL = 'internal_payment_record'
    TYPE_CHOICES = [(TYPE_CROP, 'Official Crop Zakat Receipt'), (TYPE_TRADE, 'Official Trade Zakat Receipt'), (TYPE_EXTERNAL, 'Official External Receipt'), (TYPE_INTERNAL, 'Internal Payment Record')]
    STATUS_PENDING = 'pending'
    STATUS_VERIFIED = 'verified'
    STATUS_REJECTED = 'rejected'
    STATUS_CHOICES = [(STATUS_PENDING, 'Pending'), (STATUS_VERIFIED, 'Verified'), (STATUS_REJECTED, 'Rejected')]

    receipt_number = models.CharField(max_length=120)
    receipt_type = models.CharField(max_length=40, choices=TYPE_CHOICES)
    crop_assessment = models.ForeignKey(CropZakatAssessment, on_delete=models.PROTECT, related_name='receipts', null=True, blank=True)
    trade_assessment = models.ForeignKey(TradeZakatAssessment, on_delete=models.PROTECT, related_name='receipts', null=True, blank=True)
    customer = models.ForeignKey('customers.Customer', on_delete=models.PROTECT, related_name='zakat_receipts', null=True, blank=True)
    issue_date = models.DateField(default=timezone.localdate)
    issuing_authority = models.CharField(max_length=180)
    issuing_state = models.CharField(max_length=120, blank=True)
    issuing_locality = models.CharField(max_length=120, blank=True)
    issuing_office = models.CharField(max_length=180, blank=True)
    payment_method = models.CharField(max_length=30, blank=True)
    amount_paid = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal('0.00'))
    quantity_paid = models.DecimalField(max_digits=18, decimal_places=3, null=True, blank=True)
    unit = models.CharField(max_length=20, choices=UNIT_CHOICES, null=True, blank=True)
    currency = models.CharField(max_length=10, default='SDG')
    official_reference = models.CharField(max_length=180, blank=True)
    document_file = models.FileField(upload_to='zakat/receipts/', null=True, blank=True)
    verification_status = models.CharField(max_length=30, choices=STATUS_CHOICES, default=STATUS_PENDING)
    notes = models.TextField(blank=True)
    verified_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='verified_zakat_receipts', null=True, blank=True)
    verified_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-issue_date']
        constraints = [
            models.UniqueConstraint(fields=['receipt_number', 'issuing_authority', 'issuing_office'], name='unique_zakat_receipt_authority_office'),
        ]


class ZakatPerformanceCertificate(TimeStampedUserModel):
    STATUS_VALID = 'valid'
    STATUS_EXPIRING = 'expiring'
    STATUS_EXPIRED = 'expired'
    STATUS_SUSPENDED = 'suspended'
    STATUS_CANCELLED = 'cancelled'
    STATUS_PENDING = 'pending_verification'
    STATUS_CHOICES = [(STATUS_VALID, 'Valid'), (STATUS_EXPIRING, 'Expiring'), (STATUS_EXPIRED, 'Expired'), (STATUS_SUSPENDED, 'Suspended'), (STATUS_CANCELLED, 'Cancelled'), (STATUS_PENDING, 'Pending Verification')]

    certificate_number = models.CharField(max_length=120, unique=True)
    customer = models.ForeignKey('customers.Customer', on_delete=models.PROTECT, related_name='zakat_certificates', null=True, blank=True)
    party_name = models.CharField(max_length=180, blank=True)
    zakat_year = models.PositiveIntegerField()
    issue_date = models.DateField()
    expiry_date = models.DateField()
    issuing_authority = models.CharField(max_length=180)
    issuing_state = models.CharField(max_length=120, blank=True)
    issuing_locality = models.CharField(max_length=120, blank=True)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default=STATUS_PENDING)
    document_file = models.FileField(upload_to='zakat/certificates/', null=True, blank=True)
    verification_status = models.CharField(max_length=30, choices=ZakatReceipt.STATUS_CHOICES, default=ZakatReceipt.STATUS_PENDING)
    notes = models.TextField(blank=True)
    verified_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='verified_zakat_certificates', null=True, blank=True)
    verified_at = models.DateTimeField(null=True, blank=True)

    @property
    def computed_status(self):
        today = timezone.localdate()
        if self.status in {self.STATUS_CANCELLED, self.STATUS_SUSPENDED}:
            return self.status
        if self.expiry_date < today:
            return self.STATUS_EXPIRED
        if (self.expiry_date - today).days <= 30:
            return self.STATUS_EXPIRING
        return self.STATUS_VALID


class CropMovementPermit(TimeStampedUserModel):
    STATUS_DRAFT = 'draft'
    STATUS_PENDING_ZAKAT = 'pending_zakat_verification'
    STATUS_PENDING_APPROVAL = 'pending_approval'
    STATUS_VALID = 'valid'
    STATUS_USED = 'used'
    STATUS_EXPIRED = 'expired'
    STATUS_CANCELLED = 'cancelled'
    STATUS_REJECTED = 'rejected'
    STATUS_CHOICES = [(STATUS_DRAFT, 'Draft'), (STATUS_PENDING_ZAKAT, 'Pending Zakat Verification'), (STATUS_PENDING_APPROVAL, 'Pending Approval'), (STATUS_VALID, 'Valid'), (STATUS_USED, 'Used'), (STATUS_EXPIRED, 'Expired'), (STATUS_CANCELLED, 'Cancelled'), (STATUS_REJECTED, 'Rejected')]

    permit_number = models.CharField(max_length=120, unique=True)
    issue_date = models.DateField(default=timezone.localdate)
    expiry_date = models.DateField()
    status = models.CharField(max_length=40, choices=STATUS_CHOICES, default=STATUS_DRAFT)
    issuing_authority = models.CharField(max_length=180)
    issuing_state = models.CharField(max_length=120, blank=True)
    issuing_locality = models.CharField(max_length=120, blank=True)
    source_location = models.CharField(max_length=180)
    destination_location = models.CharField(max_length=180)
    vehicle_number = models.CharField(max_length=80)
    driver_name = models.CharField(max_length=150)
    driver_phone = models.CharField(max_length=40, blank=True)
    shipment = models.ForeignKey('shipments.Shipment', on_delete=models.PROTECT, related_name='zakat_permits', null=True, blank=True)
    warehouse = models.ForeignKey('inventory.Warehouse', on_delete=models.PROTECT, related_name='zakat_permits', null=True, blank=True)
    customer = models.ForeignKey('customers.Customer', on_delete=models.PROTECT, related_name='zakat_permits', null=True, blank=True)
    related_zakat_assessment = models.ForeignKey(CropZakatAssessment, on_delete=models.PROTECT, related_name='movement_permits', null=True, blank=True)
    related_zakat_receipt = models.ForeignKey(ZakatReceipt, on_delete=models.PROTECT, related_name='movement_permits', null=True, blank=True)
    document_file = models.FileField(upload_to='zakat/permits/', null=True, blank=True)
    verification_status = models.CharField(max_length=30, choices=ZakatReceipt.STATUS_CHOICES, default=ZakatReceipt.STATUS_PENDING)
    notes = models.TextField(blank=True)
    verified_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='verified_zakat_permits', null=True, blank=True)
    verified_at = models.DateTimeField(null=True, blank=True)

    @property
    def computed_status(self):
        if self.status in {self.STATUS_CANCELLED, self.STATUS_REJECTED, self.STATUS_USED}:
            return self.status
        if self.expiry_date < timezone.localdate():
            return self.STATUS_EXPIRED
        return self.status


class CropMovementPermitItem(models.Model):
    permit = models.ForeignKey(CropMovementPermit, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey('inventory.Product', on_delete=models.PROTECT, related_name='zakat_permit_items')
    quantity = models.DecimalField(max_digits=18, decimal_places=3)
    unit = models.CharField(max_length=20, choices=UNIT_CHOICES)
    warehouse = models.ForeignKey('inventory.Warehouse', on_delete=models.PROTECT, related_name='zakat_permit_items', null=True, blank=True)
    shipment_item = models.ForeignKey('shipments.ShipmentItem', on_delete=models.PROTECT, related_name='zakat_permit_items', null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['id']


class ZakatAuditLog(models.Model):
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='zakat_audit_logs')
    action = models.CharField(max_length=80)
    record_type = models.CharField(max_length=80)
    record_id = models.CharField(max_length=80)
    previous_values = models.JSONField(default=dict, blank=True)
    new_values = models.JSONField(default=dict, blank=True)
    reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['record_type', 'record_id']), models.Index(fields=['action']), models.Index(fields=['created_at'])]

    def __str__(self):
        return f'{self.action} {self.record_type} {self.record_id}'
