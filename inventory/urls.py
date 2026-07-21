from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import InventoryMovementViewSet, InventorySummaryViewSet, InventoryViewSet, ProductViewSet, WarehouseViewSet


router = DefaultRouter()
router.register('products', ProductViewSet, basename='inventory-product')
router.register('warehouses', WarehouseViewSet, basename='inventory-warehouse')
router.register('stocks', InventoryViewSet, basename='inventory-stock')
router.register('movements', InventoryMovementViewSet, basename='inventory-movement')
router.register('summary', InventorySummaryViewSet, basename='inventory-summary')

urlpatterns = [
    path('', include(router.urls)),
]
