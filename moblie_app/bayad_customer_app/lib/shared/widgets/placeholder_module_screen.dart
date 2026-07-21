import 'package:flutter/material.dart';
import 'package:bayad_customer_app/l10n/app_localizations.dart';

import 'app_scaffold.dart';
import 'empty_view.dart';

class PlaceholderModuleScreen extends StatelessWidget {
  const PlaceholderModuleScreen({super.key, required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return AppScaffold(
      title: title,
      child: EmptyView(message: l10n.phaseOnePlaceholder),
    );
  }
}
