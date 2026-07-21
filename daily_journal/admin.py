from django.contrib import admin

from .models import JournalTransaction


@admin.register(JournalTransaction)
class JournalTransactionAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'journal_type',
        'cash_type',
        'payment_method',
        'product_name',
        'party',
        'amount',
        'quantity',
        'unit',
        'created_by',
        'created_at',
        'is_deleted',
    )
    list_filter = ('journal_type', 'cash_type', 'payment_method', 'unit', 'is_deleted', 'created_at')
    search_fields = ('party', 'description', 'product_name', 'source_reference')
    readonly_fields = ('created_at', 'updated_at', 'deleted_at')

# Register your models here.
