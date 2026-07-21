import 'package:flutter/material.dart';
import 'package:bayad_customer_app/l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/routing/route_names.dart';
import '../../../core/storage/preferences_provider.dart';
import '../../../shared/widgets/app_scaffold.dart';
import '../../auth/presentation/auth_controller.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final customer = ref.watch(authControllerProvider).customer;
    final actions = [
      _HomeAction(label: l10n.products, routeName: RouteNames.products, icon: Icons.inventory_2_outlined),
      _HomeAction(label: l10n.myOrders, routeName: RouteNames.orders, icon: Icons.receipt_long_outlined),
      _HomeAction(label: l10n.myInvoices, routeName: RouteNames.invoices, icon: Icons.request_quote_outlined),
      _HomeAction(label: l10n.myShipments, routeName: RouteNames.shipments, icon: Icons.local_shipping_outlined),
    ];
    return AppScaffold(
      title: l10n.home,
      actions: [
        TextButton(onPressed: () => ref.read(localeControllerProvider.notifier).toggle(), child: Text(l10n.language)),
        IconButton(onPressed: () => context.goNamed(RouteNames.profile), icon: const Icon(Icons.person_outline), tooltip: l10n.profile),
        IconButton(onPressed: () => ref.read(authControllerProvider.notifier).logout(), icon: const Icon(Icons.logout), tooltip: l10n.logout),
      ],
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(l10n.companyName, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                  const SizedBox(height: 12),
                  Text(l10n.greeting(customer?.name ?? '')),
                  const SizedBox(height: 6),
                  Directionality(textDirection: TextDirection.ltr, child: Text('${l10n.customerCode}: ${customer?.code ?? ''}')),
                ],
              ),
            ),
          ),
          const SizedBox(height: 18),
          ...actions.map((action) => Card(
                child: ListTile(
                  leading: Icon(action.icon),
                  title: Text(action.label),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.goNamed(action.routeName),
                ),
              )),
        ],
      ),
    );
  }
}

class _HomeAction {
  const _HomeAction({required this.label, required this.routeName, required this.icon});
  final String label;
  final String routeName;
  final IconData icon;
}
