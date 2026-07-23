import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/routing/route_names.dart';
import '../../../shared/data/mobile_providers.dart';
import '../../../shared/widgets/app_scaffold.dart';
import '../../../shared/widgets/customer_widgets.dart';
import '../../../shared/widgets/empty_view.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/loading_view.dart';

class ShipmentsScreen extends ConsumerWidget {
  const ShipmentsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final shipments = ref.watch(shipmentsProvider);
    return AppScaffold(
      title: 'My Shipments',
      currentIndex: 4,
      child: shipments.when(
        loading: () => const LoadingView(message: 'Loading Shipments...'),
        error: (error, _) => ErrorView(message: 'Unable to load Shipments. Please try again.', retryLabel: 'Retry', onRetry: () => ref.invalidate(shipmentsProvider)),
        data: (page) => page.results.isEmpty
            ? const EmptyView(message: 'No Shipment information is available.')
            : RefreshIndicator(
                onRefresh: () async => ref.refresh(shipmentsProvider.future),
                child: ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: page.results.length,
                  separatorBuilder: (context, index) => const SizedBox(height: 12),
                  itemBuilder: (context, index) => ShipmentCard(shipment: page.results[index], onTap: () => context.goNamed(RouteNames.shipmentDetail, pathParameters: {'id': '${page.results[index].id}'})),
                ),
              ),
      ),
    );
  }
}

class ShipmentDetailScreen extends ConsumerWidget {
  const ShipmentDetailScreen({super.key, required this.shipmentId});
  final int shipmentId;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final shipment = ref.watch(shipmentDetailProvider(shipmentId));
    return AppScaffold(
      title: 'Shipment Tracking',
      currentIndex: 4,
      child: shipment.when(
        loading: () => const LoadingView(message: 'Loading Shipment...'),
        error: (error, _) => ErrorView(message: 'Unable to load Shipment. Please try again.', retryLabel: 'Retry', onRetry: () => ref.invalidate(shipmentDetailProvider(shipmentId))),
        data: (data) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Card(child: ListTile(title: Text(data.shipmentNumber, style: const TextStyle(fontWeight: FontWeight.w900)), subtitle: Text('${data.orderNumber} • ${data.invoiceNumber}'), trailing: StatusBadge(status: data.status))),
            const SizedBox(height: 12),
            Card(child: Padding(padding: const EdgeInsets.all(16), child: WorkflowStepper(steps: data.workflowSteps))),
            const SizedBox(height: 12),
            ListTile(title: const Text('Driver'), subtitle: Text(data.driverName.isEmpty ? '-' : data.driverName)),
            ListTile(title: const Text('Vehicle'), subtitle: Text(data.vehicleNumber.isEmpty ? '-' : data.vehicleNumber)),
            const SectionHeader(title: 'Items'),
            for (final item in data.items) ListTile(title: Text(item.productNameEn), subtitle: QuantityText(value: item.quantity, unit: item.unit)),
          ],
        ),
      ),
    );
  }
}
