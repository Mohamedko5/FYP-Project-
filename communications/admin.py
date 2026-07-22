from django.contrib import admin

from .models import ChatAttachment, ChatConversation, ChatMessage


class ChatAttachmentInline(admin.TabularInline):
    model = ChatAttachment
    extra = 0
    readonly_fields = ('original_filename', 'stored_filename', 'mime_type', 'file_size', 'attachment_type', 'created_at')


@admin.register(ChatConversation)
class ChatConversationAdmin(admin.ModelAdmin):
    list_display = ('id', 'customer', 'status', 'last_message_at', 'assigned_admin', 'is_archived')
    list_filter = ('status', 'is_archived')
    search_fields = ('customer__name', 'customer__code', 'customer__phone')
    readonly_fields = ('created_at', 'updated_at', 'last_message_at')


@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    list_display = ('id', 'conversation', 'sender_type', 'message_type', 'created_at')
    list_filter = ('sender_type', 'message_type', 'is_system_message')
    search_fields = ('body', 'conversation__customer__name', 'conversation__customer__code')
    readonly_fields = ('created_at', 'customer_read_at', 'admin_read_at')
    inlines = [ChatAttachmentInline]


@admin.register(ChatAttachment)
class ChatAttachmentAdmin(admin.ModelAdmin):
    list_display = ('id', 'message', 'original_filename', 'attachment_type', 'mime_type', 'file_size', 'created_at')
    list_filter = ('attachment_type', 'mime_type')
    search_fields = ('original_filename', 'message__conversation__customer__name')
