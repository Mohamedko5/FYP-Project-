import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';
import '../../core/network/api_endpoints.dart';
import '../../core/network/api_exception.dart';
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
