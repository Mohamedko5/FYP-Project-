import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/routing/route_names.dart';
import '../../core/theme/app_colors.dart';
import 'customer_widgets.dart';

class AppScaffold extends StatelessWidget {
  const AppScaffold({
    super.key,
    required this.title,
    required this.child,
    this.actions,
    this.currentIndex,
  });

  final String title;
  final Widget child;
  final List<Widget>? actions;
  final int? currentIndex;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      extendBody: currentIndex != null,
      appBar: AppBar(
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w900)),
        actions: actions,
      ),
      body: SafeArea(bottom: currentIndex == null, child: child),
      bottomNavigationBar: currentIndex == null
          ? null
          : SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(14, 0, 14, 10),
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: AppColors.surface.withValues(alpha: 0.97),
                    borderRadius: BorderRadius.circular(26),
                    border: Border.all(
                      color: AppColors.border.withValues(alpha: 0.55),
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.shadow.withValues(alpha: 0.18),
                        blurRadius: 28,
                        offset: const Offset(0, 14),
                      ),
                    ],
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(26),
                    child: BayadBottomNavigation(
                      currentIndex: currentIndex!,
                      onTap: (index) {
                        final route = switch (index) {
                          0 => RouteNames.home,
                          1 => RouteNames.products,
                          2 => RouteNames.chat,
                          3 => RouteNames.orders,
                          _ => RouteNames.profile,
                        };
                        context.goNamed(route);
                      },
                    ),
                  ),
                ),
              ),
            ),
    );
  }
}
