from django.urls import path

from . import views


urlpatterns = [
    path('options/', views.options),
    path('daily-journal/', views.daily_journal),
    path('inventory/', views.inventory),
    path('customer-accounts/', views.customer_accounts),
    path('workers/', views.workers),
    path('orders/', views.orders),
    path('invoices/', views.invoices),
    path('shipments/', views.shipments),
    path('financial-summary/', views.financial_summary),
]
