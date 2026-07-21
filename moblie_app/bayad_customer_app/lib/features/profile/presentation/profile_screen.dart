import 'package:flutter/material.dart';
import 'package:bayad_customer_app/l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/storage/preferences_provider.dart';
import '../../../shared/widgets/app_scaffold.dart';
import '../../../shared/widgets/customer_widgets.dart';
import '../../auth/presentation/auth_controller.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  Future<void> _confirmLogout(BuildContext context, WidgetRef ref) async {
    final ok = await showModalBottomSheet<bool>(
      context: context,
      builder: (context) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Logout', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900)),
            const SizedBox(height: 8),
            const Text('Are you sure you want to logout from the customer application?'),
            const SizedBox(height: 18),
            FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Logout')),
            TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          ],
        ),
      ),
    );
    if (ok == true) await ref.read(authControllerProvider.notifier).logout();
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final customer = ref.watch(authControllerProvider).customer;
    return AppScaffold(
      title: l10n.profile,
      currentIndex: 3,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          CustomerHeaderCard(name: customer?.name ?? '', code: customer?.code ?? ''),
          const SizedBox(height: 16),
          _ProfileRow(label: l10n.emailAddress, value: customer?.email ?? ''),
          _ProfileRow(label: l10n.phone, value: customer?.phone ?? ''),
          if ((customer?.secondaryPhone ?? '').isNotEmpty) _ProfileRow(label: l10n.secondaryPhone, value: customer!.secondaryPhone),
          _ProfileRow(label: l10n.address, value: customer?.address ?? ''),
          _ProfileRow(label: l10n.customerType, value: customer?.customerType ?? ''),
          Card(
            child: ListTile(
              leading: const Icon(Icons.language),
              title: const Text('Language'),
              trailing: TextButton(onPressed: () => ref.read(localeControllerProvider.notifier).toggle(), child: Text(l10n.language)),
            ),
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(onPressed: () => _confirmLogout(context, ref), icon: const Icon(Icons.logout), label: Text(l10n.logout)),
        ],
      ),
    );
  }
}

class _ProfileRow extends StatelessWidget {
  const _ProfileRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Card(
        child: ListTile(
          title: Text(label, style: Theme.of(context).textTheme.labelLarge),
          subtitle: Directionality(textDirection: TextDirection.ltr, child: Text(value.isEmpty ? '-' : value)),
        ),
      ),
    );
  }
}
