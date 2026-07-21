import 'package:flutter/material.dart';
import 'package:bayad_customer_app/l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/routing/route_names.dart';
import '../../../core/storage/preferences_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_text_field.dart';
import '../domain/auth_state.dart';
import 'auth_controller.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  String? _emailError;
  String? _passwordError;
  bool _showPassword = false;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  bool _validate(AppLocalizations l10n) {
    final email = _emailController.text.trim();
    setState(() {
      _emailError = null;
      _passwordError = null;
      if (email.isEmpty) {
        _emailError = l10n.emptyEmail;
      } else if (!RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(email)) {
        _emailError = l10n.invalidEmail;
      }
      if (_passwordController.text.trim().isEmpty) _passwordError = l10n.emptyPassword;
    });
    return _emailError == null && _passwordError == null;
  }

  Future<void> _submit(AppLocalizations l10n) async {
    if (!_validate(l10n)) return;
    final ok = await ref.read(authControllerProvider.notifier).login(
          email: _emailController.text.trim(),
          password: _passwordController.text,
        );
    if (ok && mounted) context.goNamed(RouteNames.home);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final auth = ref.watch(authControllerProvider);
    final isLoading = auth.status == AuthStatus.loading;
    return Scaffold(
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            return SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: ConstrainedBox(
                constraints: BoxConstraints(minHeight: constraints.maxHeight - 40),
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 440),
                    child: Card(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Align(
                              alignment: AlignmentDirectional.centerEnd,
                              child: TextButton(
                                onPressed: () => ref.read(localeControllerProvider.notifier).toggle(),
                                child: Text(l10n.language),
                              ),
                            ),
                            Row(
                              children: [
                                Container(
                                  width: 56,
                                  height: 56,
                                  alignment: Alignment.center,
                                  decoration: BoxDecoration(color: AppColors.green, borderRadius: BorderRadius.circular(12)),
                                  child: const Text('B', style: TextStyle(color: Colors.white, fontSize: 26, fontWeight: FontWeight.w900)),
                                ),
                                const SizedBox(width: 14),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(l10n.companyName, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                                      const SizedBox(height: 4),
                                      Text(l10n.systemName, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.mutedText)),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 24),
                            Text(l10n.loginTitle, style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900)),
                            const SizedBox(height: 8),
                            Text(l10n.loginSubtitle, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.mutedText)),
                            if (auth.message != null && auth.message!.isNotEmpty) ...[
                              const SizedBox(height: 16),
                              DecoratedBox(
                                decoration: BoxDecoration(
                                  color: AppColors.danger.withValues(alpha: 0.09),
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(color: AppColors.danger.withValues(alpha: 0.28)),
                                ),
                                child: Padding(
                                  padding: const EdgeInsets.all(12),
                                  child: Text(auth.message!, style: const TextStyle(color: AppColors.danger)),
                                ),
                              ),
                            ],
                            const SizedBox(height: 22),
                            AppTextField(
                              controller: _emailController,
                              label: l10n.emailAddress,
                              hint: l10n.enterEmail,
                              errorText: _emailError,
                              keyboardType: TextInputType.emailAddress,
                              textInputAction: TextInputAction.next,
                              enabled: !isLoading,
                            ),
                            const SizedBox(height: 16),
                            AppTextField(
                              controller: _passwordController,
                              label: l10n.password,
                              hint: l10n.enterPassword,
                              errorText: _passwordError,
                              obscureText: !_showPassword,
                              enabled: !isLoading,
                              textInputAction: TextInputAction.done,
                              onSubmitted: (_) => _submit(l10n),
                              suffixIcon: IconButton(
                                tooltip: _showPassword ? l10n.hidePassword : l10n.showPassword,
                                onPressed: isLoading ? null : () => setState(() => _showPassword = !_showPassword),
                                icon: Icon(_showPassword ? Icons.visibility_off_outlined : Icons.visibility_outlined),
                              ),
                            ),
                            const SizedBox(height: 24),
                            AppButton(label: isLoading ? l10n.signingIn : l10n.login, isLoading: isLoading, onPressed: () => _submit(l10n)),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}
