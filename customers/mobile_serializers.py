from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from django.core import signing
from rest_framework import serializers

from inventory.models import Inventory, Product, ProductUnit
from invoices.models import Invoice
from orders.models import Order, OrderItem
from shipments.models import Shipment

from .email_service import EmailDeliveryError, send_customer_verification_email, send_password_reset_email
from .models import Customer, CustomerAccount, CustomerPasswordResetRequest, CustomerRegistrationRequest, PHONE_RE, normalize_phone
from .permissions import is_mobile_customer_user


User = get_user_model()
MONEY_QUANT = Decimal('0.01')
QTY_QUANT = Decimal('0.001')
GENERIC_RESET_MESSAGE = 'If an account exists for this email, a password reset code has been sent.'


def money(value):
    return f'{(value or Decimal("0.00")):.2f}'


def quantity(value):
    return f'{(value or Decimal("0.000")):.3f}'


def product_unit_available_quantity(product, unit):
    return Inventory.objects.filter(
        warehouse__is_active=True,
        warehouse__is_deleted=False,
        product=product,
        unit=unit,
    ).aggregate(total=Sum('quantity'))['total'] or Decimal('0.000')


def parse_positive_decimal(value, field):
    try:
        parsed = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise serializers.ValidationError({field: 'Enter a valid quantity.'}) from exc
    if not parsed.is_finite() or parsed <= 0:
        raise serializers.ValidationError({field: 'Quantity must be greater than zero.'})
    return parsed.quantize(QTY_QUANT, rounding=ROUND_HALF_UP)


def workflow_steps(kind, status):
    if kind == 'shipment':
        steps = [Shipment.STATUS_READY, Shipment.STATUS_PROCESSING, Shipment.STATUS_COMPLETED]
    else:
        steps = [
            Order.STATUS_PENDING,
            Order.STATUS_RECEIVED,
            Order.STATUS_INVOICED,
            Order.STATUS_READY_FOR_SHIPMENT,
            Order.STATUS_PROCESSING,
            Order.STATUS_COMPLETED,
        ]
    if status == 'cancelled':
        return [{'key': 'cancelled', 'label': 'Cancelled', 'state': 'current'}]
    try:
        current_index = steps.index(status)
    except ValueError:
        current_index = 0
    return [
        {
            'key': step,
            'label': step.replace('_', ' ').title(),
            'state': 'completed' if index < current_index else 'current' if index == current_index else 'upcoming',
        }
        for index, step in enumerate(steps)
    ]


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
        registration = CustomerRegistrationRequest.objects.filter(email__iexact=email).exclude(status=CustomerRegistrationRequest.STATUS_APPROVED).order_by('-created_at').first()
        if registration and registration.check_registration_password(password):
            code = {
                CustomerRegistrationRequest.STATUS_EMAIL_PENDING: 'email_not_verified',
                CustomerRegistrationRequest.STATUS_PENDING_APPROVAL: 'account_pending_approval',
                CustomerRegistrationRequest.STATUS_REJECTED: 'registration_rejected',
            }.get(registration.status, 'account_pending_approval')
            detail = {
                'email_not_verified': 'Please verify your email before signing in.',
                'account_pending_approval': 'Your account is waiting for administrator approval.',
                'registration_rejected': 'Your account registration was not approved. Please contact Bayad Company.',
            }[code]
            raise serializers.ValidationError({'code': code, 'detail': detail})
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


def mask_email(email):
    name, _, domain = email.partition('@')
    if len(name) <= 2:
        masked = name[:1] + '*'
    else:
        masked = f'{name[0]}***{name[-1]}'
    return f'{masked}@{domain}'


def email_delivery_validation_error(detail):
    return serializers.ValidationError({
        'code': 'email_delivery_failed',
        'detail': detail,
    })


def verification_error(detail, code='invalid_code'):
    return serializers.ValidationError({'code': code, 'detail': detail})


class MobileRegistrationSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=150)
    business_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=30)
    secondary_phone = serializers.CharField(max_length=30, required=False, allow_blank=True)
    address = serializers.CharField(max_length=255)
    customer_type = serializers.ChoiceField(choices=[choice[0] for choice in Customer.CUSTOMER_TYPE_CHOICES])
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    confirm_password = serializers.CharField(write_only=True, trim_whitespace=False)
    accept_terms = serializers.BooleanField(required=False)

    def validate_email(self, value):
        email = value.strip().lower()
        if User.objects.filter(email__iexact=email, is_active=True).exists():
            raise serializers.ValidationError('Unable to create account with these details.')
        if CustomerRegistrationRequest.objects.filter(email__iexact=email, status__in=[
            CustomerRegistrationRequest.STATUS_EMAIL_PENDING,
            CustomerRegistrationRequest.STATUS_PENDING_APPROVAL,
        ]).exists():
            raise serializers.ValidationError('A registration request is already pending. Please verify your email or request a new code.')
        return email

    def validate_phone(self, value):
        phone = normalize_phone(value)
        if not PHONE_RE.match(phone):
            raise serializers.ValidationError('Enter a valid phone number.')
        if Customer.objects.filter(phone=phone, is_active=True, is_deleted=False).exists():
            raise serializers.ValidationError('Unable to create account with these details.')
        return phone

    def validate_secondary_phone(self, value):
        phone = normalize_phone(value)
        if phone and not PHONE_RE.match(phone):
            raise serializers.ValidationError('Enter a valid phone number.')
        return phone

    def validate(self, attrs):
        if attrs['password'] != attrs['confirm_password']:
            raise serializers.ValidationError({'confirm_password': 'Passwords do not match.'})
        if attrs.get('accept_terms') is False:
            raise serializers.ValidationError({'accept_terms': 'You must accept the terms.'})
        password = attrs['password']
        if not (any(char.isupper() for char in password) and any(char.islower() for char in password) and any(char.isdigit() for char in password)):
            raise serializers.ValidationError({'password': 'Password must include uppercase, lowercase, and number characters.'})
        try:
            validate_password(password)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({'password': list(exc.messages)}) from exc
        return attrs

    def create(self, validated_data):
        password = validated_data.pop('password')
        validated_data.pop('confirm_password', None)
        validated_data.pop('accept_terms', None)
        registration = CustomerRegistrationRequest(**validated_data)
        registration.set_password(password)
        code = registration.set_verification_code()
        registration.full_clean(exclude=['password_hash', 'verification_code_hash'])
        registration.save()
        try:
            send_customer_verification_email(registration, code)
        except EmailDeliveryError as exc:
            registration.last_verification_sent_at = None
            registration.save(update_fields=['last_verification_sent_at', 'updated_at'])
            raise email_delivery_validation_error(exc.detail) from exc
        return registration


class MobileVerifyEmailSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.RegexField(r'^\d{6}$', required=False)
    verification_code = serializers.RegexField(r'^\d{6}$', required=False)

    def validate(self, attrs):
        attrs['email'] = attrs['email'].strip().lower()
        attrs['verification_code'] = attrs.get('code') or attrs.get('verification_code')
        if not attrs['verification_code']:
            raise serializers.ValidationError({'code': 'Enter the verification code.'})
        return attrs

    def save(self):
        registration = CustomerRegistrationRequest.objects.filter(email__iexact=self.validated_data['email'], status=CustomerRegistrationRequest.STATUS_EMAIL_PENDING).order_by('-created_at').first()
        if not registration:
            raise verification_error('Invalid or expired verification code.', 'invalid_code')
        if registration.verification_consumed_at:
            raise verification_error('This verification code has already been used.', 'code_used')
        if registration.is_verification_expired:
            raise verification_error('The verification code has expired.', 'code_expired')
        if registration.verification_attempts >= getattr(settings, 'CUSTOMER_EMAIL_VERIFICATION_MAX_ATTEMPTS', 5):
            raise verification_error('Too many verification attempts. Please request a new code.', 'attempt_limit')
        if not registration.check_verification_code(self.validated_data['verification_code']):
            registration.verification_attempts += 1
            registration.save(update_fields=['verification_attempts', 'updated_at'])
            raise verification_error('The verification code is incorrect.', 'invalid_code')
        registration.email_verified = True
        registration.status = CustomerRegistrationRequest.STATUS_PENDING_APPROVAL
        registration.verification_code_hash = ''
        registration.verification_code_expires_at = None
        registration.verification_consumed_at = timezone.now()
        registration.save(update_fields=['email_verified', 'status', 'verification_code_hash', 'verification_code_expires_at', 'verification_consumed_at', 'updated_at'])
        return registration


class MobileResendVerificationSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def save(self):
        email = self.validated_data['email'].strip().lower()
        registration = CustomerRegistrationRequest.objects.filter(email__iexact=email, status=CustomerRegistrationRequest.STATUS_EMAIL_PENDING).order_by('-created_at').first()
        if registration:
            now = timezone.now()
            cooldown = getattr(settings, 'CUSTOMER_EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS', 60)
            max_resends = getattr(settings, 'CUSTOMER_EMAIL_VERIFICATION_MAX_RESENDS', 5)
            if registration.last_verification_sent_at and now < registration.last_verification_sent_at + timezone.timedelta(seconds=cooldown):
                raise verification_error('Wait before requesting another code.', 'resend_cooldown')
            if registration.verification_resend_count >= max_resends:
                raise verification_error('Too many verification code requests. Please try again later.', 'resend_limit')
            code = registration.set_verification_code()
            registration.verification_resend_count += 1
            registration.save(update_fields=['verification_code_hash', 'verification_code_expires_at', 'verification_attempts', 'last_verification_sent_at', 'verification_consumed_at', 'verification_resend_count', 'updated_at'])
            try:
                send_customer_verification_email(registration, code)
            except EmailDeliveryError as exc:
                registration.last_verification_sent_at = None
                registration.verification_resend_count = max(registration.verification_resend_count - 1, 0)
                registration.save(update_fields=['last_verification_sent_at', 'verification_resend_count', 'updated_at'])
                raise email_delivery_validation_error(exc.detail) from exc
        return None


class MobileRegistrationStatusSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def status_payload(self):
        email = self.validated_data['email'].strip().lower()
        registration = CustomerRegistrationRequest.objects.filter(email__iexact=email).order_by('-created_at').first()
        if not registration:
            return {'status': 'not_found', 'message': 'No active registration request was found.'}
        messages = {
            CustomerRegistrationRequest.STATUS_EMAIL_PENDING: 'Please verify your email before administrator review.',
            CustomerRegistrationRequest.STATUS_PENDING_APPROVAL: 'Your account is waiting for administrator approval.',
            CustomerRegistrationRequest.STATUS_APPROVED: 'Your account has been approved. You can sign in.',
            CustomerRegistrationRequest.STATUS_REJECTED: 'Your account registration was not approved. Please contact Bayad Company.',
            CustomerRegistrationRequest.STATUS_EXPIRED: 'This registration request has expired.',
        }
        return {'status': registration.status, 'message': messages.get(registration.status, '')}


class MobileForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def save(self):
        email = self.validated_data['email'].strip().lower()
        user = User.objects.filter(email__iexact=email, is_active=True, is_staff=False, is_superuser=False).first()
        if user and is_mobile_customer_user(user):
            CustomerPasswordResetRequest.objects.filter(user=user, is_used=False).update(is_used=True, used_at=timezone.now())
            request = CustomerPasswordResetRequest(user=user, expires_at=timezone.now())
            code = request.set_code()
            request.save()
            try:
                send_password_reset_email(user, code)
            except EmailDeliveryError as exc:
                raise email_delivery_validation_error(exc.detail) from exc
        return None


class MobileVerifyResetCodeSerializer(serializers.Serializer):
    email = serializers.EmailField()
    verification_code = serializers.RegexField(r'^\d{6}$')

    def save(self):
        email = self.validated_data['email'].strip().lower()
        user = User.objects.filter(email__iexact=email, is_active=True, is_staff=False, is_superuser=False).first()
        if not user:
            raise serializers.ValidationError({'detail': 'Invalid or expired reset code.'})
        reset = CustomerPasswordResetRequest.objects.filter(user=user, is_used=False).order_by('-created_at').first()
        if not reset or reset.is_expired or reset.attempts >= 5:
            raise serializers.ValidationError({'detail': 'Invalid or expired reset code.'})
        if not reset.check_code(self.validated_data['verification_code']):
            reset.attempts += 1
            reset.save(update_fields=['attempts'])
            raise serializers.ValidationError({'detail': 'Invalid or expired reset code.'})
        reset.is_verified = True
        reset.verified_at = timezone.now()
        reset.save(update_fields=['is_verified', 'verified_at'])
        token = signing.dumps({'reset_id': reset.id, 'user_id': user.id}, salt='bayad-mobile-reset')
        return {'reset_token': token, 'expires_in': 600}


class MobileResetPasswordSerializer(serializers.Serializer):
    reset_token = serializers.CharField()
    new_password = serializers.CharField(write_only=True, trim_whitespace=False)
    confirm_password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        if attrs['new_password'] != attrs['confirm_password']:
            raise serializers.ValidationError({'confirm_password': 'Passwords do not match.'})
        try:
            payload = signing.loads(attrs['reset_token'], salt='bayad-mobile-reset', max_age=600)
            reset = CustomerPasswordResetRequest.objects.select_related('user').get(pk=payload['reset_id'], user_id=payload['user_id'], is_verified=True, is_used=False)
        except (signing.BadSignature, CustomerPasswordResetRequest.DoesNotExist, KeyError) as exc:
            raise serializers.ValidationError({'detail': 'Invalid or expired reset token.'}) from exc
        if reset.is_expired:
            raise serializers.ValidationError({'detail': 'Invalid or expired reset token.'})
        password = attrs['new_password']
        if not (any(char.isupper() for char in password) and any(char.islower() for char in password) and any(char.isdigit() for char in password)):
            raise serializers.ValidationError({'new_password': 'Password must include uppercase, lowercase, and number characters.'})
        try:
            validate_password(password, reset.user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({'new_password': list(exc.messages)}) from exc
        attrs['reset'] = reset
        return attrs

    def save(self):
        reset = self.validated_data['reset']
        user = reset.user
        user.set_password(self.validated_data['new_password'])
        user.save(update_fields=['password'])
        reset.is_used = True
        reset.used_at = timezone.now()
        reset.save(update_fields=['is_used', 'used_at'])
        return user


class MobileProductUnitSerializer(serializers.ModelSerializer):
    available_quantity = serializers.SerializerMethodField()
    is_available = serializers.SerializerMethodField()

    class Meta:
        model = ProductUnit
        fields = ('id', 'unit', 'selling_price', 'is_default', 'available_quantity', 'is_available')

    def get_available_quantity(self, obj):
        return quantity(product_unit_available_quantity(obj.product, obj.unit))

    def get_is_available(self, obj):
        return product_unit_available_quantity(obj.product, obj.unit) > 0


class MobileProductSerializer(serializers.ModelSerializer):
    units = serializers.SerializerMethodField()
    stock_status = serializers.SerializerMethodField()
    image = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = ('id', 'code', 'name_en', 'name_ar', 'category', 'description', 'image', 'units', 'stock_status')

    def get_units(self, obj):
        units = obj.units.filter(is_active=True).order_by('-is_default', 'unit')
        return MobileProductUnitSerializer(units, many=True).data

    def get_stock_status(self, obj):
        has_stock = Inventory.objects.filter(
            warehouse__is_active=True,
            warehouse__is_deleted=False,
            product=obj,
            quantity__gt=0,
        ).exists()
        return 'available' if has_stock else 'unavailable'

    def get_image(self, obj):
        image = getattr(obj, 'image', None)
        if not image:
            return None
        try:
            return image.url
        except ValueError:
            return None


class MobileOrderItemSerializer(serializers.ModelSerializer):
    product = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = (
            'id',
            'product',
            'product_unit',
            'product_code_snapshot',
            'product_name_en_snapshot',
            'product_name_ar_snapshot',
            'unit_snapshot',
            'quantity',
            'unit_price',
            'line_total',
        )

    def get_product(self, obj):
        return {
            'id': obj.product_id,
            'code': obj.product_code_snapshot,
            'name_en': obj.product_name_en_snapshot,
            'name_ar': obj.product_name_ar_snapshot,
        }


class MobileInvoiceSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Invoice
        fields = ('id', 'invoice_number', 'status', 'payment_status', 'total_amount', 'currency', 'issued_at', 'paid_at')


class MobileShipmentSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Shipment
        fields = ('id', 'shipment_number', 'status', 'driver_name', 'vehicle_number', 'started_at', 'completed_at')


class MobileOrderListSerializer(serializers.ModelSerializer):
    item_count = serializers.SerializerMethodField()
    product_summary = serializers.SerializerMethodField()
    invoice = serializers.SerializerMethodField()
    shipment = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = (
            'id',
            'order_number',
            'status',
            'item_count',
            'product_summary',
            'total_amount',
            'currency',
            'created_at',
            'invoice',
            'shipment',
        )

    def get_item_count(self, obj):
        return obj.items.count()

    def get_product_summary(self, obj):
        items = list(obj.items.all())
        if not items:
            return ''
        first = items[0].product_name_en_snapshot
        return f'{first} + {len(items) - 1} more' if len(items) > 1 else first

    def get_invoice(self, obj):
        invoice = obj.invoices.exclude(status=Invoice.STATUS_CANCELLED).first()
        return MobileInvoiceSummarySerializer(invoice).data if invoice else None

    def get_shipment(self, obj):
        shipment = obj.shipments.exclude(status=Shipment.STATUS_CANCELLED).first()
        return MobileShipmentSummarySerializer(shipment).data if shipment else None


class MobileOrderDetailSerializer(MobileOrderListSerializer):
    items = MobileOrderItemSerializer(many=True, read_only=True)
    workflow_steps = serializers.SerializerMethodField()

    class Meta(MobileOrderListSerializer.Meta):
        fields = MobileOrderListSerializer.Meta.fields + (
            'source_channel',
            'customer_reference',
            'customer_notes',
            'items',
            'subtotal',
            'discount_amount',
            'workflow_steps',
        )

    def get_workflow_steps(self, obj):
        return workflow_steps('order', obj.status)


class MobileOrderCreateItemSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    product_unit_id = serializers.IntegerField()
    quantity = serializers.CharField()


class MobileOrderCreateSerializer(serializers.Serializer):
    customer_reference = serializers.CharField(required=False, allow_blank=True, max_length=120)
    customer_notes = serializers.CharField(required=False, allow_blank=True)
    items = MobileOrderCreateItemSerializer(many=True)

    def validate_items(self, items):
        if not items:
            raise serializers.ValidationError('At least one item is required.')
        seen = set()
        cleaned = []
        for row in items:
            product_id = row.get('product_id')
            product_unit_id = row.get('product_unit_id')
            try:
                product = Product.objects.get(id=product_id, is_active=True, is_deleted=False)
            except Product.DoesNotExist as exc:
                raise serializers.ValidationError('Product was not found.') from exc
            try:
                product_unit = ProductUnit.objects.get(id=product_unit_id, is_active=True)
            except ProductUnit.DoesNotExist as exc:
                raise serializers.ValidationError('Product unit was not found.') from exc
            if product_unit.product_id != product.id:
                raise serializers.ValidationError('Unit must belong to the selected product.')
            key = (product.id, product_unit.id)
            if key in seen:
                raise serializers.ValidationError('Duplicate product and unit lines are not allowed.')
            seen.add(key)
            qty = parse_positive_decimal(row.get('quantity'), 'quantity')
            unit_price = product_unit.selling_price
            cleaned.append({
                'product': product,
                'product_unit': product_unit,
                'product_code_snapshot': product.code,
                'product_name_en_snapshot': product.name_en,
                'product_name_ar_snapshot': product.name_ar,
                'unit_snapshot': product_unit.unit,
                'quantity': qty,
                'unit_price': unit_price,
                'line_total': (qty * unit_price).quantize(MONEY_QUANT, rounding=ROUND_HALF_UP),
            })
        return cleaned

    @transaction.atomic
    def create(self, validated_data):
        user = self.context['request'].user
        customer = user.customer_account.customer
        items = validated_data['items']
        subtotal = sum((item['line_total'] for item in items), Decimal('0.00')).quantize(MONEY_QUANT)
        order = Order.objects.create(
            customer=customer,
            status=Order.STATUS_PENDING,
            source_channel=Order.SOURCE_CUSTOMER_APP,
            customer_reference=(validated_data.get('customer_reference') or '').strip(),
            customer_notes=(validated_data.get('customer_notes') or '').strip(),
            subtotal=subtotal,
            discount_amount=Decimal('0.00'),
            total_amount=subtotal,
            currency='SDG',
            received_by=None,
            received_at=None,
            created_by=user,
        )
        OrderItem.objects.bulk_create([OrderItem(order=order, **item) for item in items])
        try:
            order.full_clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict if hasattr(exc, 'message_dict') else exc.messages) from exc
        return order


class MobileInvoiceItemSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    product = serializers.SerializerMethodField()
    unit_snapshot = serializers.CharField()
    quantity = serializers.DecimalField(max_digits=18, decimal_places=3)
    unit_price = serializers.DecimalField(max_digits=18, decimal_places=2)
    line_total = serializers.DecimalField(max_digits=18, decimal_places=2)

    def get_product(self, obj):
        return {
            'id': obj.product_id,
            'code': obj.product_code_snapshot,
            'name_en': obj.product_name_en_snapshot,
            'name_ar': obj.product_name_ar_snapshot,
        }


class MobileInvoiceListSerializer(serializers.ModelSerializer):
    order_number = serializers.CharField(source='order.order_number', read_only=True)
    product_summary = serializers.SerializerMethodField()
    payment_method = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = ('id', 'invoice_number', 'order_number', 'total_amount', 'currency', 'payment_status', 'status', 'issued_at', 'paid_at', 'payment_method', 'product_summary')

    def get_product_summary(self, obj):
        item = obj.items.first()
        return item.product_name_en_snapshot if item else ''

    def get_payment_method(self, obj):
        payment = getattr(obj, 'payment', None)
        return payment.payment_method if payment else ''


class MobileInvoiceDetailSerializer(MobileInvoiceListSerializer):
    items = MobileInvoiceItemSerializer(many=True, read_only=True)
    payment_reference = serializers.SerializerMethodField()
    shipment = serializers.SerializerMethodField()

    class Meta(MobileInvoiceListSerializer.Meta):
        fields = MobileInvoiceListSerializer.Meta.fields + ('items', 'subtotal', 'discount_amount', 'notes', 'payment_reference', 'shipment')

    def get_payment_reference(self, obj):
        payment = getattr(obj, 'payment', None)
        return payment.payment_reference if payment else ''

    def get_shipment(self, obj):
        shipment = obj.shipments.exclude(status=Shipment.STATUS_CANCELLED).first()
        return MobileShipmentSummarySerializer(shipment).data if shipment else None


class MobileShipmentItemSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    product = serializers.SerializerMethodField()
    unit_snapshot = serializers.CharField()
    requested_quantity = serializers.DecimalField(max_digits=18, decimal_places=3)
    actual_quantity = serializers.DecimalField(max_digits=18, decimal_places=3, allow_null=True)
    number_of_bags = serializers.IntegerField(allow_null=True)
    total_weight_kg = serializers.DecimalField(max_digits=18, decimal_places=3, allow_null=True)
    average_bag_weight_kg = serializers.DecimalField(max_digits=18, decimal_places=3, allow_null=True)

    def get_product(self, obj):
        return {
            'id': obj.product_id,
            'code': obj.product_code_snapshot,
            'name_en': obj.product_name_en_snapshot,
            'name_ar': obj.product_name_ar_snapshot,
        }


class MobileShipmentListSerializer(serializers.ModelSerializer):
    order_number = serializers.CharField(source='order.order_number', read_only=True)
    invoice_number = serializers.CharField(source='invoice.invoice_number', read_only=True)
    product_summary = serializers.SerializerMethodField()

    class Meta:
        model = Shipment
        fields = ('id', 'shipment_number', 'order_number', 'invoice_number', 'status', 'product_summary', 'driver_name', 'vehicle_number', 'started_at', 'completed_at')

    def get_product_summary(self, obj):
        item = obj.items.first()
        return item.product_name_en_snapshot if item else ''


class MobileShipmentDetailSerializer(MobileShipmentListSerializer):
    items = MobileShipmentItemSerializer(many=True, read_only=True)
    workflow_steps = serializers.SerializerMethodField()

    class Meta(MobileShipmentListSerializer.Meta):
        fields = MobileShipmentListSerializer.Meta.fields + ('items', 'notes', 'workflow_steps')

    def get_workflow_steps(self, obj):
        return workflow_steps('shipment', obj.status)
