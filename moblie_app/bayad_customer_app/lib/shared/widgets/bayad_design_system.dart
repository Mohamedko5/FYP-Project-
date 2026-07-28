import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';

class BayadRadii {
  static const small = 12.0;
  static const control = 16.0;
  static const card = 20.0;
  static const banner = 26.0;
}

class BayadShadows {
  static List<BoxShadow> soft = [
    BoxShadow(
      color: AppColors.shadow.withValues(alpha: 0.12),
      blurRadius: 22,
      offset: const Offset(0, 10),
    ),
  ];

  static List<BoxShadow> floating = [
    BoxShadow(
      color: AppColors.shadow.withValues(alpha: 0.18),
      blurRadius: 30,
      offset: const Offset(0, 16),
    ),
  ];
}

class BayadCard extends StatelessWidget {
  const BayadCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.onTap,
    this.radius = BayadRadii.card,
    this.color = AppColors.surface,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;
  final double radius;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final content = AnimatedScale(
      duration: const Duration(milliseconds: 120),
      scale: 1,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(radius),
          border: Border.all(color: AppColors.border.withValues(alpha: 0.5)),
          boxShadow: BayadShadows.soft,
        ),
        child: Padding(padding: padding, child: child),
      ),
    );
    if (onTap == null) return content;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(radius),
        child: content,
      ),
    );
  }
}

class BayadSearchField extends StatelessWidget {
  const BayadSearchField({
    super.key,
    required this.hintText,
    this.onChanged,
    this.onTap,
    this.readOnly = false,
  });

  final String hintText;
  final ValueChanged<String>? onChanged;
  final VoidCallback? onTap;
  final bool readOnly;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppColors.elevatedSurface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.border.withValues(alpha: 0.55)),
        boxShadow: BayadShadows.soft,
      ),
      child: TextField(
        readOnly: readOnly,
        onTap: onTap,
        onChanged: onChanged,
        decoration: InputDecoration(
          hintText: hintText,
          prefixIcon: const Icon(Icons.search, color: AppColors.green),
          border: InputBorder.none,
          enabledBorder: InputBorder.none,
          focusedBorder: InputBorder.none,
          filled: false,
          contentPadding: const EdgeInsets.symmetric(vertical: 17),
        ),
      ),
    );
  }
}

class BayadSectionHeader extends StatelessWidget {
  const BayadSectionHeader({
    super.key,
    required this.title,
    this.actionLabel,
    this.onAction,
  });

  final String title;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Expanded(
            child: Text(
              title,
              style: Theme.of(
                context,
              ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
            ),
          ),
          if (actionLabel != null)
            TextButton(onPressed: onAction, child: Text(actionLabel!)),
        ],
      ),
    );
  }
}

class BayadIconTile extends StatelessWidget {
  const BayadIconTile({
    super.key,
    required this.icon,
    required this.label,
    this.value,
    this.onTap,
    this.badgeCount = 0,
  });

  final IconData icon;
  final String label;
  final String? value;
  final VoidCallback? onTap;
  final int badgeCount;

  @override
  Widget build(BuildContext context) {
    final iconWidget = Container(
      width: 42,
      height: 42,
      decoration: BoxDecoration(
        color: AppColors.primarySoft,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Icon(icon, color: AppColors.green, size: 22),
    );
    return BayadCard(
      onTap: onTap,
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          badgeCount > 0
              ? Badge.count(count: badgeCount, child: iconWidget)
              : iconWidget,
          const Spacer(),
          if (value != null)
            Text(
              value!,
              style: Theme.of(
                context,
              ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
            ),
          Text(
            label,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontWeight: FontWeight.w900),
          ),
        ],
      ),
    );
  }
}

class BayadPromoBanner extends StatelessWidget {
  const BayadPromoBanner({
    super.key,
    required this.title,
    required this.subtitle,
    required this.actionLabel,
    required this.onAction,
  });

  final String title;
  final String subtitle;
  final String actionLabel;
  final VoidCallback onAction;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onAction,
        borderRadius: BorderRadius.circular(BayadRadii.banner),
        child: DecoratedBox(
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [AppColors.green, AppColors.deepGreen],
            ),
            borderRadius: BorderRadius.circular(BayadRadii.banner),
            boxShadow: BayadShadows.floating,
          ),
          child: Stack(
            children: [
              PositionedDirectional(
                top: -36,
                end: -24,
                child: Transform.rotate(
                  angle: -math.pi / 10,
                  child: Icon(
                    Icons.agriculture_outlined,
                    size: 148,
                    color: Colors.white.withValues(alpha: 0.12),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: Theme.of(context).textTheme.headlineSmall
                          ?.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.w900,
                            height: 1.1,
                          ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      subtitle,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: Colors.white.withValues(alpha: 0.86),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 16),
                    FilledButton(
                      onPressed: onAction,
                      style: FilledButton.styleFrom(
                        backgroundColor: Colors.white,
                        foregroundColor: AppColors.green,
                        minimumSize: const Size(0, 42),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                      child: Text(actionLabel),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class BayadStatusChip extends StatelessWidget {
  const BayadStatusChip({super.key, required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 180),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        border: Border.all(color: color.withValues(alpha: 0.3)),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 12,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }
}
