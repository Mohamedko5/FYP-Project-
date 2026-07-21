import '../../features/profile/domain/customer.dart';

String readString(Map<String, dynamic> json, String key) => json[key]?.toString() ?? '';
int readInt(Map<String, dynamic> json, String key) => json[key] is int ? json[key] as int : int.tryParse(json[key]?.toString() ?? '') ?? 0;
double readDouble(Map<String, dynamic> json, String key) => double.tryParse(json[key]?.toString() ?? '') ?? 0;

class ProductUnitOption {
  const ProductUnitOption({
    required this.id,
    required this.unit,
    required this.sellingPrice,
    required this.isDefault,
    required this.availableQuantity,
    required this.isAvailable,
  });

  final int id;
  final String unit;
  final double sellingPrice;
  final bool isDefault;
  final double availableQuantity;
  final bool isAvailable;

  factory ProductUnitOption.fromJson(Map<String, dynamic> json) => ProductUnitOption(
        id: readInt(json, 'id'),
        unit: readString(json, 'unit'),
        sellingPrice: readDouble(json, 'selling_price'),
        isDefault: json['is_default'] == true,
        availableQuantity: readDouble(json, 'available_quantity'),
        isAvailable: json['is_available'] == true,
      );
}

class Product {
  const Product({
    required this.id,
    required this.code,
    required this.nameEn,
    required this.nameAr,
    required this.category,
    required this.description,
    required this.image,
    required this.units,
    required this.stockStatus,
  });

  final int id;
  final String code;
  final String nameEn;
  final String nameAr;
  final String category;
  final String description;
  final String? image;
  final List<ProductUnitOption> units;
  final String stockStatus;

  factory Product.fromJson(Map<String, dynamic> json) => Product(
        id: readInt(json, 'id'),
        code: readString(json, 'code'),
        nameEn: readString(json, 'name_en'),
        nameAr: readString(json, 'name_ar'),
        category: readString(json, 'category'),
        description: readString(json, 'description'),
        image: json['image'] as String?,
        units: (json['units'] as List<dynamic>? ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(ProductUnitOption.fromJson)
            .toList(),
        stockStatus: readString(json, 'stock_status'),
      );

  String localizedName(bool isArabic) => isArabic && nameAr.isNotEmpty ? nameAr : nameEn;
  double get startingPrice => units.isEmpty ? 0 : units.map((unit) => unit.sellingPrice).reduce((a, b) => a < b ? a : b);
}

class OrderItemModel {
  const OrderItemModel({
    required this.id,
    required this.productNameEn,
    required this.productNameAr,
    required this.unit,
    required this.quantity,
    required this.unitPrice,
    required this.lineTotal,
  });

  final int id;
  final String productNameEn;
  final String productNameAr;
  final String unit;
  final double quantity;
  final double unitPrice;
  final double lineTotal;

  factory OrderItemModel.fromJson(Map<String, dynamic> json) => OrderItemModel(
        id: readInt(json, 'id'),
        productNameEn: readString(json, 'product_name_en_snapshot'),
        productNameAr: readString(json, 'product_name_ar_snapshot'),
        unit: readString(json, 'unit_snapshot'),
        quantity: readDouble(json, 'quantity'),
        unitPrice: readDouble(json, 'unit_price'),
        lineTotal: readDouble(json, 'line_total'),
      );

  String localizedName(bool isArabic) => isArabic && productNameAr.isNotEmpty ? productNameAr : productNameEn;
}

class WorkflowStepModel {
  const WorkflowStepModel({required this.key, required this.label, required this.state});
  final String key;
  final String label;
  final String state;
  factory WorkflowStepModel.fromJson(Map<String, dynamic> json) => WorkflowStepModel(
        key: readString(json, 'key'),
        label: readString(json, 'label'),
        state: readString(json, 'state'),
      );
}

class OrderSummary {
  const OrderSummary({
    required this.id,
    required this.orderNumber,
    required this.status,
    required this.itemCount,
    required this.productSummary,
    required this.totalAmount,
    required this.currency,
    required this.createdAt,
  });

  final int id;
  final String orderNumber;
  final String status;
  final int itemCount;
  final String productSummary;
  final double totalAmount;
  final String currency;
  final DateTime? createdAt;

  factory OrderSummary.fromJson(Map<String, dynamic> json) => OrderSummary(
        id: readInt(json, 'id'),
        orderNumber: readString(json, 'order_number'),
        status: readString(json, 'status'),
        itemCount: readInt(json, 'item_count'),
        productSummary: readString(json, 'product_summary'),
        totalAmount: readDouble(json, 'total_amount'),
        currency: readString(json, 'currency').isEmpty ? 'SDG' : readString(json, 'currency'),
        createdAt: DateTime.tryParse(readString(json, 'created_at')),
      );
}

class OrderDetail extends OrderSummary {
  const OrderDetail({
    required super.id,
    required super.orderNumber,
    required super.status,
    required super.itemCount,
    required super.productSummary,
    required super.totalAmount,
    required super.currency,
    required super.createdAt,
    required this.customerReference,
    required this.customerNotes,
    required this.subtotal,
    required this.discountAmount,
    required this.items,
    required this.workflowSteps,
  });

  final String customerReference;
  final String customerNotes;
  final double subtotal;
  final double discountAmount;
  final List<OrderItemModel> items;
  final List<WorkflowStepModel> workflowSteps;

  factory OrderDetail.fromJson(Map<String, dynamic> json) => OrderDetail(
        id: readInt(json, 'id'),
        orderNumber: readString(json, 'order_number'),
        status: readString(json, 'status'),
        itemCount: readInt(json, 'item_count'),
        productSummary: readString(json, 'product_summary'),
        totalAmount: readDouble(json, 'total_amount'),
        currency: readString(json, 'currency').isEmpty ? 'SDG' : readString(json, 'currency'),
        createdAt: DateTime.tryParse(readString(json, 'created_at')),
        customerReference: readString(json, 'customer_reference'),
        customerNotes: readString(json, 'customer_notes'),
        subtotal: readDouble(json, 'subtotal'),
        discountAmount: readDouble(json, 'discount_amount'),
        items: (json['items'] as List<dynamic>? ?? const []).whereType<Map<String, dynamic>>().map(OrderItemModel.fromJson).toList(),
        workflowSteps: (json['workflow_steps'] as List<dynamic>? ?? const []).whereType<Map<String, dynamic>>().map(WorkflowStepModel.fromJson).toList(),
      );
}

class InvoiceSummary {
  const InvoiceSummary({
    required this.id,
    required this.invoiceNumber,
    required this.orderNumber,
    required this.status,
    required this.paymentStatus,
    required this.totalAmount,
    required this.currency,
    required this.issuedAt,
    required this.productSummary,
  });

  final int id;
  final String invoiceNumber;
  final String orderNumber;
  final String status;
  final String paymentStatus;
  final double totalAmount;
  final String currency;
  final DateTime? issuedAt;
  final String productSummary;

  factory InvoiceSummary.fromJson(Map<String, dynamic> json) => InvoiceSummary(
        id: readInt(json, 'id'),
        invoiceNumber: readString(json, 'invoice_number'),
        orderNumber: readString(json, 'order_number'),
        status: readString(json, 'status'),
        paymentStatus: readString(json, 'payment_status'),
        totalAmount: readDouble(json, 'total_amount'),
        currency: readString(json, 'currency').isEmpty ? 'SDG' : readString(json, 'currency'),
        issuedAt: DateTime.tryParse(readString(json, 'issued_at')),
        productSummary: readString(json, 'product_summary'),
      );
}

class InvoiceDetail extends InvoiceSummary {
  const InvoiceDetail({
    required super.id,
    required super.invoiceNumber,
    required super.orderNumber,
    required super.status,
    required super.paymentStatus,
    required super.totalAmount,
    required super.currency,
    required super.issuedAt,
    required super.productSummary,
    required this.subtotal,
    required this.discountAmount,
    required this.notes,
    required this.items,
  });

  final double subtotal;
  final double discountAmount;
  final String notes;
  final List<OrderItemModel> items;

  factory InvoiceDetail.fromJson(Map<String, dynamic> json) => InvoiceDetail(
        id: readInt(json, 'id'),
        invoiceNumber: readString(json, 'invoice_number'),
        orderNumber: readString(json, 'order_number'),
        status: readString(json, 'status'),
        paymentStatus: readString(json, 'payment_status'),
        totalAmount: readDouble(json, 'total_amount'),
        currency: readString(json, 'currency').isEmpty ? 'SDG' : readString(json, 'currency'),
        issuedAt: DateTime.tryParse(readString(json, 'issued_at')),
        productSummary: readString(json, 'product_summary'),
        subtotal: readDouble(json, 'subtotal'),
        discountAmount: readDouble(json, 'discount_amount'),
        notes: readString(json, 'notes'),
        items: (json['items'] as List<dynamic>? ?? const []).whereType<Map<String, dynamic>>().map(OrderItemModel.fromJson).toList(),
      );
}

class ShipmentSummary {
  const ShipmentSummary({
    required this.id,
    required this.shipmentNumber,
    required this.orderNumber,
    required this.invoiceNumber,
    required this.status,
    required this.productSummary,
    required this.driverName,
    required this.vehicleNumber,
    required this.startedAt,
    required this.completedAt,
  });

  final int id;
  final String shipmentNumber;
  final String orderNumber;
  final String invoiceNumber;
  final String status;
  final String productSummary;
  final String driverName;
  final String vehicleNumber;
  final DateTime? startedAt;
  final DateTime? completedAt;

  factory ShipmentSummary.fromJson(Map<String, dynamic> json) => ShipmentSummary(
        id: readInt(json, 'id'),
        shipmentNumber: readString(json, 'shipment_number'),
        orderNumber: readString(json, 'order_number'),
        invoiceNumber: readString(json, 'invoice_number'),
        status: readString(json, 'status'),
        productSummary: readString(json, 'product_summary'),
        driverName: readString(json, 'driver_name'),
        vehicleNumber: readString(json, 'vehicle_number'),
        startedAt: DateTime.tryParse(readString(json, 'started_at')),
        completedAt: DateTime.tryParse(readString(json, 'completed_at')),
      );
}

class ShipmentDetail extends ShipmentSummary {
  const ShipmentDetail({
    required super.id,
    required super.shipmentNumber,
    required super.orderNumber,
    required super.invoiceNumber,
    required super.status,
    required super.productSummary,
    required super.driverName,
    required super.vehicleNumber,
    required super.startedAt,
    required super.completedAt,
    required this.notes,
    required this.items,
    required this.workflowSteps,
  });

  final String notes;
  final List<OrderItemModel> items;
  final List<WorkflowStepModel> workflowSteps;

  factory ShipmentDetail.fromJson(Map<String, dynamic> json) => ShipmentDetail(
        id: readInt(json, 'id'),
        shipmentNumber: readString(json, 'shipment_number'),
        orderNumber: readString(json, 'order_number'),
        invoiceNumber: readString(json, 'invoice_number'),
        status: readString(json, 'status'),
        productSummary: readString(json, 'product_summary'),
        driverName: readString(json, 'driver_name'),
        vehicleNumber: readString(json, 'vehicle_number'),
        startedAt: DateTime.tryParse(readString(json, 'started_at')),
        completedAt: DateTime.tryParse(readString(json, 'completed_at')),
        notes: readString(json, 'notes'),
        items: (json['items'] as List<dynamic>? ?? const []).whereType<Map<String, dynamic>>().map(OrderItemModel.fromJson).toList(),
        workflowSteps: (json['workflow_steps'] as List<dynamic>? ?? const []).whereType<Map<String, dynamic>>().map(WorkflowStepModel.fromJson).toList(),
      );
}

class HomeSummary {
  const HomeSummary({
    required this.customer,
    required this.orders,
    required this.invoices,
    required this.shipments,
    required this.recentOrders,
  });

  final Customer customer;
  final Map<String, dynamic> orders;
  final Map<String, dynamic> invoices;
  final Map<String, dynamic> shipments;
  final List<OrderSummary> recentOrders;

  factory HomeSummary.fromJson(Map<String, dynamic> json) => HomeSummary(
        customer: Customer.fromJson(json['customer'] as Map<String, dynamic>? ?? const {}),
        orders: json['orders'] as Map<String, dynamic>? ?? const {},
        invoices: json['invoices'] as Map<String, dynamic>? ?? const {},
        shipments: json['shipments'] as Map<String, dynamic>? ?? const {},
        recentOrders: (json['recent_orders'] as List<dynamic>? ?? const []).whereType<Map<String, dynamic>>().map(OrderSummary.fromJson).toList(),
      );
}
