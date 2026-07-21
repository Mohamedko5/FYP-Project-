from django.contrib import admin

from .models import Worker, WorkerWorkRecord


@admin.register(Worker)
class WorkerAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'phone', 'worker_type', 'assigned_work', 'status', 'admin_unpaid_wage_total', 'is_active', 'is_deleted', 'created_at')
    list_filter = ('worker_type', 'status', 'is_active', 'is_deleted', 'created_at')
    search_fields = ('code', 'name', 'phone', 'secondary_phone', 'assigned_work')
    readonly_fields = ('code', 'created_by', 'updated_by', 'deleted_by', 'created_at', 'updated_at', 'deleted_at')
    date_hierarchy = 'created_at'

    def admin_unpaid_wage_total(self, obj):
        return obj.unpaid_wage_total

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(WorkerWorkRecord)
class WorkerWorkRecordAdmin(admin.ModelAdmin):
    list_display = ('code', 'worker', 'warehouse', 'calculation_method', 'total_wage', 'payment_status', 'payment_method', 'created_by', 'created_at', 'is_deleted')
    list_filter = ('calculation_method', 'payment_status', 'payment_method', 'source_type', 'is_deleted', 'created_at')
    search_fields = ('code', 'worker__name', 'worker__code', 'warehouse__warehouse_name', 'work_description', 'source_reference')
    readonly_fields = (
        'code', 'worker', 'warehouse', 'calculation_method', 'number_of_bags', 'price_per_bag',
        'daily_wage', 'total_wage', 'payment_status', 'payment_method', 'paid_at', 'paid_by',
        'linked_journal_transaction', 'source_type', 'source_reference', 'is_system_generated',
        'created_by', 'created_at', 'updated_at', 'is_deleted', 'deleted_by', 'deleted_at',
    )
    date_hierarchy = 'created_at'

    def has_change_permission(self, request, obj=None):
        if obj and obj.payment_status == WorkerWorkRecord.PAYMENT_PAID:
            return False
        return super().has_change_permission(request, obj)

    def has_delete_permission(self, request, obj=None):
        return False
