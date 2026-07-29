import 'package:flutter/material.dart';
import 'package:bayad_customer_app/l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/routing/route_names.dart';
import '../../../core/storage/preferences_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../domain/auth_state.dart';
import 'auth_login_widgets.dart';
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
      if (_passwordController.text.trim().isEmpty) {
        _passwordError = l10n.emptyPassword;
      }
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
      body: LoginBackground(
        child: SafeArea(
          child: LayoutBuilder(
            builder: (context, constraints) {
              final isShort = constraints.maxHeight < 680;
              return SingleChildScrollView(
                keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                padding: EdgeInsets.fromLTRB(20, isShort ? 18 : 28, 20, 22),
                child: ConstrainedBox(
                  constraints: BoxConstraints(minHeight: constraints.maxHeight - (isShort ? 40 : 56)),
                  child: Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 460),
                      child: TweenAnimationBuilder<double>(
                        tween: Tween(begin: 0, end: 1),
                        duration: const Duration(milliseconds: 420),
                        curve: Curves.easeOutCubic,
                        builder: (context, value, child) {
                          return Opacity(
                            opacity: value,
                            child: Transform.translate(
                              offset: Offset(0, 18 * (1 - value)),
                              child: child,
                            ),
                          );
                        },
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            AppLogoHeader(
                              companyName: l10n.companyName,
                              systemName: l10n.systemName,
                              language: l10n.language,
                              onLanguagePressed: () => ref.read(localeControllerProvider.notifier).toggle(),
                            ),
                            SizedBox(height: isShort ? 22 : 34),
                            LoginCard(
                              child: Padding(
                                padding: EdgeInsets.fromLTRB(24, isShort ? 24 : 28, 24, 24),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.stretch,
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Text(
                                      l10n.appTitle.toUpperCase(),
                                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                                            color: AppColors.green,
                                            fontWeight: FontWeight.w900,
                                            letterSpacing: 0.7,
                                          ),
                                    ),
                                    const SizedBox(height: 8),
                                    Text(
                                      l10n.loginTitle,
                                      style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                                            color: AppColors.text,
                                            fontWeight: FontWeight.w900,
                                            height: 1.05,
                                          ),
                                    ),
                                    const SizedBox(height: 10),
                                    Text(
                                      l10n.loginSubtitle,
                                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                            color: AppColors.mutedText,
                                            fontWeight: FontWeight.w600,
                                            height: 1.45,
                                          ),
                                    ),
                                    if (auth.message != null && auth.message!.isNotEmpty) ...[
                                      const SizedBox(height: 18),
                                      AuthErrorBanner(message: auth.message!),
                                    ],
                                    SizedBox(height: isShort ? 22 : 28),
                                    LoginTextField(
                                      controller: _emailController,
                                      label: l10n.emailAddress,
                                      hint: l10n.enterEmail,
                                      errorText: _emailError,
                                      keyboardType: TextInputType.emailAddress,
                                      textInputAction: TextInputAction.next,
                                      enabled: !isLoading,
                                      textDirection: TextDirection.ltr,
                                    ),
                                    const SizedBox(height: 16),
                                    LoginTextField(
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
                                    const SizedBox(height: 6),
                                    Align(
                                      alignment: AlignmentDirectional.centerEnd,
                                      child: TextButton(
                                        onPressed: isLoading ? null : () => context.pushNamed(RouteNames.forgotPassword),
                                        style: TextButton.styleFrom(
                                          foregroundColor: AppColors.green,
                                          textStyle: Theme.of(context).textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w900),
                                        ),
                                        child: Text(l10n.forgotPassword),
                                      ),
                                    ),
                                    const SizedBox(height: 16),
                                    LoginPrimaryButton(label: isLoading ? l10n.signingIn : l10n.login, isLoading: isLoading, onPressed: () => _submit(l10n)),
                                  ],
                                ),
                              ),
                            ),
                            const SizedBox(height: 18),
                            DecoratedBox(
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.68),
                                borderRadius: BorderRadius.circular(18),
                                border: Border.all(color: Colors.white.withValues(alpha: 0.7)),
                              ),
                              child: Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                                child: Wrap(
                                  alignment: WrapAlignment.center,
                                  crossAxisAlignment: WrapCrossAlignment.center,
                                  children: [
                                    Text(
                                      l10n.newToBayad,
                                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                            color: AppColors.deepGreen,
                                            fontWeight: FontWeight.w700,
                                          ),
                                    ),
                                    TextButton(
                                      onPressed: isLoading ? null : () => context.pushNamed(RouteNames.register),
                                      style: TextButton.styleFrom(
                                        foregroundColor: AppColors.green,
                                        textStyle: Theme.of(context).textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w900),
                                      ),
                                      child: Text(l10n.createAccount),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}
