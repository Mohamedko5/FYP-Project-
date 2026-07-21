from decimal import Decimal
import re

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q, Sum
from django.utils import timezone


PHONE_RE = re.compile(r'^\+?[0-9]{7,15}$')


def normalize_phone(value):
    return (value or '').strip().replace(' ', '').replace('-', '')


def validate_photo_file(file_obj):
    if not file_obj:
        return
    allowed = {'.jpg', '.jpeg', '.png', '.webp'}
    name = (file_obj.name or '').lower()
    if not any(name.endswith(extension) for extension in allowed):
        raise ValidationError({'photo': 'Photo must be JPG, JPEG, PNG, or WEBP.'})
    if file_obj.size and file_obj.size > 2 * 1024 * 1024:
        raise ValidationError({'photo': 'Photo must not exceed 2 MB.'})


class Worker(models.Model):
    TYPE_GENERAL = 'general_worker'
    TYPE_BAG = 'bag_carrying_worker'
    TYPE_WEIGHING = 'weighing_worker'
    WORKER_TYPE_CHOICES = [
        (TYPE_GENERAL, 'General Worker'),
        (TYPE_BAG, 'Bag Carrying Worker'),
        (TYPE_WEIGHING, 'Weighing Worker'),
    ]

    STATUS_AVAILABLE = 'available'
    STATUS_WORKING = 'working'
    STATUS_INACTIVE = 'inactive'
    STATUS_CHOICES = [
        (STATUS_AVAILABLE, 'Available'),
        (STATUS_WORKING, 'Working'),
        (STATUS_INACTIVE, 'Inactive'),
    ]

    code = models.CharField(max_length=20, unique=True, blank=True)
    name = models.CharField(max_length=150)
    phone = models.CharField(max_length=30)
    secondary_phone = models.CharField(max_length=30, blank=True)
    worker_type = models.CharField(max_length=30, choices=WORKER_TYPE_CHOICES)
    assigned_work = models.CharField(max_length=255)
    default_daily_wage = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True)
    default_price_per_bag = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True)
    photo = models.FileField(upload_to='workers/', null=True, blank=True)
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_AVAILABLE)
    is_active = models.BooleanField(default=True)
    is_deleted = models.BooleanField(default=False)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='created_workers')
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='updated_workers', null=True, blank=True)
    deleted_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='deleted_workers', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['name']
        indexes = [
            models.Index(fields=['code']),
            models.Index(fields=['phone']),
            models.Index(fields=['worker_type']),
            models.Index(fields=['status']),
            models.Index(fields=['is_active']),
            models.Index(fields=['is_deleted']),
            models.Index(fields=['created_at']),
        ]
        constraints = [
            models.UniqueConstraint(fields=['phone'], condition=Q(is_active=True, is_deleted=False), name='unique_active_worker_phone'),
            models.CheckConstraint(condition=Q(default_daily_wage__gt=0) | Q(default_daily_wage__isnull=True), name='worker_default_daily_wage_positive'),
            models.CheckConstraint(condition=Q(default_price_per_bag__gt=0) | Q(default_price_per_bag__isnull=True), name='worker_default_price_per_bag_positive'),
        ]

    def save(self, *args, **kwargs):
        if not self.code:
            last_id = Worker.objects.order_by('-id').values_list('id', flat=True).first() or 0
            self.code = f'WRK-{last_id + 1:04d}'
        super().save(*args, **kwargs)

    def clean(self):
        errors = {}
        for field in ('name', 'phone', 'worker_type', 'assigned_work'):
            value = getattr(self, field, '')
            if isinstance(value, str):
                value = value.strip()
                setattr(self, field, value)
            if not value:
                errors[field] = 'This field is required.'
        self.phone = normalize_phone(self.phone)
        self.secondary_phone = normalize_phone(self.secondary_phone)
        if self.phone and not PHONE_RE.match(self.phone):
            errors['phone'] = 'Enter a valid phone number.'
        if self.secondary_phone:
            if not PHONE_RE.match(self.secondary_phone):
                errors['secondary_phone'] = 'Enter a valid phone number.'
            if self.secondary_phone == self.phone:
                errors['secondary_phone'] = 'Secondary phone must be different from phone.'
        if self.worker_type and self.worker_type not in dict(self.WORKER_TYPE_CHOICES):
            errors['worker_type'] = 'Choose a valid worker type.'
        if self.status and self.status not in dict(self.STATUS_CHOICES):
            errors['status'] = 'Choose a valid status.'
        if self.default_daily_wage is not None and self.default_daily_wage <= 0:
            errors['default_daily_wage'] = 'Default daily wage must be greater than zero.'
        if self.default_price_per_bag is not None and self.default_price_per_bag <= 0:
            errors['default_price_per_bag'] = 'Default price per bag must be greater than zero.'
        duplicate = Worker.objects.filter(phone=self.phone, is_active=True, is_deleted=False)
        if self.pk:
            duplicate = duplicate.exclude(pk=self.pk)
        if self.phone and duplicate.exists():
            errors['phone'] = 'An active worker with this phone already exists.'
        try:
            validate_photo_file(self.photo)
        except ValidationError as exc:
            errors.update(exc.message_dict)
        if errors:
            raise ValidationError(errors)

    @property
    def unpaid_wage_total(self):
        return self.work_records.filter(is_deleted=False, payment_status=WorkerWorkRecord.PAYMENT_UNPAID).aggregate(total=Sum('total_wage'))['total'] or Decimal('0.00')

    @property
    def paid_wage_total(self):
        return self.work_records.filter(is_deleted=False, payment_status=WorkerWorkRecord.PAYMENT_PAID).aggregate(total=Sum('total_wage'))['total'] or Decimal('0.00')

    @property
    def total_work_records(self):
        return self.work_records.filter(is_deleted=False).count()

    @property
    def unpaid_work_records(self):
        return self.work_records.filter(is_deleted=False, payment_status=WorkerWorkRecord.PAYMENT_UNPAID).count()

    @property
    def paid_work_records(self):
        return self.work_records.filter(is_deleted=False, payment_status=WorkerWorkRecord.PAYMENT_PAID).count()

    @property
    def last_work_at(self):
        return self.work_records.filter(is_deleted=False).order_by('-created_at').values_list('created_at', flat=True).first()

    def __str__(self):
        return f'{self.code} - {self.name}'


class WorkerWorkRecord(models.Model):
    METHOD_DAILY = 'daily_wage'
    METHOD_BAG = 'bag_based'
    CALCULATION_METHOD_CHOICES = [
        (METHOD_DAILY, 'Daily Wage'),
        (METHOD_BAG, 'Bag Based'),
    ]

    PAYMENT_UNPAID = 'unpaid'
    PAYMENT_PAID = 'paid'
    PAYMENT_STATUS_CHOICES = [
        (PAYMENT_UNPAID, 'Unpaid'),
        (PAYMENT_PAID, 'Paid'),
    ]

    PAYMENT_CASH = 'cash'
    PAYMENT_ONLINE = 'online'
    PAYMENT_METHOD_CHOICES = [
        (PAYMENT_CASH, 'Cash'),
        (PAYMENT_ONLINE, 'Online'),
    ]

    SOURCE_MANUAL = 'manual'
    SOURCE_WEIGHING = 'weighing'
    SOURCE_SHIPMENT = 'shipment'
    SOURCE_SYSTEM = 'system'
    SOURCE_TYPE_CHOICES = [
        (SOURCE_MANUAL, 'Manual'),
        (SOURCE_WEIGHING, 'Weighing'),
        (SOURCE_SHIPMENT, 'Shipment'),
        (SOURCE_SYSTEM, 'System'),
    ]

    code = models.CharField(max_length=20, unique=True, blank=True)
    worker = models.ForeignKey(Worker, on_delete=models.PROTECT, related_name='work_records')
    warehouse = models.ForeignKey('inventory.Warehouse', on_delete=models.PROTECT, related_name='worker_work_records')
    calculation_method = models.CharField(max_length=20, choices=CALCULATION_METHOD_CHOICES)
    number_of_bags = models.DecimalField(max_digits=18, decimal_places=3, null=True, blank=True)
    price_per_bag = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True)
    daily_wage = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True)
    total_wage = models.DecimalField(max_digits=18, decimal_places=2)
    work_description = models.TextField()
    notes = models.TextField(blank=True)
    payment_status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default=PAYMENT_UNPAID)
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES, null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    paid_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='paid_worker_work_records', null=True, blank=True)
    linked_journal_transaction = models.ForeignKey('daily_journal.JournalTransaction', on_delete=models.PROTECT, related_name='worker_work_records', null=True, blank=True)
    source_type = models.CharField(max_length=20, choices=SOURCE_TYPE_CHOICES, default=SOURCE_MANUAL)
    source_reference = models.CharField(max_length=120, blank=True)
    is_system_generated = models.BooleanField(default=False)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='created_worker_work_records')
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    is_deleted = models.BooleanField(default=False)
    deleted_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='deleted_worker_work_records', null=True, blank=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['code']),
            models.Index(fields=['worker']),
            models.Index(fields=['warehouse']),
            models.Index(fields=['calculation_method']),
            models.Index(fields=['payment_status']),
            models.Index(fields=['payment_method']),
            models.Index(fields=['created_at']),
            models.Index(fields=['source_type']),
            models.Index(fields=['source_reference']),
            models.Index(fields=['is_deleted']),
        ]
        constraints = [
            models.CheckConstraint(condition=Q(total_wage__gt=0), name='worker_work_total_wage_positive'),
            models.CheckConstraint(condition=Q(daily_wage__gt=0) | Q(daily_wage__isnull=True), name='worker_work_daily_wage_positive'),
            models.CheckConstraint(condition=Q(number_of_bags__gt=0) | Q(number_of_bags__isnull=True), name='worker_work_bags_positive'),
            models.CheckConstraint(condition=Q(price_per_bag__gt=0) | Q(price_per_bag__isnull=True), name='worker_work_price_per_bag_positive'),
        ]

    def save(self, *args, **kwargs):
        if not self.code:
            last_id = WorkerWorkRecord.objects.order_by('-id').values_list('id', flat=True).first() or 0
            self.code = f'WORK-{last_id + 1:06d}'
        super().save(*args, **kwargs)

    def clean(self):
        errors = {}
        if self.worker_id and (self.worker.is_deleted or not self.worker.is_active):
            errors['worker'] = 'Archived workers cannot receive work records.'
        if self.warehouse_id and (self.warehouse.is_deleted or not self.warehouse.is_active):
            errors['warehouse'] = 'Only active warehouses may be selected.'
        if self.total_wage is not None and self.total_wage <= 0:
            errors['total_wage'] = 'Total wage must be greater than zero.'
        self.work_description = (self.work_description or '').strip()
        self.notes = (self.notes or '').strip()
        if not self.work_description:
            errors['work_description'] = 'Work description is required.'
        if errors:
            raise ValidationError(errors)

    def __str__(self):
        return f'{self.code} - {self.worker.name} - {self.total_wage}'
