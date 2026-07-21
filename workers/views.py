from datetime import datetime, time
from decimal import Decimal

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import models
from django.db.models import Sum
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from .models import Worker, WorkerWorkRecord
from .permissions import IsAdminForDeleteOnly
from .serializers import MarkPaidSerializer, WorkerSerializer, WorkerWorkRecordSerializer
from .services import money, soft_delete_work_record, work_totals


class WorkerPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 100


def parse_bool(value, field):
    if value in (None, ''):
        return None
    normalized = str(value).lower()
    if normalized in ('true', '1', 'yes'):
        return True
    if normalized in ('false', '0', 'no'):
        return False
    raise ValidationError({field: 'Use true or false.'})


def parse_local_date(value, field='date'):
    try:
        return datetime.strptime(value, '%Y-%m-%d').date()
    except ValueError as exc:
        raise ValidationError({field: 'Use YYYY-MM-DD format.'}) from exc


def day_bounds(day):
    tz = timezone.get_current_timezone()
    return (
        timezone.make_aware(datetime.combine(day, time.min), tz),
        timezone.make_aware(datetime.combine(day, time.max), tz),
    )


def filter_work_records(queryset, params):
    if params.get('warehouse'):
        queryset = queryset.filter(warehouse_id=params['warehouse'])
    if params.get('calculation_method'):
        queryset = queryset.filter(calculation_method=params['calculation_method'])
    if params.get('payment_status'):
        queryset = queryset.filter(payment_status=params['payment_status'])
    if params.get('payment_method'):
        queryset = queryset.filter(payment_method=params['payment_method'])
    if params.get('date'):
        start, end = day_bounds(parse_local_date(params['date']))
        queryset = queryset.filter(created_at__gte=start, created_at__lte=end)
    if params.get('date_from'):
        start, _ = day_bounds(parse_local_date(params['date_from'], 'date_from'))
        queryset = queryset.filter(created_at__gte=start)
    if params.get('date_to'):
        _, end = day_bounds(parse_local_date(params['date_to'], 'date_to'))
        queryset = queryset.filter(created_at__lte=end)
    ordering = params.get('ordering')
    if ordering:
        if ordering not in ('created_at', '-created_at', 'total_wage', '-total_wage'):
            raise ValidationError({'ordering': 'Unsupported ordering value.'})
        queryset = queryset.order_by(ordering)
    return queryset


class WorkerViewSet(viewsets.ModelViewSet):
    serializer_class = WorkerSerializer
    permission_classes = [IsAdminForDeleteOnly]
    pagination_class = WorkerPagination
    allowed_ordering = {'name', '-name', 'created_at', '-created_at', 'unpaid_wage_total', '-unpaid_wage_total'}

    def get_queryset(self):
        return Worker.objects.filter(is_deleted=False).prefetch_related('work_records')

    def filter_queryset(self, queryset):
        params = self.request.query_params
        search = params.get('search')
        if search:
            queryset = queryset.filter(
                models.Q(code__icontains=search)
                | models.Q(name__icontains=search)
                | models.Q(phone__icontains=search)
                | models.Q(secondary_phone__icontains=search)
                | models.Q(assigned_work__icontains=search)
            )
        if params.get('worker_type'):
            queryset = queryset.filter(worker_type=params['worker_type'])
        if params.get('status'):
            queryset = queryset.filter(status=params['status'])
        active = parse_bool(params.get('is_active'), 'is_active')
        if active is not None:
            queryset = queryset.filter(is_active=active)
        rows = list(queryset)
        if params.get('payment_status'):
            payment_status = params['payment_status']
            rows = [worker for worker in rows if worker.work_records.filter(is_deleted=False, payment_status=payment_status).exists()]
        ordering = params.get('ordering')
        if ordering:
            if ordering not in self.allowed_ordering:
                raise ValidationError({'ordering': 'Unsupported ordering value.'})
            reverse = ordering.startswith('-')
            field = ordering[1:] if reverse else ordering
            if field == 'unpaid_wage_total':
                rows.sort(key=lambda worker: worker.unpaid_wage_total, reverse=reverse)
            else:
                rows.sort(key=lambda worker: getattr(worker, field), reverse=reverse)
        return rows if (params.get('payment_status') or ordering) else queryset

    def destroy(self, request, *args, **kwargs):
        worker = self.get_object()
        if worker.work_records.filter(is_deleted=False, payment_status=WorkerWorkRecord.PAYMENT_UNPAID).exists():
            return Response({'detail': 'This worker cannot be archived while unpaid work records remain.'}, status=status.HTTP_400_BAD_REQUEST)
        worker.is_deleted = True
        worker.is_active = False
        worker.deleted_by = request.user
        worker.deleted_at = timezone.now()
        worker.save(update_fields=['is_deleted', 'is_active', 'deleted_by', 'deleted_at', 'updated_at'])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
        workers = Worker.objects.filter(is_deleted=False)
        records = WorkerWorkRecord.objects.filter(is_deleted=False)
        paid, unpaid = work_totals(records)
        return Response({
            'total_workers': workers.count(),
            'active_workers': workers.filter(is_active=True).count(),
            'general_workers': workers.filter(worker_type=Worker.TYPE_GENERAL).count(),
            'bag_carrying_workers': workers.filter(worker_type=Worker.TYPE_BAG).count(),
            'weighing_workers': workers.filter(worker_type=Worker.TYPE_WEIGHING).count(),
            'unpaid_work_records': records.filter(payment_status=WorkerWorkRecord.PAYMENT_UNPAID).count(),
            'total_unpaid_wages': money(unpaid),
            'total_paid_wages': money(paid),
        })

    @action(detail=True, methods=['get', 'post'], url_path='work-records')
    def work_records(self, request, pk=None):
        worker = self.get_object()
        if request.method == 'GET':
            queryset = filter_work_records(worker.work_records.filter(is_deleted=False).select_related('warehouse', 'created_by', 'paid_by'), request.query_params)
            return Response(WorkerWorkRecordSerializer(queryset, many=True, context={'request': request}).data)
        serializer = WorkerWorkRecordSerializer(data=request.data, context={'request': request, 'worker': worker})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'], url_path='statement')
    def statement(self, request, pk=None):
        worker = self.get_object()
        records = filter_work_records(worker.work_records.filter(is_deleted=False).select_related('warehouse', 'created_by', 'paid_by'), request.query_params)
        paid, unpaid = work_totals(records)
        method_rows = records.filter(payment_status=WorkerWorkRecord.PAYMENT_PAID).values('payment_method').annotate(total=Sum('total_wage'))
        warehouse_rows = records.values('warehouse_id', 'warehouse__warehouse_name').annotate(total=Sum('total_wage'), count=models.Count('id')).order_by('warehouse__warehouse_name')
        return Response({
            'generated_at': timezone.localtime(timezone.now()).isoformat(),
            'worker': WorkerSerializer(worker, context={'request': request}).data,
            'total_paid_wages': money(paid),
            'total_unpaid_wages': money(unpaid),
            'total_work_records': records.count(),
            'payment_method_totals': {
                'cash': money(next((row['total'] for row in method_rows if row['payment_method'] == 'cash'), Decimal('0.00'))),
                'online': money(next((row['total'] for row in method_rows if row['payment_method'] == 'online'), Decimal('0.00'))),
            },
            'warehouse_groups': [
                {
                    'warehouse_id': row['warehouse_id'],
                    'warehouse_name': row['warehouse__warehouse_name'],
                    'total_wage': money(row['total']),
                    'work_record_count': row['count'],
                }
                for row in warehouse_rows
            ],
            'work_records': WorkerWorkRecordSerializer(records, many=True, context={'request': request}).data,
        })


class WorkerWorkRecordViewSet(mixins.RetrieveModelMixin, mixins.UpdateModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    queryset = WorkerWorkRecord.objects.filter(is_deleted=False).select_related('worker', 'warehouse', 'created_by', 'paid_by')
    serializer_class = WorkerWorkRecordSerializer
    permission_classes = [IsAdminForDeleteOnly]

    def destroy(self, request, *args, **kwargs):
        record = self.get_object()
        try:
            soft_delete_work_record(record=record, user=request.user)
        except DjangoValidationError as exc:
            raise ValidationError(exc.message_dict if hasattr(exc, 'message_dict') else exc.messages) from exc
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], url_path='mark-paid')
    def mark_paid(self, request, pk=None):
        record = self.get_object()
        serializer = MarkPaidSerializer(data=request.data, context={'request': request, 'record': record})
        serializer.is_valid(raise_exception=True)
        paid_record = serializer.save()
        return Response(WorkerWorkRecordSerializer(paid_record, context={'request': request}).data)
