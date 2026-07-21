from django.contrib import admin
from django.conf import settings
from django.conf.urls.static import static
from django.urls import include, path
from rest_framework_simplejwt.views import TokenRefreshView


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('accounts.urls')),
    path('api/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/mobile/', include('customers.mobile_urls')),
    path('api/journal/', include('daily_journal.urls')),
    path('api/products/', include('inventory.product_urls')),
    path('api/inventory/', include('inventory.urls')),
    path('api/customers/', include('customers.urls')),
    path('api/workers/', include('workers.urls')),
    path('api/', include('orders.urls')),
    path('api/invoices/', include('invoices.urls')),
    path('api/shipments/', include('shipments.urls')),
    path('api/reports/', include('reports.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
