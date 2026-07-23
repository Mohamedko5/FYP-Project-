from django.contrib import admin

from .models import SupplyOffer, SupplyOfferAttachment, SupplyOfferItem, SupplyOfferStatusHistory


class SupplyOfferItemInline(admin.TabularInline):
    model = SupplyOfferItem
    extra = 0
    readonly_fields = ('customer_proposed_line_total', 'product_name_snapshot', 'unit_snapshot')


class SupplyOfferAttachmentInline(admin.TabularInline):
    model = SupplyOfferAttachment
    extra = 0
    readonly_fields = ('original_filename', 'mime_type', 'file_size', 'created_at')


@admin.register(SupplyOffer)
class SupplyOfferAdmin(admin.ModelAdmin):
    list_display = ('offer_number', 'customer', 'status', 'proposed_total', 'agreed_total', 'created_at')
    list_filter = ('status', 'currency', 'created_at')
    search_fields = ('offer_number', 'customer__name', 'customer__code', 'city')
    inlines = [SupplyOfferItemInline, SupplyOfferAttachmentInline]


@admin.register(SupplyOfferStatusHistory)
class SupplyOfferStatusHistoryAdmin(admin.ModelAdmin):
    list_display = ('offer', 'previous_status', 'new_status', 'actor_type', 'created_at')
    list_filter = ('actor_type', 'new_status')
