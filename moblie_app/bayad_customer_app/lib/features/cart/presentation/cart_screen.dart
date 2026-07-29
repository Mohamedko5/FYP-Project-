import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/routing/route_names.dart';
import '../../../shared/widgets/app_scaffold.dart';
import '../../../shared/widgets/customer_widgets.dart';
import '../../../shared/widgets/empty_view.dart';
import 'cart_controller.dart';

class CartScreen extends ConsumerWidget {
  const CartScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cart = ref.watch(cartControllerProvider);
    return AppScaffold(
      title: 'Cart',
      currentIndex: 1,
      child: cart.isEmpty
          ? const EmptyView(message: 'Your cart is empty.')
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                for (final item in cart.items)
                  Card(
                    child: ListTile(
                      title: Text(item.product.nameEn, style: const TextStyle(fontWeight: FontWeight.w900)),
                      subtitle: Text('${formatQuantity(item.quantity, item.unit.unit)} • ${formatMoney(item.lineTotal)}'),
                      trailing: IconButton(icon: const Icon(Icons.delete_outline), onPressed: () => ref.read(cartControllerProvider.notifier).remove(item.key)),
                    ),
                  ),
                const SizedBox(height: 12),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Row(children: [const Expanded(child: Text('Subtotal')), PriceText(value: cart.subtotal)]),
                  ),
                ),
                const SizedBox(height: 16),
                FilledButton(onPressed: () => context.pushNamed(RouteNames.checkout), child: const Text('Proceed to Checkout')),
              ],
            ),
    );
  }
}
