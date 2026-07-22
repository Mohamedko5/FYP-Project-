class ChatAttachment {
  const ChatAttachment({
    required this.id,
    required this.originalFilename,
    required this.mimeType,
    required this.fileSize,
    required this.attachmentType,
    required this.downloadUrl,
  });

  final int id;
  final String originalFilename;
  final String mimeType;
  final int fileSize;
  final String attachmentType;
  final String downloadUrl;

  factory ChatAttachment.fromJson(Map<String, dynamic> json) => ChatAttachment(
        id: json['id'] as int? ?? 0,
        originalFilename: json['original_filename'] as String? ?? '',
        mimeType: json['mime_type'] as String? ?? '',
        fileSize: json['file_size'] as int? ?? 0,
        attachmentType: json['attachment_type'] as String? ?? '',
        downloadUrl: json['download_url'] as String? ?? '',
      );
}

class CustomerCardSnapshot {
  const CustomerCardSnapshot({
    required this.customerId,
    required this.customerCode,
    required this.customerName,
    required this.businessName,
    required this.customerType,
    required this.email,
    required this.phone,
    required this.secondaryPhone,
    required this.address,
    required this.profileImageUrl,
    required this.accountStatus,
  });

  final int customerId;
  final String customerCode;
  final String customerName;
  final String businessName;
  final String customerType;
  final String email;
  final String phone;
  final String secondaryPhone;
  final String address;
  final String? profileImageUrl;
  final String accountStatus;

  factory CustomerCardSnapshot.fromJson(Map<String, dynamic> json) => CustomerCardSnapshot(
        customerId: json['customer_id'] as int? ?? 0,
        customerCode: json['customer_code'] as String? ?? '',
        customerName: json['customer_name'] as String? ?? '',
        businessName: json['business_name'] as String? ?? '',
        customerType: json['customer_type'] as String? ?? '',
        email: json['email'] as String? ?? '',
        phone: json['phone'] as String? ?? '',
        secondaryPhone: json['secondary_phone'] as String? ?? '',
        address: json['address'] as String? ?? '',
        profileImageUrl: json['profile_image_url'] as String?,
        accountStatus: json['account_status'] as String? ?? '',
      );
}

class ChatMessage {
  const ChatMessage({
    required this.id,
    required this.conversationId,
    required this.senderType,
    required this.messageType,
    required this.body,
    required this.createdAt,
    required this.customerReadAt,
    required this.adminReadAt,
    required this.attachments,
    this.cardSnapshot,
  });

  final int id;
  final int conversationId;
  final String senderType;
  final String messageType;
  final String body;
  final DateTime? createdAt;
  final DateTime? customerReadAt;
  final DateTime? adminReadAt;
  final List<ChatAttachment> attachments;
  final CustomerCardSnapshot? cardSnapshot;

  factory ChatMessage.fromJson(Map<String, dynamic> json) => ChatMessage(
        id: json['id'] as int? ?? 0,
        conversationId: json['conversation'] as int? ?? 0,
        senderType: json['sender_type'] as String? ?? '',
        messageType: json['message_type'] as String? ?? '',
        body: json['body'] as String? ?? '',
        createdAt: DateTime.tryParse(json['created_at'] as String? ?? ''),
        customerReadAt: DateTime.tryParse(json['customer_read_at'] as String? ?? ''),
        adminReadAt: DateTime.tryParse(json['admin_read_at'] as String? ?? ''),
        attachments: (json['attachments'] as List<dynamic>? ?? const []).whereType<Map<String, dynamic>>().map(ChatAttachment.fromJson).toList(),
        cardSnapshot: json['card_snapshot'] is Map<String, dynamic> ? CustomerCardSnapshot.fromJson(json['card_snapshot'] as Map<String, dynamic>) : null,
      );
}
