from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import CashTransactionViewSet, CommodityTransactionViewSet, CustomerViewSet


router = DefaultRouter()
router.register('cash-transactions', CashTransactionViewSet, basename='customer-cash-transaction')
router.register('commodity-transactions', CommodityTransactionViewSet, basename='customer-commodity-transaction')
router.register('', CustomerViewSet, basename='customer')

urlpatterns = [
    path('', include(router.urls)),
]
