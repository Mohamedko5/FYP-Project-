from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import WorkerViewSet, WorkerWorkRecordViewSet


router = DefaultRouter()
router.register('work-records', WorkerWorkRecordViewSet, basename='worker-work-record')
router.register('', WorkerViewSet, basename='worker')

urlpatterns = [
    path('', include(router.urls)),
]
