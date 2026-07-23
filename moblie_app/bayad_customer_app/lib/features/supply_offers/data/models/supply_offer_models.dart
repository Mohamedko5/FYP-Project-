import '../../../../shared/models/mobile_models.dart';

class SupplyOfferItem {
  const SupplyOfferItem({
    required this.id,
    required this.productName,
    required this.unit,
    required this.quantity,
    required this.customerPrice,
    required this.lineTotal,
    required this.adminPrice,
    required this.agreedPrice,
    required this.qualityGrade,
    required this.packagingDetails,
  });

  final int id;
  final String productName;
  final String unit;
  final double quantity;
  final double customerPrice;
  final double lineTotal;
  final double adminPrice;
  final double agreedPrice;
  final String qualityGrade;
  final String packagingDetails;

  factory SupplyOfferItem.fromJson(Map<String, dynamic> json) => SupplyOfferItem(
        id: readInt(json, 'id'),
        productName: readString(json, 'product_name_snapshot'),
        unit: readString(json, 'unit_snapshot'),
        quantity: readDouble(json, 'quantity'),
        customerPrice: readDouble(json, 'customer_proposed_unit_price'),
        lineTotal: readDouble(json, 'customer_proposed_line_total'),
        adminPrice: readDouble(json, 'admin_proposed_unit_price'),
        agreedPrice: readDouble(json, 'agreed_unit_price'),
        qualityGrade: readString(json, 'quality_grade'),
        packagingDetails: readString(json, 'packaging_details'),
      );
}

class SupplyOfferAttachment {
  const SupplyOfferAttachment({required this.id, required this.originalFilename, required this.mimeType, required this.downloadUrl});

  final int id;
  final String originalFilename;
  final String mimeType;
  final String downloadUrl;

  factory SupplyOfferAttachment.fromJson(Map<String, dynamic> json) => SupplyOfferAttachment(
        id: readInt(json, 'id'),
        originalFilename: readString(json, 'original_filename'),
        mimeType: readString(json, 'mime_type'),
        downloadUrl: readString(json, 'download_url'),
      );
}

class SupplyOfferTimelineEntry {
  const SupplyOfferTimelineEntry({required this.status, required this.note, required this.createdAt});

  final String status;
  final String note;
  final DateTime? createdAt;

  factory SupplyOfferTimelineEntry.fromJson(Map<String, dynamic> json) => SupplyOfferTimelineEntry(
        status: readString(json, 'new_status'),
        note: readString(json, 'customer_safe_note'),
        createdAt: DateTime.tryParse(readString(json, 'created_at')),
      );
}

class OfferResponseItem {
  const OfferResponseItem({
    required this.productName,
    required this.unit,
    required this.customerQuantity,
    required this.adminQuantity,
    required this.customerPrice,
    required this.adminPrice,
    required this.customerTotal,
    required this.adminTotal,
  });

  final String productName;
  final String unit;
  final double customerQuantity;
  final double adminQuantity;
  final double customerPrice;
  final double adminPrice;
  final double customerTotal;
  final double adminTotal;

  factory OfferResponseItem.fromJson(Map<String, dynamic> json) => OfferResponseItem(
        productName: readString(json, 'product_name'),
        unit: readString(json, 'unit'),
        customerQuantity: readDouble(json, 'customer_quantity'),
        adminQuantity: readDouble(json, 'admin_proposed_quantity'),
        customerPrice: readDouble(json, 'customer_unit_price'),
        adminPrice: readDouble(json, 'admin_proposed_unit_price'),
        customerTotal: readDouble(json, 'customer_line_total'),
        adminTotal: readDouble(json, 'admin_proposed_line_total'),
      );
}

class OfferResponse {
  const OfferResponse({
    required this.id,
    required this.responseNumber,
    required this.status,
    required this.message,
    required this.proposedTotal,
    required this.proposedReceiptDate,
    required this.warehouseName,
    required this.expiresAt,
    required this.createdAt,
    required this.items,
  });

  final int id;
  final String responseNumber;
  final String status;
  final String message;
  final double proposedTotal;
  final String proposedReceiptDate;
  final String warehouseName;
  final String expiresAt;
  final String createdAt;
  final List<OfferResponseItem> items;

  factory OfferResponse.fromJson(Map<String, dynamic> json) => OfferResponse(
        id: readInt(json, 'id'),
        responseNumber: readString(json, 'response_number'),
        status: readString(json, 'status'),
        message: readString(json, 'customer_safe_message'),
        proposedTotal: readDouble(json, 'proposed_total'),
        proposedReceiptDate: readString(json, 'proposed_receipt_date'),
        warehouseName: readString(json, 'proposed_receiving_warehouse_name'),
        expiresAt: readString(json, 'expires_at'),
        createdAt: readString(json, 'created_at'),
        items: (json['items'] as List<dynamic>? ?? const []).whereType<Map<String, dynamic>>().map(OfferResponseItem.fromJson).toList(),
      );
}

class SupplyOffer {
  const SupplyOffer({
    required this.id,
    required this.offerNumber,
    required this.status,
    required this.productSummary,
    required this.customerReference,
    required this.region,
    required this.city,
    required this.area,
    required this.detailedAddress,
    required this.availabilityDate,
    required this.customerNotes,
    required this.adminMessage,
    required this.rejectionReason,
    required this.proposedTotal,
    required this.adminProposedTotal,
    required this.agreedTotal,
    required this.currency,
    required this.createdAt,
    required this.items,
    required this.attachments,
    required this.timeline,
    required this.currentResponse,
    required this.paymentStatus,
    required this.paidAmount,
    required this.latestAdminMessage,
    required this.currentResponseId,
    required this.currentResponseStatus,
    required this.hasUnreadResponse,
    required this.unreadResponseCount,
    required this.requiresCustomerAction,
    required this.allowedActions,
  });

  final int id;
  final String offerNumber;
  final String status;
  final String productSummary;
  final String customerReference;
  final String region;
  final String city;
  final String area;
  final String detailedAddress;
  final String availabilityDate;
  final String customerNotes;
  final String adminMessage;
  final String rejectionReason;
  final double proposedTotal;
  final double adminProposedTotal;
  final double agreedTotal;
  final String currency;
  final DateTime? createdAt;
  final List<SupplyOfferItem> items;
  final List<SupplyOfferAttachment> attachments;
  final List<SupplyOfferTimelineEntry> timeline;
  final OfferResponse? currentResponse;
  final String paymentStatus;
  final double paidAmount;
  final String latestAdminMessage;
  final int currentResponseId;
  final String currentResponseStatus;
  final bool hasUnreadResponse;
  final int unreadResponseCount;
  final bool requiresCustomerAction;
  final Map<String, dynamic> allowedActions;

  factory SupplyOffer.fromJson(Map<String, dynamic> json) => SupplyOffer(
        id: readInt(json, 'id'),
        offerNumber: readString(json, 'offer_number'),
        status: readString(json, 'status'),
        productSummary: readString(json, 'product_summary'),
        customerReference: readString(json, 'customer_reference'),
        region: readString(json, 'region'),
        city: readString(json, 'city'),
        area: readString(json, 'area'),
        detailedAddress: readString(json, 'detailed_address'),
        availabilityDate: readString(json, 'availability_date'),
        customerNotes: readString(json, 'customer_notes'),
        adminMessage: readString(json, 'customer_safe_admin_message'),
        rejectionReason: readString(json, 'rejection_reason'),
        proposedTotal: readDouble(json, 'proposed_total'),
        adminProposedTotal: readDouble(json, 'admin_proposed_total'),
        agreedTotal: readDouble(json, 'agreed_total'),
        currency: readString(json, 'currency').isEmpty ? 'SDG' : readString(json, 'currency'),
        createdAt: DateTime.tryParse(readString(json, 'created_at')),
        items: (json['items'] as List<dynamic>? ?? const []).whereType<Map<String, dynamic>>().map(SupplyOfferItem.fromJson).toList(),
        attachments: (json['attachments'] as List<dynamic>? ?? const []).whereType<Map<String, dynamic>>().map(SupplyOfferAttachment.fromJson).toList(),
        timeline: (json['timeline'] as List<dynamic>? ?? const []).whereType<Map<String, dynamic>>().map(SupplyOfferTimelineEntry.fromJson).toList(),
        currentResponse: json['current_response'] is Map<String, dynamic> ? OfferResponse.fromJson(json['current_response'] as Map<String, dynamic>) : null,
        paymentStatus: readString(json, 'payment_status'),
        paidAmount: readDouble(json, 'paid_amount'),
        latestAdminMessage: readString(json, 'latest_admin_message'),
        currentResponseId: readInt(json, 'current_response_id'),
        currentResponseStatus: readString(json, 'current_response_status'),
        hasUnreadResponse: json['has_unread_response'] == true,
        unreadResponseCount: readInt(json, 'unread_response_count'),
        requiresCustomerAction: json['requires_customer_action'] == true,
        allowedActions: json['allowed_actions'] as Map<String, dynamic>? ?? const {},
      );

  bool get canAcceptResponse => allowedActions['can_accept_response'] == true;
  bool get canRejectResponse => allowedActions['can_reject_response'] == true;
}
