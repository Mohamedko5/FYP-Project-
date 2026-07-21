from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import JournalTransactionViewSet


router = DefaultRouter()
router.register('transactions', JournalTransactionViewSet, basename='journal-transaction')

urlpatterns = [
    path('', include(router.urls)),
]
