import 'package:flutter/material.dart';
import 'package:bayad_customer_app/l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/routing/route_names.dart';
import '../../../shared/data/mobile_providers.dart';
import '../../../shared/widgets/app_scaffold.dart';
import '../../../shared/widgets/bayad_design_system.dart';
import '../../../shared/widgets/customer_widgets.dart';
import '../../../shared/widgets/empty_view.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/loading_view.dart';

class OrdersScreen extends ConsumerWidget {
  const OrdersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final orders = ref.watch(ordersProvider);
    final l10n = AppLocalizations.of(context);
    final filterLabels = {
      'all': l10n.viewAllOrders,
      'pending': l10n.pending,
      'received': l10n.received,
      'invoiced': l10n.invoiced,
      'ready_for_shipment': l10n.readyForShipment,
      'processing': l10n.processing,
      'completed': l10n.completed,
      'cancelled': l10n.cancelled,
    };
    return AppScaffold(
      title: l10n.myOrders,
      child: Column(
        children: [
          SizedBox(
            height: 56,
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              scrollDirection: Axis.horizontal,
              children: [
                for (final entry in filterLabels.entries)
                  Padding(
                    padding: const EdgeInsetsDirectional.only(end: 8),
                    child: ChoiceChip(
                      label: Text(entry.value),
                      selected:
                          ref.watch(orderFilterProvider) ==
                          (entry.key == 'all' ? null : entry.key),
                      onSelected: (_) =>
                          ref.read(orderFilterProvider.notifier).state =
                              entry.key == 'all' ? null : entry.key,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(999),
                      ),
                    ),
                  ),
              ],
            ),
          ),
          Expanded(
            child: orders.when(
              loading: () => LoadingView(message: l10n.loadingOrders),
              error: (error, _) => ErrorView(
                message: l10n.ordersLoadError,
                retryLabel: l10n.retry,
                onRetry: () => ref.invalidate(ordersProvider),
              ),
              data: (page) => page.results.isEmpty
                  ? const EmptyView(message: 'No Orders found.')
                  : RefreshIndicator(
                      onRefresh: () async => ref.refresh(ordersProvider.future),
                      child: ListView.separated(
                        padding: const EdgeInsets.fromLTRB(16, 8, 16, 104),
                        itemCount: page.results.length,
                        separatorBuilder: (context, index) =>
                            const SizedBox(height: 12),
                        itemBuilder: (context, index) => OrderCard(
                          order: page.results[index],
                          onTap: () => context.pushNamed(
                            RouteNames.orderDetail,
                            pathParameters: {'id': '${page.results[index].id}'},
                          ),
                        ),
                      ),
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

class OrderDetailScreen extends ConsumerWidget {
  const OrderDetailScreen({super.key, required this.orderId});
  final int orderId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final order = ref.watch(orderDetailProvider(orderId));
    final l10n = AppLocalizations.of(context);
    final isArabic = Directionality.of(context) == TextDirection.rtl;
    return AppScaffold(
      title: l10n.orderDetails,
      child: order.when(
        loading: () => LoadingView(message: l10n.loadingOrder),
        error: (error, _) => ErrorView(
          message: l10n.orderLoadError,
          retryLabel: l10n.retry,
          onRetry: () => ref.invalidate(orderDetailProvider(orderId)),
        ),
        data: (data) => ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 104),
          children: [
            BayadCard(
              child: ListTile(
                contentPadding: EdgeInsets.zero,
                title: Directionality(
                  textDirection: TextDirection.ltr,
                  child: Text(
                    data.orderNumber,
                    style: const TextStyle(fontWeight: FontWeight.w900),
                  ),
                ),
                subtitle: Text(formatDate(data.createdAt)),
                trailing: StatusBadge(status: data.status),
              ),
            ),
            const SizedBox(height: 12),
            BayadCard(child: WorkflowStepper(steps: data.workflowSteps)),
            const SizedBox(height: 12),
            SectionHeader(title: l10n.items),
            for (final item in data.items)
              ListTile(
                title: Text(item.localizedName(isArabic)),
                subtitle: QuantityText(value: item.quantity, unit: item.unit),
                trailing: Text(formatMoney(item.lineTotal)),
              ),
            const Divider(),
            ListTile(
              title: Text(l10n.subtotal),
              trailing: Text(formatMoney(data.subtotal, data.currency)),
            ),
            ListTile(
              title: Text(l10n.discount),
              trailing: Text(formatMoney(data.discountAmount, data.currency)),
            ),
            ListTile(
              title: Text(l10n.total),
              trailing: PriceText(
                value: data.totalAmount,
                currency: data.currency,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
