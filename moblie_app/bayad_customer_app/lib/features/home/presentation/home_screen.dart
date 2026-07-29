import 'package:flutter/material.dart';
import 'package:bayad_customer_app/l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/routing/route_names.dart';
import '../../../core/storage/preferences_provider.dart';
import '../../../shared/data/mobile_providers.dart';
import '../../../shared/widgets/app_scaffold.dart';
import '../../../shared/widgets/bayad_design_system.dart';
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
        TextButton(
          onPressed: () => ref.read(localeControllerProvider.notifier).toggle(),
          child: Text(l10n.language),
        ),
        IconButton(
          onPressed: () => context.goNamed(RouteNames.profile),
          icon: const Icon(Icons.person_outline),
          tooltip: l10n.profile,
        ),
      ],
      child: summary.when(
        loading: () => LoadingView(message: l10n.loadingHome),
        error: (error, _) => ErrorView(
          message: l10n.homeLoadError,
          retryLabel: l10n.retry,
          onRetry: () => ref.invalidate(homeSummaryProvider),
        ),
        data: (data) => RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(supplyOffersProvider);
            return ref.refresh(homeSummaryProvider.future);
          },
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 104),
            children: [
              CustomerHeaderCard(
                name: data.customer.name.isEmpty
                    ? customer?.name ?? ''
                    : data.customer.name,
                code: data.customer.code.isEmpty
                    ? customer?.code ?? ''
                    : data.customer.code,
              ),
              const SizedBox(height: 16),
              BayadSearchField(
                hintText: l10n.browseProducts,
                readOnly: true,
                onTap: () => context.goNamed(RouteNames.products),
              ),
              const SizedBox(height: 16),
              BayadPromoBanner(
                title: l10n.browseProducts,
                subtitle: l10n.supplyOfferNotice,
                actionLabel: l10n.browseProducts,
                onAction: () => context.goNamed(RouteNames.products),
              ),
              const SizedBox(height: 18),
              GridView.count(
                crossAxisCount: 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
                childAspectRatio: 1.35,
                children: [
                  SummaryCard(
                    label: l10n.pendingOrders,
                    value: '${data.orders['pending'] ?? 0}',
                    icon: Icons.pending_actions,
                  ),
                  SummaryCard(
                    label: l10n.unpaidInvoices,
                    value: '${data.invoices['unpaid'] ?? 0}',
                    icon: Icons.request_quote_outlined,
                  ),
                  SummaryCard(
                    label: l10n.adminOfferResponses,
                    value: '${data.offers['unread_responses'] ?? 0}',
                    icon: Icons.mark_email_unread_outlined,
                  ),
                  SummaryCard(
                    label: l10n.processingShipments,
                    value: '${data.shipments['processing'] ?? 0}',
                    icon: Icons.local_shipping_outlined,
                  ),
                  SummaryCard(
                    label: l10n.completedOrders,
                    value: '${data.orders['completed'] ?? 0}',
                    icon: Icons.task_alt,
                  ),
                ],
              ),
              if ((data.offers['requires_customer_action'] ?? 0) != 0) ...[
                const SizedBox(height: 16),
                BayadCard(
                  child: ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.assignment_turned_in_outlined),
                    title: Text(l10n.offerResponseNotice),
                    trailing: TextButton(
                      onPressed: () => context.goNamed(RouteNames.supplyOffers),
                      child: Text(l10n.reviewOffer),
                    ),
                  ),
                ),
              ],
              if ((data.invoices['unpaid'] ?? 0) != 0) ...[
                const SizedBox(height: 16),
                BayadCard(child: Text(l10n.unpaidInvoiceNotice)),
              ],
              const SizedBox(height: 16),
              BayadSectionHeader(
                title: l10n.recentOrders,
                actionLabel: l10n.viewAllOrders,
                onAction: () => context.goNamed(RouteNames.orders),
              ),
              if (data.recentOrders.isEmpty)
                BayadCard(child: Text(l10n.noOrdersFound))
              else
                for (final order in data.recentOrders)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: OrderCard(
                      order: order,
                      onTap: () => context.goNamed(
                        RouteNames.orderDetail,
                        pathParameters: {'id': '${order.id}'},
                      ),
                    ),
                  ),
            ],
          ),
        ),
      ),
    );
  }
}
