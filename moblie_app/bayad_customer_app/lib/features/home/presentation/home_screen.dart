import 'package:flutter/material.dart';
import 'package:bayad_customer_app/l10n/app_localizations.dart';
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
    final l10n = AppLocalizations.of(context);
    final summary = ref.watch(homeSummaryProvider);
    final customer = ref.watch(authControllerProvider).customer;
    return AppScaffold(
      title: l10n.home,
      currentIndex: 0,
      actions: [
        TextButton(onPressed: () => ref.read(localeControllerProvider.notifier).toggle(), child: Text(l10n.language)),
        IconButton(onPressed: () => context.goNamed(RouteNames.profile), icon: const Icon(Icons.person_outline), tooltip: l10n.profile),
      ],
      child: summary.when(
        loading: () => LoadingView(message: l10n.loadingHome),
        error: (error, _) => ErrorView(message: l10n.homeLoadError, retryLabel: l10n.retry, onRetry: () => ref.invalidate(homeSummaryProvider)),
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
                  SummaryCard(label: l10n.pendingOrders, value: '${data.orders['pending'] ?? 0}', icon: Icons.pending_actions),
                  SummaryCard(label: l10n.unpaidInvoices, value: '${data.invoices['unpaid'] ?? 0}', icon: Icons.request_quote_outlined),
                  SummaryCard(label: l10n.processingShipments, value: '${data.shipments['processing'] ?? 0}', icon: Icons.local_shipping_outlined),
                  SummaryCard(label: l10n.completedOrders, value: '${data.orders['completed'] ?? 0}', icon: Icons.task_alt),
                ],
              ),
              if ((data.invoices['unpaid'] ?? 0) != 0) ...[
                const SizedBox(height: 16),
                Card(child: Padding(padding: const EdgeInsets.all(16), child: Text(l10n.unpaidInvoiceNotice))),
              ],
              const SizedBox(height: 16),
              SectionHeader(title: l10n.quickActions),
              const _ActionGrid(),
              const SizedBox(height: 16),
              SectionHeader(title: l10n.recentOrders, actionLabel: l10n.viewAllOrders, onAction: () => context.goNamed(RouteNames.orders)),
              if (data.recentOrders.isEmpty)
                Card(child: Padding(padding: const EdgeInsets.all(16), child: Text(l10n.noOrdersFound)))
              else
                for (final order in data.recentOrders) Padding(padding: const EdgeInsets.only(bottom: 10), child: OrderCard(order: order, onTap: () => context.goNamed(RouteNames.orderDetail, pathParameters: {'id': '${order.id}'}))),
            ],
          ),
        ),
      ),
    );
  }
}

class _ActionGrid extends ConsumerWidget {
  const _ActionGrid();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final unreadCount = ref.watch(chatUnreadCountProvider).valueOrNull ?? 0;
    final actions = [
      (l10n.browseProducts, Icons.inventory_2_outlined, RouteNames.products),
      (l10n.sellToBayad, Icons.handshake_outlined, RouteNames.createSupplyOffer),
      (l10n.mySupplyOffers, Icons.assignment_turned_in_outlined, RouteNames.supplyOffers),
      (l10n.contactBayad, Icons.chat_bubble_outline, RouteNames.chat),
      (l10n.myOrders, Icons.receipt_long_outlined, RouteNames.orders),
      (l10n.myInvoices, Icons.request_quote_outlined, RouteNames.invoices),
      (l10n.trackShipments, Icons.local_shipping_outlined, RouteNames.shipments),
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
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    action.$3 == RouteNames.chat && unreadCount > 0
                        ? Badge.count(count: unreadCount, child: Icon(action.$2))
                        : Icon(action.$2),
                    const Spacer(),
                    Text(action.$1, style: const TextStyle(fontWeight: FontWeight.w900)),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }
}
