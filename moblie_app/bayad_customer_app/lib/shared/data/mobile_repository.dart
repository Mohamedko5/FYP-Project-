import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';
import '../../core/network/api_endpoints.dart';
import '../../core/network/api_exception.dart';
import '../../features/chat/domain/chat_models.dart';
import '../../features/supply_offers/data/models/supply_offer_models.dart';
import '../models/mobile_models.dart';
import '../models/paged_response.dart';

final mobileRepositoryProvider = Provider<MobileRepository>((ref) => MobileRepository(ref.watch(dioProvider)));

class MobileRepository {
  const MobileRepository(this._dio);

  final Dio _dio;

  Future<HomeSummary> homeSummary() async {
    final response = await _getMap(ApiEndpoints.homeSummary);
    return HomeSummary.fromJson(response);
  }

  Future<PagedResponse<Product>> products({String? search, String? category, String? available, String ordering = 'name_en'}) async {
    final response = await _getMap(
      ApiEndpoints.products,
      queryParameters: {
        if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
        if (category != null && category.isNotEmpty) 'category': category,
        if (available != null && available.isNotEmpty) 'available': available,
        'ordering': ordering,
        'page_size': 50,
      },
    );
    return PagedResponse.fromJson(response, Product.fromJson);
  }

  Future<Product> product(int id) async => Product.fromJson(await _getMap(ApiEndpoints.productDetail(id)));

  Future<PagedResponse<OrderSummary>> orders({String? status}) async {
    final response = await _getMap(ApiEndpoints.orders, queryParameters: {
      if (status != null && status.isNotEmpty) 'status': status,
      'page_size': 50,
    });
    return PagedResponse.fromJson(response, OrderSummary.fromJson);
  }

  Future<OrderDetail> order(int id) async => OrderDetail.fromJson(await _getMap(ApiEndpoints.orderDetail(id)));

  Future<OrderDetail> createOrder({
    required String idempotencyKey,
    required List<Map<String, dynamic>> items,
    String customerReference = '',
    String customerNotes = '',
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        ApiEndpoints.orders,
        data: {
          'customer_reference': customerReference,
          'customer_notes': customerNotes,
          'items': items,
        },
        options: Options(headers: {'Idempotency-Key': idempotencyKey}),
      );
      return OrderDetail.fromJson(response.data ?? const {});
    } on DioException catch (error) {
      throw _mapDioError(error);
    }
  }

  Future<PagedResponse<InvoiceSummary>> invoices({String? status}) async {
    final response = await _getMap(ApiEndpoints.invoices, queryParameters: {
      if (status != null && status.isNotEmpty) 'payment_status': status,
      'page_size': 50,
    });
    return PagedResponse.fromJson(response, InvoiceSummary.fromJson);
  }

  Future<InvoiceDetail> invoice(int id) async => InvoiceDetail.fromJson(await _getMap(ApiEndpoints.invoiceDetail(id)));

  Future<PagedResponse<ShipmentSummary>> shipments({String? status}) async {
    final response = await _getMap(ApiEndpoints.shipments, queryParameters: {
      if (status != null && status.isNotEmpty) 'status': status,
      'page_size': 50,
    });
    return PagedResponse.fromJson(response, ShipmentSummary.fromJson);
  }

  Future<ShipmentDetail> shipment(int id) async => ShipmentDetail.fromJson(await _getMap(ApiEndpoints.shipmentDetail(id)));

  Future<List<ChatMessage>> chatMessages() async {
    final response = await _getMap(ApiEndpoints.chatMessages, queryParameters: {'page_size': 50});
    return (response['results'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(ChatMessage.fromJson)
        .toList()
        .reversed
        .toList();
  }

  Future<int> chatUnreadCount() async {
    final response = await _getMap(ApiEndpoints.chatUnreadCount);
    return response['unread_count'] as int? ?? 0;
  }

  Future<void> markChatRead() async {
    try {
      await _dio.post<Map<String, dynamic>>(ApiEndpoints.chatRead);
    } on DioException catch (error) {
      throw _mapDioError(error);
    }
  }

  Future<ChatMessage> sendChatText({required String body, required String clientMessageId}) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        ApiEndpoints.chatMessages,
        data: {'body': body, 'client_message_id': clientMessageId},
      );
      return ChatMessage.fromJson(response.data ?? const {});
    } on DioException catch (error) {
      throw _mapDioError(error);
    }
  }

  Future<ChatMessage> sendChatAttachment({
    required String path,
    required String filename,
    required String body,
    required String clientMessageId,
  }) async {
    try {
      final formData = FormData.fromMap({
        'body': body,
        'client_message_id': clientMessageId,
        'attachment': await MultipartFile.fromFile(path, filename: filename),
      });
      final response = await _dio.post<Map<String, dynamic>>(
        ApiEndpoints.chatMessages,
        data: formData,
        options: Options(contentType: Headers.multipartFormDataContentType),
      );
      return ChatMessage.fromJson(response.data ?? const {});
    } on DioException catch (error) {
      throw _mapDioError(error);
    }
  }

  Future<ChatMessage> shareCustomerCard({required String clientMessageId}) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        ApiEndpoints.chatCustomerCard,
        data: {'client_message_id': clientMessageId},
      );
      return ChatMessage.fromJson(response.data ?? const {});
    } on DioException catch (error) {
      throw _mapDioError(error);
    }
  }

  Future<PagedResponse<SupplyOffer>> supplyOffers({String? status}) async {
    final response = await _getMap(ApiEndpoints.supplyOffers, queryParameters: {
      if (status != null && status.isNotEmpty) 'status': status,
      'page_size': 50,
    });
    return PagedResponse.fromJson(response, SupplyOffer.fromJson);
  }

  Future<SupplyOffer> supplyOffer(int id) async {
    final offer = SupplyOffer.fromJson(await _getMap(ApiEndpoints.supplyOfferDetail(id)));
    if (offer.hasUnreadResponse && offer.currentResponseId > 0) {
      await supplyOfferResponseAction(offer.id, offer.currentResponseId, 'read');
      return SupplyOffer.fromJson(await _getMap(ApiEndpoints.supplyOfferDetail(id)));
    }
    return offer;
  }

  Future<SupplyOffer> createSupplyOffer({required String idempotencyKey, required Map<String, dynamic> data}) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        ApiEndpoints.supplyOffers,
        data: data,
        options: Options(headers: {'Idempotency-Key': idempotencyKey}),
      );
      return SupplyOffer.fromJson(response.data ?? const {});
    } on DioException catch (error) {
      throw _mapDioError(error);
    }
  }

  Future<SupplyOffer> supplyOfferAction(int id, String action) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(ApiEndpoints.supplyOfferAction(id, action));
      return SupplyOffer.fromJson(response.data ?? const {});
    } on DioException catch (error) {
      throw _mapDioError(error);
    }
  }

  Future<SupplyOffer> supplyOfferResponseAction(int offerId, int responseId, String action, {Map<String, dynamic>? data}) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(ApiEndpoints.supplyOfferResponseAction(offerId, responseId, action), data: data);
      return SupplyOffer.fromJson(response.data ?? const {});
    } on DioException catch (error) {
      throw _mapDioError(error);
    }
  }

  Future<void> uploadSupplyOfferAttachment(int id, String path, String filename) async {
    try {
      final formData = FormData.fromMap({
        'attachment_type': filename.toLowerCase().endsWith('.pdf') ? 'quality_document' : 'product_image',
        'file': await MultipartFile.fromFile(path, filename: filename),
      });
      await _dio.post<Map<String, dynamic>>(
        ApiEndpoints.supplyOfferAttachments(id),
        data: formData,
        options: Options(contentType: Headers.multipartFormDataContentType),
      );
    } on DioException catch (error) {
      throw _mapDioError(error);
    }
  }

  Future<Map<String, dynamic>> _getMap(String path, {Map<String, dynamic>? queryParameters}) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(path, queryParameters: queryParameters);
      return response.data ?? const {};
    } on DioException catch (error) {
      throw _mapDioError(error);
    }
  }

  ApiException _mapDioError(DioException error) {
    final data = error.response?.data;
    if (data is Map<String, dynamic>) {
      final detail = data['detail'];
      if (detail is String && detail.isNotEmpty) return ApiException(detail, statusCode: error.response?.statusCode);
    }
    if (error.type == DioExceptionType.connectionError ||
        error.type == DioExceptionType.connectionTimeout ||
        error.type == DioExceptionType.receiveTimeout ||
        error.type == DioExceptionType.sendTimeout) {
      return const ApiException('Unable to connect to the server.');
    }
    return const ApiException('Something went wrong. Please try again.');
  }
}
