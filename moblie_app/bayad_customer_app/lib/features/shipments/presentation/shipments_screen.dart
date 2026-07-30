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

class ShipmentsScreen extends ConsumerWidget {
  const ShipmentsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final shipments = ref.watch(shipmentsProvider);
    final l10n = AppLocalizations.of(context);
    return AppScaffold(
      title: l10n.myShipments,
      currentIndex: 4,
      child: shipments.when(
        loading: () => LoadingView(message: l10n.loadingShipments),
        error: (error, _) => ErrorView(
          message: l10n.shipmentsLoadError,
          retryLabel: l10n.retry,
          onRetry: () => ref.invalidate(shipmentsProvider),
        ),
        data: (page) => page.results.isEmpty
            ? EmptyView(message: l10n.noShipmentsFound)
            : RefreshIndicator(
                onRefresh: () async => ref.refresh(shipmentsProvider.future),
                child: ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 104),
                  itemCount: page.results.length,
                  separatorBuilder: (context, index) =>
                      const SizedBox(height: 12),
                  itemBuilder: (context, index) => ShipmentCard(
                    shipment: page.results[index],
                    onTap: () => context.pushNamed(
                      RouteNames.shipmentDetail,
                      pathParameters: {'id': '${page.results[index].id}'},
                    ),
                  ),
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
    final l10n = AppLocalizations.of(context);
    final isArabic = Directionality.of(context) == TextDirection.rtl;
    return AppScaffold(
      title: l10n.shipmentTracking,
      currentIndex: 4,
      child: shipment.when(
        loading: () => LoadingView(message: l10n.loadingShipment),
        error: (error, _) => ErrorView(
          message: l10n.shipmentLoadError,
          retryLabel: l10n.retry,
          onRetry: () => ref.invalidate(shipmentDetailProvider(shipmentId)),
        ),
        data: (data) => ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 104),
          children: [
            BayadCard(
              child: ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(
                  data.shipmentNumber,
                  style: const TextStyle(fontWeight: FontWeight.w900),
                ),
                subtitle: Text('${data.orderNumber} • ${data.invoiceNumber}'),
                trailing: StatusBadge(status: data.status),
              ),
            ),
            const SizedBox(height: 12),
            BayadCard(child: WorkflowStepper(steps: data.workflowSteps)),
            const SizedBox(height: 12),
            ListTile(
              title: Text(l10n.driver),
              subtitle: Text(data.driverName.isEmpty ? '-' : data.driverName),
            ),
            ListTile(
              title: Text(l10n.vehicle),
              subtitle: Text(
                data.vehicleNumber.isEmpty ? '-' : data.vehicleNumber,
              ),
            ),
            SectionHeader(title: l10n.items),
            for (final item in data.items)
              ListTile(
                title: Text(item.localizedName(isArabic)),
                subtitle: QuantityText(value: item.quantity, unit: item.unit),
              ),
          ],
        ),
      ),
    );
  }
}
