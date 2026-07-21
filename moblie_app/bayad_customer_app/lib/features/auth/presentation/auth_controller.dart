import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/storage/secure_storage_service.dart';
import '../../profile/domain/customer.dart';
import '../data/auth_repository.dart';
import '../domain/auth_state.dart';

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(
    dio: ref.watch(dioProvider),
    storage: ref.watch(secureStorageProvider),
  );
});

final authControllerProvider = StateNotifierProvider<AuthController, AuthState>((ref) {
  return AuthController(
    repository: ref.watch(authRepositoryProvider),
    storage: ref.watch(secureStorageProvider),
  );
});

class AuthController extends StateNotifier<AuthState> {
  AuthController({
    required AuthRepository repository,
    required SecureStorageService storage,
  })  : _repository = repository,
        _storage = storage,
        super(const AuthState.initial());

  final AuthRepository _repository;
  final SecureStorageService _storage;

  Future<void> restoreSession() async {
    state = const AuthState.loading();
    final access = await _storage.readAccessToken();
    if (access == null || access.isEmpty) {
      state = const AuthState.unauthenticated();
      return;
    }
    try {
      final customer = await _repository.me();
      state = AuthState.authenticated(customer);
    } catch (error) {
      await _repository.clearTokens();
      state = AuthState.error(error.toString());
    }
  }

  Future<bool> login({required String email, required String password}) async {
    state = const AuthState.loading();
    try {
      final Customer customer = await _repository.login(email: email, password: password);
      state = AuthState.authenticated(customer);
      return true;
    } catch (error) {
      state = AuthState.unauthenticated(error.toString());
      return false;
    }
  }

  Future<void> logout() async {
    state = const AuthState.loading();
    await _repository.logout();
    state = const AuthState.unauthenticated();
  }

  void setStateForTesting(AuthState nextState) {
    state = nextState;
  }
}
