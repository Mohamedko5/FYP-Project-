from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .product_api import ProductManagementViewSet


router = DefaultRouter()
router.register('', ProductManagementViewSet, basename='product-management')

urlpatterns = [
    path('', include(router.urls)),
]
