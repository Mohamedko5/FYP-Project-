import 'package:flutter/material.dart';
import 'package:bayad_customer_app/l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/widgets/app_scaffold.dart';
import '../../auth/presentation/auth_controller.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final customer = ref.watch(authControllerProvider).customer;
    return AppScaffold(
      title: l10n.profile,
      actions: [
        IconButton(
          onPressed: () => ref.read(authControllerProvider.notifier).logout(),
          icon: const Icon(Icons.logout),
          tooltip: l10n.logout,
        ),
      ],
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          _ProfileRow(label: l10n.customerCode, value: customer?.code ?? ''),
          _ProfileRow(label: l10n.customerName, value: customer?.name ?? ''),
          _ProfileRow(label: l10n.emailAddress, value: customer?.email ?? ''),
          _ProfileRow(label: l10n.phone, value: customer?.phone ?? ''),
          if ((customer?.secondaryPhone ?? '').isNotEmpty)
            _ProfileRow(label: l10n.secondaryPhone, value: customer!.secondaryPhone),
          _ProfileRow(label: l10n.address, value: customer?.address ?? ''),
          _ProfileRow(label: l10n.customerType, value: customer?.customerType ?? ''),
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
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: Theme.of(context).textTheme.labelLarge),
            const SizedBox(height: 6),
            Directionality(textDirection: TextDirection.ltr, child: Text(value.isEmpty ? '-' : value)),
          ],
        ),
      ),
    );
  }
}
