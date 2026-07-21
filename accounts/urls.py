from django.urls import path

from .views import ForgotPasswordView, LoginView, MeView, RegisterView, ResetPasswordView


urlpatterns = [
    path('register/', RegisterView.as_view(), name='auth_register'),
    path('login/', LoginView.as_view(), name='auth_login'),
    path('forgot-password/', ForgotPasswordView.as_view(), name='auth_forgot_password'),
    path('reset-password/', ResetPasswordView.as_view(), name='auth_reset_password'),
    path('me/', MeView.as_view(), name='auth_me'),
]
