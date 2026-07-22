import 'package:flutter/material.dart';
import 'package:bayad_customer_app/l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/routing/route_names.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/app_colors.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_text_field.dart';
import 'account_flow_controller.dart';

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});
  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final fullName = TextEditingController();
  final businessName = TextEditingController();
  final email = TextEditingController();
  final phone = TextEditingController();
  final secondaryPhone = TextEditingController();
  final address = TextEditingController();
  final password = TextEditingController();
  final confirmPassword = TextEditingController();
  String customerType = 'exporter';
  bool acceptTerms = false;
  bool showPassword = false;
  String? error;

  @override
  void dispose() {
    for (final controller in [fullName, businessName, email, phone, secondaryPhone, address, password, confirmPassword]) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> submit() async {
    final l10n = AppLocalizations.of(context);
    setState(() => error = null);
    if (fullName.text.trim().isEmpty || email.text.trim().isEmpty || phone.text.trim().isEmpty || address.text.trim().isEmpty) {
      setState(() => error = l10n.completeRequiredFields);
      return;
    }
    if (password.text != confirmPassword.text) {
      setState(() => error = l10n.passwordsDoNotMatch);
      return;
    }
    final ok = await ref.read(accountFlowControllerProvider.notifier).register({
      'full_name': fullName.text.trim(),
      'business_name': businessName.text.trim(),
      'email': email.text.trim(),
      'phone': phone.text.trim(),
      'secondary_phone': secondaryPhone.text.trim(),
      'address': address.text.trim(),
      'customer_type': customerType,
      'password': password.text,
      'confirm_password': confirmPassword.text,
      'accept_terms': acceptTerms,
    });
    if (ok && mounted) context.goNamed(RouteNames.verifyEmail);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final state = ref.watch(accountFlowControllerProvider);
    return AuthFlowScaffold(
      title: l10n.registerTitle,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _SectionTitle(l10n.personalInformation),
          AppTextField(controller: fullName, label: l10n.fullName, hint: l10n.fullNameHint),
          const SizedBox(height: 12),
          AppTextField(controller: businessName, label: l10n.businessName, hint: l10n.optional),
          const SizedBox(height: 18),
          _SectionTitle(l10n.contactInformation),
          AppTextField(controller: email, label: l10n.emailAddress, hint: 'email@example.com', keyboardType: TextInputType.emailAddress),
          const SizedBox(height: 12),
          AppTextField(controller: phone, label: l10n.phoneNumber, hint: l10n.phoneHint, keyboardType: TextInputType.phone),
          const SizedBox(height: 12),
          AppTextField(controller: secondaryPhone, label: l10n.secondaryPhone, hint: l10n.optional, keyboardType: TextInputType.phone),
          const SizedBox(height: 12),
          AppTextField(controller: address, label: l10n.address, hint: l10n.addressHint),
          const SizedBox(height: 18),
          _SectionTitle(l10n.businessInformation),
          DropdownButtonFormField<String>(
            initialValue: customerType,
            decoration: InputDecoration(labelText: l10n.customerType),
            items: [
              DropdownMenuItem(value: 'farmer', child: Text(l10n.farmer)),
              DropdownMenuItem(value: 'investor', child: Text(l10n.investor)),
              DropdownMenuItem(value: 'consumer', child: Text(l10n.consumer)),
              DropdownMenuItem(value: 'exporter', child: Text(l10n.exporter)),
              DropdownMenuItem(value: 'factory', child: Text(l10n.factory)),
              DropdownMenuItem(value: 'supplier', child: Text(l10n.supplier)),
            ],
            onChanged: (value) => setState(() => customerType = value ?? 'exporter'),
          ),
          const SizedBox(height: 18),
          _SectionTitle(l10n.accountSecurity),
          AppTextField(controller: password, label: l10n.password, hint: 'StrongPassword123!', obscureText: !showPassword),
          const SizedBox(height: 12),
          AppTextField(controller: confirmPassword, label: l10n.confirmPassword, hint: l10n.repeatPassword, obscureText: !showPassword),
          CheckboxListTile(value: showPassword, onChanged: (value) => setState(() => showPassword = value ?? false), title: Text(l10n.showPassword)),
          CheckboxListTile(value: acceptTerms, onChanged: (value) => setState(() => acceptTerms = value ?? false), title: Text(l10n.acceptTerms)),
          Text(l10n.passwordRequirements, style: const TextStyle(color: AppColors.mutedText)),
          if (error != null || state.error != null) ...[
            const SizedBox(height: 12),
            Text(error ?? state.error!, style: const TextStyle(color: AppColors.danger)),
          ],
          const SizedBox(height: 18),
          AppButton(label: state.isLoading ? l10n.submitting : l10n.createAccount, isLoading: state.isLoading, onPressed: submit),
          TextButton(onPressed: () => context.goNamed(RouteNames.login), child: Text(l10n.backToLogin)),
        ],
      ),
    );
  }
}

class VerifyEmailScreen extends ConsumerStatefulWidget {
  const VerifyEmailScreen({super.key});
  @override
  ConsumerState<VerifyEmailScreen> createState() => _VerifyEmailScreenState();
}

class _VerifyEmailScreenState extends ConsumerState<VerifyEmailScreen> {
  final code = TextEditingController();
  String? error;
  @override
  void dispose() {
    code.dispose();
    super.dispose();
  }
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final state = ref.watch(accountFlowControllerProvider);
    return AuthFlowScaffold(
      title: l10n.emailVerification,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text(l10n.verificationInstruction(state.emailMasked.isEmpty ? state.email : state.emailMasked)),
        const SizedBox(height: 16),
        AppTextField(controller: code, label: l10n.verificationCode, hint: '123456', keyboardType: TextInputType.number),
        if (error != null || state.error != null) ...[const SizedBox(height: 12), Text(error ?? state.error!, style: const TextStyle(color: AppColors.danger))],
        const SizedBox(height: 16),
        AppButton(
          label: state.isLoading ? l10n.verifying : l10n.verifyEmail,
          isLoading: state.isLoading,
          onPressed: () async {
            if (!RegExp(r'^\d{6}$').hasMatch(code.text.trim())) {
              setState(() => error = l10n.enterSixDigitCode);
              return;
            }
            final ok = await ref.read(accountFlowControllerProvider.notifier).verifyEmail(code.text.trim());
            if (ok && context.mounted) context.goNamed(RouteNames.pendingApproval);
          },
        ),
        TextButton(onPressed: state.isLoading ? null : () => ref.read(accountFlowControllerProvider.notifier).resendVerification(), child: Text(l10n.resendCode)),
      ]),
    );
  }
}

class PendingApprovalScreen extends ConsumerWidget {
  const PendingApprovalScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final state = ref.watch(accountFlowControllerProvider);
    return AuthFlowScaffold(
      title: l10n.pendingAdminApproval,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        const Icon(Icons.hourglass_top, size: 58, color: AppColors.green),
        const SizedBox(height: 16),
        Text(l10n.pendingApprovalMessage, textAlign: TextAlign.center),
        const SizedBox(height: 16),
        if (state.message != null) Text(state.message!, textAlign: TextAlign.center),
        AppButton(label: state.isLoading ? l10n.checking : l10n.checkStatus, isLoading: state.isLoading, onPressed: () => ref.read(accountFlowControllerProvider.notifier).checkStatus()),
        TextButton(onPressed: () => context.goNamed(RouteNames.login), child: Text(l10n.backToLogin)),
      ]),
    );
  }
}

class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key});
  @override
  ConsumerState<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  final email = TextEditingController();
  @override
  void dispose() {
    email.dispose();
    super.dispose();
  }
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final state = ref.watch(accountFlowControllerProvider);
    return AuthFlowScaffold(
      title: l10n.forgotPassword,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text(l10n.forgotPasswordInstruction),
        const SizedBox(height: 16),
        AppTextField(controller: email, label: l10n.emailAddress, hint: 'customer@example.com', keyboardType: TextInputType.emailAddress),
        if (state.error != null) ...[const SizedBox(height: 12), Text(state.error!, style: const TextStyle(color: AppColors.danger))],
        const SizedBox(height: 16),
        AppButton(
          label: state.isLoading ? l10n.sending : l10n.sendResetCode,
          isLoading: state.isLoading,
          onPressed: () async {
            final ok = await ref.read(accountFlowControllerProvider.notifier).forgotPassword(email.text.trim());
            if (ok && context.mounted) context.goNamed(RouteNames.verifyResetCode);
          },
        ),
      ]),
    );
  }
}

class VerifyResetCodeScreen extends ConsumerStatefulWidget {
  const VerifyResetCodeScreen({super.key});
  @override
  ConsumerState<VerifyResetCodeScreen> createState() => _VerifyResetCodeScreenState();
}

class _VerifyResetCodeScreenState extends ConsumerState<VerifyResetCodeScreen> {
  final code = TextEditingController();
  @override
  void dispose() {
    code.dispose();
    super.dispose();
  }
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final state = ref.watch(accountFlowControllerProvider);
    return AuthFlowScaffold(
      title: l10n.resetCode,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text(l10n.resetCodeInstruction(state.email)),
        const SizedBox(height: 16),
        AppTextField(controller: code, label: l10n.verificationCode, hint: '123456', keyboardType: TextInputType.number),
        if (state.error != null) ...[const SizedBox(height: 12), Text(state.error!, style: const TextStyle(color: AppColors.danger))],
        const SizedBox(height: 16),
        AppButton(
          label: state.isLoading ? l10n.verifying : l10n.verifyCode,
          isLoading: state.isLoading,
          onPressed: () async {
            if (!RegExp(r'^\d{6}$').hasMatch(code.text.trim())) {
              ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(l10n.enterSixDigitCode)));
              return;
            }
            final ok = await ref.read(accountFlowControllerProvider.notifier).verifyResetCode(code.text.trim());
            if (ok && context.mounted) context.goNamed(RouteNames.resetPassword);
          },
        ),
      ]),
    );
  }
}

class ResetPasswordScreen extends ConsumerStatefulWidget {
  const ResetPasswordScreen({super.key});
  @override
  ConsumerState<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends ConsumerState<ResetPasswordScreen> {
  final password = TextEditingController();
  final confirm = TextEditingController();
  @override
  void dispose() {
    password.dispose();
    confirm.dispose();
    super.dispose();
  }
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final state = ref.watch(accountFlowControllerProvider);
    return AuthFlowScaffold(
      title: l10n.resetPassword,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        AppTextField(controller: password, label: l10n.newPassword, hint: 'NewStrongPassword123!', obscureText: true),
        const SizedBox(height: 12),
        AppTextField(controller: confirm, label: l10n.confirmNewPassword, hint: l10n.repeatNewPassword, obscureText: true),
        const SizedBox(height: 8),
        Text(l10n.newPasswordRequirements, style: const TextStyle(color: AppColors.mutedText)),
        if (state.error != null) ...[const SizedBox(height: 12), Text(state.error!, style: const TextStyle(color: AppColors.danger))],
        const SizedBox(height: 16),
        AppButton(
          label: state.isLoading ? l10n.saving : l10n.resetPassword,
          isLoading: state.isLoading,
          onPressed: () async {
            final ok = await ref.read(accountFlowControllerProvider.notifier).resetPassword(password.text, confirm.text);
            if (ok && context.mounted) {
              await ref.read(secureStorageProvider).clearTokens();
              if (context.mounted) context.goNamed(RouteNames.login);
            }
          },
        ),
      ]),
    );
  }
}

class AuthFlowScaffold extends StatelessWidget {
  const AuthFlowScaffold({super.key, required this.title, required this.child});
  final String title;
  final Widget child;
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 460),
              child: Card(
                child: Padding(
                  padding: const EdgeInsets.all(22),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    Row(children: [
                      Container(width: 44, height: 44, alignment: Alignment.center, decoration: BoxDecoration(color: AppColors.green, borderRadius: BorderRadius.circular(10)), child: const Text('B', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900))),
                      const SizedBox(width: 12),
                      Expanded(child: Text(title, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900))),
                    ]),
                    const SizedBox(height: 20),
                    child,
                  ]),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.text);
  final String text;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Text(text, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900)),
      );
}
