import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_endpoints.dart';
import '../../../core/network/api_exception.dart';

final accountRecoveryRepositoryProvider = Provider<AccountRecoveryRepository>(
  (ref) => AccountRecoveryRepository(ref.watch(dioProvider)),
);

class RegistrationResult {
  const RegistrationResult({
    required this.registrationId,
    required this.email,
    required this.emailMasked,
    required this.message,
    required this.resendCooldownSeconds,
  });
  final int registrationId;
  final String email;
  final String emailMasked;
  final String message;
  final int resendCooldownSeconds;
}

class AccountRecoveryRepository {
  const AccountRecoveryRepository(this._dio);
  final Dio _dio;

  Future<RegistrationResult> register(Map<String, dynamic> payload) async {
    final data = await _post(ApiEndpoints.mobileRegister, payload);
    return RegistrationResult(
      registrationId: data['registration_id'] as int? ?? 0,
      email: data['email'] as String? ?? payload['email']?.toString() ?? '',
      emailMasked: data['email_masked'] as String? ?? '',
      message: data['message'] as String? ?? '',
      resendCooldownSeconds: data['resend_cooldown_seconds'] as int? ?? 60,
    );
  }

  Future<Map<String, dynamic>> verifyEmail({
    required String email,
    required String code,
  }) async {
    return _post(ApiEndpoints.mobileVerifyEmail, {
      'email': email,
      'code': code,
    });
  }

  Future<Map<String, dynamic>> resendVerification(String email) =>
      _post(ApiEndpoints.mobileResendVerification, {'email': email});

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

  Future<void> forgotPassword(String email) =>
      _post(ApiEndpoints.mobileForgotPassword, {'email': email});

  Future<String> verifyResetCode({
    required String email,
    required String code,
  }) async {
    final data = await _post(ApiEndpoints.mobileVerifyResetCode, {
      'email': email,
      'verification_code': code,
    });
    return data['reset_token'] as String? ?? '';
  }

  Future<void> resetPassword({
    required String token,
    required String password,
    required String confirmPassword,
  }) {
    return _post(ApiEndpoints.mobileResetPassword, {
      'reset_token': token,
      'new_password': password,
      'confirm_password': confirmPassword,
    });
  }

  Future<Map<String, dynamic>> _post(
    String path,
    Map<String, dynamic> data,
  ) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        path,
        data: data,
        options: Options(extra: {'skipAuth': true}),
      );
      return response.data ?? const {};
    } on DioException catch (error) {
      throw _mapDioError(error);
    }
  }

  ApiException _mapDioError(DioException error) {
    final data = error.response?.data;
    if (data is Map<String, dynamic>) {
      final code = data['code'] is List
          ? (data['code'] as List).first?.toString()
          : data['code']?.toString();
      final detail =
          data['detail'] ?? (data.values.isNotEmpty ? data.values.first : null);
      if (detail != null) {
        final message = detail is List && detail.isNotEmpty
            ? detail.first.toString()
            : detail.toString();
        return ApiException(
          message,
          statusCode: error.response?.statusCode,
          code: code,
        );
      }
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
