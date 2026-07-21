import 'package:dio/dio.dart';

import '../../../core/network/api_endpoints.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/storage/secure_storage_service.dart';
import '../../profile/domain/customer.dart';

class AuthRepository {
  AuthRepository({
    required Dio dio,
    required SecureStorageService storage,
  })  : _dio = dio,
        _storage = storage;

  final Dio _dio;
  final SecureStorageService _storage;

  Future<Customer> login({required String email, required String password}) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        ApiEndpoints.mobileLogin,
        data: {'email': email, 'password': password},
      );
      final data = response.data ?? {};
      final access = data['access'] as String?;
      final refresh = data['refresh'] as String?;
      final customerJson = data['customer'];
      if (access == null || refresh == null || customerJson is! Map<String, dynamic>) {
        throw const ApiException('Invalid API response.');
      }
      await _storage.saveTokens(access: access, refresh: refresh);
      return Customer.fromJson(customerJson);
    } on DioException catch (error) {
      throw _mapDioError(error);
    }
  }

  Future<Customer> me() async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(ApiEndpoints.mobileMe);
      return Customer.fromJson(response.data ?? {});
    } on DioException catch (error) {
      throw _mapDioError(error);
    }
  }

  Future<void> logout() async {
    final refresh = await _storage.readRefreshToken();
    try {
      if (refresh != null) {
        await _dio.post<Map<String, dynamic>>(ApiEndpoints.mobileLogout, data: {'refresh': refresh});
      }
    } on DioException {
      // Local logout still clears secure tokens even when the server is unavailable.
    } finally {
      await _storage.clearTokens();
    }
  }

  Future<void> clearTokens() => _storage.clearTokens();

  ApiException _mapDioError(DioException error) {
    final statusCode = error.response?.statusCode;
    final data = error.response?.data;
    if (data is Map<String, dynamic>) {
      final detail = data['detail'];
      if (detail is String && detail.isNotEmpty) {
        return ApiException(detail, statusCode: statusCode);
      }
      if (data.isNotEmpty) {
        return ApiException(data.values.first.toString(), statusCode: statusCode);
      }
    }
    if (error.type == DioExceptionType.connectionTimeout ||
        error.type == DioExceptionType.receiveTimeout ||
        error.type == DioExceptionType.sendTimeout ||
        error.type == DioExceptionType.connectionError) {
      return const ApiException('Unable to connect to the server.');
    }
    if (statusCode == 401) return const ApiException('Your session has expired.', statusCode: 401);
    return ApiException('Something went wrong. Please try again.', statusCode: statusCode);
  }
}
