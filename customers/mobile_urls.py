from django.urls import path

from .mobile_views import (
    MobileHomeSummaryView,
    MobileInvoiceDetailView,
    MobileInvoiceListView,
    MobileLoginView,
    MobileLogoutView,
    MobileMeView,
    MobileOrderDetailView,
    MobileOrderListCreateView,
    MobileProductDetailView,
    MobileProductListView,
    MobileRefreshView,
    MobileShipmentDetailView,
    MobileShipmentListView,
)


urlpatterns = [
    path('auth/login/', MobileLoginView.as_view(), name='mobile_auth_login'),
    path('auth/refresh/', MobileRefreshView.as_view(), name='mobile_auth_refresh'),
    path('auth/logout/', MobileLogoutView.as_view(), name='mobile_auth_logout'),
    path('me/', MobileMeView.as_view(), name='mobile_me'),
    path('home-summary/', MobileHomeSummaryView.as_view(), name='mobile_home_summary'),
    path('products/', MobileProductListView.as_view(), name='mobile_products'),
    path('products/<int:pk>/', MobileProductDetailView.as_view(), name='mobile_product_detail'),
    path('orders/', MobileOrderListCreateView.as_view(), name='mobile_orders'),
    path('orders/<int:pk>/', MobileOrderDetailView.as_view(), name='mobile_order_detail'),
    path('invoices/', MobileInvoiceListView.as_view(), name='mobile_invoices'),
    path('invoices/<int:pk>/', MobileInvoiceDetailView.as_view(), name='mobile_invoice_detail'),
    path('shipments/', MobileShipmentListView.as_view(), name='mobile_shipments'),
    path('shipments/<int:pk>/', MobileShipmentDetailView.as_view(), name='mobile_shipment_detail'),
]
