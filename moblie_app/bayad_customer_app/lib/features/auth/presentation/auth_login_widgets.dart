import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';

class LoginBackground extends StatelessWidget {
  const LoginBackground({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFFF8F3EA), Color(0xFFF0E8DC)],
        ),
      ),
      child: Stack(
        children: [
          PositionedDirectional(
            top: -78,
            end: -72,
            child: _SoftPanel(width: 230, height: 230, color: AppColors.green.withValues(alpha: 0.12)),
          ),
          PositionedDirectional(
            top: 142,
            start: -96,
            child: _SoftPanel(width: 210, height: 310, color: AppColors.mediumGreen.withValues(alpha: 0.09)),
          ),
          PositionedDirectional(
            bottom: -120,
            end: -34,
            child: _SoftPanel(width: 300, height: 260, color: const Color(0xFFD6C8AF).withValues(alpha: 0.25)),
          ),
          const PositionedDirectional(
            top: 78,
            start: 22,
            end: 22,
            child: _FieldLines(),
          ),
          child,
        ],
      ),
    );
  }
}

class AppLogoHeader extends StatelessWidget {
  const AppLogoHeader({
    super.key,
    required this.companyName,
    required this.systemName,
    required this.language,
    required this.onLanguagePressed,
  });

  final String companyName;
  final String systemName;
  final String language;
  final VoidCallback onLanguagePressed;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const BayadMark(size: 56),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                companyName,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      color: AppColors.text,
                      fontWeight: FontWeight.w900,
                      height: 1.1,
                    ),
              ),
              const SizedBox(height: 5),
              Text(
                systemName,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: AppColors.mutedText,
                      fontWeight: FontWeight.w600,
                      height: 1.25,
                    ),
              ),
            ],
          ),
        ),
        const SizedBox(width: 10),
        LanguagePill(label: language, onPressed: onLanguagePressed),
      ],
    );
  }
}

class BayadMark extends StatelessWidget {
  const BayadMark({super.key, this.size = 52});

  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: AppColors.green,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: AppColors.green.withValues(alpha: 0.28),
            blurRadius: 18,
            offset: const Offset(0, 9),
          ),
        ],
      ),
      child: Text(
        'B',
        style: TextStyle(
          color: Colors.white,
          fontSize: size * 0.43,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }
}

class LanguagePill extends StatelessWidget {
  const LanguagePill({super.key, required this.label, required this.onPressed});

  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      child: Material(
        color: Colors.white.withValues(alpha: 0.82),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(999),
          side: BorderSide(color: AppColors.border.withValues(alpha: 0.9)),
        ),
        child: InkWell(
          onTap: onPressed,
          borderRadius: BorderRadius.circular(999),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 9),
            child: Text(
              label,
              style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    color: AppColors.deepGreen,
                    fontWeight: FontWeight.w800,
                  ),
            ),
          ),
        ),
      ),
    );
  }
}

class LoginCard extends StatelessWidget {
  const LoginCard({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.94),
        borderRadius: BorderRadius.circular(26),
        border: Border.all(color: Colors.white.withValues(alpha: 0.75)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF2C3326).withValues(alpha: 0.12),
            blurRadius: 32,
            offset: const Offset(0, 18),
          ),
          BoxShadow(
            color: Colors.white.withValues(alpha: 0.75),
            blurRadius: 0,
            spreadRadius: 1,
          ),
        ],
      ),
      child: child,
    );
  }
}

class LoginTextField extends StatelessWidget {
  const LoginTextField({
    super.key,
    required this.controller,
    required this.label,
    required this.hint,
    this.errorText,
    this.keyboardType,
    this.textInputAction,
    this.obscureText = false,
    this.enabled = true,
    this.suffixIcon,
    this.onSubmitted,
    this.textDirection,
  });

  final TextEditingController controller;
  final String label;
  final String hint;
  final String? errorText;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final bool obscureText;
  final bool enabled;
  final Widget? suffixIcon;
  final ValueChanged<String>? onSubmitted;
  final TextDirection? textDirection;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      keyboardType: keyboardType,
      textInputAction: textInputAction,
      obscureText: obscureText,
      enabled: enabled,
      onSubmitted: onSubmitted,
      textDirection: textDirection,
      style: Theme.of(context).textTheme.bodyLarge?.copyWith(
            color: AppColors.text,
            fontWeight: FontWeight.w700,
          ),
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        errorText: errorText,
        suffixIcon: suffixIcon == null
            ? null
            : Padding(
                padding: const EdgeInsetsDirectional.only(end: 6),
                child: suffixIcon,
              ),
        filled: true,
        fillColor: enabled ? const Color(0xFFFBFAF6) : const Color(0xFFF0EEE8),
        contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 19),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(16)),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: Color(0xFFE0D8CA)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: AppColors.green, width: 1.8),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: AppColors.danger, width: 1.2),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: AppColors.danger, width: 1.8),
        ),
      ),
    );
  }
}

class LoginPrimaryButton extends StatelessWidget {
  const LoginPrimaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.isLoading = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool isLoading;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          if (!isLoading && onPressed != null)
            BoxShadow(
              color: AppColors.green.withValues(alpha: 0.28),
              blurRadius: 20,
              offset: const Offset(0, 10),
            ),
        ],
      ),
      child: FilledButton(
        onPressed: isLoading ? null : onPressed,
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(56),
          backgroundColor: AppColors.green,
          disabledBackgroundColor: AppColors.green.withValues(alpha: 0.54),
          foregroundColor: Colors.white,
          disabledForegroundColor: Colors.white.withValues(alpha: 0.88),
          textStyle: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w900),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        ),
        child: AnimatedSwitcher(
          duration: const Duration(milliseconds: 180),
          child: isLoading
              ? const SizedBox(
                  key: ValueKey('loading'),
                  width: 22,
                  height: 22,
                  child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white),
                )
              : Text(label, key: const ValueKey('label')),
        ),
      ),
    );
  }
}

class AuthErrorBanner extends StatelessWidget {
  const AuthErrorBanner({super.key, required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppColors.danger.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.danger.withValues(alpha: 0.22)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(13),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.info_outline, color: AppColors.danger, size: 20),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                message,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: AppColors.danger,
                      fontWeight: FontWeight.w700,
                    ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SoftPanel extends StatelessWidget {
  const _SoftPanel({required this.width, required this.height, required this.color});

  final double width;
  final double height;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Transform.rotate(
      angle: -0.18,
      child: Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(46),
        ),
      ),
    );
  }
}

class _FieldLines extends StatelessWidget {
  const _FieldLines();

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Opacity(
        opacity: 0.34,
        child: Column(
          children: List.generate(
            4,
            (index) => Padding(
              padding: const EdgeInsets.only(bottom: 22),
              child: Container(
                height: 1,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      Colors.transparent,
                      AppColors.green.withValues(alpha: 0.16),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
