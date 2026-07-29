import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
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
import 'package:bayad_customer_app/l10n/app_localizations.dart';
import 'package:bayad_customer_app/core/theme/app_theme.dart';
import 'package:bayad_customer_app/shared/data/mobile_providers.dart';
import 'package:bayad_customer_app/shared/models/mobile_models.dart';
import 'package:bayad_customer_app/shared/models/paged_response.dart';
import 'package:bayad_customer_app/shared/widgets/customer_widgets.dart';

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
  units: const [
    ProductUnitOption(
      id: 1,
      unit: 'Qintar',
      sellingPrice: 110000,
      isDefault: true,
      availableQuantity: 500,
      isAvailable: true,
    ),
  ],
  stockStatus: 'available',
);

const testOrder = OrderSummary(
  id: 1,
  orderNumber: 'ORD-2026-000001',
  status: 'pending',
  itemCount: 1,
  productSummary: 'White Sesame',
  totalAmount: 110000,
  currency: 'SDG',
  createdAt: null,
);
const testInvoice = InvoiceSummary(
  id: 1,
  invoiceNumber: 'INV-2026-000001',
  orderNumber: 'ORD-2026-000001',
  status: 'issued',
  paymentStatus: 'unpaid',
  totalAmount: 110000,
  currency: 'SDG',
  issuedAt: null,
  productSummary: 'White Sesame',
);
const testShipment = ShipmentSummary(
  id: 1,
  shipmentNumber: 'SHP-2026-000001',
  orderNumber: 'ORD-2026-000001',
  invoiceNumber: 'INV-2026-000001',
  status: 'ready_for_shipment',
  productSummary: 'White Sesame',
  driverName: '',
  vehicleNumber: '',
  startedAt: null,
  completedAt: null,
);
const testOfferResponse = OfferResponse(
  id: 5,
  responseNumber: 'SUP-2026-000001-R1',
  status: 'pending_customer',
  message: 'Bayad proposes a different price.',
  proposedTotal: 4900000,
  proposedReceiptDate: '2026-08-05',
  warehouseName: 'Main Warehouse',
  expiresAt: '',
  createdAt: '2026-07-24T10:00:00Z',
  items: [
    OfferResponseItem(
      productName: 'White Sesame',
      unit: 'Qintar',
      customerQuantity: 100,
      adminQuantity: 70,
      customerPrice: 120000,
      adminPrice: 70000,
      customerTotal: 12000000,
      adminTotal: 4900000,
    ),
  ],
);

final longNameProduct = Product(
  id: 2,
  code: 'PRD-0002',
  nameEn: 'Premium Long Staple White Sesame For Export Quality Large Bags',
  nameAr: 'سمسم أبيض فاخر طويل الاسم بجودة تصدير وأكياس كبيرة',
  category: 'commodity',
  description: 'High quality white sesame with a deliberately long name.',
  image: null,
  units: const [
    ProductUnitOption(
      id: 2,
      unit: 'Kilogram',
      sellingPrice: 123456789.75,
      isDefault: true,
      availableQuantity: 800,
      isAvailable: true,
    ),
  ],
  stockStatus: 'available',
);

final unavailableProduct = Product(
  id: 3,
  code: 'PRD-0003',
  nameEn: 'Sorghum',
  nameAr: 'ذرة',
  category: 'commodity',
  description: 'Temporarily unavailable.',
  image: null,
  units: const [
    ProductUnitOption(
      id: 3,
      unit: 'Sack',
      sellingPrice: 10000,
      isDefault: true,
      availableQuantity: 0,
      isAvailable: false,
    ),
  ],
  stockStatus: 'unavailable',
);
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
    SupplyOfferItem(
      id: 1,
      productName: 'White Sesame',
      unit: 'Qintar',
      quantity: 100,
      customerPrice: 120000,
      lineTotal: 12000000,
      adminPrice: 0,
      agreedPrice: 0,
      qualityGrade: 'Grade A',
      packagingDetails: 'Sealed bags',
    ),
  ],
  attachments: [],
  timeline: [],
  currentResponse: null,
  paymentStatus: 'not_paid',
  paidAmount: 0,
  latestAdminMessage: '',
  currentResponseId: 0,
  currentResponseStatus: '',
  hasUnreadResponse: false,
  unreadResponseCount: 0,
  requiresCustomerAction: false,
  allowedActions: {},
);
const testCounterOffer = SupplyOffer(
  id: 1,
  offerNumber: 'SUP-2026-000001',
  status: 'counter_offered',
  productSummary: 'White Sesame',
  customerReference: 'July offer',
  region: 'White Nile',
  city: 'Kosti',
  area: 'Al Rabwa',
  detailedAddress: 'Farm near Kosti market',
  availabilityDate: '2026-07-30',
  customerNotes: '',
  adminMessage: 'Bayad proposes a different price.',
  rejectionReason: '',
  proposedTotal: 12000000,
  adminProposedTotal: 4900000,
  agreedTotal: 0,
  currency: 'SDG',
  createdAt: null,
  items: [
    SupplyOfferItem(
      id: 1,
      productName: 'White Sesame',
      unit: 'Qintar',
      quantity: 100,
      customerPrice: 120000,
      lineTotal: 12000000,
      adminPrice: 70000,
      agreedPrice: 0,
      qualityGrade: 'Grade A',
      packagingDetails: 'Sealed bags',
    ),
  ],
  attachments: [],
  timeline: [],
  currentResponse: testOfferResponse,
  paymentStatus: 'not_paid',
  paidAmount: 0,
  latestAdminMessage: 'Bayad proposes a different price.',
  currentResponseId: 5,
  currentResponseStatus: 'pending_customer',
  hasUnreadResponse: true,
  unreadResponseCount: 1,
  requiresCustomerAction: true,
  allowedActions: {
    'can_accept_response': true,
    'can_reject_response': true,
    'can_withdraw_offer': false,
  },
);

class FakeAuthRepository extends AuthRepository {
  FakeAuthRepository({
    this.loginError,
    this.restoreError,
    this.loginCustomer = testCustomer,
  }) : super(dio: Dio(), storage: SecureStorageService());

  final String? loginError;
  final String? restoreError;
  final Customer loginCustomer;
  bool didLogout = false;

  @override
  Future<Customer> login({
    required String email,
    required String password,
  }) async {
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
  Map<String, dynamic> offersSummary = const {
    'total': 1,
    'unread_responses': 0,
    'requires_customer_action': 0,
  },
  List<SupplyOffer> offerResults = const [testSupplyOffer],
}) async {
  SharedPreferences.setMockInitialValues({
    PreferencesService.languageKey: language,
  });
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
        homeSummaryProvider.overrideWith(
          (ref) async => HomeSummary(
            customer: testCustomer,
            orders: const {'total': 1, 'pending': 1, 'completed': 0},
            invoices: const {
              'total': 1,
              'unpaid': 1,
              'paid': 0,
              'outstanding_value': '110000.00',
            },
            shipments: const {'ready': 1, 'processing': 0, 'completed': 0},
            offers: offersSummary,
            recentOrders: const [testOrder],
          ),
        ),
        productsProvider.overrideWith(
          (ref) async => PagedResponse(
            count: 1,
            next: null,
            previous: null,
            results: [testProduct],
          ),
        ),
        productDetailProvider.overrideWith((ref, id) async => testProduct),
        ordersProvider.overrideWith(
          (ref) async => const PagedResponse(
            count: 1,
            next: null,
            previous: null,
            results: [testOrder],
          ),
        ),
        orderDetailProvider.overrideWith(
          (ref, id) async => const OrderDetail(
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
            items: [
              OrderItemModel(
                id: 1,
                productNameEn: 'White Sesame',
                productNameAr: 'Ø³Ù…Ø³Ù… Ø£Ø¨ÙŠØ¶',
                unit: 'Qintar',
                quantity: 1,
                unitPrice: 110000,
                lineTotal: 110000,
              ),
            ],
            workflowSteps: [
              WorkflowStepModel(
                key: 'pending',
                label: 'Pending',
                state: 'current',
              ),
            ],
          ),
        ),
        invoicesProvider.overrideWith(
          (ref) async => const PagedResponse(
            count: 1,
            next: null,
            previous: null,
            results: [testInvoice],
          ),
        ),
        invoiceDetailProvider.overrideWith(
          (ref, id) async => const InvoiceDetail(
            id: 1,
            invoiceNumber: 'INV-2026-000001',
            orderNumber: 'ORD-2026-000001',
            status: 'issued',
            paymentStatus: 'unpaid',
            totalAmount: 110000,
            currency: 'SDG',
            issuedAt: null,
            productSummary: 'White Sesame',
            subtotal: 110000,
            discountAmount: 0,
            notes: '',
            items: [],
          ),
        ),
        shipmentsProvider.overrideWith(
          (ref) async => const PagedResponse(
            count: 1,
            next: null,
            previous: null,
            results: [testShipment],
          ),
        ),
        shipmentDetailProvider.overrideWith(
          (ref, id) async => const ShipmentDetail(
            id: 1,
            shipmentNumber: 'SHP-2026-000001',
            orderNumber: 'ORD-2026-000001',
            invoiceNumber: 'INV-2026-000001',
            status: 'ready_for_shipment',
            productSummary: 'White Sesame',
            driverName: '',
            vehicleNumber: '',
            startedAt: null,
            completedAt: null,
            notes: '',
            items: [],
            workflowSteps: [
              WorkflowStepModel(
                key: 'ready_for_shipment',
                label: 'Ready for Shipment',
                state: 'current',
              ),
            ],
          ),
        ),
        chatUnreadCountProvider.overrideWith((ref) async => 0),
        chatMessagesProvider.overrideWith((ref) async => const <ChatMessage>[]),
        supplyOffersProvider.overrideWith(
          (ref) async => PagedResponse(
            count: offerResults.length,
            next: null,
            previous: null,
            results: offerResults,
          ),
        ),
        supplyOfferDetailProvider.overrideWith(
          (ref, id) async => offerResults.first,
        ),
      ],
      child: const BayadCustomerApp(),
    ),
  );
  await tester.pump(const Duration(milliseconds: 100));
  await tester.pump(const Duration(milliseconds: 100));
}

Future<void> pumpProductCard(
  WidgetTester tester, {
  required Product product,
  String language = 'en',
  Size surfaceSize = const Size(390, 844),
  VoidCallback? onAdd,
}) async {
  tester.view.physicalSize = surfaceSize;
  tester.view.devicePixelRatio = 1;
  addTearDown(() {
    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
  });
  final locale = Locale(language);
  final isArabic = language == 'ar';
  await tester.pumpWidget(
    MaterialApp(
      theme: AppTheme.light(),
      locale: locale,
      supportedLocales: AppLocalizations.supportedLocales,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      home: Directionality(
        textDirection: isArabic ? TextDirection.rtl : TextDirection.ltr,
        child: Scaffold(
          body: Center(
            child: SizedBox(
              width: surfaceSize.width < 360 ? surfaceSize.width - 32 : 170,
              height: isArabic ? 330 : 312,
              child: Builder(
                builder: (context) {
                  final l10n = AppLocalizations.of(context);
                  return ProductCard(
                    product: product,
                    isArabic: isArabic,
                    addToCartLabel: l10n.addToCart,
                    availableLabel: l10n.available,
                    unavailableLabel: l10n.unavailable,
                    onDetails: () {},
                    onAdd: onAdd ?? () {},
                  );
                },
              ),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('Product grid card renders without overflow on narrow phone', (
    tester,
  ) async {
    await pumpProductCard(
      tester,
      product: longNameProduct,
      surfaceSize: const Size(360, 800),
    );
    expect(tester.takeException(), isNull);
    expect(find.textContaining('Premium Long Staple'), findsOneWidget);
  });

  testWidgets('Long Product name is constrained to two readable lines', (
    tester,
  ) async {
    await pumpProductCard(tester, product: longNameProduct);
    final text = tester.widget<Text>(
      find.textContaining('Premium Long Staple'),
    );
    expect(text.maxLines, 2);
    expect(text.overflow, TextOverflow.ellipsis);
  });

  testWidgets('Large price remains one readable line', (tester) async {
    await pumpProductCard(tester, product: longNameProduct);
    final text = tester.widget<Text>(find.text('SDG 123,456,789.75'));
    expect(text.maxLines, 1);
    expect(text.overflow, TextOverflow.ellipsis);
  });

  testWidgets('Unavailable badge is localized in Arabic', (tester) async {
    await pumpProductCard(tester, product: unavailableProduct, language: 'ar');
    expect(find.text('غير متوفر'), findsOneWidget);
    expect(find.text('Unavailable'), findsNothing);
  });

  testWidgets('Unavailable badge is localized in English', (tester) async {
    await pumpProductCard(tester, product: unavailableProduct);
    expect(find.text('Unavailable'), findsOneWidget);
    expect(find.text('غير متوفر'), findsNothing);
  });

  testWidgets('Disabled Add to Cart button remains disabled', (tester) async {
    var called = false;
    await pumpProductCard(
      tester,
      product: unavailableProduct,
      onAdd: () => called = true,
    );
    await tester.tap(find.text('Add to Cart'));
    await tester.pump();
    expect(called, isFalse);
  });

  testWidgets('Available Add to Cart button still calls the current action', (
    tester,
  ) async {
    var called = false;
    await pumpProductCard(
      tester,
      product: testProduct,
      onAdd: () => called = true,
    );
    await tester.tap(find.text('Add to Cart'));
    await tester.pump();
    expect(called, isTrue);
  });

  testWidgets('Missing image displays the Bayad product placeholder', (
    tester,
  ) async {
    await pumpProductCard(tester, product: testProduct);
    expect(find.byIcon(Icons.grass), findsOneWidget);
  });

  testWidgets('Arabic Product card uses RTL and localized Add to Cart', (
    tester,
  ) async {
    await pumpProductCard(
      tester,
      product: testProduct,
      language: 'ar',
      surfaceSize: const Size(390, 844),
    );
    final directionality = tester.widget<Directionality>(
      find.byType(Directionality).first,
    );
    expect(directionality.textDirection, TextDirection.rtl);
    expect(find.text('إضافة إلى السلة'), findsOneWidget);
  });

  testWidgets('English Product card uses LTR labels', (tester) async {
    await pumpProductCard(
      tester,
      product: testProduct,
      language: 'en',
      surfaceSize: const Size(412, 915),
    );
    final directionality = tester.widget<Directionality>(
      find.byType(Directionality).first,
    );
    expect(directionality.textDirection, TextDirection.ltr);
    expect(find.text('Add to Cart'), findsOneWidget);
  });

  testWidgets('Product card remains readable on very narrow width', (
    tester,
  ) async {
    await pumpProductCard(
      tester,
      product: longNameProduct,
      surfaceSize: const Size(320, 800),
    );
    expect(tester.takeException(), isNull);
    expect(find.text('SDG 123,456,789.75'), findsOneWidget);
  });

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
    await pumpBayadApp(
      tester,
      repository: FakeAuthRepository(loginError: 'Invalid email or password.'),
    );
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
    final controller = AuthController(
      repository: repository,
      storage: SecureStorageService(),
    );
    await controller.logout();
    expect(repository.didLogout, isTrue);
  });

  testWidgets('English Login rendering', (tester) async {
    await pumpBayadApp(tester, language: 'en');
    expect(find.text('Customer Login'), findsOneWidget);
  });

  testWidgets('Arabic RTL Login rendering', (tester) async {
    await pumpBayadApp(tester, language: 'ar');
    final directionality = tester.widget<Directionality>(
      find.byType(Directionality).first,
    );
    expect(directionality.textDirection, TextDirection.rtl);
    expect(find.text('دخول العملاء'), findsOneWidget);
  });

  testWidgets('Home displays Customer name', (tester) async {
    await pumpBayadApp(
      tester,
      initialState: const AuthState.authenticated(testCustomer),
    );
    expect(find.textContaining('Ahmed Trading'), findsWidgets);
  });

  testWidgets('Profile displays Customer API data', (tester) async {
    await pumpBayadApp(
      tester,
      initialState: const AuthState.authenticated(testCustomer),
    );
    await tester.tap(find.byIcon(Icons.person_outline).last);
    await tester.pump(const Duration(milliseconds: 100));
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.text('CUS-0001'), findsWidgets);
  });

  testWidgets('Chat appears in bottom navigation', (tester) async {
    await pumpBayadApp(
      tester,
      initialState: const AuthState.authenticated(testCustomer),
    );
    expect(find.text('Chat'), findsOneWidget);
  });

  testWidgets('Bottom navigation has five destinations with My Offers fourth', (
    tester,
  ) async {
    await pumpBayadApp(
      tester,
      initialState: const AuthState.authenticated(testCustomer),
    );
    final destinations = tester
        .widgetList<NavigationDestination>(find.byType(NavigationDestination))
        .toList();
    expect(destinations.length, 5);
    expect(destinations.map((destination) => destination.label), [
      'Home',
      'Products',
      'Chat',
      'My Offers',
      'Account',
    ]);
    expect(
      destinations.map((destination) => destination.label),
      isNot(contains('My Orders')),
    );
  });

  testWidgets('Arabic bottom navigation displays My Offers as عروضي', (
    tester,
  ) async {
    await pumpBayadApp(
      tester,
      initialState: const AuthState.authenticated(testCustomer),
      language: 'ar',
    );
    final destinations = tester
        .widgetList<NavigationDestination>(find.byType(NavigationDestination))
        .toList();
    expect(destinations.length, 5);
    expect(destinations[3].label, '\u0639\u0631\u0648\u0636\u064a');
  });

  testWidgets('Bottom navigation My Offers opens real Offers list', (
    tester,
  ) async {
    await pumpBayadApp(
      tester,
      initialState: const AuthState.authenticated(testCustomer),
    );
    await tester.tap(find.byIcon(Icons.local_offer_outlined));
    await tester.pumpAndSettle();
    expect(find.text('Offers'), findsOneWidget);
    expect(find.text('SUP-2026-000001'), findsOneWidget);
  });

  testWidgets('Selecting Chat opens ChatScreen with composer', (tester) async {
    await pumpBayadApp(
      tester,
      initialState: const AuthState.authenticated(testCustomer),
    );
    await tester.tap(find.text('Chat'));
    await tester.pump(const Duration(milliseconds: 100));
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.text('Bayad Support'), findsOneWidget);
    expect(find.text('No Messages Yet'), findsOneWidget);
    expect(find.byType(TextField), findsWidgets);
    expect(find.text('Send'), findsWidgets);
  });

  testWidgets('Home no longer displays Quick Actions section in English', (
    tester,
  ) async {
    await pumpBayadApp(
      tester,
      initialState: const AuthState.authenticated(testCustomer),
    );
    final homeScrollable = find.byType(Scrollable).first;
    expect(find.text('Quick Actions'), findsNothing);
    expect(
      find.descendant(of: homeScrollable, matching: find.text('Contact Bayad')),
      findsNothing,
    );
    expect(
      find.descendant(of: homeScrollable, matching: find.text('Sell to Bayad')),
      findsNothing,
    );
    expect(
      find.descendant(of: homeScrollable, matching: find.text('My Offers')),
      findsNothing,
    );
    expect(
      find.descendant(of: homeScrollable, matching: find.text('My Orders')),
      findsNothing,
    );
    expect(
      find.descendant(of: homeScrollable, matching: find.text('My Invoices')),
      findsNothing,
    );
    expect(
      find.descendant(
        of: homeScrollable,
        matching: find.text('Track Shipments'),
      ),
      findsNothing,
    );
  });

  testWidgets('Home no longer displays Quick Actions section in Arabic', (
    tester,
  ) async {
    await pumpBayadApp(
      tester,
      initialState: const AuthState.authenticated(testCustomer),
      language: 'ar',
    );
    final homeScrollable = find.byType(Scrollable).first;
    expect(
      find.text(
        '\u0627\u0644\u0625\u062c\u0631\u0627\u0621\u0627\u062a \u0627\u0644\u0633\u0631\u064a\u0639\u0629',
      ),
      findsNothing,
    );
    expect(
      find.descendant(
        of: homeScrollable,
        matching: find.text('\u0637\u0644\u0628\u0627\u062a\u064a'),
      ),
      findsNothing,
    );
    final directionality = tester.widget<Directionality>(
      find.byType(Directionality).first,
    );
    expect(directionality.textDirection, TextDirection.rtl);
  });

  testWidgets('Home still scrolls to Recent Orders without Quick Actions gap', (
    tester,
  ) async {
    await pumpBayadApp(
      tester,
      initialState: const AuthState.authenticated(testCustomer),
    );
    await tester.scrollUntilVisible(
      find.text('Recent Orders'),
      120,
      scrollable: find.byType(Scrollable).first,
    );
    expect(tester.takeException(), isNull);
    expect(find.text('Recent Orders'), findsOneWidget);
  });

  testWidgets('Account My Orders menu item opens Orders', (tester) async {
    await pumpBayadApp(
      tester,
      initialState: const AuthState.authenticated(testCustomer),
    );
    await tester.tap(find.byIcon(Icons.person_outline).last);
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.text('My Orders'),
      120,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('My Orders'), findsOneWidget);
    await tester.drag(find.byType(Scrollable).first, const Offset(0, -160));
    await tester.pumpAndSettle();
    await tester.tap(find.text('My Orders'));
    await tester.pumpAndSettle();
    expect(find.text('ORD-2026-000001'), findsOneWidget);
    expect(find.text('My Orders'), findsOneWidget);
  });

  testWidgets('Home displays unread Offer response count from API summary', (
    tester,
  ) async {
    await pumpBayadApp(
      tester,
      initialState: const AuthState.authenticated(testCustomer),
      offersSummary: const {
        'total': 1,
        'unread_responses': 1,
        'requires_customer_action': 1,
      },
      offerResults: const [testCounterOffer],
    );
    expect(find.text('Admin Offer Responses'), findsOneWidget);
    expect(find.text('1'), findsWidgets);
    await tester.scrollUntilVisible(
      find.text('Bayad Admin has responded to your Offer.'),
      120,
      scrollable: find.byType(Scrollable).first,
    );
    expect(
      find.text('Bayad Admin has responded to your Offer.'),
      findsOneWidget,
    );
  });

  testWidgets(
    'Counter-offered Offer shows Admin response badge and translated status',
    (tester) async {
      await pumpBayadApp(
        tester,
        initialState: const AuthState.authenticated(testCustomer),
        offerResults: const [testCounterOffer],
      );
      await tester.tap(find.byIcon(Icons.local_offer_outlined));
      await tester.pump(const Duration(milliseconds: 100));
      await tester.pump(const Duration(milliseconds: 100));
      expect(find.textContaining('Admin Responded'), findsOneWidget);
      expect(find.text('New Admin Response'), findsOneWidget);
      expect(find.text('Review Admin Offer'), findsOneWidget);
      expect(find.textContaining('SDG 4,900,000.00'), findsOneWidget);
    },
  );

  testWidgets('Sell to Bayad opens Create Offer from Offers screen', (
    tester,
  ) async {
    await pumpBayadApp(
      tester,
      initialState: const AuthState.authenticated(testCustomer),
    );
    await tester.tap(find.byIcon(Icons.local_offer_outlined));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Sell to Bayad'));
    await tester.pump(const Duration(milliseconds: 100));
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.text('Create Offer'), findsOneWidget);
    expect(find.text('Add Offer Items'), findsOneWidget);
  });

  testWidgets('Create Offer visible Back returns to My Offers', (tester) async {
    await pumpBayadApp(
      tester,
      initialState: const AuthState.authenticated(testCustomer),
    );
    await tester.tap(find.byIcon(Icons.local_offer_outlined));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Sell to Bayad'));
    await tester.pumpAndSettle();
    expect(find.text('Create Offer'), findsOneWidget);
    expect(find.byType(BackButton), findsOneWidget);

    await tester.tap(find.byType(BackButton));
    await tester.pumpAndSettle();
    expect(find.text('Offers'), findsOneWidget);
    expect(find.text('Sell to Bayad'), findsOneWidget);
    expect(find.text('Create Offer'), findsNothing);
  });

  testWidgets('Create Offer Android system Back returns to My Offers', (
    tester,
  ) async {
    await pumpBayadApp(
      tester,
      initialState: const AuthState.authenticated(testCustomer),
    );
    await tester.tap(find.byIcon(Icons.local_offer_outlined));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Sell to Bayad'));
    await tester.pumpAndSettle();
    expect(find.text('Create Offer'), findsOneWidget);

    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(find.text('Offers'), findsOneWidget);
    expect(find.text('Sell to Bayad'), findsOneWidget);
    expect(find.text('Create Offer'), findsNothing);
  });

  testWidgets('Arabic message can be entered in Chat', (tester) async {
    await pumpBayadApp(
      tester,
      initialState: const AuthState.authenticated(testCustomer),
      language: 'ar',
    );
    await tester.tap(find.byIcon(Icons.chat_bubble_outline).last);
    await tester.pump(const Duration(milliseconds: 100));
    await tester.pump(const Duration(milliseconds: 100));
    await tester.enterText(find.byType(TextField).last, 'أريد معرفة حالة طلبي');
    expect(find.text('أريد معرفة حالة طلبي'), findsOneWidget);
  });

  testWidgets('Server error displays Retry', (tester) async {
    await pumpBayadApp(
      tester,
      initialState: const AuthState.error('Unable to connect to the server.'),
    );
    expect(find.text('Retry'), findsOneWidget);
  });

  testWidgets('Route error does not show a blank screen', (tester) async {
    await pumpBayadApp(
      tester,
      initialState: const AuthState.authenticated(testCustomer),
    );
    expect(find.byType(MaterialApp), findsOneWidget);
  });
}
