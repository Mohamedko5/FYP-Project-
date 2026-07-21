import 'package:flutter/material.dart';
import 'package:bayad_customer_app/l10n/app_localizations.dart';

import '../../../shared/widgets/placeholder_module_screen.dart';

class ShipmentsScreen extends StatelessWidget {
  const ShipmentsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return PlaceholderModuleScreen(title: AppLocalizations.of(context).myShipments);
  }
}
