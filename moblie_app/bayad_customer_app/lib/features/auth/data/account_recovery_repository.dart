import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_endpoints.dart';
import '../../../core/network/api_exception.dart';

final accountRecoveryRepositoryProvider = Provider<AccountRecoveryRepository>((ref) => AccountRecoveryRepository(ref.watch(dioProvider)));

class RegistrationResult {
  const RegistrationResult({required this.registrationId, required this.emailMasked, required this.message});
  final int registrationId;
  final String emailMasked;
  final String message;
}

class AccountRecoveryRepository {
  const AccountRecoveryRepository(this._dio);
  final Dio _dio;

  Future<RegistrationResult> register(Map<String, dynamic> payload) async {
    final data = await _post(ApiEndpoints.mobileRegister, payload);
    return RegistrationResult(
      registrationId: data['registration_id'] as int? ?? 0,
      emailMasked: data['email_masked'] as String? ?? '',
      message: data['message'] as String? ?? '',
    );
  }

  Future<String> verifyEmail({required int registrationId, required String code}) async {
    final data = await _post(ApiEndpoints.mobileVerifyEmail, {'registration_id': registrationId, 'verification_code': code});
    return data['status'] as String? ?? '';
  }

  Future<void> resendVerification(String email) => _post(ApiEndpoints.mobileResendVerification, {'email': email});

  Future<Map<String, dynamic>> registrationStatus(String email) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        ApiEndpoints.mobileRegistrationStatus,
        queryParameters: {'email': email},
        options: Options(extra: {'skipAuth': true}),
      );
      return response.data ?? const {};
    } on DioException catch (error) {
      throw _mapDioError(error);
    }
  }

  Future<void> forgotPassword(String email) => _post(ApiEndpoints.mobileForgotPassword, {'email': email});

  Future<String> verifyResetCode({required String email, required String code}) async {
    final data = await _post(ApiEndpoints.mobileVerifyResetCode, {'email': email, 'verification_code': code});
    return data['reset_token'] as String? ?? '';
  }

  Future<void> resetPassword({required String token, required String password, required String confirmPassword}) {
    return _post(ApiEndpoints.mobileResetPassword, {
      'reset_token': token,
      'new_password': password,
      'confirm_password': confirmPassword,
    });
  }

  Future<Map<String, dynamic>> _post(String path, Map<String, dynamic> data) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(path, data: data, options: Options(extra: {'skipAuth': true}));
      return response.data ?? const {};
    } on DioException catch (error) {
      throw _mapDioError(error);
    }
  }

  ApiException _mapDioError(DioException error) {
    final data = error.response?.data;
    if (data is Map<String, dynamic>) {
      final detail = data['detail'] ?? (data.values.isNotEmpty ? data.values.first : null);
      if (detail != null) return ApiException(detail.toString(), statusCode: error.response?.statusCode);
    }
    if (error.type == DioExceptionType.connectionError || error.type == DioExceptionType.connectionTimeout || error.type == DioExceptionType.receiveTimeout || error.type == DioExceptionType.sendTimeout) {
      return const ApiException('Unable to connect to the server.');
    }
    return const ApiException('Something went wrong. Please try again.');
  }
}
