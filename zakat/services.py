from decimal import Decimal, ROUND_HALF_UP

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Count, Sum
from django.utils import timezone

from accounts.models import UserProfile
from inventory.models import InventoryMovement
from supply_offers.models import SupplyOffer

from .models import (
    CropMovementPermit,
    CropZakatAssessment,
    CropZakatAssessmentItem,
    PreviousZakatReceiptEvidence,
    TradeZakatAssessment,
    ZakatAuditLog,
    ZakatPerformanceCertificate,
    ZakatReceipt,
    ZakatRule,
)


def user_role(user):
    return getattr(getattr(user, 'profile', None), 'role', None)


def ensure_admin(user, message='Only admin users can perform this action.'):
    if user_role(user) != UserProfile.ROLE_ADMIN:
        raise PermissionError(message)


def money(value):
    return (value or Decimal('0.00')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


def quantity(value):
    return (value or Decimal('0.000')).quantize(Decimal('0.001'), rounding=ROUND_HALF_UP)


def audit(*, actor, action, record, previous=None, new=None, reason=''):
    return ZakatAuditLog.objects.create(
        actor=actor,
        action=action,
        record_type=record.__class__.__name__,
        record_id=str(record.pk),
        previous_values=previous or {},
        new_values=new or {},
        reason=reason or '',
    )


def active_rule_for_crop(*, product, irrigation_method, assessment_date):
    rules = ZakatRule.objects.filter(
        zakat_type=ZakatRule.TYPE_CROP,
        is_active=True,
        verification_status__in=[ZakatRule.VERIFICATION_DRAFT, ZakatRule.VERIFICATION_CONFIRMED],
        effective_from__lte=assessment_date,
    ).filter(models_effective_to_q(assessment_date))
    rules = rules.filter(crop_product__isnull=True) | rules.filter(crop_product=product)
    rules = rules.filter(irrigation_method__in=[irrigation_method, None, ''])
    return rules.order_by('-crop_product_id', '-effective_from').first()


def active_trade_rule(*, assessment_date):
    return ZakatRule.objects.filter(
        zakat_type=ZakatRule.TYPE_TRADE,
        is_active=True,
        verification_status__in=[ZakatRule.VERIFICATION_DRAFT, ZakatRule.VERIFICATION_CONFIRMED],
        effective_from__lte=assessment_date,
    ).filter(models_effective_to_q(assessment_date)).order_by('-effective_from').first()


def models_effective_to_q(day):
    from django.db.models import Q

    return Q(effective_to__isnull=True) | Q(effective_to__gte=day)


def calculation_pending(assessment, message):
    assessment.assessment_status = CropZakatAssessment.STATUS_PENDING_INFORMATION
    assessment.assessment_notes = '\n'.join(filter(None, [assessment.assessment_notes, message]))
    assessment.save(update_fields=['assessment_status', 'assessment_notes', 'updated_at'])
    return {'status': 'pending_information', 'message': message}


def resolved_irrigation(item, assessment):
    if item.irrigation_method and item.irrigation_method != ZakatRule.IRRIGATION_UNKNOWN:
        return item.irrigation_method
    return assessment.irrigation_method


@transaction.atomic
def calculate_crop_zakat(*, assessment, user):
    assessment = CropZakatAssessment.objects.select_for_update().prefetch_related('items__product').get(pk=assessment.pk)
    if assessment.irrigation_method == ZakatRule.IRRIGATION_UNKNOWN:
        return calculation_pending(assessment, 'Irrigation method must be confirmed before calculation.')
    if assessment.previous_zakat_paid and assessment.previous_receipt and assessment.previous_receipt.verification_status != PreviousZakatReceiptEvidence.STATUS_VERIFIED:
        assessment.assessment_status = CropZakatAssessment.STATUS_PENDING_VERIFICATION
        assessment.save(update_fields=['assessment_status', 'updated_at'])
        audit(actor=user, action='calculation_pending_previous_receipt', record=assessment)
        return {'status': 'pending_verification', 'message': 'Previous receipt must be verified before assessment can be marked previously paid.'}

    total_value = Decimal('0.00')
    total_quantity = Decimal('0.000')
    breakdown = []
    selected_assessment_rule = None

    for item in assessment.items.select_for_update().select_related('product'):
        irrigation_method = resolved_irrigation(item, assessment)
        rule = item.selected_rule or active_rule_for_crop(product=item.product, irrigation_method=irrigation_method, assessment_date=assessment.assessment_date)
        if not rule:
            return calculation_pending(assessment, f'No active Zakat rule exists for {item.product.name_en}.')
        if rule.irrigation_method and rule.irrigation_method != irrigation_method:
            return calculation_pending(assessment, 'Selected rule irrigation method does not match assessment irrigation method.')
        if rule.calculation_method == ZakatRule.METHOD_QUANTITY_PERCENTAGE:
            if item.unit != rule.threshold_unit:
                return calculation_pending(assessment, f'{item.product.name_en} uses {item.unit}; rule threshold uses {rule.threshold_unit}. Official conversion or separate assessment is required.')
            if item.net_quantity < rule.threshold_quantity:
                zakat_qty = Decimal('0.000')
            else:
                zakat_qty = quantity(item.net_quantity * (rule.rate_percentage / Decimal('100')))
            item.zakat_quantity = zakat_qty
            item.zakat_monetary_value = money(zakat_qty * (rule.official_valuation_price or Decimal('0.00'))) if rule.official_valuation_price else None
            if rule.official_valuation_price is None:
                return calculation_pending(assessment, 'Official valuation price is required for monetary crop value.')
            item.estimated_crop_value = money(item.net_quantity * rule.official_valuation_price)
        elif rule.calculation_method == ZakatRule.METHOD_MONETARY_PERCENTAGE:
            if rule.official_valuation_price is None:
                return calculation_pending(assessment, 'Official valuation price is required for monetary crop assessment.')
            item.estimated_crop_value = money(item.net_quantity * rule.official_valuation_price)
            item.zakat_monetary_value = money(item.estimated_crop_value * (rule.rate_percentage / Decimal('100')))
            item.zakat_quantity = None
        else:
            return calculation_pending(assessment, 'Manual official assessment must be entered by authorized staff.')

        item.selected_rule = rule
        item.threshold_quantity_snapshot = rule.threshold_quantity
        item.applied_rate_snapshot = rule.rate_percentage
        item.valuation_price_snapshot = rule.official_valuation_price
        item.save(update_fields=[
            'selected_rule', 'threshold_quantity_snapshot', 'applied_rate_snapshot', 'valuation_price_snapshot',
            'estimated_crop_value', 'zakat_quantity', 'zakat_monetary_value',
        ])
        selected_assessment_rule = selected_assessment_rule or rule
        total_value += item.zakat_monetary_value or Decimal('0.00')
        total_quantity += item.zakat_quantity or Decimal('0.000')
        breakdown.append({
            'product': item.product.name_en,
            'unit': item.unit,
            'net_quantity': str(item.net_quantity),
            'rule_code': rule.rule_code,
            'rate_percentage': str(rule.rate_percentage),
            'zakat_quantity': str(item.zakat_quantity or ''),
            'zakat_value': str(item.zakat_monetary_value or ''),
        })

    assessment.selected_rule = selected_assessment_rule
    assessment.official_reference_snapshot = selected_assessment_rule.official_reference if selected_assessment_rule else ''
    assessment.total_assessed_value = money(sum((item.estimated_crop_value for item in assessment.items.all()), Decimal('0.00')))
    assessment.total_zakat_quantity = total_quantity if total_quantity > 0 else None
    assessment.total_zakat_value = money(total_value)
    assessment.assessment_status = CropZakatAssessment.STATUS_ASSESSED
    assessment.save(update_fields=[
        'selected_rule', 'official_reference_snapshot', 'total_assessed_value', 'total_zakat_quantity',
        'total_zakat_value', 'assessment_status', 'updated_at',
    ])
    audit(actor=user, action='crop_calculation_performed', record=assessment, new={'breakdown': breakdown})
    return {'status': 'assessed', 'breakdown': breakdown, 'total_zakat_value': str(assessment.total_zakat_value)}


@transaction.atomic
def approve_crop_assessment(*, assessment, user):
    ensure_admin(user)
    assessment = CropZakatAssessment.objects.select_for_update().get(pk=assessment.pk)
    if assessment.assessment_status not in {CropZakatAssessment.STATUS_ASSESSED, CropZakatAssessment.STATUS_PREVIOUSLY_PAID}:
        raise ValidationError({'assessment_status': 'Only assessed or previously paid assessments can be approved.'})
    if assessment.approved_at:
        return assessment
    previous = {'assessment_status': assessment.assessment_status}
    assessment.assessment_status = CropZakatAssessment.STATUS_APPROVED
    assessment.approved_by = user
    assessment.approved_at = timezone.now()
    assessment.save(update_fields=['assessment_status', 'approved_by', 'approved_at', 'updated_at'])
    audit(actor=user, action='crop_assessment_approved', record=assessment, previous=previous, new={'assessment_status': assessment.assessment_status})
    return assessment


@transaction.atomic
def verify_previous_receipt(*, evidence, user, notes=''):
    ensure_admin(user)
    evidence = PreviousZakatReceiptEvidence.objects.select_for_update().get(pk=evidence.pk)
    if evidence.verification_status == PreviousZakatReceiptEvidence.STATUS_VERIFIED:
        return evidence
    previous = {'verification_status': evidence.verification_status}
    evidence.verification_status = PreviousZakatReceiptEvidence.STATUS_VERIFIED
    evidence.verified_by = user
    evidence.verified_at = timezone.now()
    evidence.verification_notes = notes or evidence.verification_notes
    evidence.save(update_fields=['verification_status', 'verified_by', 'verified_at', 'verification_notes', 'updated_at'])
    for assessment in evidence.crop_assessments.select_for_update():
        if assessment.previous_zakat_paid:
            assessment.assessment_status = CropZakatAssessment.STATUS_PREVIOUSLY_PAID
            assessment.payment_status = CropZakatAssessment.PAYMENT_PREVIOUSLY_PAID
            assessment.save(update_fields=['assessment_status', 'payment_status', 'updated_at'])
    audit(actor=user, action='previous_receipt_verified', record=evidence, previous=previous, new={'verification_status': evidence.verification_status})
    return evidence


@transaction.atomic
def verify_zakat_receipt(*, receipt, user, notes=''):
    ensure_admin(user)
    receipt = ZakatReceipt.objects.select_for_update().get(pk=receipt.pk)
    if receipt.verification_status == ZakatReceipt.STATUS_VERIFIED:
        return receipt
    previous = {'verification_status': receipt.verification_status}
    receipt.verification_status = ZakatReceipt.STATUS_VERIFIED
    receipt.verified_by = user
    receipt.verified_at = timezone.now()
    receipt.notes = notes or receipt.notes
    receipt.save(update_fields=['verification_status', 'verified_by', 'verified_at', 'notes', 'updated_at'])
    if receipt.crop_assessment_id:
        assessment = CropZakatAssessment.objects.select_for_update().get(pk=receipt.crop_assessment_id)
        assessment.payment_status = CropZakatAssessment.PAYMENT_PAID
        assessment.assessment_status = CropZakatAssessment.STATUS_PAID
        assessment.save(update_fields=['payment_status', 'assessment_status', 'updated_at'])
    if receipt.trade_assessment_id:
        trade = TradeZakatAssessment.objects.select_for_update().get(pk=receipt.trade_assessment_id)
        trade.status = TradeZakatAssessment.STATUS_PAID
        trade.save(update_fields=['status', 'updated_at'])
    audit(actor=user, action='zakat_receipt_verified', record=receipt, previous=previous, new={'verification_status': receipt.verification_status})
    return receipt


@transaction.atomic
def calculate_trade_zakat(*, assessment, user):
    assessment = TradeZakatAssessment.objects.select_for_update().get(pk=assessment.pk)
    rule = assessment.selected_rule or active_trade_rule(assessment_date=assessment.assessment_date)
    if not rule:
        raise ValidationError({'selected_rule': 'No active Trade Zakat rule exists for this assessment date.'})
    base = assessment.cash_balance + assessment.trade_inventory_value + assessment.receivables_value + assessment.other_assessable_assets - assessment.allowed_liabilities
    if base < Decimal('0.00'):
        base = Decimal('0.00')
    assessment.selected_rule = rule
    assessment.net_assessable_base = money(base)
    assessment.monetary_threshold = rule.monetary_threshold or Decimal('0.00')
    assessment.applied_rate = rule.rate_percentage
    assessment.zakat_due = money(base * (rule.rate_percentage / Decimal('100'))) if base >= assessment.monetary_threshold else Decimal('0.00')
    assessment.status = TradeZakatAssessment.STATUS_ASSESSED
    assessment.save(update_fields=['selected_rule', 'net_assessable_base', 'monetary_threshold', 'applied_rate', 'zakat_due', 'status', 'updated_at'])
    audit(actor=user, action='trade_calculation_performed', record=assessment, new={'net_assessable_base': str(assessment.net_assessable_base), 'zakat_due': str(assessment.zakat_due), 'rule_code': rule.rule_code})
    return {'status': 'assessed', 'net_assessable_base': str(assessment.net_assessable_base), 'zakat_due': str(assessment.zakat_due), 'rule_code': rule.rule_code}


def dashboard_summary():
    today = timezone.localdate()
    soon = today + timezone.timedelta(days=30)
    return {
        'pending_crop_assessments': CropZakatAssessment.objects.filter(assessment_status__in=[CropZakatAssessment.STATUS_DRAFT, CropZakatAssessment.STATUS_PENDING_INFORMATION]).count(),
        'awaiting_verification': CropZakatAssessment.objects.filter(assessment_status=CropZakatAssessment.STATUS_PENDING_VERIFICATION).count(),
        'unpaid_assessments': CropZakatAssessment.objects.filter(payment_status=CropZakatAssessment.PAYMENT_UNPAID).exclude(assessment_status=CropZakatAssessment.STATUS_CANCELLED).count(),
        'valid_receipts': ZakatReceipt.objects.filter(verification_status=ZakatReceipt.STATUS_VERIFIED).count(),
        'certificates_expiring_soon': ZakatPerformanceCertificate.objects.filter(expiry_date__gte=today, expiry_date__lte=soon).count(),
        'expired_certificates': ZakatPerformanceCertificate.objects.filter(expiry_date__lt=today).count(),
        'active_movement_permits': CropMovementPermit.objects.filter(status=CropMovementPermit.STATUS_VALID, expiry_date__gte=today).count(),
        'permits_expiring_soon': CropMovementPermit.objects.filter(expiry_date__gte=today, expiry_date__lte=soon).count(),
    }


def report_summary(params=None):
    params = params or {}
    crop = CropZakatAssessment.objects.exclude(assessment_status=CropZakatAssessment.STATUS_CANCELLED)
    receipts = ZakatReceipt.objects.all()
    permits = CropMovementPermit.objects.all()
    certs = ZakatPerformanceCertificate.objects.all()
    return {
        'assessments_by_status': list(crop.values('assessment_status').annotate(count=Count('id')).order_by('assessment_status')),
        'paid_vs_unpaid': list(crop.values('payment_status').annotate(count=Count('id'), amount=Sum('total_zakat_value')).order_by('payment_status')),
        'calculated_amount_by_crop': list(CropZakatAssessmentItem.objects.values('product_name_snapshot', 'unit').annotate(amount=Sum('zakat_monetary_value'), quantity=Sum('zakat_quantity')).order_by('product_name_snapshot', 'unit')),
        'irrigation_distribution': list(crop.values('irrigation_method').annotate(count=Count('id')).order_by('irrigation_method')),
        'receipts_by_issuing_office': list(receipts.values('issuing_office').annotate(count=Count('id'), amount=Sum('amount_paid')).order_by('issuing_office')),
        'certificates_by_expiry_status': [
            {'status': 'valid', 'count': sum(1 for cert in certs if cert.computed_status == ZakatPerformanceCertificate.STATUS_VALID)},
            {'status': 'expiring', 'count': sum(1 for cert in certs if cert.computed_status == ZakatPerformanceCertificate.STATUS_EXPIRING)},
            {'status': 'expired', 'count': sum(1 for cert in certs if cert.computed_status == ZakatPerformanceCertificate.STATUS_EXPIRED)},
        ],
        'permits_by_status': list(permits.values('status').annotate(count=Count('id')).order_by('status')),
        'trade_zakat_by_year': list(TradeZakatAssessment.objects.values('zakat_year').annotate(amount=Sum('zakat_due')).order_by('zakat_year')),
        'external_receipts': list(PreviousZakatReceiptEvidence.objects.values('verification_status').annotate(count=Count('id')).order_by('verification_status')),
    }


def assert_no_legacy_side_effects():
    return {
        'inventory_movements': InventoryMovement.objects.count(),
        'supply_offers': SupplyOffer.objects.count(),
    }


@transaction.atomic
def seed_draft_rules(*, user):
    ensure_admin(user)
    today = timezone.localdate()
    examples = [
        {
            'rule_code': 'DRAFT-CROP-NATURAL-10',
            'name_ar': 'مسودة زكاة المحاصيل بالري الطبيعي',
            'name_en': 'Draft Crop Zakat - Natural Irrigation',
            'zakat_type': ZakatRule.TYPE_CROP,
            'irrigation_method': ZakatRule.IRRIGATION_NATURAL,
            'calculation_method': ZakatRule.METHOD_QUANTITY_PERCENTAGE,
            'rate_percentage': Decimal('10.0000'),
            'threshold_quantity': Decimal('0.000'),
            'threshold_unit': 'Bag',
        },
        {
            'rule_code': 'DRAFT-CROP-ARTIFICIAL-5',
            'name_ar': 'مسودة زكاة المحاصيل بالري الصناعي',
            'name_en': 'Draft Crop Zakat - Artificial Irrigation',
            'zakat_type': ZakatRule.TYPE_CROP,
            'irrigation_method': ZakatRule.IRRIGATION_ARTIFICIAL,
            'calculation_method': ZakatRule.METHOD_QUANTITY_PERCENTAGE,
            'rate_percentage': Decimal('5.0000'),
            'threshold_quantity': Decimal('0.000'),
            'threshold_unit': 'Bag',
        },
        {
            'rule_code': 'DRAFT-TRADE-2-5',
            'name_ar': 'مسودة زكاة عروض التجارة',
            'name_en': 'Draft Trade Zakat',
            'zakat_type': ZakatRule.TYPE_TRADE,
            'calculation_method': ZakatRule.METHOD_MONETARY_PERCENTAGE,
            'rate_percentage': Decimal('2.5000'),
            'monetary_threshold': Decimal('0.00'),
        },
    ]
    created = []
    for data in examples:
        rule, was_created = ZakatRule.objects.get_or_create(
            rule_code=data['rule_code'],
            defaults={
                **data,
                'effective_from': today,
                'issuing_authority': 'Draft local ERP configuration - confirm with Zakat Chamber',
                'verification_status': ZakatRule.VERIFICATION_DRAFT,
                'created_by': user,
                'notes': 'Draft example only. Confirm rates, nisab, units, and valuation with the competent Zakat Chamber before use.',
            },
        )
        if was_created:
            created.append(rule.rule_code)
            audit(actor=user, action='draft_zakat_rule_seeded', record=rule, new={'rule_code': rule.rule_code})
    return {'created': created, 'count': len(created)}
