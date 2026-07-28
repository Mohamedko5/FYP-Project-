import 'package:flutter/material.dart';
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
    return AppScaffold(
      title: 'My Orders',
      currentIndex: 3,
      child: Column(
        children: [
          SizedBox(
            height: 56,
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              scrollDirection: Axis.horizontal,
              children: [
                for (final entry in const {
                  'All': null,
                  'Pending': 'pending',
                  'Received': 'received',
                  'Invoiced': 'invoiced',
                  'Ready': 'ready_for_shipment',
                  'Processing': 'processing',
                  'Completed': 'completed',
                  'Cancelled': 'cancelled',
                }.entries)
                  Padding(
                    padding: const EdgeInsetsDirectional.only(end: 8),
                    child: ChoiceChip(
                      label: Text(entry.key),
                      selected: ref.watch(orderFilterProvider) == entry.value,
                      onSelected: (_) =>
                          ref.read(orderFilterProvider.notifier).state =
                              entry.value,
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
              loading: () => const LoadingView(message: 'Loading Orders...'),
              error: (error, _) => ErrorView(
                message: 'Unable to load Orders. Please try again.',
                retryLabel: 'Retry',
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
                          onTap: () => context.goNamed(
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
    return AppScaffold(
      title: 'Order Details',
      currentIndex: 3,
      child: order.when(
        loading: () => const LoadingView(message: 'Loading Order...'),
        error: (error, _) => ErrorView(
          message: 'Unable to load Order. Please try again.',
          retryLabel: 'Retry',
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
            const SectionHeader(title: 'Items'),
            for (final item in data.items)
              ListTile(
                title: Text(item.productNameEn),
                subtitle: QuantityText(value: item.quantity, unit: item.unit),
                trailing: Text(formatMoney(item.lineTotal)),
              ),
            const Divider(),
            ListTile(
              title: const Text('Subtotal'),
              trailing: Text(formatMoney(data.subtotal, data.currency)),
            ),
            ListTile(
              title: const Text('Discount'),
              trailing: Text(formatMoney(data.discountAmount, data.currency)),
            ),
            ListTile(
              title: const Text('Total'),
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
