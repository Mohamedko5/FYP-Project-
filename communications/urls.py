from django.urls import path

from .views import (
    AdminCloseView,
    AdminConversationDetailView,
    AdminConversationListView,
    AdminMessageListCreateView,
    AdminReadView,
    AdminReopenView,
    AdminUnreadCountView,
    ChatAttachmentDownloadView,
    MobileConversationView,
    MobileCustomerCardView,
    MobileMessageListCreateView,
    MobileReadView,
    MobileUnreadCountView,
)


urlpatterns = [
    path('attachments/<int:attachment_id>/', ChatAttachmentDownloadView.as_view(), name='chat_attachment_download'),
    path('mobile/conversation/', MobileConversationView.as_view(), name='mobile_chat_conversation'),
    path('mobile/messages/', MobileMessageListCreateView.as_view(), name='mobile_chat_messages'),
    path('mobile/customer-card/', MobileCustomerCardView.as_view(), name='mobile_chat_customer_card'),
    path('mobile/messages/read/', MobileReadView.as_view(), name='mobile_chat_read'),
    path('mobile/unread-count/', MobileUnreadCountView.as_view(), name='mobile_chat_unread_count'),
    path('admin/conversations/', AdminConversationListView.as_view(), name='admin_chat_conversations'),
    path('admin/conversations/<int:conversation_id>/', AdminConversationDetailView.as_view(), name='admin_chat_conversation_detail'),
    path('admin/conversations/<int:conversation_id>/messages/', AdminMessageListCreateView.as_view(), name='admin_chat_messages'),
    path('admin/conversations/<int:conversation_id>/read/', AdminReadView.as_view(), name='admin_chat_read'),
    path('admin/conversations/<int:conversation_id>/close/', AdminCloseView.as_view(), name='admin_chat_close'),
    path('admin/conversations/<int:conversation_id>/reopen/', AdminReopenView.as_view(), name='admin_chat_reopen'),
    path('admin/unread-count/', AdminUnreadCountView.as_view(), name='admin_chat_unread_count'),
]
