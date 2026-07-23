from django.urls import path

from . import views


urlpatterns = [
    path('mobile/supply-offers/', views.MobileSupplyOfferListCreateView.as_view(), name='mobile_supply_offer_list'),
    path('mobile/supply-offers/<int:offer_id>/', views.MobileSupplyOfferDetailView.as_view(), name='mobile_supply_offer_detail'),
    path('mobile/supply-offers/<int:offer_id>/attachments/', views.MobileOfferAttachmentView.as_view(), name='mobile_supply_offer_attachment'),
    path('mobile/supply-offers/<int:offer_id>/timeline/', views.MobileOfferTimelineView.as_view(), name='mobile_supply_offer_timeline'),
    path('mobile/supply-offers/<int:offer_id>/responses/<int:response_id>/<str:action>/', views.MobileOfferResponseActionView.as_view(), name='mobile_supply_offer_response_action'),
    path('mobile/supply-offers/<int:offer_id>/<str:action>/', views.MobileOfferActionView.as_view(), name='mobile_supply_offer_action'),
    path('admin/supply-offers/', views.AdminSupplyOfferListView.as_view(), name='admin_supply_offer_list'),
    path('admin/supply-offers/unread-count/', views.AdminSupplyOfferUnreadView.as_view(), name='admin_supply_offer_unread'),
    path('admin/supply-offers/<int:offer_id>/', views.AdminSupplyOfferDetailView.as_view(), name='admin_supply_offer_detail'),
    path('admin/supply-offers/<int:offer_id>/timeline/', views.AdminOfferTimelineView.as_view(), name='admin_supply_offer_timeline'),
    path('admin/supply-offers/<int:offer_id>/<str:action>/', views.AdminOfferActionView.as_view(), name='admin_supply_offer_action'),
    path('attachments/<int:attachment_id>/', views.SupplyOfferAttachmentDownloadView.as_view(), name='supply_offer_attachment_download'),
]
