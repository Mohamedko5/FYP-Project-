import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/account_recovery_repository.dart';

final accountFlowControllerProvider = StateNotifierProvider<AccountFlowController, AccountFlowState>((ref) {
  return AccountFlowController(ref.watch(accountRecoveryRepositoryProvider));
});

class AccountFlowState {
  const AccountFlowState({
    this.isLoading = false,
    this.message,
    this.error,
    this.registrationId,
    this.email = '',
    this.emailMasked = '',
    this.resetToken = '',
  });

  final bool isLoading;
  final String? message;
  final String? error;
  final int? registrationId;
  final String email;
  final String emailMasked;
  final String resetToken;

  AccountFlowState copyWith({bool? isLoading, String? message, String? error, int? registrationId, String? email, String? emailMasked, String? resetToken}) {
    return AccountFlowState(
      isLoading: isLoading ?? this.isLoading,
      message: message,
      error: error,
      registrationId: registrationId ?? this.registrationId,
      email: email ?? this.email,
      emailMasked: emailMasked ?? this.emailMasked,
      resetToken: resetToken ?? this.resetToken,
    );
  }
}

class AccountFlowController extends StateNotifier<AccountFlowState> {
  AccountFlowController(this._repository) : super(const AccountFlowState());
  final AccountRecoveryRepository _repository;

  Future<bool> register(Map<String, dynamic> payload) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final result = await _repository.register(payload);
      state = state.copyWith(isLoading: false, message: result.message, registrationId: result.registrationId, email: payload['email']?.toString() ?? '', emailMasked: result.emailMasked);
      return true;
    } catch (error) {
      state = state.copyWith(isLoading: false, error: error.toString());
      return false;
    }
  }

  Future<bool> verifyEmail(String code) async {
    if (state.registrationId == null) return false;
    state = state.copyWith(isLoading: true, error: null);
    try {
      await _repository.verifyEmail(registrationId: state.registrationId!, code: code);
      state = state.copyWith(isLoading: false, message: 'pending_approval');
      return true;
    } catch (error) {
      state = state.copyWith(isLoading: false, error: error.toString());
      return false;
    }
  }

  Future<bool> resendVerification() async {
    if (state.email.trim().isEmpty) {
      state = state.copyWith(error: 'Email address is required.');
      return false;
    }
    state = state.copyWith(isLoading: true, error: null);
    try {
      await _repository.resendVerification(state.email);
      state = state.copyWith(isLoading: false, message: 'If a verification is pending, a new code has been sent.');
      return true;
    } catch (error) {
      state = state.copyWith(isLoading: false, error: error.toString());
      return false;
    }
  }

  Future<String?> checkStatus() async {
    if (state.email.trim().isEmpty) {
      state = state.copyWith(error: 'Email address is required.');
      return null;
    }
    state = state.copyWith(isLoading: true, error: null);
    try {
      final data = await _repository.registrationStatus(state.email);
      state = state.copyWith(isLoading: false, message: data['message']?.toString());
      return data['status']?.toString();
    } catch (error) {
      state = state.copyWith(isLoading: false, error: error.toString());
      return null;
    }
  }

  Future<bool> forgotPassword(String email) async {
    state = state.copyWith(isLoading: true, error: null, email: email);
    try {
      await _repository.forgotPassword(email);
      state = state.copyWith(isLoading: false, message: 'If an account exists for this email, a password reset code has been sent.');
      return true;
    } catch (error) {
      state = state.copyWith(isLoading: false, error: error.toString());
      return false;
    }
  }

  Future<bool> verifyResetCode(String code) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final token = await _repository.verifyResetCode(email: state.email, code: code);
      state = state.copyWith(isLoading: false, resetToken: token);
      return token.isNotEmpty;
    } catch (error) {
      state = state.copyWith(isLoading: false, error: error.toString());
      return false;
    }
  }

  Future<bool> resetPassword(String password, String confirmPassword) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      await _repository.resetPassword(token: state.resetToken, password: password, confirmPassword: confirmPassword);
      state = state.copyWith(isLoading: false, message: 'Your password has been reset successfully. Please sign in.', resetToken: '');
      return true;
    } catch (error) {
      state = state.copyWith(isLoading: false, error: error.toString());
      return false;
    }
  }
}
