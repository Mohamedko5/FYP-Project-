from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    JournalTransactionViewSet,
    WarehouseCommodityTransactionReverseView,
    WarehouseCommodityTransactionView,
)


router = DefaultRouter()
router.register('transactions', JournalTransactionViewSet, basename='journal-transaction')

urlpatterns = [
    path('warehouse-commodity-transactions/', WarehouseCommodityTransactionView.as_view(), name='warehouse-commodity-transaction'),
    path('warehouse-commodity-transactions/<int:pk>/reverse/', WarehouseCommodityTransactionReverseView.as_view(), name='warehouse-commodity-transaction-reverse'),
    path('', include(router.urls)),
]
