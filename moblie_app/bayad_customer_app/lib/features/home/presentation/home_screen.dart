import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/routing/route_names.dart';
import '../../../core/storage/preferences_provider.dart';
import '../../../shared/data/mobile_providers.dart';
import '../../../shared/widgets/app_scaffold.dart';
import '../../../shared/widgets/customer_widgets.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/loading_view.dart';
import '../../auth/presentation/auth_controller.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final summary = ref.watch(homeSummaryProvider);
    final customer = ref.watch(authControllerProvider).customer;
    return AppScaffold(
      title: 'Home',
      currentIndex: 0,
      actions: [
        TextButton(onPressed: () => ref.read(localeControllerProvider.notifier).toggle(), child: const Text('Language')),
        IconButton(onPressed: () => context.goNamed(RouteNames.profile), icon: const Icon(Icons.person_outline), tooltip: 'Profile'),
      ],
      child: summary.when(
        loading: () => const LoadingView(message: 'Loading your customer portal...'),
        error: (error, _) => ErrorView(message: 'Unable to load Home. Please try again.', retryLabel: 'Retry', onRetry: () => ref.invalidate(homeSummaryProvider)),
        data: (data) => RefreshIndicator(
          onRefresh: () async => ref.refresh(homeSummaryProvider.future),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              CustomerHeaderCard(name: data.customer.name.isEmpty ? customer?.name ?? '' : data.customer.name, code: data.customer.code.isEmpty ? customer?.code ?? '' : data.customer.code),
              const SizedBox(height: 16),
              GridView.count(
                crossAxisCount: 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
                childAspectRatio: 1.35,
                children: [
                  SummaryCard(label: 'Pending Orders', value: '${data.orders['pending'] ?? 0}', icon: Icons.pending_actions),
                  SummaryCard(label: 'Unpaid Invoices', value: '${data.invoices['unpaid'] ?? 0}', icon: Icons.request_quote_outlined),
                  SummaryCard(label: 'Processing Shipments', value: '${data.shipments['processing'] ?? 0}', icon: Icons.local_shipping_outlined),
                  SummaryCard(label: 'Completed Orders', value: '${data.orders['completed'] ?? 0}', icon: Icons.task_alt),
                ],
              ),
              if ((data.invoices['unpaid'] ?? 0) != 0) ...[
                const SizedBox(height: 16),
                const Card(child: Padding(padding: EdgeInsets.all(16), child: Text('You have an unpaid Invoice. Please contact Bayad Company to complete payment.'))),
              ],
              const SizedBox(height: 16),
              const SectionHeader(title: 'Quick Actions'),
              _ActionGrid(),
              const SizedBox(height: 16),
              SectionHeader(title: 'Recent Orders', actionLabel: 'View All Orders', onAction: () => context.goNamed(RouteNames.orders)),
              if (data.recentOrders.isEmpty)
                const Card(child: Padding(padding: EdgeInsets.all(16), child: Text('No Orders found.')))
              else
                for (final order in data.recentOrders) Padding(padding: const EdgeInsets.only(bottom: 10), child: OrderCard(order: order, onTap: () => context.goNamed(RouteNames.orderDetail, pathParameters: {'id': '${order.id}'}))),
            ],
          ),
        ),
      ),
    );
  }
}

class _ActionGrid extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final actions = [
      ('Browse Products', Icons.inventory_2_outlined, RouteNames.products),
      ('My Orders', Icons.receipt_long_outlined, RouteNames.orders),
      ('My Invoices', Icons.request_quote_outlined, RouteNames.invoices),
      ('Track Shipments', Icons.local_shipping_outlined, RouteNames.shipments),
    ];
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisSpacing: 12,
      mainAxisSpacing: 12,
      childAspectRatio: 1.45,
      children: [
        for (final action in actions)
          Card(
            child: InkWell(
              onTap: () => context.goNamed(action.$3),
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Icon(action.$2), const Spacer(), Text(action.$1, style: const TextStyle(fontWeight: FontWeight.w900))]),
              ),
            ),
          ),
      ],
    );
  }
}
