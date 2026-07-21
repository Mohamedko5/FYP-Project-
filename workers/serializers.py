from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Sum
from django.utils import timezone
from rest_framework import serializers

from inventory.models import Warehouse

from .models import Worker, WorkerWorkRecord, validate_photo_file
from .services import create_work_record, mark_work_record_paid, money, update_work_record


def local_date(value):
    return timezone.localtime(value).date().isoformat()


def local_time(value):
    return timezone.localtime(value).strftime('%H:%M')


class WorkerSerializer(serializers.ModelSerializer):
    photo_url = serializers.SerializerMethodField()
    unpaid_wage_total = serializers.SerializerMethodField()
    paid_wage_total = serializers.SerializerMethodField()
    total_work_records = serializers.IntegerField(read_only=True)
    unpaid_work_records = serializers.IntegerField(read_only=True)
    paid_work_records = serializers.IntegerField(read_only=True)
    last_work_at = serializers.SerializerMethodField()

    class Meta:
        model = Worker
        fields = (
            'id', 'code', 'name', 'phone', 'secondary_phone', 'worker_type', 'assigned_work',
            'default_daily_wage', 'default_price_per_bag', 'photo', 'photo_url', 'notes', 'status',
            'is_active', 'is_deleted', 'created_by', 'updated_by', 'deleted_by',
            'created_at', 'updated_at', 'deleted_at', 'unpaid_wage_total', 'paid_wage_total',
            'total_work_records', 'unpaid_work_records', 'paid_work_records', 'last_work_at',
        )
        read_only_fields = (
            'id', 'code', 'photo_url', 'is_deleted', 'created_by', 'updated_by', 'deleted_by',
            'created_at', 'updated_at', 'deleted_at', 'unpaid_wage_total', 'paid_wage_total',
            'total_work_records', 'unpaid_work_records', 'paid_work_records', 'last_work_at',
        )

    def validate_photo(self, value):
        try:
            validate_photo_file(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict.get('photo', exc.messages))
        return value

    def get_photo_url(self, obj):
        if not obj.photo:
            return ''
        request = self.context.get('request')
        return request.build_absolute_uri(obj.photo.url) if request else obj.photo.url

    def get_unpaid_wage_total(self, obj):
        return money(obj.unpaid_wage_total)

    def get_paid_wage_total(self, obj):
        return money(obj.paid_wage_total)

    def get_last_work_at(self, obj):
        return timezone.localtime(obj.last_work_at).isoformat() if obj.last_work_at else None

    def create(self, validated_data):
        request = self.context['request']
        worker = Worker(created_by=request.user, **validated_data)
        try:
            worker.full_clean()
            worker.save()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict if hasattr(exc, 'message_dict') else exc.messages)
        return worker

    def update(self, instance, validated_data):
        request = self.context['request']
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.updated_by = request.user
        try:
            instance.full_clean()
            instance.save()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict if hasattr(exc, 'message_dict') else exc.messages)
        return instance


class WorkerWorkRecordSerializer(serializers.ModelSerializer):
    worker_name = serializers.CharField(source='worker.name', read_only=True)
    worker_code = serializers.CharField(source='worker.code', read_only=True)
    warehouse_name = serializers.CharField(source='warehouse.warehouse_name', read_only=True)
    warehouse_id = serializers.PrimaryKeyRelatedField(source='warehouse', queryset=Warehouse.objects.filter(is_active=True, is_deleted=False), write_only=True)
    date = serializers.SerializerMethodField()
    time = serializers.SerializerMethodField()
    administrator_name = serializers.SerializerMethodField()
    paid_by_name = serializers.SerializerMethodField()

    class Meta:
        model = WorkerWorkRecord
        fields = (
            'id', 'code', 'worker', 'worker_name', 'worker_code', 'warehouse', 'warehouse_id',
            'warehouse_name', 'calculation_method', 'number_of_bags', 'price_per_bag',
            'daily_wage', 'total_wage', 'work_description', 'notes', 'payment_status',
            'payment_method', 'paid_at', 'paid_by', 'paid_by_name', 'linked_journal_transaction',
            'source_type', 'source_reference', 'is_system_generated', 'created_by', 'created_at',
            'updated_at', 'date', 'time', 'administrator_name', 'is_deleted', 'deleted_by', 'deleted_at',
        )
        read_only_fields = (
            'id', 'code', 'worker', 'warehouse', 'total_wage', 'payment_status', 'payment_method',
            'paid_at', 'paid_by', 'paid_by_name', 'linked_journal_transaction', 'source_type',
            'source_reference', 'is_system_generated', 'created_by', 'created_at', 'updated_at',
            'date', 'time', 'administrator_name', 'is_deleted', 'deleted_by', 'deleted_at',
        )

    def get_date(self, obj):
        return local_date(obj.created_at)

    def get_time(self, obj):
        return local_time(obj.created_at)

    def get_administrator_name(self, obj):
        user = obj.created_by
        return user.get_full_name() or user.username or user.email

    def get_paid_by_name(self, obj):
        if not obj.paid_by:
            return ''
        return obj.paid_by.get_full_name() or obj.paid_by.username or obj.paid_by.email

    def create(self, validated_data):
        request = self.context['request']
        worker = self.context['worker']
        warehouse = validated_data.pop('warehouse')
        try:
            return create_work_record(worker=worker, user=request.user, warehouse_id=warehouse.id, **validated_data)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict if hasattr(exc, 'message_dict') else exc.messages)

    def update(self, instance, validated_data):
        if 'warehouse' in validated_data:
            validated_data['warehouse_id'] = validated_data.pop('warehouse').id
        try:
            return update_work_record(record=instance, user=self.context['request'].user, **validated_data)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict if hasattr(exc, 'message_dict') else exc.messages)


class MarkPaidSerializer(serializers.Serializer):
    payment_method = serializers.ChoiceField(choices=('cash', 'online'))

    def save(self, **kwargs):
        try:
            return mark_work_record_paid(
                record_id=self.context['record'].id,
                user=self.context['request'].user,
                payment_method=self.validated_data['payment_method'],
            )
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict if hasattr(exc, 'message_dict') else exc.messages)
