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
import 'package:bayad_customer_app/features/chat/domain/chat_models.dart';
import 'package:bayad_customer_app/features/profile/domain/customer.dart';
import 'package:bayad_customer_app/features/supply_offers/data/models/supply_offer_models.dart';
import 'package:bayad_customer_app/shared/data/mobile_providers.dart';
import 'package:bayad_customer_app/shared/models/mobile_models.dart';
import 'package:bayad_customer_app/shared/models/paged_response.dart';

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

final testProduct = Product(
  id: 1,
  code: 'PRD-0001',
  nameEn: 'White Sesame',
  nameAr: 'Ø³Ù…Ø³Ù… Ø£Ø¨ÙŠØ¶',
  category: 'commodity',
  description: 'High quality white sesame',
  image: null,
  units: const [ProductUnitOption(id: 1, unit: 'Qintar', sellingPrice: 110000, isDefault: true, availableQuantity: 500, isAvailable: true)],
  stockStatus: 'available',
);

const testOrder = OrderSummary(id: 1, orderNumber: 'ORD-2026-000001', status: 'pending', itemCount: 1, productSummary: 'White Sesame', totalAmount: 110000, currency: 'SDG', createdAt: null);
const testInvoice = InvoiceSummary(id: 1, invoiceNumber: 'INV-2026-000001', orderNumber: 'ORD-2026-000001', status: 'issued', paymentStatus: 'unpaid', totalAmount: 110000, currency: 'SDG', issuedAt: null, productSummary: 'White Sesame');
const testShipment = ShipmentSummary(id: 1, shipmentNumber: 'SHP-2026-000001', orderNumber: 'ORD-2026-000001', invoiceNumber: 'INV-2026-000001', status: 'ready_for_shipment', productSummary: 'White Sesame', driverName: '', vehicleNumber: '', startedAt: null, completedAt: null);
const testSupplyOffer = SupplyOffer(
  id: 1,
  offerNumber: 'SUP-2026-000001',
  status: 'submitted',
  productSummary: 'White Sesame',
  customerReference: 'July offer',
  region: 'White Nile',
  city: 'Kosti',
  area: 'Al Rabwa',
  detailedAddress: 'Farm near Kosti market',
  availabilityDate: '2026-07-30',
  customerNotes: '',
  adminMessage: '',
  rejectionReason: '',
  proposedTotal: 12000000,
  adminProposedTotal: 0,
  agreedTotal: 0,
  currency: 'SDG',
  createdAt: null,
  items: [
    SupplyOfferItem(id: 1, productName: 'White Sesame', unit: 'Qintar', quantity: 100, customerPrice: 120000, lineTotal: 12000000, adminPrice: 0, agreedPrice: 0, qualityGrade: 'Grade A', packagingDetails: 'Sealed bags'),
  ],
  attachments: [],
  timeline: [],
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
        homeSummaryProvider.overrideWith((ref) async => const HomeSummary(
              customer: testCustomer,
              orders: {'total': 1, 'pending': 1, 'completed': 0},
              invoices: {'total': 1, 'unpaid': 1, 'paid': 0, 'outstanding_value': '110000.00'},
              shipments: {'ready': 1, 'processing': 0, 'completed': 0},
              recentOrders: [testOrder],
            )),
        productsProvider.overrideWith((ref) async => PagedResponse(count: 1, next: null, previous: null, results: [testProduct])),
        productDetailProvider.overrideWith((ref, id) async => testProduct),
        ordersProvider.overrideWith((ref) async => const PagedResponse(count: 1, next: null, previous: null, results: [testOrder])),
        orderDetailProvider.overrideWith((ref, id) async => const OrderDetail(
              id: 1,
              orderNumber: 'ORD-2026-000001',
              status: 'pending',
              itemCount: 1,
              productSummary: 'White Sesame',
              totalAmount: 110000,
              currency: 'SDG',
              createdAt: null,
              customerReference: '',
              customerNotes: '',
              subtotal: 110000,
              discountAmount: 0,
              items: [OrderItemModel(id: 1, productNameEn: 'White Sesame', productNameAr: 'Ø³Ù…Ø³Ù… Ø£Ø¨ÙŠØ¶', unit: 'Qintar', quantity: 1, unitPrice: 110000, lineTotal: 110000)],
              workflowSteps: [WorkflowStepModel(key: 'pending', label: 'Pending', state: 'current')],
            )),
        invoicesProvider.overrideWith((ref) async => const PagedResponse(count: 1, next: null, previous: null, results: [testInvoice])),
        invoiceDetailProvider.overrideWith((ref, id) async => const InvoiceDetail(id: 1, invoiceNumber: 'INV-2026-000001', orderNumber: 'ORD-2026-000001', status: 'issued', paymentStatus: 'unpaid', totalAmount: 110000, currency: 'SDG', issuedAt: null, productSummary: 'White Sesame', subtotal: 110000, discountAmount: 0, notes: '', items: [])),
        shipmentsProvider.overrideWith((ref) async => const PagedResponse(count: 1, next: null, previous: null, results: [testShipment])),
        shipmentDetailProvider.overrideWith((ref, id) async => const ShipmentDetail(id: 1, shipmentNumber: 'SHP-2026-000001', orderNumber: 'ORD-2026-000001', invoiceNumber: 'INV-2026-000001', status: 'ready_for_shipment', productSummary: 'White Sesame', driverName: '', vehicleNumber: '', startedAt: null, completedAt: null, notes: '', items: [], workflowSteps: [WorkflowStepModel(key: 'ready_for_shipment', label: 'Ready for Shipment', state: 'current')])),
        chatUnreadCountProvider.overrideWith((ref) async => 0),
        chatMessagesProvider.overrideWith((ref) async => const <ChatMessage>[]),
        supplyOffersProvider.overrideWith((ref) async => const PagedResponse(count: 1, next: null, previous: null, results: [testSupplyOffer])),
        supplyOfferDetailProvider.overrideWith((ref, id) async => testSupplyOffer),
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

  testWidgets('Login displays Create Account', (tester) async {
    await pumpBayadApp(tester);
    expect(find.text('Create Account'), findsOneWidget);
  });

  testWidgets('Login displays Forgot Password', (tester) async {
    await pumpBayadApp(tester);
    expect(find.text('Forgot Password?'), findsOneWidget);
  });

  test('Logout clears secure tokens path', () async {
    final repository = FakeAuthRepository();
    final controller = AuthController(repository: repository, storage: SecureStorageService());
    await controller.logout();
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
    await tester.tap(find.byIcon(Icons.person_outline).last);
    await tester.pump(const Duration(milliseconds: 100));
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.text('CUS-0001'), findsWidgets);
  });

  testWidgets('Chat appears in bottom navigation', (tester) async {
    await pumpBayadApp(tester, initialState: const AuthState.authenticated(testCustomer));
    expect(find.text('Chat'), findsOneWidget);
  });

  testWidgets('Selecting Chat opens ChatScreen with composer', (tester) async {
    await pumpBayadApp(tester, initialState: const AuthState.authenticated(testCustomer));
    await tester.tap(find.text('Chat'));
    await tester.pump(const Duration(milliseconds: 100));
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.text('Bayad Support'), findsOneWidget);
    expect(find.text('No Messages Yet'), findsOneWidget);
    expect(find.byType(TextField), findsWidgets);
    expect(find.text('Send'), findsWidgets);
  });

  testWidgets('Home displays Contact Bayad', (tester) async {
    await pumpBayadApp(tester, initialState: const AuthState.authenticated(testCustomer));
    await tester.scrollUntilVisible(find.text('Contact Bayad'), 120, scrollable: find.byType(Scrollable).first);
    expect(find.text('Contact Bayad'), findsOneWidget);
  });

  testWidgets('Home displays Sell to Bayad', (tester) async {
    await pumpBayadApp(tester, initialState: const AuthState.authenticated(testCustomer));
    await tester.scrollUntilVisible(find.text('Sell to Bayad'), 120, scrollable: find.byType(Scrollable).first);
    expect(find.text('Sell to Bayad'), findsOneWidget);
  });

  testWidgets('Home displays My Supply Offers', (tester) async {
    await pumpBayadApp(tester, initialState: const AuthState.authenticated(testCustomer));
    await tester.scrollUntilVisible(find.text('My Supply Offers'), 120, scrollable: find.byType(Scrollable).first);
    expect(find.text('My Supply Offers'), findsOneWidget);
  });

  testWidgets('My Supply Offers opens Supply Offers list', (tester) async {
    await pumpBayadApp(tester, initialState: const AuthState.authenticated(testCustomer));
    await tester.scrollUntilVisible(find.text('My Supply Offers'), 120, scrollable: find.byType(Scrollable).first);
    await tester.ensureVisible(find.text('My Supply Offers'));
    await tester.pump();
    await tester.tap(find.text('My Supply Offers'));
    await tester.pump(const Duration(milliseconds: 100));
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.text('Supply Offers'), findsOneWidget);
    expect(find.text('SUP-2026-000001'), findsOneWidget);
  });

  testWidgets('Sell to Bayad opens Create Supply Offer', (tester) async {
    await pumpBayadApp(tester, initialState: const AuthState.authenticated(testCustomer));
    await tester.scrollUntilVisible(find.text('Sell to Bayad'), 120, scrollable: find.byType(Scrollable).first);
    await tester.ensureVisible(find.text('Sell to Bayad'));
    await tester.pump();
    await tester.tap(find.text('Sell to Bayad'));
    await tester.pump(const Duration(milliseconds: 100));
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.text('Create Supply Offer'), findsOneWidget);
    expect(find.text('Add Offer Items'), findsOneWidget);
  });

  testWidgets('Arabic message can be entered in Chat', (tester) async {
    await pumpBayadApp(tester, initialState: const AuthState.authenticated(testCustomer), language: 'ar');
    await tester.tap(find.byIcon(Icons.chat_bubble_outline).last);
    await tester.pump(const Duration(milliseconds: 100));
    await tester.pump(const Duration(milliseconds: 100));
    await tester.enterText(find.byType(TextField).last, 'أريد معرفة حالة طلبي');
    expect(find.text('أريد معرفة حالة طلبي'), findsOneWidget);
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
