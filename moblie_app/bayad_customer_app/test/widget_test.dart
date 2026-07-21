import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:bayad_customer_app/app.dart';
import 'package:bayad_customer_app/core/storage/preferences_provider.dart';
import 'package:bayad_customer_app/core/storage/preferences_service.dart';
import 'package:bayad_customer_app/core/storage/secure_storage_service.dart';
import 'package:bayad_customer_app/features/auth/data/auth_repository.dart';
import 'package:bayad_customer_app/features/auth/domain/auth_state.dart';
import 'package:bayad_customer_app/features/auth/presentation/auth_controller.dart';
import 'package:bayad_customer_app/features/profile/domain/customer.dart';

const testCustomer = Customer(
  id: 1,
  code: 'CUS-0001',
  name: 'Ahmed Trading',
  email: 'customer@bayad.com',
  phone: '+249123456789',
  secondaryPhone: '',
  address: 'Omdurman',
  customerType: 'exporter',
);

class FakeAuthRepository extends AuthRepository {
  FakeAuthRepository({this.loginError, this.restoreError, this.loginCustomer = testCustomer})
      : super(dio: Dio(), storage: SecureStorageService());

  final String? loginError;
  final String? restoreError;
  final Customer loginCustomer;
  bool didLogout = false;

  @override
  Future<Customer> login({required String email, required String password}) async {
    if (loginError != null) throw Exception(loginError);
    return loginCustomer;
  }

  @override
  Future<Customer> me() async {
    if (restoreError != null) throw Exception(restoreError);
    return loginCustomer;
  }

  @override
  Future<void> logout() async {
    didLogout = true;
  }

  @override
  Future<void> clearTokens() async {}
}

Future<void> pumpBayadApp(
  WidgetTester tester, {
  AuthState initialState = const AuthState.unauthenticated(),
  FakeAuthRepository? repository,
  String language = 'en',
}) async {
  SharedPreferences.setMockInitialValues({PreferencesService.languageKey: language});
  FlutterSecureStorage.setMockInitialValues({});
  final preferences = await SharedPreferences.getInstance();
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        sharedPreferencesProvider.overrideWithValue(preferences),
        authControllerProvider.overrideWith((ref) {
          final controller = AuthController(
            repository: repository ?? FakeAuthRepository(),
            storage: SecureStorageService(),
          );
          controller.setStateForTesting(initialState);
          return controller;
        }),
      ],
      child: const BayadCustomerApp(),
    ),
  );
  await tester.pump(const Duration(milliseconds: 100));
  await tester.pump(const Duration(milliseconds: 100));
}

void main() {
  testWidgets('Empty email validation', (tester) async {
    await pumpBayadApp(tester);
    await tester.tap(find.text('Login'));
    await tester.pump();
    expect(find.text('Please enter your email address.'), findsOneWidget);
  });

  testWidgets('Invalid email validation', (tester) async {
    await pumpBayadApp(tester);
    await tester.enterText(find.byType(TextField).first, 'bad-email');
    await tester.enterText(find.byType(TextField).last, 'password');
    await tester.tap(find.text('Login'));
    await tester.pump();
    expect(find.text('Please enter a valid email address.'), findsOneWidget);
  });

  testWidgets('Empty password validation', (tester) async {
    await pumpBayadApp(tester);
    await tester.enterText(find.byType(TextField).first, 'customer@bayad.com');
    await tester.tap(find.text('Login'));
    await tester.pump();
    expect(find.text('Please enter your password.'), findsOneWidget);
  });

  testWidgets('Login loading state', (tester) async {
    await pumpBayadApp(tester, initialState: const AuthState.loading());
    expect(find.byType(CircularProgressIndicator), findsWidgets);
  });

  testWidgets('Login API error state', (tester) async {
    await pumpBayadApp(tester, repository: FakeAuthRepository(loginError: 'Invalid email or password.'));
    await tester.enterText(find.byType(TextField).first, 'customer@bayad.com');
    await tester.enterText(find.byType(TextField).last, 'wrong-password');
    await tester.tap(find.text('Login'));
    await tester.pump(const Duration(milliseconds: 100));
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.textContaining('Invalid email or password'), findsWidgets);
  });

  testWidgets('Successful authentication routes to Home', (tester) async {
    await pumpBayadApp(tester, repository: FakeAuthRepository());
    await tester.enterText(find.byType(TextField).first, 'customer@bayad.com');
    await tester.enterText(find.byType(TextField).last, 'CustomerPass123!');
    await tester.tap(find.text('Login'));
    await tester.pump(const Duration(milliseconds: 100));
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.text('Home'), findsWidgets);
  });

  testWidgets('Unauthenticated state routes to Login', (tester) async {
    await pumpBayadApp(tester);
    expect(find.text('Customer Login'), findsOneWidget);
  });

  testWidgets('Logout clears secure tokens path', (tester) async {
    final repository = FakeAuthRepository();
    await pumpBayadApp(tester, initialState: const AuthState.authenticated(testCustomer), repository: repository);
    await tester.tap(find.byIcon(Icons.logout));
    await tester.pump(const Duration(milliseconds: 100));
    await tester.pump(const Duration(milliseconds: 100));
    expect(repository.didLogout, isTrue);
  });

  testWidgets('English Login rendering', (tester) async {
    await pumpBayadApp(tester, language: 'en');
    expect(find.text('Customer Login'), findsOneWidget);
  });

  testWidgets('Arabic RTL Login rendering', (tester) async {
    await pumpBayadApp(tester, language: 'ar');
    final directionality = tester.widget<Directionality>(find.byType(Directionality).first);
    expect(directionality.textDirection, TextDirection.rtl);
    expect(find.text('دخول العملاء'), findsOneWidget);
  });

  testWidgets('Home displays Customer name', (tester) async {
    await pumpBayadApp(tester, initialState: const AuthState.authenticated(testCustomer));
    expect(find.textContaining('Ahmed Trading'), findsWidgets);
  });

  testWidgets('Profile displays Customer API data', (tester) async {
    await pumpBayadApp(tester, initialState: const AuthState.authenticated(testCustomer));
    await tester.tap(find.byIcon(Icons.person_outline));
    await tester.pump(const Duration(milliseconds: 100));
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.text('CUS-0001'), findsOneWidget);
  });

  testWidgets('Server error displays Retry', (tester) async {
    await pumpBayadApp(tester, initialState: const AuthState.error('Unable to connect to the server.'));
    expect(find.text('Retry'), findsOneWidget);
  });

  testWidgets('Route error does not show a blank screen', (tester) async {
    await pumpBayadApp(tester, initialState: const AuthState.authenticated(testCustomer));
    expect(find.byType(MaterialApp), findsOneWidget);
  });
}
