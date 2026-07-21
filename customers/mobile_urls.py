from django.urls import path

from .mobile_views import MobileLoginView, MobileLogoutView, MobileMeView, MobileRefreshView


urlpatterns = [
    path('auth/login/', MobileLoginView.as_view(), name='mobile_auth_login'),
    path('auth/refresh/', MobileRefreshView.as_view(), name='mobile_auth_refresh'),
    path('auth/logout/', MobileLogoutView.as_view(), name='mobile_auth_logout'),
    path('me/', MobileMeView.as_view(), name='mobile_me'),
]
