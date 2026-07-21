import 'package:flutter/material.dart';
import 'package:intl/intl.dart' as intl;

import '../../core/theme/app_colors.dart';
import '../models/mobile_models.dart';

String formatMoney(double value, [String currency = 'SDG']) => '$currency ${intl.NumberFormat('#,##0.00').format(value)}';
String formatQuantity(double value, String unit) => '${intl.NumberFormat('#,##0.###').format(value)} $unit';
String formatDate(DateTime? date) => date == null ? '-' : intl.DateFormat('dd MMM yyyy').format(date.toLocal());

class BayadBottomNavigation extends StatelessWidget {
  const BayadBottomNavigation({super.key, required this.currentIndex, required this.onTap});

  final int currentIndex;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context) {
    return NavigationBar(
      selectedIndex: currentIndex,
      onDestinationSelected: onTap,
      destinations: const [
        NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'Home'),
        NavigationDestination(icon: Icon(Icons.inventory_2_outlined), selectedIcon: Icon(Icons.inventory_2), label: 'Products'),
        NavigationDestination(icon: Icon(Icons.receipt_long_outlined), selectedIcon: Icon(Icons.receipt_long), label: 'Orders'),
        NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: 'Account'),
      ],
    );
  }
}

class StatusBadge extends StatelessWidget {
  const StatusBadge({super.key, required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final normalized = status.replaceAll('_', ' ');
    final color = switch (status) {
      'paid' || 'completed' || 'available' => AppColors.green,
      'processing' || 'ready_for_shipment' || 'invoiced' || 'received' => const Color(0xFF80621F),
      'cancelled' || 'unavailable' => AppColors.danger,
      _ => AppColors.mutedText,
    };
    return Semantics(
      label: normalized,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          border: Border.all(color: color.withValues(alpha: 0.32)),
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(
          normalized.split(' ').map((part) => part.isEmpty ? part : '${part[0].toUpperCase()}${part.substring(1)}').join(' '),
          style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w800),
        ),
      ),
    );
  }
}

class PriceText extends StatelessWidget {
  const PriceText({super.key, required this.value, this.currency = 'SDG'});
  final double value;
  final String currency;
  @override
  Widget build(BuildContext context) => Text(formatMoney(value, currency), style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900));
}

class QuantityText extends StatelessWidget {
  const QuantityText({super.key, required this.value, required this.unit});
  final double value;
  final String unit;
  @override
  Widget build(BuildContext context) => Directionality(textDirection: TextDirection.ltr, child: Text(formatQuantity(value, unit)));
}

class SectionHeader extends StatelessWidget {
  const SectionHeader({super.key, required this.title, this.actionLabel, this.onAction});
  final String title;
  final String? actionLabel;
  final VoidCallback? onAction;
  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(child: Text(title, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900))),
        if (actionLabel != null) TextButton(onPressed: onAction, child: Text(actionLabel!)),
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
        decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
      ),
      separatorBuilder: (context, index) => const SizedBox(height: 12),
      itemCount: 5,
    );
  }
}

class PullToRefreshWrapper extends StatelessWidget {
  const PullToRefreshWrapper({super.key, required this.onRefresh, required this.child});
  final RefreshCallback onRefresh;
  final Widget child;
  @override
  Widget build(BuildContext context) => RefreshIndicator(onRefresh: onRefresh, child: child);
}

class CustomerHeaderCard extends StatelessWidget {
  const CustomerHeaderCard({super.key, required this.name, required this.code});
  final String name;
  final String code;
  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Row(
          children: [
            const CircleAvatar(backgroundColor: AppColors.green, foregroundColor: Colors.white, child: Text('B')),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(name, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900)),
                  const SizedBox(height: 4),
                  Directionality(textDirection: TextDirection.ltr, child: Text(code, style: const TextStyle(color: AppColors.mutedText))),
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
  const SummaryCard({super.key, required this.label, required this.value, required this.icon});
  final String label;
  final String value;
  final IconData icon;
  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: AppColors.green),
            const SizedBox(height: 10),
            Text(value, style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900)),
            Text(label, style: const TextStyle(color: AppColors.mutedText)),
          ],
        ),
      ),
    );
  }
}

class ProductCard extends StatelessWidget {
  const ProductCard({super.key, required this.product, required this.isArabic, required this.onDetails, required this.onAdd});
  final Product product;
  final bool isArabic;
  final VoidCallback onDetails;
  final VoidCallback onAdd;
  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Container(width: 48, height: 48, decoration: BoxDecoration(color: AppColors.warmBackground, borderRadius: BorderRadius.circular(10)), child: const Icon(Icons.grass, color: AppColors.green)),
              const SizedBox(width: 12),
              Expanded(child: Text(product.localizedName(isArabic), style: const TextStyle(fontWeight: FontWeight.w900))),
              StatusBadge(status: product.stockStatus),
            ]),
            const SizedBox(height: 10),
            Text(product.description, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: AppColors.mutedText)),
            const SizedBox(height: 10),
            PriceText(value: product.startingPrice),
            const SizedBox(height: 10),
            Row(children: [
              Expanded(child: OutlinedButton(onPressed: onDetails, child: const Text('View Details'))),
              const SizedBox(width: 8),
              Expanded(child: FilledButton(onPressed: product.units.any((unit) => unit.isAvailable) ? onAdd : null, child: const Text('Add to Cart'))),
            ]),
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
        amount: shipment.driverName.isEmpty ? 'Driver pending' : shipment.driverName,
        status: shipment.status,
        onTap: onTap,
      );
}

class _RecordCard extends StatelessWidget {
  const _RecordCard({required this.title, required this.subtitle, required this.amount, required this.status, required this.onTap});
  final String title;
  final String subtitle;
  final String amount;
  final String status;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        onTap: onTap,
        title: Directionality(textDirection: TextDirection.ltr, child: Text(title, style: const TextStyle(fontWeight: FontWeight.w900))),
        subtitle: Text(subtitle, maxLines: 2, overflow: TextOverflow.ellipsis),
        trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [StatusBadge(status: status), const SizedBox(height: 6), Text(amount)]),
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
            leading: Icon(step.state == 'completed' ? Icons.check_circle : step.state == 'current' ? Icons.radio_button_checked : Icons.radio_button_unchecked, color: step.state == 'upcoming' ? AppColors.mutedText : AppColors.green),
            title: Text(step.label),
          ),
      ],
    );
  }
}
