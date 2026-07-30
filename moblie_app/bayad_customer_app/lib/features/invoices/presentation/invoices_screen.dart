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

class InvoicesScreen extends ConsumerWidget {
  const InvoicesScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final invoices = ref.watch(invoicesProvider);
    final l10n = AppLocalizations.of(context);
    return AppScaffold(
      title: l10n.myInvoices,
      currentIndex: 4,
      child: invoices.when(
        loading: () => LoadingView(message: l10n.loadingInvoices),
        error: (error, _) => ErrorView(
          message: l10n.invoicesLoadError,
          retryLabel: l10n.retry,
          onRetry: () => ref.invalidate(invoicesProvider),
        ),
        data: (page) => page.results.isEmpty
            ? EmptyView(message: l10n.noInvoicesFound)
            : RefreshIndicator(
                onRefresh: () async => ref.refresh(invoicesProvider.future),
                child: ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 104),
                  itemCount: page.results.length,
                  separatorBuilder: (context, index) =>
                      const SizedBox(height: 12),
                  itemBuilder: (context, index) => InvoiceCard(
                    invoice: page.results[index],
                    onTap: () => context.pushNamed(
                      RouteNames.invoiceDetail,
                      pathParameters: {'id': '${page.results[index].id}'},
                    ),
                  ),
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
    final l10n = AppLocalizations.of(context);
    final isArabic = Directionality.of(context) == TextDirection.rtl;
    return AppScaffold(
      title: l10n.invoiceDetails,
      currentIndex: 4,
      child: invoice.when(
        loading: () => LoadingView(message: l10n.loadingInvoice),
        error: (error, _) => ErrorView(
          message: l10n.invoiceLoadError,
          retryLabel: l10n.retry,
          onRetry: () => ref.invalidate(invoiceDetailProvider(invoiceId)),
        ),
        data: (data) => ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 104),
          children: [
            BayadCard(
              child: ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(
                  data.invoiceNumber,
                  style: const TextStyle(fontWeight: FontWeight.w900),
                ),
                subtitle: Text(
                  '${data.orderNumber} • ${formatDate(data.issuedAt)}',
                ),
                trailing: StatusBadge(status: data.paymentStatus),
              ),
            ),
            if (data.paymentStatus == 'unpaid')
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: BayadCard(child: Text(l10n.unpaidInvoiceNotice)),
              ),
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
