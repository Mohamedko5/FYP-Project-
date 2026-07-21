import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:bayad_customer_app/l10n/app_localizations.dart';

import '../../../core/theme/app_colors.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/loading_view.dart';
import '../domain/auth_state.dart';
import 'auth_controller.dart';

class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      if (ref.read(authControllerProvider).status == AuthStatus.initial) {
        ref.read(authControllerProvider.notifier).restoreSession();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final auth = ref.watch(authControllerProvider);
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 72,
                height: 72,
                alignment: Alignment.center,
                decoration: BoxDecoration(color: AppColors.green, borderRadius: BorderRadius.circular(16)),
                child: const Text('B', style: TextStyle(color: Colors.white, fontSize: 34, fontWeight: FontWeight.w900)),
              ),
              const SizedBox(height: 20),
              Text(l10n.companyName, textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
              const SizedBox(height: 8),
              Text(l10n.systemName, textAlign: TextAlign.center),
              const SizedBox(height: 28),
              if (auth.status == AuthStatus.error)
                AppButton(label: l10n.retry, onPressed: () => ref.read(authControllerProvider.notifier).restoreSession())
              else
                LoadingView(message: l10n.splashLoading),
            ],
          ),
        ),
      ),
    );
  }
}
