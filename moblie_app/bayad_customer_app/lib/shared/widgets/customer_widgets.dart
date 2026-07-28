import 'package:flutter/material.dart';
import 'package:bayad_customer_app/l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart' as intl;

import '../../core/theme/app_colors.dart';
import '../data/mobile_providers.dart';
import '../models/mobile_models.dart';
import 'bayad_design_system.dart';

String formatMoney(double value, [String currency = 'SDG']) =>
    '$currency ${intl.NumberFormat('#,##0.00').format(value)}';
String formatLocalizedMoney(
  double value, {
  String currency = 'SDG',
  bool isArabic = false,
}) {
  final amount = intl.NumberFormat('#,##0.00').format(value);
  return isArabic ? '$amount $currency' : '$currency $amount';
}

String formatQuantity(double value, String unit) =>
    '${intl.NumberFormat('#,##0.###').format(value)} $unit';
String formatDate(DateTime? date) =>
    date == null ? '-' : intl.DateFormat('dd MMM yyyy').format(date.toLocal());

class BayadBottomNavigation extends ConsumerWidget {
  const BayadBottomNavigation({
    super.key,
    required this.currentIndex,
    required this.onTap,
  });

  final int currentIndex;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final unreadCount = ref.watch(chatUnreadCountProvider).valueOrNull ?? 0;
    final chatIcon = unreadCount > 0
        ? Badge.count(
            count: unreadCount,
            child: const Icon(Icons.chat_bubble_outline),
          )
        : const Icon(Icons.chat_bubble_outline);
    final selectedChatIcon = unreadCount > 0
        ? Badge.count(count: unreadCount, child: const Icon(Icons.chat_bubble))
        : const Icon(Icons.chat_bubble);
    return NavigationBar(
      elevation: 0,
      selectedIndex: currentIndex,
      onDestinationSelected: onTap,
      destinations: [
        NavigationDestination(
          icon: const Icon(Icons.home_outlined),
          selectedIcon: const Icon(Icons.home),
          label: l10n.home,
        ),
        NavigationDestination(
          icon: const Icon(Icons.inventory_2_outlined),
          selectedIcon: const Icon(Icons.inventory_2),
          label: l10n.products,
        ),
        NavigationDestination(
          icon: chatIcon,
          selectedIcon: selectedChatIcon,
          label: l10n.chat,
        ),
        NavigationDestination(
          icon: const Icon(Icons.receipt_long_outlined),
          selectedIcon: const Icon(Icons.receipt_long),
          label: l10n.myOrders,
        ),
        NavigationDestination(
          icon: const Icon(Icons.person_outline),
          selectedIcon: const Icon(Icons.person),
          label: l10n.account,
        ),
      ],
    );
  }
}

class StatusBadge extends StatelessWidget {
  const StatusBadge({super.key, required this.status, this.localizedLabel});

  final String status;
  final String? localizedLabel;

  @override
  Widget build(BuildContext context) {
    final normalized = status.replaceAll('_', ' ');
    final label =
        localizedLabel ??
        normalized
            .split(' ')
            .map(
              (part) => part.isEmpty
                  ? part
                  : '${part[0].toUpperCase()}${part.substring(1)}',
            )
            .join(' ');
    final color = switch (status) {
      'paid' || 'completed' || 'available' => AppColors.success,
      'processing' ||
      'ready_for_shipment' ||
      'invoiced' ||
      'received' ||
      'partial' ||
      'unpaid' => AppColors.warning,
      'cancelled' || 'unavailable' => AppColors.danger,
      _ => AppColors.mutedText,
    };
    return Semantics(
      label: label,
      child: BayadStatusChip(label: label, color: color),
    );
  }
}

class PriceText extends StatelessWidget {
  const PriceText({super.key, required this.value, this.currency = 'SDG'});
  final double value;
  final String currency;
  @override
  Widget build(BuildContext context) => Text(
    formatMoney(value, currency),
    style: Theme.of(
      context,
    ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
  );
}

class QuantityText extends StatelessWidget {
  const QuantityText({super.key, required this.value, required this.unit});
  final double value;
  final String unit;
  @override
  Widget build(BuildContext context) => Directionality(
    textDirection: TextDirection.ltr,
    child: Text(formatQuantity(value, unit)),
  );
}

class SectionHeader extends StatelessWidget {
  const SectionHeader({
    super.key,
    required this.title,
    this.actionLabel,
    this.onAction,
  });
  final String title;
  final String? actionLabel;
  final VoidCallback? onAction;
  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(
            title,
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
          ),
        ),
        if (actionLabel != null)
          TextButton(onPressed: onAction, child: Text(actionLabel!)),
      ],
    );
  }
}

class LoadingSkeleton extends StatelessWidget {
  const LoadingSkeleton({super.key});
  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemBuilder: (context, index) => Container(
        height: 104,
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.border),
        ),
      ),
      separatorBuilder: (context, index) => const SizedBox(height: 12),
      itemCount: 5,
    );
  }
}

class PullToRefreshWrapper extends StatelessWidget {
  const PullToRefreshWrapper({
    super.key,
    required this.onRefresh,
    required this.child,
  });
  final RefreshCallback onRefresh;
  final Widget child;
  @override
  Widget build(BuildContext context) =>
      RefreshIndicator(onRefresh: onRefresh, child: child);
}

class CustomerHeaderCard extends StatelessWidget {
  const CustomerHeaderCard({super.key, required this.name, required this.code});
  final String name;
  final String code;
  @override
  Widget build(BuildContext context) {
    return BayadCard(
      child: Padding(
        padding: EdgeInsets.zero,
        child: Row(
          children: [
            Container(
              width: 54,
              height: 54,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: AppColors.green,
                borderRadius: BorderRadius.circular(18),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.green.withValues(alpha: 0.25),
                    blurRadius: 18,
                    offset: const Offset(0, 9),
                  ),
                ],
              ),
              child: const Text(
                'B',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w900,
                  fontSize: 22,
                ),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    name,
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Directionality(
                    textDirection: TextDirection.ltr,
                    child: Text(
                      code,
                      style: const TextStyle(color: AppColors.mutedText),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class SummaryCard extends StatelessWidget {
  const SummaryCard({
    super.key,
    required this.label,
    required this.value,
    required this.icon,
  });
  final String label;
  final String value;
  final IconData icon;
  @override
  Widget build(BuildContext context) {
    return BayadIconTile(icon: icon, label: label, value: value);
  }
}

class BayadProductCard extends StatelessWidget {
  const BayadProductCard({
    super.key,
    required this.product,
    required this.isArabic,
    required this.onDetails,
    required this.onAdd,
    this.addToCartLabel,
    this.availableLabel,
    this.unavailableLabel,
  });
  final Product product;
  final bool isArabic;
  final VoidCallback onDetails;
  final VoidCallback onAdd;
  final String? addToCartLabel;
  final String? availableLabel;
  final String? unavailableLabel;
  @override
  Widget build(BuildContext context) {
    final available = product.units.any((unit) => unit.isAvailable);
    final defaultUnit = product.units
        .where((unit) => unit.isDefault)
        .firstOrNull;
    final displayUnit =
        defaultUnit ?? (product.units.isEmpty ? null : product.units.first);
    final statusLabel = product.stockStatus == 'unavailable'
        ? unavailableLabel
        : product.stockStatus == 'available'
        ? availableLabel
        : null;
    return BayadCard(
      onTap: onDetails,
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(
            flex: 44,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(18),
              child: DecoratedBox(
                decoration: const BoxDecoration(color: AppColors.primarySoft),
                child: _ProductImage(image: product.image),
              ),
            ),
          ),
          const SizedBox(height: 10),
          SizedBox(
            height: 42,
            child: Align(
              alignment: AlignmentDirectional.topStart,
              child: Text(
                product.localizedName(isArabic),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.start,
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w900,
                  height: isArabic ? 1.28 : 1.2,
                ),
              ),
            ),
          ),
          const SizedBox(height: 6),
          SizedBox(
            height: 22,
            child: Align(
              alignment: AlignmentDirectional.centerStart,
              child: Directionality(
                textDirection: TextDirection.ltr,
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: AlignmentDirectional.centerStart,
                  child: Text(
                    formatLocalizedMoney(
                      product.startingPrice,
                      isArabic: isArabic,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
              ),
            ),
          ),
          if (displayUnit != null) ...[
            const SizedBox(height: 3),
            Text(
              displayUnit.unit,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: AppColors.mutedText,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
          const Spacer(),
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: StatusBadge(
              status: product.stockStatus,
              localizedLabel: statusLabel,
            ),
          ),
          const SizedBox(height: 9),
          SizedBox(
            width: double.infinity,
            height: 44,
            child: FilledButton(
              onPressed: available ? onAdd : null,
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(44),
                padding: const EdgeInsets.symmetric(horizontal: 8),
              ),
              child: FittedBox(
                fit: BoxFit.scaleDown,
                child: Text(
                  addToCartLabel ?? 'Add to Cart',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ProductImage extends StatelessWidget {
  const _ProductImage({required this.image});

  final String? image;

  @override
  Widget build(BuildContext context) {
    final imageUrl = image?.trim();
    if (imageUrl == null || imageUrl.isEmpty) {
      return const Center(
        child: Icon(Icons.grass, color: AppColors.green, size: 42),
      );
    }
    return Image.network(
      imageUrl,
      fit: BoxFit.cover,
      errorBuilder: (context, error, stackTrace) => const Center(
        child: Icon(Icons.grass, color: AppColors.green, size: 42),
      ),
    );
  }
}

class ProductCard extends StatelessWidget {
  const ProductCard({
    super.key,
    required this.product,
    required this.isArabic,
    required this.onDetails,
    required this.onAdd,
    this.addToCartLabel,
    this.availableLabel,
    this.unavailableLabel,
  });
  final Product product;
  final bool isArabic;
  final VoidCallback onDetails;
  final VoidCallback onAdd;
  final String? addToCartLabel;
  final String? availableLabel;
  final String? unavailableLabel;
  @override
  Widget build(BuildContext context) {
    return BayadProductCard(
      product: product,
      isArabic: isArabic,
      onDetails: onDetails,
      onAdd: onAdd,
      addToCartLabel: addToCartLabel,
      availableLabel: availableLabel,
      unavailableLabel: unavailableLabel,
    );
  }
}

class LegacyProductCard extends StatelessWidget {
  const LegacyProductCard({
    super.key,
    required this.product,
    required this.isArabic,
    required this.onDetails,
    required this.onAdd,
  });
  final Product product;
  final bool isArabic;
  final VoidCallback onDetails;
  final VoidCallback onAdd;
  @override
  Widget build(BuildContext context) {
    return BayadCard(
      child: Padding(
        padding: EdgeInsets.zero,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: AppColors.warmBackground,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.grass, color: AppColors.green),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    product.localizedName(isArabic),
                    style: const TextStyle(fontWeight: FontWeight.w900),
                  ),
                ),
                StatusBadge(status: product.stockStatus),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              product.description,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: AppColors.mutedText),
            ),
            const SizedBox(height: 10),
            PriceText(value: product.startingPrice),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: onDetails,
                    child: const Text('View Details'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: FilledButton(
                    onPressed: product.units.any((unit) => unit.isAvailable)
                        ? onAdd
                        : null,
                    child: const Text('Add to Cart'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class OrderCard extends StatelessWidget {
  const OrderCard({super.key, required this.order, required this.onTap});
  final OrderSummary order;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => _RecordCard(
    title: order.orderNumber,
    subtitle: '${formatDate(order.createdAt)} • ${order.productSummary}',
    amount: formatMoney(order.totalAmount, order.currency),
    status: order.status,
    onTap: onTap,
  );
}

class InvoiceCard extends StatelessWidget {
  const InvoiceCard({super.key, required this.invoice, required this.onTap});
  final InvoiceSummary invoice;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => _RecordCard(
    title: invoice.invoiceNumber,
    subtitle: '${invoice.orderNumber} • ${formatDate(invoice.issuedAt)}',
    amount: formatMoney(invoice.totalAmount, invoice.currency),
    status: invoice.paymentStatus,
    onTap: onTap,
  );
}

class ShipmentCard extends StatelessWidget {
  const ShipmentCard({super.key, required this.shipment, required this.onTap});
  final ShipmentSummary shipment;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => _RecordCard(
    title: shipment.shipmentNumber,
    subtitle: '${shipment.orderNumber} • ${shipment.productSummary}',
    amount: shipment.driverName.isEmpty
        ? 'Driver pending'
        : shipment.driverName,
    status: shipment.status,
    onTap: onTap,
  );
}

class _RecordCard extends StatelessWidget {
  const _RecordCard({
    required this.title,
    required this.subtitle,
    required this.amount,
    required this.status,
    required this.onTap,
  });
  final String title;
  final String subtitle;
  final String amount;
  final String status;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    return BayadCard(
      onTap: onTap,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              color: AppColors.primarySoft,
              borderRadius: BorderRadius.circular(15),
            ),
            child: const Icon(
              Icons.receipt_long_outlined,
              color: AppColors.green,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Directionality(
                        textDirection: TextDirection.ltr,
                        child: Text(
                          title,
                          style: const TextStyle(fontWeight: FontWeight.w900),
                        ),
                      ),
                    ),
                    StatusBadge(status: status),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  subtitle,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: AppColors.mutedText),
                ),
                const SizedBox(height: 10),
                Text(
                  amount,
                  style: const TextStyle(fontWeight: FontWeight.w900),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class WorkflowStepper extends StatelessWidget {
  const WorkflowStepper({super.key, required this.steps});
  final List<WorkflowStepModel> steps;
  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        for (final step in steps)
          ListTile(
            dense: true,
            leading: Icon(
              step.state == 'completed'
                  ? Icons.check_circle
                  : step.state == 'current'
                  ? Icons.radio_button_checked
                  : Icons.radio_button_unchecked,
              color: step.state == 'upcoming'
                  ? AppColors.mutedText
                  : AppColors.green,
            ),
            title: Text(step.label),
          ),
      ],
    );
  }
}
