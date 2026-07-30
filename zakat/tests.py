from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import UserProfile
from inventory.models import Product, UNIT_BAG, UNIT_KG
from .models import (
    CropMovementPermit,
    CropZakatAssessment,
    CropZakatAssessmentItem,
    PreviousZakatReceiptEvidence,
    TradeZakatAssessment,
    ZakatPerformanceCertificate,
    ZakatReceipt,
    ZakatRule,
)
from .services import assert_no_legacy_side_effects, calculate_crop_zakat, calculate_trade_zakat


User = get_user_model()


class ZakatAPITests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(username='zakat-admin', password='pass')
        self.manager = User.objects.create_user(username='zakat-manager', password='pass')
        self.other = User.objects.create_user(username='plain-user', password='pass')
        UserProfile.objects.create(user=self.admin, role=UserProfile.ROLE_ADMIN)
        UserProfile.objects.create(user=self.manager, role=UserProfile.ROLE_MANAGER)
        self.product = Product.objects.create(name_en='Corn Zakat', name_ar='Corn Zakat AR', category=Product.CATEGORY_COMMODITY)

    def rule_payload(self, **overrides):
        payload = {
            'rule_code': 'CORN-NAT-10',
            'name_ar': 'Corn natural',
            'name_en': 'Corn natural',
            'zakat_type': ZakatRule.TYPE_CROP,
            'crop_product': self.product.id,
            'irrigation_method': ZakatRule.IRRIGATION_NATURAL,
            'calculation_method': ZakatRule.METHOD_QUANTITY_PERCENTAGE,
            'rate_percentage': '10.0000',
            'threshold_quantity': '100.000',
            'threshold_unit': UNIT_BAG,
            'official_valuation_price': '50.00',
            'effective_from': timezone.localdate().isoformat(),
            'issuing_authority': 'Zakat Chamber',
            'verification_status': ZakatRule.VERIFICATION_DRAFT,
        }
        payload.update(overrides)
        return payload

    def test_only_zakat_users_can_access_and_rules_are_admin_only(self):
        self.client.force_authenticate(self.other)
        response = self.client.get('/api/zakat/dashboard/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(self.manager)
        response = self.client.post('/api/zakat/rules/', self.rule_payload(), format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(self.admin)
        response = self.client.post('/api/zakat/rules/', self.rule_payload(), format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_manager_can_create_crop_assessment_but_cannot_approve(self):
        self.client.force_authenticate(self.admin)
        self.client.post('/api/zakat/rules/', self.rule_payload(), format='json')
        self.client.force_authenticate(self.manager)
        response = self.client.post('/api/zakat/crop-assessments/', {
            'assessment_date': timezone.localdate().isoformat(),
            'seller_name_snapshot': 'Ahmed Farms',
            'agricultural_season': '2026',
            'irrigation_method': ZakatRule.IRRIGATION_NATURAL,
            'items': [{
                'product': self.product.id,
                'gross_quantity': '200.000',
                'packaging_weight': '0.000',
                'net_quantity': '200.000',
                'unit': UNIT_BAG,
            }],
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        assessment_id = response.data['id']
        self.client.post(f'/api/zakat/crop-assessments/{assessment_id}/calculate/', {}, format='json')
        response = self.client.post(f'/api/zakat/crop-assessments/{assessment_id}/approve/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class ZakatCalculationTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(username='zakat-admin-calc', password='pass')
        self.manager = User.objects.create_user(username='zakat-manager-calc', password='pass')
        UserProfile.objects.create(user=self.admin, role=UserProfile.ROLE_ADMIN)
        UserProfile.objects.create(user=self.manager, role=UserProfile.ROLE_MANAGER)
        self.product = Product.objects.create(name_en='White Sesame Zakat', name_ar='White Sesame Zakat AR', category=Product.CATEGORY_COMMODITY)

    def create_rule(self, code='SESAME-NAT-10', irrigation=ZakatRule.IRRIGATION_NATURAL, rate='10.0000', unit=UNIT_BAG, rule_type=ZakatRule.TYPE_CROP):
        return ZakatRule.objects.create(
            rule_code=code,
            name_ar=code,
            name_en=code,
            zakat_type=rule_type,
            crop_product=self.product if rule_type == ZakatRule.TYPE_CROP else None,
            irrigation_method=irrigation if rule_type == ZakatRule.TYPE_CROP else None,
            calculation_method=ZakatRule.METHOD_QUANTITY_PERCENTAGE if rule_type == ZakatRule.TYPE_CROP else ZakatRule.METHOD_MONETARY_PERCENTAGE,
            rate_percentage=Decimal(rate),
            threshold_quantity=Decimal('100.000') if rule_type == ZakatRule.TYPE_CROP else None,
            threshold_unit=unit if rule_type == ZakatRule.TYPE_CROP else '',
            monetary_threshold=Decimal('1000.00'),
            official_valuation_price=Decimal('50.00') if rule_type == ZakatRule.TYPE_CROP else None,
            effective_from=timezone.localdate(),
            issuing_authority='Zakat Chamber',
            verification_status=ZakatRule.VERIFICATION_DRAFT,
            created_by=self.admin,
        )

    def create_assessment(self, irrigation=ZakatRule.IRRIGATION_NATURAL, unit=UNIT_BAG, previous_receipt=None, previous_paid=False):
        assessment = CropZakatAssessment.objects.create(
            assessment_date=timezone.localdate(),
            seller_name_snapshot='Ahmed Farms',
            agricultural_season='2026',
            irrigation_method=irrigation,
            previous_zakat_paid=previous_paid,
            previous_receipt=previous_receipt,
            created_by=self.manager,
        )
        CropZakatAssessmentItem.objects.create(
            assessment=assessment,
            product=self.product,
            gross_quantity=Decimal('200.000'),
            packaging_weight=Decimal('0.000'),
            net_quantity=Decimal('200.000'),
            unit=unit,
            irrigation_method=irrigation,
        )
        return assessment

    def test_crop_calculation_uses_effective_rule_and_has_no_legacy_side_effects(self):
        self.create_rule(rate='10.0000')
        before = assert_no_legacy_side_effects()
        result = calculate_crop_zakat(assessment=self.create_assessment(), user=self.manager)
        after = assert_no_legacy_side_effects()
        assessment = CropZakatAssessment.objects.get()

        self.assertEqual(result['status'], 'assessed')
        self.assertEqual(assessment.total_zakat_quantity, Decimal('20.000'))
        self.assertEqual(assessment.total_zakat_value, Decimal('1000.00'))
        self.assertEqual(before, after)

    def test_artificial_irrigation_can_have_different_rate(self):
        self.create_rule(code='NAT-10', irrigation=ZakatRule.IRRIGATION_NATURAL, rate='10.0000')
        self.create_rule(code='ART-5', irrigation=ZakatRule.IRRIGATION_ARTIFICIAL, rate='5.0000')
        assessment = self.create_assessment(irrigation=ZakatRule.IRRIGATION_ARTIFICIAL)
        calculate_crop_zakat(assessment=assessment, user=self.manager)
        assessment.refresh_from_db()
        self.assertEqual(assessment.total_zakat_quantity, Decimal('10.000'))

    def test_unit_mismatch_requires_official_information(self):
        self.create_rule(unit=UNIT_KG)
        result = calculate_crop_zakat(assessment=self.create_assessment(unit=UNIT_BAG), user=self.manager)
        self.assertEqual(result['status'], 'pending_information')

    def test_previous_receipt_blocks_until_verified_then_marks_previously_paid(self):
        evidence = PreviousZakatReceiptEvidence.objects.create(
            receipt_number='EXT-1',
            issue_date=timezone.localdate(),
            issuing_office='Kosti Office',
            payer='Ahmed Farms',
            created_by=self.manager,
        )
        assessment = self.create_assessment(previous_receipt=evidence, previous_paid=True)
        result = calculate_crop_zakat(assessment=assessment, user=self.manager)
        self.assertEqual(result['status'], 'pending_verification')

        self.client.force_authenticate(self.admin)
        response = self.client.post(f'/api/zakat/previous-receipts/{evidence.id}/verify/', {'notes': 'Checked'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        assessment.refresh_from_db()
        self.assertEqual(assessment.assessment_status, CropZakatAssessment.STATUS_PREVIOUSLY_PAID)
        self.assertEqual(assessment.payment_status, CropZakatAssessment.PAYMENT_PREVIOUSLY_PAID)

    def test_verified_receipt_marks_crop_assessment_paid(self):
        self.create_rule()
        assessment = self.create_assessment()
        calculate_crop_zakat(assessment=assessment, user=self.manager)
        receipt = ZakatReceipt.objects.create(
            receipt_number='ZR-1',
            receipt_type=ZakatReceipt.TYPE_CROP,
            crop_assessment=assessment,
            issue_date=timezone.localdate(),
            issuing_authority='Zakat Chamber',
            amount_paid=Decimal('1000.00'),
            created_by=self.manager,
        )
        self.client.force_authenticate(self.admin)
        response = self.client.post(f'/api/zakat/receipts/{receipt.id}/verify/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        assessment.refresh_from_db()
        self.assertEqual(assessment.payment_status, CropZakatAssessment.PAYMENT_PAID)

    def test_trade_zakat_is_calculated_separately(self):
        self.create_rule(code='TRADE-2-5', rate='2.5000', rule_type=ZakatRule.TYPE_TRADE)
        assessment = TradeZakatAssessment.objects.create(
            company='Bayad Trading',
            assessment_date=timezone.localdate(),
            zakat_year=2026,
            period_start=timezone.localdate(),
            period_end=timezone.localdate(),
            cash_balance=Decimal('2000.00'),
            trade_inventory_value=Decimal('3000.00'),
            receivables_value=Decimal('1000.00'),
            allowed_liabilities=Decimal('1000.00'),
            created_by=self.manager,
        )
        result = calculate_trade_zakat(assessment=assessment, user=self.manager)
        self.assertEqual(result['zakat_due'], '125.00')

    def test_certificate_and_permit_expiry_statuses_are_computed(self):
        yesterday = timezone.localdate() - timezone.timedelta(days=1)
        cert = ZakatPerformanceCertificate.objects.create(
            certificate_number='CERT-1',
            party_name='Ahmed Farms',
            zakat_year=2026,
            issue_date=yesterday,
            expiry_date=yesterday,
            issuing_authority='Zakat Chamber',
            created_by=self.manager,
        )
        permit = CropMovementPermit.objects.create(
            permit_number='PERMIT-1',
            issue_date=yesterday,
            expiry_date=yesterday,
            source_location='Kosti',
            destination_location='Rabak',
            created_by=self.manager,
        )
        self.assertEqual(cert.computed_status, ZakatPerformanceCertificate.STATUS_EXPIRED)
        self.assertEqual(permit.computed_status, CropMovementPermit.STATUS_EXPIRED)
