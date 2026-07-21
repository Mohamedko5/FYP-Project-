import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/routing/route_names.dart';
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
      appBar: AppBar(title: Text(title), actions: actions),
      body: SafeArea(child: child),
      bottomNavigationBar: currentIndex == null
          ? null
          : BayadBottomNavigation(
              currentIndex: currentIndex!,
              onTap: (index) {
                final route = switch (index) {
                  0 => RouteNames.home,
                  1 => RouteNames.products,
                  2 => RouteNames.orders,
                  _ => RouteNames.profile,
                };
                context.goNamed(route);
              },
            ),
    );
  }
}
