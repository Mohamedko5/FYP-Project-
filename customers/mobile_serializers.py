from django.contrib.auth import authenticate, get_user_model
from rest_framework import serializers

from .models import Customer, CustomerAccount
from .permissions import is_mobile_customer_user


User = get_user_model()


class MobileCustomerSerializer(serializers.ModelSerializer):
    email = serializers.SerializerMethodField()

    class Meta:
        model = Customer
        fields = (
            'id',
            'code',
            'name',
            'email',
            'phone',
            'secondary_phone',
            'address',
            'customer_type',
        )

    def get_email(self, customer):
        account = getattr(customer, 'mobile_account', None)
        user = getattr(account, 'user', None)
        return user.email if user else ''


class MobileLoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    default_error_messages = {
        'invalid_credentials': 'Invalid email or password.',
        'inactive_customer': 'Your customer account is inactive.',
    }

    def validate(self, attrs):
        email = attrs['email'].lower()
        password = attrs['password']
        user = User.objects.filter(email__iexact=email).first()
        if not user:
            self.fail('invalid_credentials')

        authenticated_user = authenticate(username=user.username, password=password)
        if authenticated_user is None:
            self.fail('invalid_credentials')

        account = CustomerAccount.objects.select_related('customer', 'user').filter(user=authenticated_user).first()
        if not account:
            self.fail('invalid_credentials')

        if not is_mobile_customer_user(authenticated_user):
            self.fail('inactive_customer')

        attrs['user'] = authenticated_user
        attrs['customer'] = account.customer
        return attrs
