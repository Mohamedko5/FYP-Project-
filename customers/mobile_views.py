from django.contrib.auth import get_user_model
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from .mobile_serializers import MobileCustomerSerializer, MobileLoginSerializer
from .permissions import IsMobileCustomer, is_mobile_customer_user


User = get_user_model()


def mobile_token_response(user, customer):
    refresh = RefreshToken.for_user(user)
    return {
        'access': str(refresh.access_token),
        'refresh': str(refresh),
        'customer': MobileCustomerSerializer(customer).data,
    }


class MobileLoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = MobileLoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({'detail': 'Invalid email or password.'}, status=status.HTTP_401_UNAUTHORIZED)
        return Response(mobile_token_response(serializer.validated_data['user'], serializer.validated_data['customer']))


class MobileRefreshView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        refresh_value = request.data.get('refresh')
        if not refresh_value:
            return Response({'detail': 'Refresh token is required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            refresh = RefreshToken(refresh_value)
            user_id = refresh.payload.get('user_id')
            user = User.objects.select_related('customer_account__customer', 'profile').get(pk=user_id)
        except (TokenError, User.DoesNotExist):
            return Response({'detail': 'Your session has expired.'}, status=status.HTTP_401_UNAUTHORIZED)

        if not is_mobile_customer_user(user):
            return Response({'detail': 'Your customer account is inactive.'}, status=status.HTTP_401_UNAUTHORIZED)

        return Response({
            'access': str(refresh.access_token),
            'customer': MobileCustomerSerializer(user.customer_account.customer).data,
        })


class MobileLogoutView(APIView):
    permission_classes = [IsMobileCustomer]

    def post(self, request):
        refresh_value = request.data.get('refresh')
        if refresh_value:
            try:
                refresh = RefreshToken(refresh_value)
                blacklist = getattr(refresh, 'blacklist', None)
                if callable(blacklist):
                    blacklist()
            except TokenError:
                pass
        return Response({'detail': 'Logged out successfully.'})


class MobileMeView(APIView):
    permission_classes = [IsMobileCustomer]

    def get(self, request):
        return Response(MobileCustomerSerializer(request.user.customer_account.customer).data)
