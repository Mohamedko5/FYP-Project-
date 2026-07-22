import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/app_config.dart';
import '../storage/secure_storage_service.dart';
import 'api_endpoints.dart';

final secureStorageProvider = Provider<SecureStorageService>((ref) => SecureStorageService());

final dioProvider = Provider<Dio>((ref) {
  final storage = ref.watch(secureStorageProvider);
  final dio = Dio(
    BaseOptions(
      baseUrl: AppConfig.apiBaseUrl,
      connectTimeout: const Duration(seconds: 12),
      receiveTimeout: const Duration(seconds: 18),
      sendTimeout: const Duration(seconds: 12),
      responseType: ResponseType.json,
      contentType: Headers.jsonContentType,
    ),
  );

  Future<void>? refreshFuture;

  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) async {
        final skipAuth = options.extra['skipAuth'] == true;
        final token = skipAuth ? null : await storage.readAccessToken();
        if (!skipAuth && token != null && token.isNotEmpty) {
          options.headers['Authorization'] = 'Bearer $token';
        } else {
          options.headers.remove('Authorization');
        }
        handler.next(options);
      },
      onError: (error, handler) async {
        final request = error.requestOptions;
        final alreadyRetried = request.extra['retried'] == true;
        final isRefreshCall = request.path == ApiEndpoints.mobileRefresh;
        if (error.response?.statusCode != 401 || alreadyRetried || isRefreshCall) {
          handler.next(error);
          return;
        }

        final refresh = await storage.readRefreshToken();
        if (refresh == null || refresh.isEmpty) {
          await storage.clearTokens();
          handler.next(error);
          return;
        }

        refreshFuture ??= dio
            .post<Map<String, dynamic>>(
              ApiEndpoints.mobileRefresh,
              data: {'refresh': refresh},
              options: Options(extra: {'skipAuth': true}),
            )
            .then((response) async {
              final access = response.data?['access'] as String?;
              if (access == null || access.isEmpty) throw DioException(requestOptions: request);
              await storage.saveAccessToken(access);
            }).whenComplete(() {
          refreshFuture = null;
        });

        try {
          await refreshFuture;
          final access = await storage.readAccessToken();
          final retryResponse = await dio.fetch<dynamic>(
            request.copyWith(
              headers: {
                ...request.headers,
                if (access != null) 'Authorization': 'Bearer $access',
              },
              extra: {...request.extra, 'retried': true},
            ),
          );
          handler.resolve(retryResponse);
        } catch (_) {
          await storage.clearTokens();
          handler.next(error);
        }
      },
    ),
  );
  return dio;
});
