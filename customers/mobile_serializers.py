from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from django.contrib.auth import authenticate, get_user_model
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import Sum
from rest_framework import serializers

from inventory.models import Inventory, Product, ProductUnit
from invoices.models import Invoice
from orders.models import Order, OrderItem
from shipments.models import Shipment

from .models import Customer, CustomerAccount
from .permissions import is_mobile_customer_user


User = get_user_model()
MONEY_QUANT = Decimal('0.01')
QTY_QUANT = Decimal('0.001')


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
