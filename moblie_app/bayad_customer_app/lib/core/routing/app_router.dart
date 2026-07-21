import 'package:flutter/material.dart';
import 'package:bayad_customer_app/l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/domain/auth_state.dart';
import '../../features/auth/presentation/auth_controller.dart';
import '../../features/auth/presentation/login_screen.dart';
import '../../features/auth/presentation/splash_screen.dart';
import '../../features/home/presentation/home_screen.dart';
import '../../features/invoices/presentation/invoices_screen.dart';
import '../../features/orders/presentation/orders_screen.dart';
import '../../features/products/presentation/products_screen.dart';
import '../../features/profile/presentation/profile_screen.dart';
import '../../features/shipments/presentation/shipments_screen.dart';
import 'route_names.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authControllerProvider);
  return GoRouter(
    initialLocation: '/splash',
    redirect: (context, state) {
      final location = state.matchedLocation;
      final isSplash = location == '/splash';
      final isLogin = location == '/login';
      final isProtected = !isSplash && !isLogin;

      if (authState.status == AuthStatus.initial || authState.status == AuthStatus.loading) {
        return isSplash ? null : '/splash';
      }
      if (authState.status == AuthStatus.error) return isSplash ? null : '/login';
      if (!authState.isAuthenticated && (isProtected || isSplash)) return '/login';
      if (authState.isAuthenticated && (isLogin || isSplash)) return '/home';
      return null;
    },
    errorBuilder: (context, state) => const RouteErrorScreen(),
    routes: [
      GoRoute(path: '/splash', name: RouteNames.splash, builder: (context, state) => const SplashScreen()),
      GoRoute(path: '/login', name: RouteNames.login, builder: (context, state) => const LoginScreen()),
      GoRoute(path: '/home', name: RouteNames.home, builder: (context, state) => const HomeScreen()),
      GoRoute(path: '/profile', name: RouteNames.profile, builder: (context, state) => const ProfileScreen()),
      GoRoute(path: '/products', name: RouteNames.products, builder: (context, state) => const ProductsScreen()),
      GoRoute(path: '/orders', name: RouteNames.orders, builder: (context, state) => const OrdersScreen()),
      GoRoute(path: '/invoices', name: RouteNames.invoices, builder: (context, state) => const InvoicesScreen()),
      GoRoute(path: '/shipments', name: RouteNames.shipments, builder: (context, state) => const ShipmentsScreen()),
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
            child: Text(AppLocalizations.of(context).routeError, textAlign: TextAlign.center),
          ),
        ),
      ),
    );
  }
}
