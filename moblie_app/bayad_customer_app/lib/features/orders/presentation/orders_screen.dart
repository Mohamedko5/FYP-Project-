import 'package:flutter/material.dart';
import 'package:bayad_customer_app/l10n/app_localizations.dart';

import '../../../shared/widgets/placeholder_module_screen.dart';

class OrdersScreen extends StatelessWidget {
  const OrdersScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return PlaceholderModuleScreen(title: AppLocalizations.of(context).myOrders);
  }
}
