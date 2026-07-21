import '../../profile/domain/customer.dart';

enum AuthStatus { initial, loading, authenticated, unauthenticated, error }

class AuthState {
  const AuthState({
    required this.status,
    this.customer,
    this.message,
  });

  const AuthState.initial() : this(status: AuthStatus.initial);
  const AuthState.loading() : this(status: AuthStatus.loading);
  const AuthState.authenticated(Customer customer)
      : this(status: AuthStatus.authenticated, customer: customer);
  const AuthState.unauthenticated([String? message])
      : this(status: AuthStatus.unauthenticated, message: message);
  const AuthState.error(String message) : this(status: AuthStatus.error, message: message);

  final AuthStatus status;
  final Customer? customer;
  final String? message;

  bool get isAuthenticated => status == AuthStatus.authenticated && customer != null;
}
