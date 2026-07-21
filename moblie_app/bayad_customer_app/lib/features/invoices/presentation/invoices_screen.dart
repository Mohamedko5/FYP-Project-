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

class InvoicesScreen extends ConsumerWidget {
  const InvoicesScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final invoices = ref.watch(invoicesProvider);
    return AppScaffold(
      title: 'My Invoices',
      currentIndex: 3,
      child: invoices.when(
        loading: () => const LoadingView(message: 'Loading Invoices...'),
        error: (error, _) => ErrorView(message: 'Unable to load Invoices. Please try again.', retryLabel: 'Retry', onRetry: () => ref.invalidate(invoicesProvider)),
        data: (page) => page.results.isEmpty
            ? const EmptyView(message: 'You do not have any Invoices yet.')
            : RefreshIndicator(
                onRefresh: () async => ref.refresh(invoicesProvider.future),
                child: ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: page.results.length,
                  separatorBuilder: (context, index) => const SizedBox(height: 12),
                  itemBuilder: (context, index) => InvoiceCard(invoice: page.results[index], onTap: () => context.goNamed(RouteNames.invoiceDetail, pathParameters: {'id': '${page.results[index].id}'})),
                ),
              ),
      ),
    );
  }
}

class InvoiceDetailScreen extends ConsumerWidget {
  const InvoiceDetailScreen({super.key, required this.invoiceId});
  final int invoiceId;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final invoice = ref.watch(invoiceDetailProvider(invoiceId));
    return AppScaffold(
      title: 'Invoice Details',
      currentIndex: 3,
      child: invoice.when(
        loading: () => const LoadingView(message: 'Loading Invoice...'),
        error: (error, _) => ErrorView(message: 'Unable to load Invoice. Please try again.', retryLabel: 'Retry', onRetry: () => ref.invalidate(invoiceDetailProvider(invoiceId))),
        data: (data) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Card(child: ListTile(title: Text(data.invoiceNumber, style: const TextStyle(fontWeight: FontWeight.w900)), subtitle: Text('${data.orderNumber} • ${formatDate(data.issuedAt)}'), trailing: StatusBadge(status: data.paymentStatus))),
            if (data.paymentStatus == 'unpaid') const Padding(padding: EdgeInsets.symmetric(vertical: 12), child: Card(child: Padding(padding: EdgeInsets.all(16), child: Text('Please contact Bayad Company to complete payment.')))),
            const SectionHeader(title: 'Items'),
            for (final item in data.items) ListTile(title: Text(item.productNameEn), subtitle: QuantityText(value: item.quantity, unit: item.unit), trailing: Text(formatMoney(item.lineTotal))),
            const Divider(),
            ListTile(title: const Text('Subtotal'), trailing: Text(formatMoney(data.subtotal, data.currency))),
            ListTile(title: const Text('Discount'), trailing: Text(formatMoney(data.discountAmount, data.currency))),
            ListTile(title: const Text('Total'), trailing: PriceText(value: data.totalAmount, currency: data.currency)),
          ],
        ),
      ),
    );
  }
}
