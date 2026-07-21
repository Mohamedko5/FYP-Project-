from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import UserProfile
from daily_journal.models import JournalTransaction
from inventory.models import Inventory, InventoryMovement, Product, Warehouse

from .models import Worker, WorkerWorkRecord


User = get_user_model()


class WorkerAPITests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(username='admin', password='pass')
        self.manager = User.objects.create_user(username='manager', password='pass')
        UserProfile.objects.create(user=self.admin, role=UserProfile.ROLE_ADMIN)
        UserProfile.objects.create(user=self.manager, role=UserProfile.ROLE_MANAGER)
        self.client.force_authenticate(self.admin)
        self.product = Product.objects.get(name_en='White Sesame')
        self.warehouse = Warehouse.objects.create(
            warehouse_name='Main Store',
            location='Market',
            primary_product=self.product,
            capacity='100.000',
            capacity_unit='Qintar',
            manager_name='Manager',
            guard_name='Guard',
            created_by=self.admin,
        )

    def worker_payload(self, **overrides):
        payload = {
            'name': 'Worker One',
            'phone': '+249912345678',
            'secondary_phone': '',
            'worker_type': Worker.TYPE_GENERAL,
            'assigned_work': 'Main Store',
            'default_daily_wage': '100.00',
            'status': Worker.STATUS_AVAILABLE,
            'notes': 'Reliable',
        }
        payload.update(overrides)
        return payload

    def create_worker(self, **overrides):
        worker = Worker(created_by=self.admin, **self.worker_payload(**overrides))
        worker.full_clean()
        worker.save()
        return worker

    def work_payload(self, **overrides):
        payload = {
            'warehouse_id': self.warehouse.id,
            'calculation_method': WorkerWorkRecord.METHOD_DAILY,
            'daily_wage': '100.00',
            'work_description': 'Daily warehouse cleaning',
            'notes': 'Done',
        }
        payload.update(overrides)
        return payload

    def work_url(self, worker):
        return reverse('worker-work-records', args=[worker.id])

    def detail_url(self, worker):
        return reverse('worker-detail', args=[worker.id])

    def create_record(self, worker=None, **overrides):
        worker = worker or self.create_worker()
        response = self.client.post(self.work_url(worker), self.work_payload(**overrides), format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        return WorkerWorkRecord.objects.get(id=response.data['id'])

    def test_unauthenticated_worker_list_returns_401(self):
        self.client.force_authenticate(None)
        response = self.client.get(reverse('worker-list'))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_admin_can_create_worker(self):
        response = self.client.post(reverse('worker-list'), self.worker_payload(), format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_manager_can_create_worker(self):
        self.client.force_authenticate(self.manager)
        response = self.client.post(reverse('worker-list'), self.worker_payload(), format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_worker_code_is_generated_automatically(self):
        response = self.client.post(reverse('worker-list'), {**self.worker_payload(), 'code': 'WRK-9999'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['code'].startswith('WRK-'))
        self.assertNotEqual(response.data['code'], 'WRK-9999')

    def test_work_record_code_is_generated_automatically(self):
        record = self.create_record()
        self.assertTrue(record.code.startswith('WORK-'))

    def test_duplicate_active_phone_is_rejected(self):
        self.create_worker()
        response = self.client.post(reverse('worker-list'), self.worker_payload(name='Other'), format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_required_fields_are_validated(self):
        response = self.client.post(reverse('worker-list'), {'name': '', 'phone': '', 'worker_type': '', 'assigned_work': ''}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_invalid_photo_type_is_rejected(self):
        photo = SimpleUploadedFile('bad.gif', b'abc', content_type='image/gif')
        response = self.client.post(reverse('worker-list'), {**self.worker_payload(), 'photo': photo}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_oversized_photo_is_rejected(self):
        photo = SimpleUploadedFile('large.jpg', b'a' * (2 * 1024 * 1024 + 1), content_type='image/jpeg')
        response = self.client.post(reverse('worker-list'), {**self.worker_payload(), 'photo': photo}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_general_worker_accepts_daily_wage_only(self):
        worker = self.create_worker(worker_type=Worker.TYPE_GENERAL)
        response = self.client.post(self.work_url(worker), self.work_payload(), format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_general_worker_rejects_bag_based(self):
        worker = self.create_worker(worker_type=Worker.TYPE_GENERAL)
        response = self.client.post(self.work_url(worker), self.work_payload(calculation_method='bag_based', daily_wage='', number_of_bags='10', price_per_bag='2.00'), format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_bag_carrying_worker_accepts_bag_based_only(self):
        worker = self.create_worker(worker_type=Worker.TYPE_BAG, default_daily_wage=None, default_price_per_bag='3.00')
        response = self.client.post(self.work_url(worker), self.work_payload(calculation_method='bag_based', daily_wage='', number_of_bags='10', price_per_bag='3.00'), format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_bag_carrying_worker_rejects_daily_wage(self):
        worker = self.create_worker(worker_type=Worker.TYPE_BAG, default_daily_wage=None, default_price_per_bag='3.00')
        response = self.client.post(self.work_url(worker), self.work_payload(), format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_weighing_worker_accepts_daily_wage(self):
        worker = self.create_worker(worker_type=Worker.TYPE_WEIGHING)
        response = self.client.post(self.work_url(worker), self.work_payload(), format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_weighing_worker_accepts_bag_based(self):
        worker = self.create_worker(worker_type=Worker.TYPE_WEIGHING)
        response = self.client.post(self.work_url(worker), self.work_payload(calculation_method='bag_based', daily_wage='', number_of_bags='10', price_per_bag='3.00'), format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_daily_wage_total_is_calculated_by_backend(self):
        record = self.create_record(daily_wage='125.00', total_wage='9999.00')
        self.assertEqual(record.total_wage, Decimal('125.00'))

    def test_bag_based_total_is_calculated_by_backend(self):
        worker = self.create_worker(worker_type=Worker.TYPE_BAG, default_daily_wage=None, default_price_per_bag='3.00')
        record = self.create_record(worker, calculation_method='bag_based', daily_wage='', number_of_bags='10', price_per_bag='3.00')
        self.assertEqual(record.total_wage, Decimal('30.00'))

    def test_frontend_supplied_total_wage_cannot_override_backend_calculation(self):
        record = self.create_record(total_wage='999.00')
        self.assertEqual(record.total_wage, Decimal('100.00'))

    def test_zero_and_negative_wage_values_are_rejected(self):
        worker = self.create_worker()
        response = self.client.post(self.work_url(worker), self.work_payload(daily_wage='0'), format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        response = self.client.post(self.work_url(worker), self.work_payload(daily_wage='-1'), format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_invalid_warehouse_is_rejected(self):
        worker = self.create_worker()
        response = self.client.post(self.work_url(worker), self.work_payload(warehouse_id=99999), format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_archived_warehouse_is_rejected(self):
        worker = self.create_worker()
        self.warehouse.is_active = False
        self.warehouse.is_deleted = True
        self.warehouse.save(update_fields=['is_active', 'is_deleted'])
        response = self.client.post(self.work_url(worker), self.work_payload(), format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_work_record_creation_does_not_change_inventory(self):
        Inventory.objects.create(warehouse=self.warehouse, product=self.product, quantity='10.000', unit='Qintar', minimum_threshold='1.000')
        self.create_record()
        self.assertEqual(Inventory.objects.get().quantity, Decimal('10.000'))

    def test_work_record_creation_does_not_create_inventory_movement(self):
        self.create_record()
        self.assertEqual(InventoryMovement.objects.count(), 0)

    def test_new_work_record_starts_as_unpaid(self):
        record = self.create_record()
        self.assertEqual(record.payment_status, WorkerWorkRecord.PAYMENT_UNPAID)

    def test_unpaid_record_does_not_create_daily_journal_expense(self):
        self.create_record()
        self.assertEqual(JournalTransaction.objects.count(), 0)

    def test_mark_paid_with_cash_succeeds(self):
        record = self.create_record()
        response = self.client.post(reverse('worker-work-record-mark-paid', args=[record.id]), {'payment_method': 'cash'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        record.refresh_from_db()
        self.assertEqual(record.payment_status, 'paid')

    def test_mark_paid_with_online_succeeds(self):
        record = self.create_record()
        response = self.client.post(reverse('worker-work-record-mark-paid', args=[record.id]), {'payment_method': 'online'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_mark_paid_creates_daily_journal_expense(self):
        record = self.create_record()
        self.client.post(reverse('worker-work-record-mark-paid', args=[record.id]), {'payment_method': 'cash'}, format='json')
        self.assertEqual(JournalTransaction.objects.get().cash_type, JournalTransaction.CASH_EXPENSE)

    def test_daily_journal_expense_amount_equals_total_wage(self):
        record = self.create_record(daily_wage='145.00')
        self.client.post(reverse('worker-work-record-mark-paid', args=[record.id]), {'payment_method': 'cash'}, format='json')
        self.assertEqual(JournalTransaction.objects.get().amount, Decimal('145.00'))

    def test_daily_journal_payment_method_matches_selected_method(self):
        record = self.create_record()
        self.client.post(reverse('worker-work-record-mark-paid', args=[record.id]), {'payment_method': 'online'}, format='json')
        self.assertEqual(JournalTransaction.objects.get().payment_method, 'online')

    def test_paid_record_stores_paid_at_and_paid_by(self):
        record = self.create_record()
        self.client.post(reverse('worker-work-record-mark-paid', args=[record.id]), {'payment_method': 'cash'}, format='json')
        record.refresh_from_db()
        self.assertIsNotNone(record.paid_at)
        self.assertEqual(record.paid_by, self.admin)

    def test_paying_same_record_twice_is_rejected(self):
        record = self.create_record()
        self.client.post(reverse('worker-work-record-mark-paid', args=[record.id]), {'payment_method': 'cash'}, format='json')
        response = self.client.post(reverse('worker-work-record-mark-paid', args=[record.id]), {'payment_method': 'cash'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_duplicate_daily_journal_record_is_not_created(self):
        record = self.create_record()
        self.client.post(reverse('worker-work-record-mark-paid', args=[record.id]), {'payment_method': 'cash'}, format='json')
        response = self.client.post(reverse('worker-work-record-mark-paid', args=[record.id]), {'payment_method': 'cash'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(JournalTransaction.objects.count(), 1)

    @patch('daily_journal.models.JournalTransaction.objects.get_or_create')
    def test_payment_operation_is_atomic(self, mocked_get_or_create):
        mocked_get_or_create.side_effect = RuntimeError('journal failed')
        record = self.create_record()
        with self.assertRaises(RuntimeError):
            self.client.post(reverse('worker-work-record-mark-paid', args=[record.id]), {'payment_method': 'cash'}, format='json')
        record.refresh_from_db()
        self.assertEqual(record.payment_status, WorkerWorkRecord.PAYMENT_UNPAID)

    def test_invalid_payment_method_is_rejected(self):
        record = self.create_record()
        response = self.client.post(reverse('worker-work-record-mark-paid', args=[record.id]), {'payment_method': 'card'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_paid_wage_cannot_be_edited(self):
        record = self.create_record()
        self.client.post(reverse('worker-work-record-mark-paid', args=[record.id]), {'payment_method': 'cash'}, format='json')
        response = self.client.patch(reverse('worker-work-record-detail', args=[record.id]), {'daily_wage': '200.00'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_unpaid_manual_work_record_can_be_edited(self):
        record = self.create_record()
        response = self.client.patch(reverse('worker-work-record-detail', args=[record.id]), {'daily_wage': '200.00', 'work_description': 'Updated'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_editing_recalculates_total_wage(self):
        record = self.create_record()
        self.client.patch(reverse('worker-work-record-detail', args=[record.id]), {'daily_wage': '200.00'}, format='json')
        record.refresh_from_db()
        self.assertEqual(record.total_wage, Decimal('200.00'))

    def test_paid_work_record_cannot_be_deleted(self):
        record = self.create_record()
        self.client.post(reverse('worker-work-record-mark-paid', args=[record.id]), {'payment_method': 'cash'}, format='json')
        response = self.client.delete(reverse('worker-work-record-detail', args=[record.id]))
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_unpaid_manual_work_record_can_be_soft_deleted_by_admin(self):
        record = self.create_record()
        response = self.client.delete(reverse('worker-work-record-detail', args=[record.id]))
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        record.refresh_from_db()
        self.assertTrue(record.is_deleted)

    def test_manager_cannot_delete_work_record(self):
        record = self.create_record()
        self.client.force_authenticate(self.manager)
        response = self.client.delete(reverse('worker-work-record-detail', args=[record.id]))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_worker_with_unpaid_work_records_cannot_be_archived(self):
        worker = self.create_worker()
        self.create_record(worker)
        response = self.client.delete(self.detail_url(worker))
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_worker_without_unpaid_work_records_can_be_archived_by_admin(self):
        worker = self.create_worker()
        response = self.client.delete(self.detail_url(worker))
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_manager_cannot_archive_worker(self):
        worker = self.create_worker()
        self.client.force_authenticate(self.manager)
        response = self.client.delete(self.detail_url(worker))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_archived_worker_cannot_receive_work_records(self):
        worker = self.create_worker()
        worker.is_active = False
        worker.is_deleted = True
        worker.save(update_fields=['is_active', 'is_deleted'])
        response = self.client.post(self.work_url(worker), self.work_payload(), format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_paid_and_unpaid_totals_are_calculated_correctly(self):
        worker = self.create_worker()
        paid_record = self.create_record(worker, daily_wage='100.00')
        self.create_record(worker, daily_wage='50.00')
        self.client.post(reverse('worker-work-record-mark-paid', args=[paid_record.id]), {'payment_method': 'cash'}, format='json')
        response = self.client.get(self.detail_url(worker))
        self.assertEqual(response.data['paid_wage_total'], '100.00')
        self.assertEqual(response.data['unpaid_wage_total'], '50.00')

    def test_worker_search_works(self):
        self.create_worker(name='Search Target')
        response = self.client.get(reverse('worker-list'), {'search': 'Target'})
        self.assertEqual(response.data['count'], 1)

    def test_worker_type_filter_works(self):
        self.create_worker(worker_type=Worker.TYPE_WEIGHING)
        response = self.client.get(reverse('worker-list'), {'worker_type': Worker.TYPE_WEIGHING})
        self.assertEqual(response.data['count'], 1)

    def test_payment_status_filter_works(self):
        worker = self.create_worker()
        self.create_record(worker)
        response = self.client.get(reverse('worker-list'), {'payment_status': 'unpaid'})
        self.assertEqual(response.data['count'], 1)

    def test_statement_totals_are_correct(self):
        worker = self.create_worker()
        paid_record = self.create_record(worker, daily_wage='100.00')
        self.create_record(worker, daily_wage='50.00')
        self.client.post(reverse('worker-work-record-mark-paid', args=[paid_record.id]), {'payment_method': 'cash'}, format='json')
        response = self.client.get(reverse('worker-statement', args=[worker.id]))
        self.assertEqual(response.data['total_paid_wages'], '100.00')
        self.assertEqual(response.data['total_unpaid_wages'], '50.00')

    def test_summary_totals_are_correct(self):
        worker = self.create_worker()
        paid_record = self.create_record(worker, daily_wage='100.00')
        self.create_record(worker, daily_wage='50.00')
        self.client.post(reverse('worker-work-record-mark-paid', args=[paid_record.id]), {'payment_method': 'cash'}, format='json')
        response = self.client.get(reverse('worker-summary'))
        self.assertEqual(response.data['total_paid_wages'], '100.00')
        self.assertEqual(response.data['total_unpaid_wages'], '50.00')

    def test_soft_deleted_records_do_not_affect_totals(self):
        worker = self.create_worker()
        record = self.create_record(worker, daily_wage='100.00')
        self.client.delete(reverse('worker-work-record-detail', args=[record.id]))
        response = self.client.get(self.detail_url(worker))
        self.assertEqual(response.data['unpaid_wage_total'], '0.00')
