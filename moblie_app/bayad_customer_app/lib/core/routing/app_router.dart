import 'package:flutter/material.dart';
import 'package:bayad_customer_app/l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/domain/auth_state.dart';
import '../../features/auth/presentation/auth_controller.dart';
import '../../features/auth/presentation/login_screen.dart';
import '../../features/auth/presentation/registration_screens.dart';
import '../../features/auth/presentation/splash_screen.dart';
import '../../features/cart/presentation/cart_screen.dart';
import '../../features/cart/presentation/checkout_screen.dart';
import '../../features/chat/presentation/chat_screen.dart';
import '../../features/home/presentation/home_screen.dart';
import '../../features/invoices/presentation/invoices_screen.dart';
import '../../features/orders/presentation/orders_screen.dart';
import '../../features/products/presentation/products_screen.dart';
import '../../features/profile/presentation/profile_screen.dart';
import '../../features/shipments/presentation/shipments_screen.dart';
import '../../features/supply_offers/presentation/screens/supply_offers_screen.dart';
import 'route_names.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authControllerProvider);
  return GoRouter(
    initialLocation: '/splash',
    redirect: (context, state) {
      final location = state.matchedLocation;
      final isSplash = location == '/splash';
      final isResetFlow =
          location == '/forgot-password' ||
          location == '/verify-reset-code' ||
          location == '/reset-password';
      final isPublicAuth = {
        '/login',
        '/register',
        '/verify-email',
        '/pending-approval',
        '/registration-status',
        '/forgot-password',
        '/verify-reset-code',
        '/reset-password',
      }.contains(location);
      final isProtected = !isSplash && !isPublicAuth;

      if (authState.status == AuthStatus.initial ||
          authState.status == AuthStatus.loading) {
        return isSplash ? null : '/splash';
      }
      if (authState.status == AuthStatus.error) {
        return isSplash ? null : '/login';
      }
      if (!authState.isAuthenticated && (isProtected || isSplash)) {
        return '/login';
      }
      if (authState.isAuthenticated &&
          (isSplash || (isPublicAuth && !isResetFlow))) {
        return '/home';
      }
      return null;
    },
    errorBuilder: (context, state) => const RouteErrorScreen(),
    routes: [
      GoRoute(
        path: '/splash',
        name: RouteNames.splash,
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(
        path: '/login',
        name: RouteNames.login,
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/register',
        name: RouteNames.register,
        builder: (context, state) => const RegisterScreen(),
      ),
      GoRoute(
        path: '/verify-email',
        name: RouteNames.verifyEmail,
        builder: (context, state) {
          final extra = state.extra;
          final data = extra is Map ? extra : const {};
          return VerifyEmailScreen(
            initialEmail: data['email']?.toString() ?? '',
            initialEmailMasked: data['emailMasked']?.toString() ?? '',
            initialResendCooldownSeconds: data['resendCooldownSeconds'] is int
                ? data['resendCooldownSeconds'] as int
                : 0,
          );
        },
      ),
      GoRoute(
        path: '/pending-approval',
        name: RouteNames.pendingApproval,
        builder: (context, state) => const PendingApprovalScreen(),
      ),
      GoRoute(
        path: '/registration-status',
        name: RouteNames.registrationStatus,
        builder: (context, state) => const PendingApprovalScreen(),
      ),
      GoRoute(
        path: '/forgot-password',
        name: RouteNames.forgotPassword,
        builder: (context, state) => const ForgotPasswordScreen(),
      ),
      GoRoute(
        path: '/verify-reset-code',
        name: RouteNames.verifyResetCode,
        builder: (context, state) => const VerifyResetCodeScreen(),
      ),
      GoRoute(
        path: '/reset-password',
        name: RouteNames.resetPassword,
        builder: (context, state) => const ResetPasswordScreen(),
      ),
      GoRoute(
        path: '/home',
        name: RouteNames.home,
        builder: (context, state) => const HomeScreen(),
      ),
      GoRoute(
        path: '/profile',
        name: RouteNames.profile,
        builder: (context, state) => const ProfileScreen(),
      ),
      GoRoute(
        path: '/chat',
        name: RouteNames.chat,
        builder: (context, state) => const ChatScreen(),
      ),
      GoRoute(
        path: '/products',
        name: RouteNames.products,
        builder: (context, state) => const ProductsScreen(),
      ),
      GoRoute(
        path: '/products/:id',
        name: RouteNames.productDetail,
        builder: (context, state) => ProductDetailScreen(
          productId: int.tryParse(state.pathParameters['id'] ?? '') ?? 0,
        ),
      ),
      GoRoute(
        path: '/cart',
        name: RouteNames.cart,
        builder: (context, state) => const CartScreen(),
      ),
      GoRoute(
        path: '/checkout',
        name: RouteNames.checkout,
        builder: (context, state) => const CheckoutScreen(),
      ),
      GoRoute(
        path: '/orders/:id/success',
        name: RouteNames.orderSuccess,
        builder: (context, state) => OrderSuccessScreen(
          orderId: int.tryParse(state.pathParameters['id'] ?? '') ?? 0,
        ),
      ),
      GoRoute(
        path: '/orders',
        name: RouteNames.orders,
        builder: (context, state) => const OrdersScreen(),
      ),
      GoRoute(
        path: '/orders/:id',
        name: RouteNames.orderDetail,
        builder: (context, state) => OrderDetailScreen(
          orderId: int.tryParse(state.pathParameters['id'] ?? '') ?? 0,
        ),
      ),
      GoRoute(
        path: '/invoices',
        name: RouteNames.invoices,
        builder: (context, state) => const InvoicesScreen(),
      ),
      GoRoute(
        path: '/invoices/:id',
        name: RouteNames.invoiceDetail,
        builder: (context, state) => InvoiceDetailScreen(
          invoiceId: int.tryParse(state.pathParameters['id'] ?? '') ?? 0,
        ),
      ),
      GoRoute(
        path: '/shipments',
        name: RouteNames.shipments,
        builder: (context, state) => const ShipmentsScreen(),
      ),
      GoRoute(
        path: '/shipments/:id',
        name: RouteNames.shipmentDetail,
        builder: (context, state) => ShipmentDetailScreen(
          shipmentId: int.tryParse(state.pathParameters['id'] ?? '') ?? 0,
        ),
      ),
      GoRoute(
        path: '/supply-offers',
        name: RouteNames.supplyOffers,
        builder: (context, state) => const SupplyOffersScreen(),
      ),
      GoRoute(
        path: '/supply-offers/create',
        name: RouteNames.createSupplyOffer,
        builder: (context, state) => const CreateSupplyOfferScreen(),
      ),
      GoRoute(
        path: '/supply-offers/:id',
        name: RouteNames.supplyOfferDetail,
        builder: (context, state) => SupplyOfferDetailScreen(
          offerId: int.tryParse(state.pathParameters['id'] ?? '') ?? 0,
        ),
      ),
    ],
  );
});

class RouteErrorScreen extends StatelessWidget {
  const RouteErrorScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text(
              AppLocalizations.of(context).routeError,
              textAlign: TextAlign.center,
            ),
          ),
        ),
      ),
    );
  }
}
